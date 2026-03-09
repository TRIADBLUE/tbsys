import { useState, useEffect, useRef, useCallback } from "react";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useUploadAsset } from "@/hooks/use-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, X, Camera, Paperclip, FileText } from "lucide-react";

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: number;
  defaultTitle?: string;
  defaultDescription?: string;
  sourceLabel?: string;
  sourcePage?: string;
}

export function TaskCreateDialog({
  open,
  onOpenChange,
  defaultProjectId,
  defaultTitle = "",
  defaultDescription = "",
  sourceLabel,
  sourcePage,
}: TaskCreateDialogProps) {
  const createTask = useCreateTask();
  const { data: projectData } = useProjects();
  const projects = projectData?.projects || [];

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>(
    defaultProjectId ? String(defaultProjectId) : "none",
  );
  const [taggedProjects, setTaggedProjects] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<{ file: File; preview?: string }[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAsset = useUploadAsset();

  // Reset form when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setProjectId(defaultProjectId ? String(defaultProjectId) : "none");
      setTaggedProjects(defaultProjectId ? [defaultProjectId] : []);
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      // Clean up old previews
      attachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
      setAttachments([]);
    }
  }, [open, defaultTitle, defaultDescription, defaultProjectId]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newAttachments = Array.from(files).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function captureScreenshot() {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "window" } as any,
      });
      const track = stream.getVideoTracks()[0];
      const canvas = document.createElement("canvas");
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      track.stop();
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png"),
      );
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
      addFiles([file]);
    } catch {
      // User cancelled or browser doesn't support
    } finally {
      setIsCapturing(false);
    }
  }

  function addTaggedProject(id: string) {
    const numId = parseInt(id, 10);
    if (!isNaN(numId) && !taggedProjects.includes(numId)) {
      setTaggedProjects((prev) => [...prev, numId]);
    }
  }

  function removeTaggedProject(id: number) {
    setTaggedProjects((prev) => prev.filter((p) => p !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // Build tags from tagged projects
    const projectTags = taggedProjects
      .map((id) => projects.find((p) => p.id === id)?.slug)
      .filter(Boolean) as string[];

    // Add source page as a tag if available
    if (sourcePage) {
      projectTags.push(`source:${sourcePage}`);
    }

    const primaryProjectId = projectId !== "none" ? parseInt(projectId, 10) : undefined;

    // Build description with source context
    let fullDescription = description.trim();
    if (sourceLabel && fullDescription) {
      fullDescription = `${fullDescription}\n\n---\nSource: ${sourceLabel}`;
    } else if (sourceLabel) {
      fullDescription = `Source: ${sourceLabel}`;
    }

    // Upload attachments first
    const uploadedAssetIds: number[] = [];
    for (const attachment of attachments) {
      try {
        const result = await uploadAsset.mutateAsync({
          file: attachment.file,
          projectId: primaryProjectId,
          category: attachment.file.type.startsWith("image/") ? "screenshot" : "document",
        });
        uploadedAssetIds.push(result.asset.id);
      } catch {
        // Continue even if one upload fails
      }
    }

    // Append attachment references to description
    if (uploadedAssetIds.length > 0) {
      const attachmentNote = `\n\nAttachments: ${uploadedAssetIds.map((id) => `[Asset #${id}]`).join(", ")}`;
      fullDescription = (fullDescription || "") + attachmentNote;
    }

    await createTask.mutateAsync({
      title: title.trim(),
      description: fullDescription || undefined,
      status: status as any,
      priority: priority as any,
      dueDate: dueDate || undefined,
      projectId: primaryProjectId,
      tags: projectTags.length > 0 ? projectTags : undefined,
    });

    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
    setTaggedProjects([]);
    attachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
    setAttachments([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        {/* Source indicator */}
        {sourceLabel && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 -mt-1">
            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Captured from <span className="font-medium text-gray-700">{sourceLabel}</span></span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
              if (items[i].kind === "file") {
                const file = items[i].getAsFile();
                if (file) files.push(file);
              }
            }
            if (files.length > 0) addFiles(files);
          }}
        >
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Primary Project</Label>
            <Select value={projectId} onValueChange={(val) => {
              setProjectId(val);
              if (val !== "none") addTaggedProject(val);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.colorPrimary || "#666" }}
                      />
                      {p.displayName}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Multi-project tagging */}
          <div>
            <Label>Also Related To</Label>
            <Select
              value=""
              onValueChange={addTaggedProject}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tag additional projects..." />
              </SelectTrigger>
              <SelectContent>
                {projects
                  .filter((p) => !taggedProjects.includes(p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.colorPrimary || "#666" }}
                        />
                        {p.displayName}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {taggedProjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {taggedProjects.map((id) => {
                  const project = projects.find((p) => p.id === id);
                  if (!project) return null;
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-xs flex items-center gap-1 pr-1"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: project.colorPrimary || "#666" }}
                      />
                      {project.displayName}
                      <button
                        type="button"
                        onClick={() => removeTaggedProject(id)}
                        className="ml-0.5 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <Label>Attachments</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Add File
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={captureScreenshot}
                disabled={isCapturing}
              >
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                {isCapturing ? "Capturing..." : "Screenshot"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.md"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="relative group border rounded-lg overflow-hidden bg-gray-50"
                  >
                    {a.preview ? (
                      <img
                        src={a.preview}
                        alt={a.file.name}
                        className="w-full h-20 object-cover"
                      />
                    ) : (
                      <div className="w-full h-20 flex flex-col items-center justify-center p-2">
                        <FileText className="h-6 w-6 text-gray-400 mb-1" />
                        <span className="text-[10px] text-gray-500 truncate w-full text-center">
                          {a.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 truncate">
                      {(a.file.size / 1024).toFixed(0)}KB
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending || uploadAsset.isPending}>
              {uploadAsset.isPending ? "Uploading..." : createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

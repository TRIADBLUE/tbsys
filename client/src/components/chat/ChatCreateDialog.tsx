import { useState } from "react";
import { useCreateChatThread, useChatProviders } from "@/hooks/use-chat";
import { useProjects } from "@/hooks/use-projects";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ChatCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatCreateDialog({ open, onOpenChange }: ChatCreateDialogProps) {
  const [, navigate] = useLocation();
  const createThread = useCreateChatThread();
  const { data: providersData } = useChatProviders();
  const { data: projectData } = useProjects();
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("builder");
  const [provider, setProvider] = useState("none");
  const [projectId, setProjectId] = useState("none");

  const enabledProviders = providersData?.providers.filter((p) => p.isEnabled) || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const result = await createThread.mutateAsync({
      title: title.trim(),
      agentRole: role as any,
      providerSlug: provider !== "none" ? provider : undefined,
      projectId: projectId !== "none" ? parseInt(projectId, 10) : undefined,
    });

    setTitle("");
    setProvider("none");
    onOpenChange(false);
    navigate(`/builds`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat Thread</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="chat-title">Title</Label>
            <Input
              id="chat-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title"
              required
              autoFocus
            />
          </div>

          <div>
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projectData?.projects?.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="architect">Architect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto</SelectItem>
                  {enabledProviders.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createThread.isPending}>
              {createThread.isPending ? "Creating..." : "Create Thread"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

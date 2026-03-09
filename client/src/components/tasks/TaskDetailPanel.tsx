import { useState } from "react";
import {
  useTask,
  useUpdateTask,
  useDeleteTask,
  useAddTaskNote,
  useDeleteTaskNote,
} from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Trash2, Send, MessageSquare, Highlighter, Wrench, Cpu } from "lucide-react";
import { useLocation } from "wouter";
import type { Task } from "@shared/types";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

interface TaskDetailPanelProps {
  taskId: number;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const { data, isLoading } = useTask(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addNote = useAddTaskNote();
  const deleteNote = useDeleteTaskNote();
  const [, setLocation] = useLocation();
  const [noteContent, setNoteContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { task, notes, highlights } = data;

  function handleStatusChange(status: string) {
    updateTask.mutate({ id: taskId, data: { status: status as any } });
  }

  function handlePriorityChange(priority: string) {
    updateTask.mutate({ id: taskId, data: { priority: priority as any } });
  }

  function handleTitleSave() {
    if (editTitle.trim() && editTitle !== task.title) {
      updateTask.mutate({ id: taskId, data: { title: editTitle.trim() } });
    }
    setIsEditing(false);
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    await addNote.mutateAsync({ taskId, content: noteContent.trim() });
    setNoteContent("");
  }

  async function handleDelete() {
    await deleteTask.mutateAsync(taskId);
    onClose();
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <span className="text-xs text-gray-400 font-mono">#{task.id}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        {isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
            autoFocus
          />
        ) : (
          <h2
            className="text-lg font-semibold cursor-pointer hover:text-blue-600"
            onClick={() => {
              setEditTitle(task.title);
              setIsEditing(true);
            }}
          >
            {task.title}
          </h2>
        )}

        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Status</label>
            <Select value={task.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs">
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
            <label className="text-xs text-gray-500 mb-1 block">Priority</label>
            <Select value={task.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger className="h-8 text-xs">
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

        {/* Send to AI */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              const params = new URLSearchParams();
              if (task.projectId) params.set("projectId", String(task.projectId));
              params.set("role", "architect");
              params.set("taskId", String(task.id));
              params.set("prompt", `Task #${task.id}: ${task.title}${task.description ? "\n\n" + task.description : ""}`);
              setLocation(`/builds?${params.toString()}`);
              onClose();
            }}
          >
            <Cpu className="h-3.5 w-3.5 mr-1.5" />
            Send to Architect
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              const params = new URLSearchParams();
              if (task.projectId) params.set("projectId", String(task.projectId));
              params.set("role", "builder");
              params.set("taskId", String(task.id));
              params.set("prompt", `Task #${task.id}: ${task.title}${task.description ? "\n\n" + task.description : ""}`);
              setLocation(`/builds?${params.toString()}`);
              onClose();
            }}
          >
            <Wrench className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
            Builder
          </Button>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Description
            </label>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">
              Notes ({notes.length})
            </span>
          </div>

          <div className="space-y-2 mb-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-gray-50 rounded p-2 text-sm group relative"
              >
                <p className="text-gray-700">{note.content}</p>
                <span className="text-xs text-gray-400">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() =>
                    deleteNote.mutate({ taskId, noteId: note.id })
                  }
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note..."
              className="text-sm h-8"
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddNote}
              disabled={addNote.isPending}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Highlighter className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">
                Highlights ({highlights.length})
              </span>
            </div>

            <div className="space-y-2">
              {highlights.map((h) => (
                <div key={h.id} className="bg-yellow-50 border-l-2 border-yellow-300 p-2 rounded-r text-sm">
                  <p className="text-gray-700 italic">
                    "{h.highlightedText}"
                  </p>
                  {h.sourcePath && (
                    <span className="text-xs text-gray-400 font-mono">
                      {h.sourcePath}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-2 border-t text-xs text-gray-400 space-y-1">
          <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(task.updatedAt).toLocaleString()}</p>
          {task.completedAt && (
            <p>Completed: {new Date(task.completedAt).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

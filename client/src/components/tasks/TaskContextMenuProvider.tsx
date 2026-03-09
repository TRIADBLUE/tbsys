import { useState, createContext, useContext, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { ListPlus, Zap, ClipboardCopy } from "lucide-react";

interface TaskContextMenuContextType {
  isEnabled: boolean;
}

const TaskContextMenuContext = createContext<TaskContextMenuContextType>({
  isEnabled: true,
});

export function useTaskContextMenu() {
  return useContext(TaskContextMenuContext);
}

// Map ConsoleBlue routes to project slugs for auto-detection
const ROUTE_TO_PROJECT: Record<string, string> = {
  "/projects": "",
  "/builds": "",
  "/tasks": "",
};

function detectSourceContext(pathname: string, projects: { id: number; slug: string; displayName: string; subdomainUrl: string | null }[]) {
  // Check if we're on a project-specific page (e.g. /projects/3)
  const projectMatch = pathname.match(/^\/projects\/(\d+)/);
  if (projectMatch) {
    const id = parseInt(projectMatch[1], 10);
    const project = projects.find((p) => p.id === id);
    if (project) {
      return {
        projectId: project.id,
        sourcePage: pathname,
        sourceLabel: project.displayName,
      };
    }
  }

  // Otherwise just return the current page
  return {
    projectId: undefined as number | undefined,
    sourcePage: pathname,
    sourceLabel: `console.blue${pathname}`,
  };
}

export function TaskContextMenuProvider({ children }: { children: ReactNode }) {
  const createTask = useCreateTask();
  const { data: projectData } = useProjects();
  const [location] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [sourceInfo, setSourceInfo] = useState<{
    projectId?: number;
    sourcePage: string;
    sourceLabel: string;
  } | null>(null);

  const projects = projectData?.projects || [];

  function getSelectedText(): string {
    const selection = window.getSelection();
    return selection?.toString()?.trim() || "";
  }

  function captureSource() {
    return detectSourceContext(location, projects);
  }

  function handleQuickTask() {
    const text = getSelectedText();
    if (!text) return;
    const source = captureSource();
    createTask.mutate({
      title: text,
      description: `Source: ${source.sourceLabel}`,
      projectId: source.projectId,
    });
  }

  function handleCreateFromSelection() {
    const text = getSelectedText();
    const source = captureSource();
    setSelectedText(text);
    setSourceInfo(source);
    setCreateOpen(true);
  }

  return (
    <TaskContextMenuContext.Provider value={{ isEnabled: true }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="contents">{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleCreateFromSelection}>
            <ListPlus className="h-4 w-4 mr-2" />
            Create Task from Selection
          </ContextMenuItem>
          <ContextMenuItem onClick={handleQuickTask}>
            <Zap className="h-4 w-4 mr-2" />
            Quick Task
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              const text = getSelectedText();
              if (text) navigator.clipboard.writeText(text);
            }}
          >
            <ClipboardCopy className="h-4 w-4 mr-2" />
            Copy
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultTitle={selectedText}
        defaultDescription={selectedText}
        defaultProjectId={sourceInfo?.projectId}
        sourceLabel={sourceInfo?.sourceLabel}
        sourcePage={sourceInfo?.sourcePage}
      />
    </TaskContextMenuContext.Provider>
  );
}

import { useState } from "react";
import { useTasks, useTaskStats } from "@/hooks/use-tasks";
import { TaskKanban } from "@/components/tasks/TaskKanban";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { TaskCreateDialog } from "@/components/tasks/TaskCreateDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, LayoutGrid, List } from "lucide-react";
import type { Task } from "@shared/types";

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Record<string, string | undefined>>(
    {},
  );

  const { data, isLoading } = useTasks({
    projectId: filters.projectId
      ? parseInt(filters.projectId, 10)
      : undefined,
    status: filters.status,
    priority: filters.priority,
    search: filters.search,
    sort: filters.sort,
  });
  const { data: stats } = useTaskStats();

  function handleTaskClick(task: Task) {
    setSelectedTaskId(task.id);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <div className="flex items-center gap-3 mt-1">
            {stats && (
              <>
                <span className="text-sm text-gray-500">
                  {stats.total} total
                </span>
                {stats.overdue > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.overdue} overdue
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-md">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-2.5 py-1.5 ${
                viewMode === "kanban"
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-1.5 ${
                viewMode === "list"
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TaskFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : viewMode === "kanban" ? (
        <TaskKanban tasks={data?.tasks || []} onTaskClick={handleTaskClick} />
      ) : (
        <TaskListView tasks={data?.tasks || []} onTaskClick={handleTaskClick} />
      )}

      {/* Detail Panel */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Create Dialog */}
      <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

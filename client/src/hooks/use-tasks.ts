import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Task,
  TaskListResponse,
  TaskDetailResponse,
  TaskStatsResponse,
  TaskNote,
  TaskHighlight,
} from "@shared/types";
import type { InsertTask, UpdateTask } from "@shared/validators";

export function useTasks(filters?: {
  projectId?: number;
  status?: string;
  priority?: string;
  assignedTo?: number;
  search?: string;
  sort?: string;
}) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () =>
      apiClient.get<TaskListResponse>("/tasks", filters as any),
  });
}

export function useTask(id: number) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: () => apiClient.get<TaskDetailResponse>(`/tasks/${id}`),
    enabled: !!id,
  });
}

export function useTaskStats(projectId?: number) {
  return useQuery({
    queryKey: ["task-stats", projectId],
    queryFn: () =>
      apiClient.get<TaskStatsResponse>(
        "/tasks/stats",
        projectId ? { projectId } : undefined,
      ),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertTask) =>
      apiClient.post<{ task: Task }>("/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTask }) =>
      apiClient.patch<{ task: Task }>(`/tasks/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<{ success: boolean }>(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskIds,
      status,
    }: {
      taskIds: number[];
      status: string;
    }) => apiClient.put<{ success: boolean }>("/tasks/reorder", { taskIds, status }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useAddTaskNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      content,
    }: {
      taskId: number;
      content: string;
    }) => apiClient.post<{ note: TaskNote }>(`/tasks/${taskId}/notes`, { content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.taskId],
      });
    },
  });
}

export function useDeleteTaskNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      noteId,
    }: {
      taskId: number;
      noteId: number;
    }) =>
      apiClient.delete<{ success: boolean }>(
        `/tasks/${taskId}/notes/${noteId}`,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.taskId],
      });
    },
  });
}

export function useAddTaskHighlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: number;
      data: {
        sourceType: string;
        highlightedText: string;
        sourcePath?: string;
        contextSnippet?: string;
      };
    }) =>
      apiClient.post<{ highlight: TaskHighlight }>(
        `/tasks/${taskId}/highlights`,
        data,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.taskId],
      });
    },
  });
}

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { Search } from "lucide-react";

interface TaskFiltersProps {
  filters: {
    projectId?: string;
    status?: string;
    priority?: string;
    search?: string;
    sort?: string;
  };
  onChange: (filters: Record<string, string | undefined>) => void;
}

export function TaskFilters({ filters, onChange }: TaskFiltersProps) {
  const { data: projectData } = useProjects();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tasks..."
          className="pl-9 h-9"
          value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <Select
        value={filters.projectId || "all"}
        onValueChange={(v) =>
          onChange({ ...filters, projectId: v === "all" ? undefined : v })
        }
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="All Projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {projectData?.projects.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority || "all"}
        onValueChange={(v) =>
          onChange({ ...filters, priority: v === "all" ? undefined : v })
        }
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="All Priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.sort || "default"}
        onValueChange={(v) =>
          onChange({ ...filters, sort: v === "default" ? undefined : v })
        }
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          <SelectItem value="due_date">Due Date</SelectItem>
          <SelectItem value="priority">Priority</SelectItem>
          <SelectItem value="created">Newest</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

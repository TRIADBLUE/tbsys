import { useState } from "react";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { useProjects } from "@/hooks/use-projects";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskCreateDialog } from "@/components/tasks/TaskCreateDialog";
import { ChatCreateDialog } from "@/components/chat/ChatCreateDialog";
import { ProjectForm } from "@/components/projects/ProjectForm";
import {
  FolderOpen,
  CheckSquare,
  MessageSquare,
  FileText,
  Plus,
  ArrowRight,
  Clock,
  GitBranch,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4 px-5">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const ACTION_ICONS: Record<string, string> = {
  create: "text-green-600",
  update: "text-blue-600",
  delete: "text-red-600",
  reorder: "text-purple-600",
  sync: "text-yellow-600",
  login: "text-gray-600",
  logout: "text-gray-400",
  settings_change: "text-orange-600",
};

export default function DashboardPage() {
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [chatCreateOpen, setChatCreateOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const { data: stats, isLoading } = useDashboardStats();
  const { data: projectData } = useProjects();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const projects = projectData?.projects?.slice(0, 6) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Projects"
          value={stats?.totalProjects || 0}
          icon={FolderOpen}
          color="bg-blue-500"
        />
        <StatCard
          label="Active Tasks"
          value={stats?.activeTasks || 0}
          icon={CheckSquare}
          color="bg-yellow-500"
        />
        <StatCard
          label="Open Threads"
          value={stats?.openThreads || 0}
          icon={MessageSquare}
          color="bg-purple-500"
        />
        <StatCard
          label="Recent Pushes"
          value={stats?.recentPushes || 0}
          icon={GitBranch}
          color="bg-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Chat */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => setChatCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-xs">New Build</span>
              </Button>
              <Link href="/builds">
                <Button variant="ghost" className="w-full justify-start h-auto py-3">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span className="text-xs">Builds</span>
                </Button>
              </Link>
            </div>

            {/* Tasks */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => setTaskCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-xs">New Task</span>
              </Button>
              <Link href="/tasks">
                <Button variant="ghost" className="w-full justify-start h-auto py-3">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  <span className="text-xs">Tasks</span>
                </Button>
              </Link>
            </div>

            {/* Projects */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => setProjectCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-xs">New Project</span>
              </Button>
              <Link href="/projects">
                <Button variant="ghost" className="w-full justify-start h-auto py-3">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  <span className="text-xs">Projects</span>
                </Button>
              </Link>
            </div>

            {/* Docs */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/docs">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="text-xs">Push Docs</span>
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="ghost" className="w-full justify-start h-auto py-3">
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="text-xs">Docs</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Task Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Tasks by Status</CardTitle>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.tasksByStatus ? (
              <div className="space-y-2">
                {Object.entries(stats.tasksByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">
                      {status.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${
                              stats.activeTasks + (stats.tasksByStatus.done || 0) > 0
                                ? (count / (stats.activeTasks + (stats.tasksByStatus.done || 0))) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                No tasks yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <Link href="/audit">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {stats?.recentActivity?.slice(0, 10).map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <Clock className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${ACTION_ICONS[entry.action] || "text-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 truncate">
                      <span className="font-medium capitalize">
                        {entry.action}
                      </span>{" "}
                      {entry.entityType}
                      {entry.entitySlug && (
                        <span className="text-gray-400">
                          {" "}
                          ({entry.entitySlug})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Cards */}
      {projects.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.slug}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: project.colorPrimary || "#0000FF" }}
                      >
                        {project.iconEmoji ||
                          project.displayName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {project.displayName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {project.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <TaskCreateDialog open={taskCreateOpen} onOpenChange={setTaskCreateOpen} />
      <ChatCreateDialog open={chatCreateOpen} onOpenChange={setChatCreateOpen} />
      <Dialog open={projectCreateOpen} onOpenChange={setProjectCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm onSuccess={() => setProjectCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

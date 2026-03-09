import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectListPage from "@/pages/ProjectListPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import ProjectGitHubPage from "@/pages/ProjectGitHubPage";
import AuditLogPage from "@/pages/AuditLogPage";
import SettingsPage from "@/pages/SettingsPage";
import SharedDocsPage from "@/pages/SharedDocsPage";
import TasksPage from "@/pages/TasksPage";
import ChatPage from "@/pages/ChatPage";
import SitePlannerPage from "@/pages/SitePlannerPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AssetManagerPage from "@/pages/AssetManagerPage";
import LinkMonitorPage from "@/pages/LinkMonitorPage";
import TeamPage from "@/pages/TeamPage";
import { NewProjectDocsAlert } from "@/components/docs/NewProjectDocsAlert";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.user) {
    return <Redirect to="/login" />;
  }

  return (
    <>
      {children}
      <NewProjectDocsAlert />
    </>
  );
}

function ProtectedRoute({
  component: Component,
  withLayout = true,
}: {
  component: React.ComponentType;
  withLayout?: boolean;
}) {
  return (
    <AuthGuard>
      {withLayout ? (
        <AppLayout>
          <Component />
        </AppLayout>
      ) : (
        <Component />
      )}
    </AuthGuard>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/projects">
        <ProtectedRoute component={ProjectListPage} />
      </Route>
      <Route path="/projects/:slug">
        <ProtectedRoute component={ProjectDetailPage} />
      </Route>
      <Route path="/projects/:slug/github">
        <ProtectedRoute component={ProjectGitHubPage} />
      </Route>
      <Route path="/projects/:slug/site-plan">
        <ProtectedRoute component={SitePlannerPage} />
      </Route>
      <Route path="/docs">
        <ProtectedRoute component={SharedDocsPage} />
      </Route>
      <Route path="/tasks">
        <ProtectedRoute component={TasksPage} />
      </Route>
      <Route path="/builds">
        <ProtectedRoute component={ChatPage} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={AnalyticsPage} />
      </Route>
      <Route path="/assets">
        <ProtectedRoute component={AssetManagerPage} />
      </Route>
      <Route path="/link-monitor">
        <ProtectedRoute component={LinkMonitorPage} />
      </Route>
      <Route path="/team">
        <ProtectedRoute component={TeamPage} />
      </Route>
      <Route path="/audit">
        <ProtectedRoute component={AuditLogPage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
            <p className="text-gray-500">Page not found</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

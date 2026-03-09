import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { BRAND_ASSETS } from "@/lib/assets";
import NotificationBell from "@/components/NotificationBell";
import { TaskContextMenuProvider } from "@/components/tasks/TaskContextMenuProvider";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "Tasks", href: "/tasks" },
  { label: "Builds", href: "/builds" },
  { label: "Docs", href: "/docs" },
  { label: "Analytics", href: "/analytics" },
  { label: "Assets", href: "/assets" },
  { label: "Links", href: "/link-monitor" },
  { label: "Team", href: "/team" },
  { label: "Activity", href: "/audit" },
  { label: "Settings", href: "/settings" },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: authData } = useAuth();
  const logout = useLogout();
  const user = authData?.user;

  async function handleLogout() {
    await logout.mutateAsync();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center">
                <img
                  src={BRAND_ASSETS.consoleblue.logoLockup}
                  alt="Console.Blue"
                  className="h-8"
                />
              </Link>

              <nav className="flex items-center gap-0.5 overflow-x-auto">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? location === "/"
                      : location === item.href ||
                        location.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href}>
                      <span
                        className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Notifications + User */}
            <div className="flex items-center gap-3">
              <NotificationBell />

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {user?.displayName?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "?"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with Task Context Menu */}
      <main>
        <TaskContextMenuProvider>{children}</TaskContextMenuProvider>
      </main>
    </div>
  );
}

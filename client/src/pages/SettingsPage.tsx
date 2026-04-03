import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const NOTIFICATION_TYPES = [
  { type: "task_complete", label: "Task completed", description: "When a task you created is marked complete" },
  { type: "agent_response", label: "Agent response", description: "When a Replit agent replies to your chat" },
  { type: "sync_failure", label: "Sync failure", description: "When GitHub sync fails for a project" },
  { type: "deploy_complete", label: "Deploy complete", description: "When a project deployment finishes" },
  { type: "mention", label: "Mentions", description: "When you are mentioned in a comment or task" },
];

export default function SettingsPage() {
  const { data: authData } = useAuth();
  const user = authData?.user;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground mb-6">
          Manage your account and notification preferences
        </p>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileSection user={user} />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <NotificationSettingsSection />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <SecuritySection />
          </TabsContent>
        </Tabs>
      </div>
  );
}

function ProfileSection({ user }: { user?: { id: number; email: string; displayName: string | null; role: string } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Email</Label>
          <p className="text-sm font-medium">{user?.email || "—"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Display Name</Label>
          <p className="text-sm font-medium">{user?.displayName || "—"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Role</Label>
          <p className="text-sm font-medium capitalize">{user?.role?.replace("_", " ") || "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettingsSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function togglePref(type: string, enabled: boolean) {
    setSaving(type);
    try {
      await apiClient.patch(`/notifications/preferences/${type}`, { enabled });
      setPrefs((prev) => ({ ...prev, [type]: enabled }));
    } catch {
      // revert on error
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose which notifications you receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_TYPES.map((nt, i) => (
          <div key={nt.type}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{nt.label}</p>
                <p className="text-xs text-muted-foreground">{nt.description}</p>
              </div>
              <Switch
                checked={prefs[nt.type] !== false}
                onCheckedChange={(checked) => togglePref(nt.type, checked)}
                disabled={saving === nt.type}
              />
            </div>
            {i < NOTIFICATION_TYPES.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change password");
        return;
      }
      setMessage("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Failed to change password");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your login credentials</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md border border-green-200">
              {message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit">Update Password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

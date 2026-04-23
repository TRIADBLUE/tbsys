import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SafeImage } from "@/components/ui/safe-image";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { useToast } from "@/hooks/use-toast";
import type { Project, ProjectStatus } from "@shared/types";

interface ProjectFormProps {
  project?: Project;
  onSuccess?: () => void;
}

export function ProjectForm({ project, onSuccess }: ProjectFormProps) {
  const isEditing = !!project;
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { toast } = useToast();

  const showSaveError = (err: unknown) => {
    const message =
      err instanceof Error ? err.message : "Unknown error — check DevTools console";
    const details =
      err && typeof err === "object" && "details" in err
        ? JSON.stringify((err as { details: unknown }).details)
        : undefined;
    toast({
      title: isEditing ? "Save failed" : "Create failed",
      description: details ? `${message} — ${details}` : message,
      variant: "destructive",
    });
  };

  const [form, setForm] = useState({
    slug: project?.slug || "",
    displayName: project?.displayName || "",
    description: project?.description || "",
    githubRepo: project?.githubRepo || "",
    iconUrl: project?.iconUrl || "",
    iconEmoji: project?.iconEmoji || "",
    colorPrimary: project?.colorPrimary || "#0000FF",
    colorAccent: project?.colorAccent || "#FF44CC",
    status: (project?.status || "active") as ProjectStatus,
    subdomainUrl: project?.subdomainUrl || "",
    productionUrl: project?.productionUrl || "",
    visible: project?.visible ?? true,
    syncEnabled: project?.syncEnabled ?? true,
    tags: project?.tags?.join(", ") || "",
  });

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-generate slug from display name
  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      slug: form.slug,
      displayName: form.displayName,
      description: form.description || undefined,
      githubRepo: form.githubRepo || undefined,
      iconUrl: form.iconUrl || undefined,
      iconEmoji: form.iconEmoji || undefined,
      colorPrimary: form.colorPrimary || undefined,
      colorAccent: form.colorAccent || undefined,
      status: form.status,
      subdomainUrl: form.subdomainUrl || undefined,
      productionUrl: form.productionUrl || undefined,
      visible: form.visible,
      syncEnabled: form.syncEnabled,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    if (isEditing) {
      updateProject.mutate(
        { idOrSlug: project.slug, data },
        { onSuccess, onError: showSaveError },
      );
    } else {
      createProject.mutate(data, { onSuccess, onError: showSaveError });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Name */}
      <div className="space-y-1">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={form.displayName}
          onChange={(e) => {
            updateField("displayName", e.target.value);
            if (!isEditing) {
              updateField("slug", autoSlug(e.target.value));
            }
          }}
          placeholder="My Project"
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-1">
        <Label htmlFor="slug">Slug (URL-safe identifier)</Label>
        <Input
          id="slug"
          value={form.slug}
          onChange={(e) => updateField("slug", e.target.value)}
          placeholder="my-project"
          pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
          disabled={isEditing}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="What this project does..."
          rows={2}
        />
      </div>

      {/* GitHub Repo */}
      <div className="space-y-1">
        <Label htmlFor="githubRepo">GitHub Repository Name</Label>
        <Input
          id="githubRepo"
          value={form.githubRepo}
          onChange={(e) => updateField("githubRepo", e.target.value)}
          placeholder="repo-name"
        />
      </div>

      {/* Project Icon */}
      <div className="space-y-1">
        <Label>Project Icon</Label>
        <div className="flex items-center gap-3">
          {(form.iconUrl || form.iconEmoji) && (
            <div className="shrink-0">
              {form.iconUrl ? (
                <SafeImage
                  src={form.iconUrl}
                  alt="Icon preview"
                  className="w-12 h-12 rounded-lg object-contain border"
                  fallbackInitials={form.displayName.slice(0, 2)}
                  fallbackColor="#0000FF"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg border flex items-center justify-center text-2xl">
                  {form.iconEmoji}
                </div>
              )}
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Input
              value={form.iconUrl}
              onChange={(e) => updateField("iconUrl", e.target.value)}
              placeholder="https://example.com/icon.png or /assets/brands/slug/icon.png"
            />
            <p className="text-xs text-muted-foreground">
              Image URL for this project's icon. Used on cards, detail pages, and exports.
            </p>
          </div>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Primary Color</Label>
          <p className="text-[10px] text-muted-foreground">Buttons, links, page titles, active navigation</p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.colorPrimary}
              onChange={(e) => updateField("colorPrimary", e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <Input
              value={form.colorPrimary}
              onChange={(e) => updateField("colorPrimary", e.target.value)}
              className="font-mono text-sm flex-1"
              maxLength={7}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Accent Color</Label>
          <p className="text-[10px] text-muted-foreground">Secondary actions, tags, badges, decorative borders</p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.colorAccent}
              onChange={(e) => updateField("colorAccent", e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <Input
              value={form.colorAccent}
              onChange={(e) => updateField("colorAccent", e.target.value)}
              className="font-mono text-sm flex-1"
              maxLength={7}
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <Label>Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => updateField("status", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* URLs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="subdomainUrl">Subdomain</Label>
          <Input
            id="subdomainUrl"
            value={form.subdomainUrl}
            onChange={(e) => updateField("subdomainUrl", e.target.value)}
            placeholder="app.triadblue.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="productionUrl">Production URL</Label>
          <Input
            id="productionUrl"
            value={form.productionUrl}
            onChange={(e) => updateField("productionUrl", e.target.value)}
            placeholder="https://app.triadblue.com"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={form.tags}
          onChange={(e) => updateField("tags", e.target.value)}
          placeholder="payments, api, subdomain"
        />
      </div>

      {/* Toggles */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.visible}
              onCheckedChange={(v) => updateField("visible", v)}
            />
            <Label className="text-sm">Visible on dashboard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.syncEnabled}
              onCheckedChange={(v) => updateField("syncEnabled", v)}
            />
            <Label className="text-sm">GitHub sync enabled</Label>
          </div>
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? isEditing
            ? "Saving..."
            : "Creating..."
          : isEditing
            ? "Save Changes"
            : "Create Project"}
      </Button>
    </form>
  );
}

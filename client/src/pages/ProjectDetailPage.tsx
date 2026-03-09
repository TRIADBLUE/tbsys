import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useProject } from "@/hooks/use-projects";
import { useProjectDocs } from "@/hooks/use-project-docs";
import { useAssets, useUploadAsset } from "@/hooks/use-assets";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectColorPicker } from "@/components/projects/ProjectColorPicker";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { ProjectSyncButton } from "@/components/projects/ProjectSyncButton";
import { ProjectDeleteDialog } from "@/components/projects/ProjectDeleteDialog";
import { SafeImage } from "@/components/ui/safe-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrandAssets } from "@/lib/assets";
import { DocPlanner } from "@/components/docs/DocPlanner";
import { ProjectDocList } from "@/components/docs/ProjectDocList";
import { DocAssemblyPreview } from "@/components/docs/DocAssemblyPreview";
import { DocPushHistory } from "@/components/docs/DocPushHistory";
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Settings,
  Palette,
  FileCode,
  FileText,
  Pencil,
  Image,
  Upload,
  Info,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ProjectDetailPage() {
  const [, params] = useRoute("/projects/:slug");
  const slug = params?.slug || "";
  const { data, isLoading, error } = useProject(slug);
  const { data: docsData } = useProjectDocs(slug);
  const [editOpen, setEditOpen] = useState(false);
  const [docHelpOpen, setDocHelpOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">Project not found</p>
          <Link href="/projects">
            <Button variant="outline">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { project, settings } = data;
  const brandAssets = getBrandAssets(project.slug);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>

        {/* Project Header */}
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{
            borderLeftWidth: "6px",
            borderLeftColor: project.colorPrimary || "#0000FF",
            backgroundColor: project.colorBackground || `${project.colorPrimary || "#0000FF"}05`,
          }}
        >
          <div className="flex items-start gap-4">
            <SafeImage
              src={project.iconUrl || brandAssets.icon}
              alt={project.displayName}
              className="w-16 h-16 rounded-xl object-contain"
              fallbackInitials={project.displayName.slice(0, 2)}
              fallbackColor={project.colorPrimary || "#0000FF"}
            />

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {project.displayName}
                </h1>
                <ProjectStatusBadge status={project.status} />
              </div>

              {project.description && (
                <p className="text-gray-600 mb-3">{project.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-400">
                {project.productionUrl && (
                  <a
                    href={project.productionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-gray-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {project.subdomainUrl || project.productionUrl}
                  </a>
                )}
                {project.githubRepo && (
                  <a
                    href={`https://github.com/${project.githubOwner || "triadblue"}/${project.githubRepo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-gray-600"
                  >
                    <Github className="h-3.5 w-3.5" />
                    {project.githubRepo}
                  </a>
                )}
                <ProjectSyncButton
                  repo={project.githubRepo}
                  projectId={project.id}
                  lastSyncedAt={project.lastSyncedAt}
                  size="sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit {project.displayName}</DialogTitle>
                  </DialogHeader>
                  <ProjectForm
                    project={project}
                    onSuccess={() => setEditOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              <ProjectDeleteDialog
                projectSlug={project.slug}
                projectName={project.displayName}
              />
            </div>
          </div>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-200/50">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-white/80 text-gray-600 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="settings">
          <TabsList className="mb-4">
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-1">
              <Palette className="h-4 w-4" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="brand-assets" className="gap-1">
              <Image className="h-4 w-4" />
              Brand Assets
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1">
              <FileText className="h-4 w-4" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-1">
              <FileCode className="h-4 w-4" />
              GitHub
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
              </CardHeader>
              <CardContent>
                {settings.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No custom settings configured for this project.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {settings.map((setting) => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {setting.key}
                          </div>
                          {setting.category && (
                            <span className="text-xs text-gray-400">
                              {setting.category}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-mono text-gray-600">
                          {setting.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="colors">
            <Card>
              <CardHeader>
                <CardTitle>Brand Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectColorPicker
                  projectSlug={project.slug}
                  colorPrimary={project.colorPrimary}
                  colorAccent={project.colorAccent}
                  colorBackground={project.colorBackground}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand-assets">
            <ProjectBrandAssets projectId={project.id} projectSlug={project.slug} />
          </TabsContent>

          <TabsContent value="docs">
            <div className="space-y-6">
              {/* Help Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDocHelpOpen(!docHelpOpen)}
                >
                  <Info className="h-4 w-4 mr-1.5" />
                  {docHelpOpen ? "Hide" : "Show"} Upload Guide
                </Button>
              </div>

              {/* Docs Help Sidebar/Panel */}
              {docHelpOpen && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-blue-900">Documentation Upload Guide</CardTitle>
                      <button onClick={() => setDocHelpOpen(false)} className="text-blue-400 hover:text-blue-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-blue-800 space-y-3">
                    <div>
                      <p className="font-medium mb-1">What is CLAUDE.md?</p>
                      <p className="text-blue-700 text-xs">
                        CLAUDE.md is the onboarding document that AI agents read before working on your project.
                        It contains brand rules, coding standards, restrictions, and project-specific context.
                        When you push docs, all shared + project docs are assembled into one CLAUDE.md and committed to GitHub.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">How to Use the Doc Planner</p>
                      <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
                        <li><strong>Auto-Generate</strong> — Creates starter docs based on project settings</li>
                        <li><strong>Add Custom Docs</strong> — Write your own sections (restrictions, features, etc.)</li>
                        <li><strong>Reorder</strong> — Drag sections to control the order in the assembled file</li>
                        <li><strong>Assembly Preview</strong> — See the final CLAUDE.md before pushing</li>
                        <li><strong>Push to GitHub</strong> — Commits the assembled doc to your repo's root</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Document Categories</p>
                      <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
                        <li><strong>Identity</strong> — Who you are, project purpose, URLs</li>
                        <li><strong>Restrictions</strong> — What AI agents cannot do</li>
                        <li><strong>Features</strong> — Unique capabilities and integrations</li>
                        <li><strong>Direction</strong> — Coding standards, workflow, tech stack</li>
                        <li><strong>Custom</strong> — Anything else specific to the project</li>
                      </ul>
                    </div>
                    <div className="bg-blue-100/50 rounded p-2 text-xs text-blue-600">
                      <strong>Tip:</strong> Shared docs (company-wide policy) are managed in the main Docs page.
                      They automatically appear in every project's CLAUDE.md push.
                    </div>
                  </CardContent>
                </Card>
              )}

              <DocPlanner
                projectSlug={project.slug}
                projectName={project.displayName}
                githubRepo={project.githubRepo}
                hasExistingDocs={(docsData?.docs?.length ?? 0) > 0}
              />
              <ProjectDocList projectSlug={project.slug} />
              <DocAssemblyPreview
                projectSlug={project.slug}
                githubRepo={project.githubRepo}
              />
              <DocPushHistory
                projectSlug={project.slug}
                githubOwner={project.githubOwner}
              />
            </div>
          </TabsContent>

          <TabsContent value="github">
            <Card>
              <CardHeader>
                <CardTitle>GitHub Repository</CardTitle>
              </CardHeader>
              <CardContent>
                {project.githubRepo ? (
                  <div className="space-y-4">
                    {/* Lazy-load the full explorer components */}
                    <p className="text-sm text-gray-500">
                      Repository:{" "}
                      <span className="font-mono font-medium">
                        {project.githubRepo}
                      </span>
                      {" / "}
                      <span className="font-mono">{project.defaultBranch}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No GitHub repository linked to this project.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Brand Asset Types ───────────────────────────────────────────

const BRAND_IMAGE_SLOTS = [
  {
    key: "browser",
    label: "Web Browser Logo",
    category: "logo" as const,
    description: "Main logo displayed in browser tabs, headers, and navigation bars.",
    specs: "1200 x 630px, PNG or SVG. Transparent background preferred. Horizontal lockup works best.",
    tag: "browser-logo",
  },
  {
    key: "logo-text",
    label: "Logo + Text Lockup",
    category: "logo" as const,
    description: "Full logo with company/project name text. Used for marketing, splash screens, and documents.",
    specs: "2000 x 500px, PNG or SVG. Transparent background. High-resolution for print & retina displays.",
    tag: "logo-text",
  },
  {
    key: "favicon-transparent",
    label: "Favicon (Transparent)",
    category: "icon" as const,
    description: "Square icon with transparent background. Used as favicon in modern browsers and PWA icon.",
    specs: "512 x 512px, PNG. Must be square. Transparent background. Simple mark, no text.",
    tag: "favicon-transparent",
  },
  {
    key: "favicon-white",
    label: "Favicon (White Background)",
    category: "icon" as const,
    description: "Square icon with solid white background. Used for social sharing (OG image), Apple touch icon, and anywhere transparent backgrounds aren't supported.",
    specs: "512 x 512px, PNG. Must be square. White (#FFFFFF) background. Same mark as transparent version.",
    tag: "favicon-white",
  },
];

function ProjectBrandAssets({ projectId, projectSlug }: { projectId: number; projectSlug: string }) {
  const { data } = useAssets({ projectId });
  const uploadAsset = useUploadAsset();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const allAssets = data?.assets || [];
  const assetsByTag = allAssets.reduce<Record<string, (typeof allAssets)[0]>>((acc, asset) => {
    const meta = asset.metadata as Record<string, unknown> | null;
    if (meta?.brandSlot) {
      acc[meta.brandSlot as string] = asset;
    }
    return acc;
  }, {});

  async function handleUpload(slot: typeof BRAND_IMAGE_SLOTS[0], file: File) {
    await uploadAsset.mutateAsync({
      file,
      projectId,
      category: slot.category,
    });
  }

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-900 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Brand Asset Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-amber-800 space-y-2">
          <p>
            Every project needs <strong>4 brand images</strong> for consistent identity across the platform,
            browser tabs, social sharing, and documentation.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {BRAND_IMAGE_SLOTS.map((slot) => (
              <div key={slot.key} className="bg-white/60 rounded-lg p-2.5">
                <p className="font-semibold text-amber-900 text-xs">{slot.label}</p>
                <p className="text-amber-700 mt-0.5">{slot.description}</p>
                <p className="text-amber-600 mt-1 font-mono bg-amber-100/50 rounded px-1.5 py-0.5 inline-block">
                  {slot.specs}
                </p>
              </div>
            ))}
          </div>
          <div className="bg-amber-100/50 rounded p-2 mt-2">
            <strong>Why these sizes?</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-700">
              <li><strong>1200x630</strong> — Standard OG/social preview ratio (1.91:1)</li>
              <li><strong>2000x500</strong> — High-res lockup for headers, print, and retina screens</li>
              <li><strong>512x512</strong> — Maximum favicon/PWA icon size, browsers downsample automatically</li>
              <li><strong>PNG</strong> — Lossless compression, supports transparency</li>
              <li><strong>SVG</strong> — Vector format, infinite scaling (logos only)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Upload Grid */}
      <div className="grid grid-cols-2 gap-4">
        {BRAND_IMAGE_SLOTS.map((slot) => {
          const existing = assetsByTag[slot.key];
          return (
            <Card key={slot.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{slot.label}</h3>
                    <p className="text-[10px] text-gray-400 font-mono">{slot.specs}</p>
                  </div>
                </div>

                <div
                  className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-300 transition-colors relative group"
                  onClick={() => fileInputRefs.current[slot.key]?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleUpload(slot, file);
                  }}
                >
                  {existing ? (
                    <>
                      <img
                        src={`/api/assets/file/${existing.id}`}
                        alt={slot.label}
                        className="w-full h-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Click to replace</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Click or drag to upload</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">{slot.specs}</p>
                    </div>
                  )}
                </div>

                <input
                  ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(slot, file);
                    e.target.value = "";
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* All Project Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">All Project Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.assets && data.assets.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {data.assets.map((asset) => {
                const isImage = asset.mimeType.startsWith("image/");
                return (
                  <div key={asset.id} className="border rounded-lg overflow-hidden">
                    <div className="aspect-square bg-gray-50 flex items-center justify-center">
                      {isImage ? (
                        <img
                          src={`/api/assets/file/${asset.id}`}
                          alt={asset.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="h-8 w-8 text-gray-300" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-700 truncate">{asset.filename}</p>
                      <p className="text-[10px] text-gray-400">{asset.category}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">
              No assets uploaded for this project yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

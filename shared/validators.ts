import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #FF44CC)");

const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Must be lowercase alphanumeric with hyphens, no leading/trailing hyphens",
  );

// ── Project Validators ─────────────────────────────────

export const insertProjectSchema = z.object({
  slug: slug,
  displayName: z.string().min(1).max(200),
  description: z.string().optional(),
  githubRepo: z.string().max(200).optional(),
  githubOwner: z.string().max(100).optional(),
  defaultBranch: z.string().max(100).optional(),
  colorPrimary: hexColor.optional(),
  colorAccent: hexColor.optional(),
  colorBackground: hexColor.optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  iconEmoji: z.string().max(10).optional().nullable(),
  status: z
    .enum(["active", "archived", "maintenance", "development", "planned"])
    .optional(),
  displayOrder: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  subdomainUrl: z.string().max(500).optional().nullable(),
  productionUrl: z.string().url().max(500).optional().nullable(),
  customSettings: z.record(z.unknown()).optional(),
  syncEnabled: z.boolean().optional(),
});

export const updateProjectSchema = insertProjectSchema.partial();

export const reorderProjectsSchema = z.object({
  projectIds: z
    .array(z.number().int().positive())
    .min(1, "Must provide at least one project ID"),
});

// ── Project Colors Validator ───────────────────────────

export const updateColorsSchema = z
  .object({
    colorPrimary: hexColor.optional(),
    colorAccent: hexColor.optional(),
    colorBackground: hexColor.optional().nullable(),
  })
  .refine(
    (data) =>
      data.colorPrimary !== undefined ||
      data.colorAccent !== undefined ||
      data.colorBackground !== undefined,
    { message: "Must provide at least one color to update" },
  );

// ── Project Settings Validators ────────────────────────

export const upsertSettingsSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(1).max(200),
        value: z.string().nullable(),
        valueType: z.enum(["string", "number", "boolean", "json"]).optional(),
        category: z.string().max(100).optional(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

// ── User Preferences Validators ────────────────────────

export const upsertPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        key: z.string().min(1).max(200),
        value: z.string(),
      }),
    )
    .min(1),
});

// ── GitHub Sync Validator ──────────────────────────────

export const syncRequestSchema = z.object({
  projectId: z.number().int().positive().optional(),
  repo: z.string().max(200).optional(),
});

// ── Query Param Validators ─────────────────────────────

export const projectListQuerySchema = z.object({
  status: z
    .enum(["active", "archived", "maintenance", "development", "planned"])
    .optional(),
  visible: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  tag: z.string().optional(),
  sort: z
    .enum(["display_order", "display_name", "updated_at", "created_at"])
    .optional()
    .default("display_order"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.coerce.number().int().optional(),
  action: z
    .enum([
      "create",
      "update",
      "delete",
      "reorder",
      "sync",
      "settings_change",
      "login",
      "logout",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ── Shared Doc Validators ──────────────────────────────

export const insertSharedDocSchema = z.object({
  slug: slug,
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  displayOrder: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export const updateSharedDocSchema = insertSharedDocSchema.partial();

export const reorderDocsSchema = z.object({
  docIds: z
    .array(z.number().int().positive())
    .min(1, "Must provide at least one doc ID"),
});

// ── Project Doc Validators ─────────────────────────────

export const insertProjectDocSchema = z.object({
  slug: slug,
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  displayOrder: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export const updateProjectDocSchema = insertProjectDocSchema.partial();

// ── Doc Push Validators ────────────────────────────────

export const docPushSchema = z.object({
  targetPath: z.string().max(500).optional().default("CLAUDE.md"),
  commitMessage: z.string().max(500).optional(),
});

// ── Doc Generate Validator ─────────────────────────────

export const docGenerateSchema = z.object({
  force: z.boolean().optional().default(false),
});

// ── Task Validators ───────────────────────────────────

export const insertTaskSchema = z.object({
  projectId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.number().int().positive().optional().nullable(),
  parentTaskId: z.number().int().positive().optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  dueDate: z.string().optional().nullable(),
});

export const updateTaskSchema = insertTaskSchema.partial();

export const reorderTasksSchema = z.object({
  taskIds: z
    .array(z.number().int().positive())
    .min(1, "Must provide at least one task ID"),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]),
});

export const insertTaskNoteSchema = z.object({
  content: z.string().min(1),
});

export const insertTaskHighlightSchema = z.object({
  sourceType: z.enum(["page", "component", "text"]),
  sourcePath: z.string().optional().nullable(),
  highlightedText: z.string().min(1),
  contextSnippet: z.string().optional().nullable(),
});

export const taskListQuerySchema = z.object({
  projectId: z.coerce.number().int().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.coerce.number().int().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ── Site Planner Validators ───────────────────────────

export const updateCanvasStateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  canvasState: z
    .object({
      zoom: z.number().min(0.1).max(5),
      panX: z.number(),
      panY: z.number(),
    })
    .optional(),
});

export const insertSitePageSchema = z.object({
  title: z.string().min(1).max(200),
  path: z.string().max(500).optional().nullable(),
  pageType: z.enum(["page", "layout", "component", "api"]).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["planned", "in_progress", "complete"]).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ w: z.number(), h: z.number() }).optional(),
  linkedTaskId: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateSitePageSchema = insertSitePageSchema.partial();

export const insertSiteConnectionSchema = z.object({
  sourcePageId: z.number().int().positive(),
  targetPageId: z.number().int().positive(),
  connectionType: z.enum(["navigates_to", "includes", "inherits", "api_call"]).optional(),
  label: z.string().max(200).optional().nullable(),
});

export const linkTaskToPageSchema = z.object({
  taskId: z.number().int().positive().nullable(),
});

// ── Chat Validators ───────────────────────────────────

export const createChatThreadSchema = z.object({
  projectId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1).max(500),
  agentRole: z.enum(["builder", "architect"]).optional(),
  providerSlug: z.string().max(50).optional(),
  modelId: z.string().max(100).optional(),
});

export const chatAttachmentSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  url: z.string().optional(),
  base64: z.string().optional(),
});

export const sendChatMessageSchema = z.object({
  content: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]).optional().default("user"),
  attachments: z.array(chatAttachmentSchema).optional(),
});

export const updateProviderConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  defaultForRole: z.enum(["builder", "architect"]).optional().nullable(),
  modelTiers: z
    .object({
      builder: z.string().optional(),
      architect: z.string().optional(),
    })
    .optional(),
  config: z
    .object({
      baseUrl: z.string().optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
});

export const chatThreadListQuerySchema = z.object({
  projectId: z.coerce.number().int().optional(),
  agentRole: z.enum(["builder", "architect"]).optional(),
  status: z.enum(["active", "archived"]).optional().default("active"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ── Asset Validators ──────────────────────────────────

export const assetListQuerySchema = z.object({
  projectId: z.coerce.number().int().optional(),
  category: z.enum(["icon", "logo", "screenshot", "document"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ── Link Monitor Validators ───────────────────────────

export const triggerLinkCheckSchema = z.object({
  projectId: z.number().int().positive(),
});

export const linkCheckQuerySchema = z.object({
  projectId: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ── Export Types ────────────────────────────────────────

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ReorderProjects = z.infer<typeof reorderProjectsSchema>;
export type UpdateColors = z.infer<typeof updateColorsSchema>;
export type UpsertSettings = z.infer<typeof upsertSettingsSchema>;
export type UpsertPreferences = z.infer<typeof upsertPreferencesSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type InsertSharedDoc = z.infer<typeof insertSharedDocSchema>;
export type UpdateSharedDoc = z.infer<typeof updateSharedDocSchema>;
export type InsertProjectDoc = z.infer<typeof insertProjectDocSchema>;
export type UpdateProjectDoc = z.infer<typeof updateProjectDocSchema>;
export type DocPushRequest = z.infer<typeof docPushSchema>;
export type ReorderDocs = z.infer<typeof reorderDocsSchema>;
export type DocGenerate = z.infer<typeof docGenerateSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type InsertTaskNote = z.infer<typeof insertTaskNoteSchema>;
export type InsertTaskHighlight = z.infer<typeof insertTaskHighlightSchema>;
export type InsertSitePage = z.infer<typeof insertSitePageSchema>;
export type UpdateSitePage = z.infer<typeof updateSitePageSchema>;
export type InsertSiteConnection = z.infer<typeof insertSiteConnectionSchema>;
export type CreateChatThread = z.infer<typeof createChatThreadSchema>;
export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;
export type UpdateProviderConfig = z.infer<typeof updateProviderConfigSchema>;

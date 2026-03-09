import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "archived",
  "maintenance",
  "development",
  "planned",
]);

export const auditLogActionEnum = pgEnum("audit_log_action", [
  "create",
  "update",
  "delete",
  "reorder",
  "sync",
  "settings_change",
  "login",
  "logout",
]);

// ── Projects ───────────────────────────────────────────

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),

  // Identity
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  description: text("description"),

  // GitHub link
  githubRepo: varchar("github_repo", { length: 200 }),
  githubOwner: varchar("github_owner", { length: 100 }),
  defaultBranch: varchar("default_branch", { length: 100 }).default("main"),

  // Branding
  colorPrimary: varchar("color_primary", { length: 7 }).default("#0000FF"),
  colorAccent: varchar("color_accent", { length: 7 }).default("#FF44CC"),
  colorBackground: varchar("color_background", { length: 7 }),
  iconUrl: text("icon_url"),
  iconEmoji: varchar("icon_emoji", { length: 10 }),

  // Organization
  status: projectStatusEnum("status").default("active").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  visible: boolean("visible").default(true).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),

  // URLs
  subdomainUrl: varchar("subdomain_url", { length: 500 }),
  productionUrl: varchar("production_url", { length: 500 }),

  // Custom data
  customSettings: jsonb("custom_settings")
    .$type<Record<string, unknown>>()
    .default({}),

  // Sync
  lastSyncedAt: timestamp("last_synced_at"),
  syncEnabled: boolean("sync_enabled").default(true).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Project Settings ───────────────────────────────────

export const projectSettings = pgTable(
  "project_settings",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    key: varchar("key", { length: 200 }).notNull(),
    value: text("value"),
    valueType: varchar("value_type", { length: 20 }).default("string"),
    category: varchar("category", { length: 100 }),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_settings_project_key_idx").on(
      table.projectId,
      table.key,
    ),
  ],
);

// ── User Preferences ───────────────────────────────────

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    key: varchar("key", { length: 200 }).notNull(),
    value: text("value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_preferences_user_key_idx").on(table.userId, table.key),
  ],
);

// ── GitHub Sync Cache ──────────────────────────────────

export const githubSyncCache = pgTable("github_sync_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cache_key", { length: 500 }).notNull().unique(),
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  owner: varchar("owner", { length: 100 }).notNull(),
  repo: varchar("repo", { length: 200 }),
  path: text("path"),
  responseData: jsonb("response_data").notNull(),
  etag: varchar("etag", { length: 200 }),
  ttlSeconds: integer("ttl_seconds").default(300).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Audit Log ──────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: auditLogActionEnum("action").notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: integer("entity_id"),
  entitySlug: varchar("entity_slug", { length: 200 }),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Admin Users ───────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 200 }),
  role: varchar("role", { length: 50 }).notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  accountLocked: boolean("account_locked").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  lockedUntil: timestamp("locked_until"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Admin Sessions ────────────────────────────────────

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => adminUsers.id, { onDelete: "cascade" })
    .notNull(),
  sessionToken: text("session_token").notNull().unique(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Password Reset Tokens ─────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => adminUsers.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Notifications ─────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => adminUsers.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  projectId: integer("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Notification Preferences ──────────────────────────

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => adminUsers.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_prefs_user_type_idx").on(
      table.userId,
      table.type,
    ),
  ],
);

// ── Shared Docs ──────────────────────────────────────

export const sharedDocs = pgTable("shared_docs", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull().default(""),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Project Docs ─────────────────────────────────────

export const projectDocs = pgTable("project_docs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull().default(""),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Doc Push Log ─────────────────────────────────────

export const docPushStatusEnum = pgEnum("doc_push_status", [
  "success",
  "error",
]);

export const docPushLog = pgTable("doc_push_log", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  targetRepo: varchar("target_repo", { length: 200 }).notNull(),
  targetPath: varchar("target_path", { length: 500 }).notNull().default("CLAUDE.md"),
  commitSha: varchar("commit_sha", { length: 40 }),
  assembledContent: text("assembled_content").notNull(),
  status: docPushStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  pushedAt: timestamp("pushed_at").defaultNow().notNull(),
});

// ── Task Enums ────────────────────────────────────────

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const highlightSourceTypeEnum = pgEnum("highlight_source_type", [
  "page",
  "component",
  "text",
]);

// ── Tasks ─────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  assignedTo: integer("assigned_to").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  parentTaskId: integer("parent_task_id"),
  displayOrder: integer("display_order").default(0).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdBy: integer("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskNotes = pgTable("task_notes", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  createdBy: integer("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskHighlights = pgTable("task_highlights", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  sourceType: highlightSourceTypeEnum("source_type").notNull(),
  sourcePath: text("source_path"),
  highlightedText: text("highlighted_text").notNull(),
  contextSnippet: text("context_snippet"),
  createdBy: integer("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Site Planner ──────────────────────────────────────

export const pageTypeEnum = pgEnum("page_type", [
  "page",
  "layout",
  "component",
  "api",
]);

export const pageStatusEnum = pgEnum("page_status", [
  "planned",
  "in_progress",
  "complete",
]);

export const connectionTypeEnum = pgEnum("connection_type", [
  "navigates_to",
  "includes",
  "inherits",
  "api_call",
]);

export const sitePlans = pgTable("site_plans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  name: varchar("name", { length: 200 }).notNull(),
  canvasState: jsonb("canvas_state")
    .$type<{ zoom: number; panX: number; panY: number }>()
    .default({ zoom: 1, panX: 0, panY: 0 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sitePages = pgTable("site_pages", {
  id: serial("id").primaryKey(),
  sitePlanId: integer("site_plan_id")
    .references(() => sitePlans.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  path: varchar("path", { length: 500 }),
  pageType: pageTypeEnum("page_type").default("page").notNull(),
  description: text("description"),
  status: pageStatusEnum("status").default("planned").notNull(),
  position: jsonb("position").$type<{ x: number; y: number }>().default({ x: 0, y: 0 }),
  size: jsonb("size").$type<{ w: number; h: number }>().default({ w: 200, h: 120 }),
  linkedTaskId: integer("linked_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const siteConnections = pgTable("site_connections", {
  id: serial("id").primaryKey(),
  sitePlanId: integer("site_plan_id")
    .references(() => sitePlans.id, { onDelete: "cascade" })
    .notNull(),
  sourcePageId: integer("source_page_id")
    .references(() => sitePages.id, { onDelete: "cascade" })
    .notNull(),
  targetPageId: integer("target_page_id")
    .references(() => sitePages.id, { onDelete: "cascade" })
    .notNull(),
  connectionType: connectionTypeEnum("connection_type")
    .default("navigates_to")
    .notNull(),
  label: varchar("label", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Chat System ───────────────────────────────────────

export const agentRoleEnum = pgEnum("agent_role", ["builder", "architect"]);

export const chatThreadStatusEnum = pgEnum("chat_thread_status", [
  "active",
  "archived",
]);

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
  "system",
]);

export const aiProviderTypeEnum = pgEnum("ai_provider_type", [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "kimi",
  "groq",
  "replit",
  "claude-code",
]);

export const chatThreads = pgTable("chat_threads", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 500 }).notNull(),
  agentRole: agentRoleEnum("agent_role").default("builder").notNull(),
  providerSlug: varchar("provider_slug", { length: 50 }),
  modelId: varchar("model_id", { length: 100 }),
  status: chatThreadStatusEnum("status").default("active").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .references(() => chatThreads.id, { onDelete: "cascade" })
    .notNull(),
  role: chatMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  linkedTaskId: integer("linked_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  providerType: aiProviderTypeEnum("provider_type").notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  defaultForRole: agentRoleEnum("default_for_role"),
  modelTiers: jsonb("model_tiers")
    .$type<{ builder?: string; architect?: string }>()
    .default({}),
  config: jsonb("config")
    .$type<{ baseUrl?: string; headers?: Record<string, string> }>()
    .default({}),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Assets ────────────────────────────────────────────

export const assetCategoryEnum = pgEnum("asset_category", [
  "icon",
  "logo",
  "screenshot",
  "document",
]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  filename: varchar("filename", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  category: assetCategoryEnum("category").default("document").notNull(),
  uploadedBy: integer("uploaded_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Link Monitor ──────────────────────────────────────

export const linkChecks = pgTable("link_checks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  isHealthy: boolean("is_healthy").notNull(),
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

// ── Relations ──────────────────────────────────────────

export const projectsRelations = relations(projects, ({ many }) => ({
  settings: many(projectSettings),
  notifications: many(notifications),
  docs: many(projectDocs),
  pushLogs: many(docPushLog),
}));

export const projectSettingsRelations = relations(
  projectSettings,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectSettings.projectId],
      references: [projects.id],
    }),
  }),
);

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, {
    fields: [adminSessions.userId],
    references: [adminUsers.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(adminUsers, {
    fields: [notifications.userId],
    references: [adminUsers.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(adminUsers, {
      fields: [notificationPreferences.userId],
      references: [adminUsers.id],
    }),
  }),
);

export const projectDocsRelations = relations(projectDocs, ({ one }) => ({
  project: one(projects, {
    fields: [projectDocs.projectId],
    references: [projects.id],
  }),
}));

export const docPushLogRelations = relations(docPushLog, ({ one }) => ({
  project: one(projects, {
    fields: [docPushLog.projectId],
    references: [projects.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(adminUsers, {
    fields: [tasks.assignedTo],
    references: [adminUsers.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
  }),
  notes: many(taskNotes),
  highlights: many(taskHighlights),
}));

export const taskNotesRelations = relations(taskNotes, ({ one }) => ({
  task: one(tasks, {
    fields: [taskNotes.taskId],
    references: [tasks.id],
  }),
}));

export const taskHighlightsRelations = relations(taskHighlights, ({ one }) => ({
  task: one(tasks, {
    fields: [taskHighlights.taskId],
    references: [tasks.id],
  }),
}));

export const sitePlansRelations = relations(sitePlans, ({ one, many }) => ({
  project: one(projects, {
    fields: [sitePlans.projectId],
    references: [projects.id],
  }),
  pages: many(sitePages),
  connections: many(siteConnections),
}));

export const sitePagesRelations = relations(sitePages, ({ one }) => ({
  sitePlan: one(sitePlans, {
    fields: [sitePages.sitePlanId],
    references: [sitePlans.id],
  }),
  linkedTask: one(tasks, {
    fields: [sitePages.linkedTaskId],
    references: [tasks.id],
  }),
}));

export const siteConnectionsRelations = relations(siteConnections, ({ one }) => ({
  sitePlan: one(sitePlans, {
    fields: [siteConnections.sitePlanId],
    references: [sitePlans.id],
  }),
  sourcePage: one(sitePages, {
    fields: [siteConnections.sourcePageId],
    references: [sitePages.id],
  }),
  targetPage: one(sitePages, {
    fields: [siteConnections.targetPageId],
    references: [sitePages.id],
  }),
}));

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  project: one(projects, {
    fields: [chatThreads.projectId],
    references: [projects.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [chatMessages.threadId],
    references: [chatThreads.id],
  }),
  linkedTask: one(tasks, {
    fields: [chatMessages.linkedTaskId],
    references: [tasks.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
}));

export const linkChecksRelations = relations(linkChecks, ({ one }) => ({
  project: one(projects, {
    fields: [linkChecks.projectId],
    references: [projects.id],
  }),
}));

import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_user_name_idx").on(t.userId, t.name)],
);

export const secrets = pgTable(
  "secrets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    environment: text("environment").notNull(),
    key: text("key").notNull(),
    /** AES-256-GCM ciphertext: v1.iv.tag.data */
    ciphertext: text("ciphertext").notNull(),
    fingerprint: text("fingerprint").notNull(),
    note: text("note").notNull().default(""),
    rotationDays: integer("rotation_days").notNull().default(90),
    lastRotatedOn: text("last_rotated_on").notNull(),
    expiresOn: text("expires_on"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("secrets_project_env_key_idx").on(t.projectId, t.environment, t.key),
    index("secrets_user_idx").on(t.userId),
  ],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    secretId: integer("secret_id").references(() => secrets.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    /** SHA-256 of the token. The token itself only exists in the link. */
    tokenHash: text("token_hash").notNull().unique(),
    /** Encrypted with a key derived from the token, so the database cannot read it. */
    ciphertext: text("ciphertext"),
    maxViews: integer("max_views").notNull().default(1),
    views: integer("views").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("share_links_user_idx").on(t.userId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    action: text("action").notNull(),
    target: text("target").notNull().default(""),
    detail: text("detail").notNull().default(""),
    ip: text("ip").notNull().default(""),
    success: boolean("success").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_user_idx").on(t.userId, t.createdAt), index("audit_email_idx").on(t.email, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

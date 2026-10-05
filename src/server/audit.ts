import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { auditEvents } from "@/db/schema";

export const ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.sign_in_failed": "Failed sign-in",
  "auth.locked": "Sign-in blocked (too many attempts)",
  "auth.sign_up": "Created account",
  "auth.sign_out": "Signed out",
  "project.create": "Created project",
  "project.delete": "Deleted project",
  "secret.create": "Added secret",
  "secret.update": "Updated secret",
  "secret.rotate": "Rotated secret",
  "secret.reveal": "Revealed secret",
  "secret.delete": "Deleted secret",
  "env.import": "Imported .env",
  "env.export": "Exported .env",
  "share.create": "Created share link",
  "share.view": "Share link opened",
  "share.revoke": "Revoked share link",
};

export interface AuditInput {
  userId: number | null;
  email?: string | null;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
  success?: boolean;
  at?: Date;
}

export async function recordEvent(db: DB, e: AuditInput) {
  await db.insert(auditEvents).values({
    userId: e.userId,
    email: e.email ?? null,
    action: e.action,
    target: e.target ?? "",
    detail: e.detail ?? "",
    ip: e.ip ?? "",
    success: e.success ?? true,
    ...(e.at ? { createdAt: e.at } : {}),
  });
}

export async function listEvents(db: DB, userId: number, opts: { action?: string; limit?: number } = {}) {
  const where = opts.action
    ? and(eq(auditEvents.userId, userId), sql`${auditEvents.action} like ${opts.action + "%"}`)
    : eq(auditEvents.userId, userId);
  return db.select().from(auditEvents).where(where).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(opts.limit ?? 100);
}

export async function failedSignInsSince(db: DB, email: string, since: Date): Promise<Date[]> {
  const rows = await db
    .select({ at: auditEvents.createdAt })
    .from(auditEvents)
    .where(and(eq(auditEvents.email, email), eq(auditEvents.action, "auth.sign_in_failed"), gte(auditEvents.createdAt, since)));
  return rows.map((r) => r.at);
}

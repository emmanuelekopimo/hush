import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { projects, secrets, type Secret } from "@/db/schema";
import { decrypt, encrypt, fingerprint, maskValue, secretAad } from "@/lib/crypto";
import type { EnvEntry } from "@/lib/envfile";
import { healthSummary, rotationStatus, statusRank, type RotationResult } from "@/lib/rotation";
import type { Environment } from "@/lib/validation";
import { recordEvent } from "./audit";

export interface SecretView {
  id: number;
  projectId: number;
  environment: string;
  key: string;
  masked: string;
  note: string;
  rotationDays: number;
  lastRotatedOn: string;
  expiresOn: string | null;
  version: number;
  fingerprint: string;
  reused: boolean;
  rotation: RotationResult;
}

function toView(s: Secret, key: Buffer, today: string, reusedPrints: Set<string>): SecretView {
  let masked = "•".repeat(8);
  try {
    masked = maskValue(decrypt(s.ciphertext, key, secretAad(s.projectId, s.environment, s.key)));
  } catch {
    masked = "Cannot decrypt";
  }
  return {
    id: s.id,
    projectId: s.projectId,
    environment: s.environment,
    key: s.key,
    masked,
    note: s.note,
    rotationDays: s.rotationDays,
    lastRotatedOn: s.lastRotatedOn,
    expiresOn: s.expiresOn,
    version: s.version,
    fingerprint: s.fingerprint,
    reused: reusedPrints.has(s.fingerprint),
    rotation: rotationStatus(s, today),
  };
}

/** Fingerprints that appear on more than one secret of this user (same value reused). */
async function reusedFingerprints(db: DB, userId: number): Promise<Set<string>> {
  const rows = await db
    .select({ fp: secrets.fingerprint })
    .from(secrets)
    .where(eq(secrets.userId, userId))
    .groupBy(secrets.fingerprint)
    .having(sql`count(*) > 1`);
  return new Set(rows.map((r) => r.fp));
}

// ---------- Projects ----------

export async function listProjects(db: DB, userId: number, today: string) {
  const rows = await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.name));
  const all = await db
    .select({ projectId: secrets.projectId, environment: secrets.environment, lastRotatedOn: secrets.lastRotatedOn, rotationDays: secrets.rotationDays, expiresOn: secrets.expiresOn })
    .from(secrets)
    .where(eq(secrets.userId, userId));
  return rows.map((p) => {
    const mine = all.filter((s) => s.projectId === p.id);
    const health = healthSummary(mine.map((s) => rotationStatus(s, today).status));
    const envs = new Set(mine.map((s) => s.environment));
    return { ...p, secretCount: mine.length, environments: envs.size, health };
  });
}

export async function getProject(db: DB, userId: number, projectId: number) {
  if (!Number.isInteger(projectId)) return null;
  const [p] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return p ?? null;
}

export async function createProject(db: DB, userId: number, input: { name: string; description: string }, ip = "") {
  const [dupe] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.userId, userId), eq(projects.name, input.name)));
  if (dupe) return { ok: false as const, error: "You already have a project with this name" };
  const [project] = await db.insert(projects).values({ userId, name: input.name, description: input.description }).returning();
  await recordEvent(db, { userId, action: "project.create", target: project.name, ip });
  return { ok: true as const, project };
}

export async function deleteProject(db: DB, userId: number, projectId: number, ip = "") {
  const project = await getProject(db, userId, projectId);
  if (!project) return false;
  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  await recordEvent(db, { userId, action: "project.delete", target: project.name, ip });
  return true;
}

// ---------- Secrets ----------

export async function listSecrets(db: DB, userId: number, projectId: number, environment: string, key: Buffer, today: string) {
  const rows = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.userId, userId), eq(secrets.projectId, projectId), eq(secrets.environment, environment)))
    .orderBy(asc(secrets.key));
  const reused = await reusedFingerprints(db, userId);
  return rows.map((s) => toView(s, key, today, reused));
}

export async function environmentCounts(db: DB, userId: number, projectId: number) {
  const rows = await db
    .select({ environment: secrets.environment, n: sql<number>`count(*)::int` })
    .from(secrets)
    .where(and(eq(secrets.userId, userId), eq(secrets.projectId, projectId)))
    .groupBy(secrets.environment);
  return Object.fromEntries(rows.map((r) => [r.environment, r.n])) as Record<string, number>;
}

export async function keysByEnvironment(db: DB, userId: number, projectId: number) {
  const rows = await db
    .select({ environment: secrets.environment, key: secrets.key })
    .from(secrets)
    .where(and(eq(secrets.userId, userId), eq(secrets.projectId, projectId)));
  const out: Record<string, string[]> = { development: [], staging: [], production: [] };
  for (const r of rows) (out[r.environment] ??= []).push(r.key);
  return out;
}

export async function getSecret(db: DB, userId: number, secretId: number) {
  if (!Number.isInteger(secretId)) return null;
  const [s] = await db.select().from(secrets).where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)));
  return s ?? null;
}

export interface SecretInput {
  key: string;
  value: string;
  environment: Environment;
  note: string;
  rotationDays: number;
  expiresOn: string | null;
}

export async function createSecret(db: DB, userId: number, projectId: number, input: SecretInput, vault: Buffer, today: string, ip = "") {
  const project = await getProject(db, userId, projectId);
  if (!project) return { ok: false as const, error: "Project not found" };
  const [dupe] = await db
    .select({ id: secrets.id })
    .from(secrets)
    .where(and(eq(secrets.projectId, projectId), eq(secrets.environment, input.environment), eq(secrets.key, input.key)));
  if (dupe) return { ok: false as const, error: `${input.key} already exists in ${input.environment}`, field: "key" };

  const [secret] = await db
    .insert(secrets)
    .values({
      userId,
      projectId,
      environment: input.environment,
      key: input.key,
      ciphertext: encrypt(input.value, vault, secretAad(projectId, input.environment, input.key)),
      fingerprint: fingerprint(input.value),
      note: input.note,
      rotationDays: input.rotationDays,
      lastRotatedOn: today,
      expiresOn: input.expiresOn,
    })
    .returning();
  await recordEvent(db, { userId, action: "secret.create", target: `${project.name} / ${input.environment} / ${input.key}`, ip });
  return { ok: true as const, secret };
}

/**
 * Update a secret. A new value counts as a rotation: the version goes up and
 * the rotation clock restarts today. Changing only the note or schedule does not.
 */
export async function updateSecret(db: DB, userId: number, secretId: number, input: Omit<SecretInput, "environment" | "key" | "value"> & { value?: string }, vault: Buffer, today: string, ip = "") {
  const s = await getSecret(db, userId, secretId);
  if (!s) return { ok: false as const, error: "Secret not found" };
  const aad = secretAad(s.projectId, s.environment, s.key);
  const current = decrypt(s.ciphertext, vault, aad);
  const rotated = !!input.value && input.value !== current;

  await db
    .update(secrets)
    .set({
      note: input.note,
      rotationDays: input.rotationDays,
      expiresOn: input.expiresOn,
      updatedAt: new Date(),
      ...(rotated
        ? { ciphertext: encrypt(input.value!, vault, aad), fingerprint: fingerprint(input.value!), version: s.version + 1, lastRotatedOn: today }
        : {}),
    })
    .where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)));
  await recordEvent(db, { userId, action: rotated ? "secret.rotate" : "secret.update", target: `${s.environment} / ${s.key}`, detail: rotated ? `now version ${s.version + 1}` : "", ip });
  return { ok: true as const, rotated };
}

export async function revealSecret(db: DB, userId: number, secretId: number, vault: Buffer, ip = "") {
  const s = await getSecret(db, userId, secretId);
  if (!s) return null;
  const value = decrypt(s.ciphertext, vault, secretAad(s.projectId, s.environment, s.key));
  await recordEvent(db, { userId, action: "secret.reveal", target: `${s.environment} / ${s.key}`, ip });
  return value;
}

export async function deleteSecret(db: DB, userId: number, secretId: number, ip = "") {
  const s = await getSecret(db, userId, secretId);
  if (!s) return false;
  await db.delete(secrets).where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)));
  await recordEvent(db, { userId, action: "secret.delete", target: `${s.environment} / ${s.key}`, ip });
  return true;
}

export async function importEntries(db: DB, userId: number, projectId: number, environment: Environment, entries: EnvEntry[], overwrite: boolean, vault: Buffer, today: string, ip = "") {
  const project = await getProject(db, userId, projectId);
  if (!project) return { ok: false as const, error: "Project not found" };
  const existing = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.projectId, projectId), eq(secrets.environment, environment)));
  const byKey = new Map(existing.map((s) => [s.key, s]));
  let added = 0, updated = 0, skipped = 0;

  for (const e of entries) {
    const key = e.key.toUpperCase();
    const aad = secretAad(projectId, environment, key);
    const found = byKey.get(key);
    if (!found) {
      await db.insert(secrets).values({ userId, projectId, environment, key, ciphertext: encrypt(e.value, vault, aad), fingerprint: fingerprint(e.value), lastRotatedOn: today, rotationDays: 90 });
      added++;
    } else if (overwrite && fingerprint(e.value) !== found.fingerprint) {
      await db
        .update(secrets)
        .set({ ciphertext: encrypt(e.value, vault, aad), fingerprint: fingerprint(e.value), version: found.version + 1, lastRotatedOn: today, updatedAt: new Date() })
        .where(eq(secrets.id, found.id));
      updated++;
    } else {
      skipped++;
    }
  }
  await recordEvent(db, { userId, action: "env.import", target: `${project.name} / ${environment}`, detail: `${added} added, ${updated} updated, ${skipped} skipped`, ip });
  return { ok: true as const, added, updated, skipped };
}

export async function exportEntries(db: DB, userId: number, projectId: number, environment: string, vault: Buffer, ip = "") {
  const project = await getProject(db, userId, projectId);
  if (!project) return null;
  const rows = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.userId, userId), eq(secrets.projectId, projectId), eq(secrets.environment, environment)));
  const entries = rows.map((s) => ({ key: s.key, value: decrypt(s.ciphertext, vault, secretAad(s.projectId, s.environment, s.key)) }));
  await recordEvent(db, { userId, action: "env.export", target: `${project.name} / ${environment}`, detail: `${entries.length} keys`, ip });
  return { project, entries };
}

// ---------- Dashboard ----------

export async function attentionList(db: DB, userId: number, vault: Buffer, today: string, limit = 6) {
  const rows = await db
    .select({ s: secrets, projectName: projects.name })
    .from(secrets)
    .innerJoin(projects, eq(projects.id, secrets.projectId))
    .where(eq(secrets.userId, userId));
  const reused = await reusedFingerprints(db, userId);
  return rows
    .map((r) => ({ ...toView(r.s, vault, today, reused), projectName: r.projectName }))
    .filter((v) => v.rotation.status !== "ok")
    .sort((a, b) => statusRank(a.rotation.status) - statusRank(b.rotation.status) || a.rotation.daysLeft - b.rotation.daysLeft)
    .slice(0, limit);
}

export async function overallHealth(db: DB, userId: number, today: string) {
  const rows = await db
    .select({ lastRotatedOn: secrets.lastRotatedOn, rotationDays: secrets.rotationDays, expiresOn: secrets.expiresOn })
    .from(secrets)
    .where(eq(secrets.userId, userId));
  return healthSummary(rows.map((r) => rotationStatus(r, today).status));
}

export async function reusedCount(db: DB, userId: number) {
  const fps = await reusedFingerprints(db, userId);
  if (fps.size === 0) return 0;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(secrets)
    .where(and(eq(secrets.userId, userId), inArray(secrets.fingerprint, [...fps])));
  return r.n;
}

export async function secretOptions(db: DB, userId: number) {
  return db
    .select({ id: secrets.id, key: secrets.key, environment: secrets.environment, projectName: projects.name })
    .from(secrets)
    .innerJoin(projects, eq(projects.id, secrets.projectId))
    .where(eq(secrets.userId, userId))
    .orderBy(asc(projects.name), asc(secrets.environment), asc(secrets.key));
}


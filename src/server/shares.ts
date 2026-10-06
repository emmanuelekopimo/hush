import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { shareLinks } from "@/db/schema";
import { decrypt, deriveKey, encrypt, randomToken, sha256 } from "@/lib/crypto";
import { expiryDate, shareStatus, type ExpiryOption } from "@/lib/shares";
import { recordEvent } from "./audit";
import { revealSecret, getSecret } from "./vault";

// The share token is only ever in the link. The database keeps its hash and a
// copy of the value encrypted with a key derived from the token, so a database
// leak does not reveal shared secrets.

function tokenKey(token: string) {
  return deriveKey(`share-token:${token}`, "hush-share-v1");
}

export async function createShare(db: DB, userId: number, input: { secretId: number; expiry: ExpiryOption; maxViews: number }, vault: Buffer, now: Date, ip = "") {
  const secret = await getSecret(db, userId, input.secretId);
  if (!secret) return { ok: false as const, error: "Secret not found" };
  const value = await revealSecret(db, userId, secret.id, vault, ip);
  if (value === null) return { ok: false as const, error: "Secret not found" };
  const token = randomToken(24);
  const label = `${secret.key} (${secret.environment})`;
  const [link] = await db
    .insert(shareLinks)
    .values({
      userId,
      secretId: secret.id,
      label,
      tokenHash: sha256(token),
      ciphertext: encrypt(JSON.stringify({ key: secret.key, value }), tokenKey(token), "share"),
      maxViews: input.maxViews,
      expiresAt: expiryDate(input.expiry, now),
      createdAt: now,
    })
    .returning();
  await recordEvent(db, { userId, action: "share.create", target: label, detail: `${input.maxViews} view(s), ${input.expiry}`, ip });
  return { ok: true as const, token, link };
}

export async function listShares(db: DB, userId: number, now: Date) {
  const rows = await db.select().from(shareLinks).where(eq(shareLinks.userId, userId)).orderBy(desc(shareLinks.createdAt));
  return rows.map((r) => ({ ...r, ciphertext: null, status: shareStatus(r, now) }));
}

/** Look at a link without opening it (so link previews do not burn it). */
export async function peekShare(db: DB, token: string, now: Date) {
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, sha256(token)));
  if (!link) return null;
  return { label: link.label, status: shareStatus(link, now), expiresAt: link.expiresAt, viewsLeft: Math.max(0, link.maxViews - link.views) };
}

/**
 * Open a link. The view counter is increased in one conditional UPDATE, so two
 * people opening a one-time link at the same moment cannot both see it.
 */
export async function openShare(db: DB, token: string, now: Date, ip = "") {
  const hash = sha256(token);
  const [link] = await db
    .update(shareLinks)
    .set({ views: sql`${shareLinks.views} + 1`, lastViewedAt: now })
    .where(and(eq(shareLinks.tokenHash, hash), isNull(shareLinks.revokedAt), gt(shareLinks.expiresAt, now), lt(shareLinks.views, shareLinks.maxViews)))
    .returning();
  if (!link || !link.ciphertext) {
    const peek = await peekShare(db, token, now);
    return { ok: false as const, status: peek?.status ?? ("missing" as const) };
  }
  const payload = JSON.parse(decrypt(link.ciphertext, tokenKey(token), "share")) as { key: string; value: string };
  if (link.views >= link.maxViews) {
    await db.update(shareLinks).set({ ciphertext: null }).where(eq(shareLinks.id, link.id));
  }
  await recordEvent(db, { userId: link.userId, action: "share.view", target: link.label, detail: `view ${link.views} of ${link.maxViews}`, ip, at: now });
  return { ok: true as const, ...payload, viewsLeft: link.maxViews - link.views };
}

export async function revokeShare(db: DB, userId: number, shareId: number, now: Date, ip = "") {
  const [link] = await db
    .update(shareLinks)
    .set({ revokedAt: now, ciphertext: null })
    .where(and(eq(shareLinks.id, shareId), eq(shareLinks.userId, userId)))
    .returning();
  if (!link) return false;
  await recordEvent(db, { userId, action: "share.revoke", target: link.label, ip });
  return true;
}

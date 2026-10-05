import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { auditEvents, projects, secrets, shareLinks, users } from "@/db/schema";
import { encrypt, fingerprint, randomToken, secretAad, sha256, deriveKey } from "@/lib/crypto";
import { addDays } from "@/lib/dates";

export const DEMO_EMAIL = "demo@hush.ng";
export const DEMO_PASSWORD = "demo1234";

// Seed values are generated at run time so no token-shaped strings live in the source code.
const hex = (n: number) => randomBytes(n).toString("hex");
const b64 = (n: number) => randomBytes(n).toString("base64url");
const alnum = (n: number) => b64(n * 2).replace(/[-_]/g, "").slice(0, n);

interface SeedSecret {
  env: "development" | "staging" | "production";
  key: string;
  value: string;
  note?: string;
  rotationDays: number;
  /** days ago it was last rotated */
  rotatedAgo: number;
  /** expiry relative to today (negative = already expired) */
  expiresIn?: number;
}

function projectSecrets(): Record<string, { description: string; items: SeedSecret[] }> {
  const jwt = b64(48);
  const pgPass = alnum(24);
  return {
    "Campus Pay API": {
      description: "Backend for paying school fees and hostel dues",
      items: [
        { env: "production", key: "DATABASE_URL", value: `postgres://campuspay:${pgPass}@db.campuspay.ng:5432/campuspay`, note: "Primary database", rotationDays: 90, rotatedAgo: 21 },
        { env: "production", key: "PAYSTACK_SECRET_KEY", value: `sk_live_${hex(20)}`, note: "Live payments key", rotationDays: 90, rotatedAgo: 118 },
        { env: "production", key: "JWT_SECRET", value: jwt, note: "Signs user sessions", rotationDays: 90, rotatedAgo: 85 },
        { env: "production", key: "SMTP_PASSWORD", value: alnum(20), note: "Receipts mailbox. Provider password expires", rotationDays: 180, rotatedAgo: 60, expiresIn: -3 },
        { env: "production", key: "REDIS_URL", value: `redis://default:${alnum(20)}@cache.campuspay.ng:6379`, rotationDays: 180, rotatedAgo: 30 },
        { env: "staging", key: "DATABASE_URL", value: `postgres://campuspay:${alnum(18)}@staging-db.campuspay.ng:5432/campuspay`, rotationDays: 90, rotatedAgo: 40 },
        { env: "staging", key: "PAYSTACK_SECRET_KEY", value: `sk_test_${hex(20)}`, note: "Test mode key", rotationDays: 180, rotatedAgo: 12 },
        { env: "staging", key: "JWT_SECRET", value: jwt, note: "Copied from production by mistake", rotationDays: 90, rotatedAgo: 85 },
        { env: "development", key: "DATABASE_URL", value: "postgres://postgres:postgres@localhost:5432/campuspay", rotationDays: 365, rotatedAgo: 10 },
        { env: "development", key: "PAYSTACK_SECRET_KEY", value: `sk_test_${hex(20)}`, rotationDays: 365, rotatedAgo: 10 },
      ],
    },
    "Hostel Finder": {
      description: "Map of verified hostels around the University of Uyo",
      items: [
        { env: "production", key: "DATABASE_URL", value: `postgres://hostel:${alnum(22)}@db.hostelfinder.ng:5432/hostels`, rotationDays: 90, rotatedAgo: 14 },
        { env: "production", key: "MAPBOX_TOKEN", value: `pk.${b64(40)}`, note: "Public map token, read only", rotationDays: 365, rotatedAgo: 50 },
        { env: "production", key: "CLOUDINARY_API_SECRET", value: alnum(27), note: "Hostel photo uploads", rotationDays: 90, rotatedAgo: 88 },
        { env: "production", key: "ADMIN_PASSWORD", value: alnum(16), note: "Shared admin login. Replace with SSO", rotationDays: 30, rotatedAgo: 41 },
        { env: "development", key: "MAPBOX_TOKEN", value: `pk.${b64(40)}`, rotationDays: 365, rotatedAgo: 50 },
      ],
    },
    "Portfolio Site": {
      description: "Personal site and blog",
      items: [
        { env: "production", key: "RESEND_API_KEY", value: `re_${alnum(32)}`, note: "Contact form email", rotationDays: 180, rotatedAgo: 33 },
        { env: "production", key: "GITHUB_TOKEN", value: `github_pat_${alnum(60)}`, note: "Reads pinned repos. Fine-grained, read only", rotationDays: 90, rotatedAgo: 20, expiresIn: 70 },
      ],
    },
  };
}

export async function isEmpty(db: DB) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return r.n === 0;
}

export async function resetDatabase(db: DB) {
  await db.execute(sql`truncate table audit_events, share_links, secrets, projects, users restart identity cascade`);
}

export async function seed(db: DB, opts: { today: string; vault: Buffer; now?: Date }) {
  const { today, vault } = opts;
  const now = opts.now ?? new Date(`${today}T10:00:00Z`);
  const at = (daysAgo: number, hour = 9, minute = 0) => {
    const d = new Date(`${addDays(today, -daysAgo)}T00:00:00Z`);
    d.setUTCHours(hour, minute);
    return d;
  };

  const [demo] = await db
    .insert(users)
    .values({ name: "Friday Essien", email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10), createdAt: at(120) })
    .returning();
  const [other] = await db
    .insert(users)
    .values({ name: "Ada Okon", email: "ada@hush.ng", passwordHash: await bcrypt.hash("ada12345", 10), createdAt: at(60) })
    .returning();

  const projectIds: Record<string, number> = {};
  const secretIds: Record<string, number> = {};
  for (const [name, def] of Object.entries(projectSecrets())) {
    const [p] = await db.insert(projects).values({ userId: demo.id, name, description: def.description, createdAt: at(100) }).returning();
    projectIds[name] = p.id;
    for (const s of def.items) {
      const [row] = await db
        .insert(secrets)
        .values({
          userId: demo.id,
          projectId: p.id,
          environment: s.env,
          key: s.key,
          ciphertext: encrypt(s.value, vault, secretAad(p.id, s.env, s.key)),
          fingerprint: fingerprint(s.value),
          note: s.note ?? "",
          rotationDays: s.rotationDays,
          lastRotatedOn: addDays(today, -s.rotatedAgo),
          expiresOn: s.expiresIn === undefined ? null : addDays(today, s.expiresIn),
          version: s.rotatedAgo > 60 ? 1 : 2,
          createdAt: at(100),
        })
        .returning();
      secretIds[`${name}/${s.env}/${s.key}`] = row.id;
    }
  }

  // Another user's data, to prove scoping.
  const [ap] = await db.insert(projects).values({ userId: other.id, name: "Lecture Notes Bot", description: "Ada's Telegram bot" }).returning();
  const botToken = `${Math.floor(Math.random() * 1e9)}:${alnum(35)}`;
  await db.insert(secrets).values({
    userId: other.id,
    projectId: ap.id,
    environment: "production",
    key: "TELEGRAM_BOT_TOKEN",
    ciphertext: encrypt(botToken, vault, secretAad(ap.id, "production", "TELEGRAM_BOT_TOKEN")),
    fingerprint: fingerprint(botToken),
    lastRotatedOn: addDays(today, -5),
    rotationDays: 90,
  });

  // Share links: one active, one already used, one expired, one revoked.
  const shareKey = (token: string) => deriveKey(`share-token:${token}`, "hush-share-v1");
  const shares = [
    { label: "DATABASE_URL (staging)", secret: "Campus Pay API/staging/DATABASE_URL", createdAgoH: 2, expiresInH: 22, maxViews: 1, views: 0, revoked: false },
    { label: "MAPBOX_TOKEN (production)", secret: "Hostel Finder/production/MAPBOX_TOKEN", createdAgoH: 30, expiresInH: 138, maxViews: 1, views: 1, revoked: false },
    { label: "PAYSTACK_SECRET_KEY (staging)", secret: "Campus Pay API/staging/PAYSTACK_SECRET_KEY", createdAgoH: 80, expiresInH: -56, maxViews: 3, views: 1, revoked: false },
    { label: "RESEND_API_KEY (production)", secret: "Portfolio Site/production/RESEND_API_KEY", createdAgoH: 26, expiresInH: 142, maxViews: 1, views: 0, revoked: true },
  ];
  for (const s of shares) {
    const token = randomToken(24);
    const active = !s.revoked && s.views < s.maxViews && s.expiresInH > 0;
    await db.insert(shareLinks).values({
      userId: demo.id,
      secretId: secretIds[s.secret],
      label: s.label,
      tokenHash: sha256(token),
      ciphertext: active ? encrypt(JSON.stringify({ key: s.label.split(" ")[0], value: "seeded share" }), shareKey(token), "share") : null,
      maxViews: s.maxViews,
      views: s.views,
      expiresAt: new Date(now.getTime() + s.expiresInH * 3_600_000),
      createdAt: new Date(now.getTime() - s.createdAgoH * 3_600_000),
      revokedAt: s.revoked ? new Date(now.getTime() - 3 * 3_600_000) : null,
      lastViewedAt: s.views ? new Date(now.getTime() - (s.createdAgoH - 1) * 3_600_000) : null,
    });
  }

  // Activity history over the last two weeks.
  const ev = (daysAgo: number, hour: number, action: string, target = "", detail = "", ip = "102.89.34.17", success = true) => ({
    userId: demo.id,
    email: action.startsWith("auth") ? DEMO_EMAIL : null,
    action,
    target,
    detail,
    ip,
    success,
    createdAt: at(daysAgo, hour, (daysAgo * 7 + hour * 3) % 60),
  });
  await db.insert(auditEvents).values([
    ev(13, 9, "auth.sign_in"),
    ev(13, 9, "project.create", "Portfolio Site"),
    ev(12, 14, "env.import", "Hostel Finder / production", "4 added, 0 updated, 0 skipped"),
    ev(10, 11, "secret.reveal", "production / DATABASE_URL"),
    ev(9, 16, "share.create", "MAPBOX_TOKEN (production)", "1 view(s), 7d"),
    ev(9, 17, "share.view", "MAPBOX_TOKEN (production)", "view 1 of 1", "105.112.24.9"),
    ev(7, 10, "secret.rotate", "production / DATABASE_URL", "now version 2"),
    ev(5, 8, "env.export", "Campus Pay API / development", "2 keys"),
    ev(3, 23, "auth.sign_in_failed", "", "", "41.203.72.6", false),
    ev(3, 23, "auth.sign_in_failed", "", "", "41.203.72.6", false),
    ev(3, 23, "auth.sign_in_failed", "", "", "41.203.72.6", false),
    ev(2, 9, "auth.sign_in"),
    ev(2, 9, "secret.reveal", "staging / PAYSTACK_SECRET_KEY"),
    ev(1, 12, "share.revoke", "RESEND_API_KEY (production)"),
    ev(0, 8, "share.create", "DATABASE_URL (staging)", "1 view(s), 24h"),
  ]);

  return { demoId: demo.id, otherId: other.id, projectIds, secretIds };
}

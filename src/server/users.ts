import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { users, type User } from "@/db/schema";
import { lockoutDecision, WINDOW_MINUTES } from "@/lib/lockout";
import { failedSignInsSince, recordEvent } from "./audit";

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "locked"; retryAfterMinutes?: number };

// A real bcrypt hash used to keep timing similar when the email does not exist.
let dummyHash: string | null = null;
function dummy() {
  dummyHash ??= bcrypt.hashSync("hush-timing-dummy", 10);
  return dummyHash;
}

export async function findUserByEmail(db: DB, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return u ?? null;
}

export async function findUserById(db: DB, id: number) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u ?? null;
}

export async function createUser(db: DB, input: { name: string; email: string; password: string }, ip = "") {
  const existing = await findUserByEmail(db, input.email);
  if (existing) return { ok: false as const, error: "An account with this email already exists" };
  const passwordHash = await bcrypt.hash(input.password, 10);
  const [user] = await db.insert(users).values({ name: input.name, email: input.email.toLowerCase(), passwordHash }).returning();
  await recordEvent(db, { userId: user.id, email: user.email, action: "auth.sign_up", ip });
  return { ok: true as const, user };
}

export async function authenticate(db: DB, email: string, password: string, now: Date, ip = ""): Promise<AuthResult> {
  const normal = email.toLowerCase();
  const failures = await failedSignInsSince(db, normal, new Date(now.getTime() - WINDOW_MINUTES * 60_000));
  const decision = lockoutDecision(failures, now);
  const user = await findUserByEmail(db, normal);

  if (decision.locked) {
    await recordEvent(db, { userId: user?.id ?? null, email: normal, action: "auth.locked", ip, success: false, at: now });
    return { ok: false, reason: "locked", retryAfterMinutes: decision.retryAfterMinutes };
  }

  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummy());
  if (!user || !valid) {
    await recordEvent(db, { userId: user?.id ?? null, email: normal, action: "auth.sign_in_failed", ip, success: false, at: now });
    return { ok: false, reason: "invalid" };
  }
  await recordEvent(db, { userId: user.id, email: normal, action: "auth.sign_in", ip, at: now });
  return { ok: true, user };
}

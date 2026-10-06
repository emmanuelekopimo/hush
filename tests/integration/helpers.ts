import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, type DB } from "@/db";
import { deriveKey } from "@/lib/crypto";
import { resetDatabase, seed } from "@/server/seed";

export const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/hush_test";
export const TODAY = "2026-10-06";
export const NOW = new Date(`${TODAY}T10:00:00Z`);
export const vault = deriveKey("test-session-secret-0123456789abcdef", "hush-vault-v1");

export async function setupDb() {
  const { db, pool } = createDb(TEST_URL);
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, pool };
}

export async function freshSeed(db: DB) {
  await resetDatabase(db);
  return seed(db, { today: TODAY, vault, now: NOW });
}

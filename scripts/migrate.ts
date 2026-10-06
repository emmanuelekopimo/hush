import "dotenv/config";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db";

/** Create the target database if it does not exist yet (useful on a shared Postgres server). */
async function ensureDatabase(url: string) {
  const probe = new Client({ connectionString: url });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (e) {
    await probe.end().catch(() => undefined);
    if ((e as { code?: string }).code !== "3D000") throw e;
  }
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Refusing to create database with name "${name}"`);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  console.log(`Created database ${name}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  await ensureDatabase(url);
  const { db, pool } = createDb(url);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { hushPool?: Pool; hushDb?: DB };

export function getDb(): DB {
  if (!globalForDb.hushDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.hushPool = new Pool({ connectionString: url, max: 10 });
    globalForDb.hushDb = drizzle(globalForDb.hushPool, { schema });
  }
  return globalForDb.hushDb;
}

export function createDb(url: string): { db: DB; pool: Pool } {
  const pool = new Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

export { schema };

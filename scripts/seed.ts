import "dotenv/config";
import { createDb } from "../src/db";
import { getToday } from "../src/lib/dates";
import { isEmpty, resetDatabase, seed } from "../src/server/seed";
import { deriveKey } from "../src/lib/crypto";

// Usage: tsx scripts/seed.ts          reset and seed
//        tsx scripts/seed.ts --if-empty  seed only when there are no users
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, pool } = createDb(url);
  const ifEmpty = process.argv.includes("--if-empty");
  if (ifEmpty && !(await isEmpty(db))) {
    console.log("Database already has data. Skipping seed.");
  } else {
    await resetDatabase(db);
    const vault = deriveKey(process.env.VAULT_KEY || process.env.SESSION_SECRET || "", "hush-vault-v1");
    await seed(db, { today: getToday(), vault });
    console.log("Demo data seeded");
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

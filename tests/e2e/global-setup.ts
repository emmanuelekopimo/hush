import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { stdio: "inherit", env: process.env });
}

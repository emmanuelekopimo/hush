import { arrow, box, entity, svg } from "./svg";

export function architecture() {
  return svg(900, 470, `
${box(20, 30, 170, 70, "Browser", ["Pages, forms, tools", "Web Crypto, canvas"])}
${box(250, 30, 170, 70, "proxy.ts", ["Checks the session", "cookie (JWT)"])}
${box(480, 20, 400, 200, "", [], { dashed: true })}
<text x="500" y="44" font-size="12" font-weight="600" fill="#555">Next.js app (one Railway service)</text>
${box(500, 58, 170, 64, "Server Components", ["read data, render HTML"])}
${box(690, 58, 170, 64, "Server Actions", ["forms, Zod validation"])}
${box(500, 140, 170, 64, "Route handlers", ["/api/health, export"])}
${box(690, 140, 170, 64, "src/server", ["vault, shares, audit"])}
${box(560, 270, 240, 70, "src/lib (pure rules)", ["crypto, rotation, envfile,", "scanner, scramble, seal"], { dark: true })}
${box(250, 270, 220, 70, "PostgreSQL", ["users, projects, secrets,", "share_links, audit_events"])}
${box(20, 270, 170, 70, "Client-only tools", ["scanner, scrambler,", "file sealing"])}
${box(250, 380, 400, 60, "Railway", ["build, run migrations, seed if empty, health check"], { dashed: true })}
${arrow(190, 65, 248, 65, "HTTPS")}
${arrow(420, 65, 498, 65, "allowed")}
${arrow(775, 204, 690, 268, "uses")}
${arrow(690, 172, 472, 290, "Drizzle ORM")}
${arrow(105, 100, 105, 268, "runs locally")}
`);
}

export function encryptionFlow() {
  return svg(900, 300, `
${box(20, 40, 170, 64, "Secret value", ["typed in a form"])}
${box(20, 160, 170, 64, "SESSION_SECRET", ["or VAULT_KEY"])}
${box(250, 160, 170, 64, "HKDF-SHA256", ["vault key, 32 bytes"])}
${box(250, 40, 170, 64, "AAD", ["project : env : key"])}
${box(480, 90, 180, 84, "AES-256-GCM", ["random 12 byte IV", "16 byte auth tag"], { dark: true })}
${box(720, 90, 160, 84, "secrets.ciphertext", ["v1.iv.tag.data"])}
${arrow(190, 72, 478, 112, "plaintext")}
${arrow(190, 192, 248, 192)}
${arrow(420, 192, 478, 152, "key")}
${arrow(420, 72, 478, 102, "")}
${arrow(660, 132, 718, 132, "store")}
<text x="450" y="270" text-anchor="middle" font-size="12" fill="#555">Moving a ciphertext to another row changes the AAD, so decryption fails. Changing one byte fails the tag check.</text>
`);
}

export function erd() {
  const users = entity(30, 30, 220, "users", [["id", "serial PK"], ["name", "text"], ["email", "text unique"], ["password_hash", "bcrypt"], ["created_at", "timestamptz"]]);
  const projects = entity(330, 30, 220, "projects", [["id", "serial PK"], ["user_id", "FK users"], ["name", "text"], ["description", "text"], ["created_at", "timestamptz"]]);
  const secrets = entity(630, 30, 250, "secrets", [["id", "serial PK"], ["user_id", "FK users"], ["project_id", "FK projects"], ["environment", "text"], ["key", "text"], ["ciphertext", "AES-GCM"], ["fingerprint", "hash"], ["rotation_days", "int"], ["last_rotated_on", "date"], ["expires_on", "date null"], ["version", "int"]]);
  const shares = entity(330, 300, 250, "share_links", [["id", "serial PK"], ["user_id", "FK users"], ["secret_id", "FK secrets"], ["token_hash", "sha256 unique"], ["ciphertext", "null when used"], ["max_views / views", "int"], ["expires_at", "timestamptz"], ["revoked_at", "timestamptz"]]);
  const audit = entity(30, 300, 220, "audit_events", [["id", "serial PK"], ["user_id", "FK users"], ["email", "text"], ["action", "text"], ["target", "text"], ["ip", "text"], ["success", "bool"], ["created_at", "timestamptz"]]);
  return svg(910, 520, `
${users.svg}${projects.svg}${secrets.svg}${shares.svg}${audit.svg}
${arrow(250, 70, 328, 70, "1 : many")}
${arrow(550, 70, 628, 70, "1 : many")}
${arrow(700, 30 + secrets.h, 560, 298, "1 : many")}
${arrow(140, 30 + users.h, 140, 298, "1 : many")}
<text x="755" y="${30 + secrets.h + 40}" text-anchor="middle" font-size="11" fill="#555">unique (project_id, environment, key)</text>
`);
}

export function shareSequence() {
  const lane = (x: number, label: string) => `<text x="${x}" y="28" text-anchor="middle" font-size="13" font-weight="600">${label}</text><line x1="${x}" y1="40" x2="${x}" y2="400" stroke="#bbb" stroke-dasharray="4 4"/>`;
  const msg = (x1: number, x2: number, y: number, t: string) => arrow(x1, y, x2, y, t);
  return svg(900, 420, `
${lane(110, "Owner")}${lane(370, "Hush server")}${lane(620, "PostgreSQL")}${lane(820, "Recipient")}
${msg(110, 368, 80, "create link (secret, expiry, views)")}
${msg(370, 618, 120, "store sha256(token), value encrypted with key from token")}
${msg(368, 112, 160, "link /s/token (shown once)")}
${arrow(112, 200, 818, 200, "sends link by chat or email", { dashed: true })}
${msg(818, 372, 240, "open page (no view used yet)")}
${msg(818, 372, 280, "press Reveal")}
${msg(370, 618, 320, "UPDATE views+1 WHERE views < max AND not expired")}
${msg(368, 818, 360, "value shown; ciphertext deleted when views run out")}
`);
}

export function rotationFlow() {
  return svg(900, 230, `
${box(20, 80, 170, 64, "Secret", ["last rotated, every N days,", "expires on"])}
${box(250, 80, 150, 64, "Expired?", ["expires_on < today"])}
${box(450, 80, 150, 64, "Late?", ["due date < today"])}
${box(650, 80, 150, 64, "Within 7 days?", ["due date - today"])}
${box(250, 170, 150, 44, "expired", [], { dark: true })}
${box(450, 170, 150, 44, "overdue", [], { dark: true })}
${box(650, 170, 150, 44, "due", [], { dark: true })}
${box(820, 90, 70, 44, "ok", [], { dark: true })}
${arrow(190, 112, 248, 112)}
${arrow(400, 112, 448, 112, "no")}
${arrow(600, 112, 648, 112, "no")}
${arrow(800, 112, 818, 112, "")}
${arrow(325, 144, 325, 168, "yes")}
${arrow(525, 144, 525, 168, "yes")}
${arrow(725, 144, 725, 168, "yes")}
<text x="450" y="40" text-anchor="middle" font-size="12" fill="#555">rotationStatus(secret, today): due date = last rotated + rotation days</text>
`);
}

export function scrambleFlow() {
  return svg(900, 230, `
${box(20, 70, 150, 70, "Key", ["e.g. uniuyo-2026"])}
${box(210, 70, 150, 70, "Seed", ["FNV-1a + SplitMix"])}
${box(400, 20, 200, 70, "Block permutation", ["Fisher-Yates shuffle"], { dark: true })}
${box(400, 120, 200, 70, "Colour mask", ["XOR R, G, B with stream"], { dark: true })}
${box(650, 70, 230, 70, "Scrambled PNG", ["same size, alpha unchanged"])}
${arrow(170, 105, 208, 105)}
${arrow(360, 95, 398, 60)}
${arrow(360, 115, 398, 150)}
${arrow(600, 55, 648, 95)}
${arrow(600, 155, 648, 115)}
<text x="450" y="215" text-anchor="middle" font-size="12" fill="#555">Unscramble runs the same steps in reverse order with the same key and block size.</text>
`);
}

export function deployment() {
  return svg(900, 200, `
${box(20, 60, 140, 70, "Developer", ["feature branch"])}
${box(200, 60, 140, 70, "GitHub", ["pull request, merge to main"])}
${box(380, 60, 140, 70, "Railway build", ["npm run build"])}
${box(560, 60, 150, 70, "Start", ["migrate, seed if empty,", "next start"])}
${box(750, 60, 130, 70, "Health check", ["/api/health + DB"], { dark: true })}
${arrow(160, 95, 198, 95, "push")}
${arrow(340, 95, 378, 95, "webhook")}
${arrow(520, 95, 558, 95)}
${arrow(710, 95, 748, 95)}
<text x="450" y="170" text-anchor="middle" font-size="12" fill="#555">Traffic moves to the new version only after the health check returns OK.</text>
`);
}

export const DIAGRAMS = { architecture, encryptionFlow, erd, shareSequence, rotationFlow, scrambleFlow, deployment };

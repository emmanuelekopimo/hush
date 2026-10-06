// Written content for the documentation PDF. Plain HTML fragments.

export const TESTS = { unit: 61, integration: 18, e2eDesktop: 17, e2eMobile: 2, total: 98 };
const LIVE = "https://hush-production-70be.up.railway.app";

const table = (head: string[], rows: string[][], cls = "") =>
  `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

export const CONTENT = {
  dateLabel: "October 2026",
  liveUrl: LIVE,

  overview: `
<p>Hush is a web application for keeping the environment variables of software projects in one safe place. Developers usually keep database passwords, payment keys and API tokens in <code>.env</code> files that get copied between laptops, pasted into group chats and sometimes committed to GitHub by mistake. Hush replaces that habit with an encrypted vault that also tells you which keys are old, which are reused, and who looked at what.</p>
<h3>The problem</h3>
<p>Student and startup teams in Nigeria often share secrets on WhatsApp, keep the same password in development and production, and never rotate keys after a teammate leaves. When a key leaks, nobody knows how old it is or where else it is used.</p>
<h3>What Hush does</h3>
${table(["Feature", "What it gives the user"], [
    ["Encrypted vault", "Projects with development, staging and production variables. Values are encrypted with AES-256-GCM before they reach the database."],
    ["Rotation tracking", "Each secret has a rotation period and an optional expiry. Hush marks it healthy, due soon, overdue or expired, and scores the whole vault."],
    ["Reuse detection", "A keyed fingerprint of each value shows when the same secret is used in two places, without comparing plaintext."],
    [".env import and export", "Paste a .env file to import it, or download an environment as a .env file. Bad lines are reported with line numbers."],
    ["One-time share links", "Send a secret with a link that works a set number of times and expires. The server keeps only a hash of the link."],
    ["Leak scanner", "Paste code or logs to find API keys, tokens, private keys and passwords. Runs in the browser."],
    ["Image scrambler", "Scramble a picture with a key so only people with the key can restore it."],
    ["File sealing", "Encrypt any file with a passphrase in the browser and download a .hush file."],
    ["Secret generator", "Strong random values with an entropy estimate."],
    ["Activity log", "Every sign-in, failed sign-in, reveal, export and share is recorded with the IP address."],
  ])}
<h3>Demo account</h3>
<p>The live site is <strong>${LIVE}</strong>. The sign-in page is pre-filled with <code>demo@hush.ng</code> and <code>demo1234</code>. The demo vault has three projects with a mix of healthy, due, overdue and expired secrets, share links in every state and two weeks of activity, so every screen has something to show.</p>
<h3>Technology</h3>
${table(["Layer", "Choice"], [
    ["Framework", "Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript in strict mode"],
    ["Database", "PostgreSQL with Drizzle ORM and versioned SQL migrations from drizzle-kit"],
    ["Validation", "Zod schemas with one inline error per field"],
    ["Authentication", "bcryptjs password hashes, HS256 JWT signed with jose in an HTTP-only cookie"],
    ["Cryptography", "Node crypto (AES-256-GCM, HKDF, SHA-256) on the server; Web Crypto (PBKDF2, AES-GCM) in the browser"],
    ["Interface", "Plain CSS in a monochrome dark theme, lucide-react icons, DiceBear avatars made locally, Inter and JetBrains Mono from Fontsource"],
    ["Tests and hosting", "Vitest, Playwright, GitHub and Railway"],
  ])}`,

  logic: `
<p>All business rules live as pure functions in <code>src/lib</code>. They take "today" or "now" as an argument instead of reading the clock, so tests and demos are repeatable. Setting <code>HUSH_TODAY=YYYY-MM-DD</code> pins the date for the whole app.</p>
<h3>Encryption at rest</h3>
<p>The vault key is derived from <code>SESSION_SECRET</code> (or a separate <code>VAULT_KEY</code>) with HKDF-SHA256 and a purpose label, so the session key and the vault key are different even though they come from one secret. Each value is encrypted with AES-256-GCM using a fresh random 12-byte IV. The stored text is <code>v1.iv.tag.data</code>.</p>
<p>The encryption also takes additional authenticated data (AAD) made of the project id, environment and key name. If someone with database access copies the ciphertext of a production key into a staging row, decryption fails because the AAD no longer matches. Changing any byte fails the 16-byte authentication tag.</p>
<pre>export function encrypt(plaintext: string, key: Buffer, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ct].map(b64url).join(".");
}</pre>
<h3>Rotation status</h3>
<p><code>rotationStatus(secret, today)</code> computes the due date as last rotated plus the rotation period, then checks in order: expired (expiry date before today), overdue (due date before today), due (within 7 days) and otherwise ok. Saving a new value is treated as a rotation: the version number goes up and the clock restarts. The vault health score starts at 100 and loses points per secret, with expired costing more than overdue, and overdue more than due.</p>`,

  logic2: `
<h3>One-time share links</h3>
<p>A link carries a random 24-byte token. The database stores only <code>sha256(token)</code> and a copy of the value encrypted with a key derived from the token itself, so even a full database leak does not reveal shared values. Opening the page only shows the label. The Reveal button runs a single conditional UPDATE that increases the view count only if the link is not revoked, not expired and has views left. Two people pressing Reveal at the same moment cannot both succeed. When the last view is used, the stored ciphertext is set to NULL.</p>
<h3>Sign-in protection</h3>
<p>Failed sign-ins are recorded in the audit log. <code>lockoutDecision(failures, now)</code> refuses sign-in after five failures for the same email in 15 minutes, even with the right password, until the oldest failure leaves the window. Unknown emails still run a bcrypt comparison so response times do not reveal which emails exist.</p>
<h3>Leak scanner</h3>
<p><code>scanText</code> first applies rules for known formats (AWS access keys, GitHub tokens, Stripe and Paystack keys, Slack tokens, Google API keys, JWTs, private key blocks and database URLs with passwords). It then looks for assignments such as <code>API_TOKEN = "..."</code> and keeps only values whose Shannon entropy is at least 3 bits per character, which filters out placeholders like <code>changeme</code>. Matches are redacted before they are shown.</p>`,

  logic3: `
<h3>Image scrambling</h3>
<p>The key is hashed into a 32-bit seed. A deterministic generator seeded with it drives a Fisher-Yates shuffle of the image's blocks and produces a mask that is XOR-ed into the red, green and blue values of every pixel. Unscrambling applies the mask again and moves each block back. The result is exact for PNG files. This is keyed obfuscation that keeps the file a valid image; for real confidentiality Hush offers file sealing.</p>
<h3>File sealing</h3>
<p>The browser derives an AES-256 key from the passphrase with PBKDF2-SHA256 (210,000 iterations and a random 16-byte salt) and encrypts the original name, type and contents with AES-GCM. The output starts with the bytes <code>HUSH1</code> so the tool can tell sealed files apart. A wrong passphrase or any change to the file fails the tag check.</p>`,

  architecture: `
<p>Hush is one Next.js application. <code>src/proxy.ts</code> runs before every page and redirects visitors without a valid session cookie to the sign-in page. Pages are Server Components that read from the database through services in <code>src/server</code>. Forms call Server Actions, which validate input with Zod and return field errors for the form to show inline. The scanner, scrambler, sealer and generator are Client Components that use only <code>src/lib</code> and browser APIs, so their input never leaves the device.</p>
${table(["Folder", "Contents"], [
    ["src/lib", "Pure rules: crypto, rotation, envfile, scanner, shares, lockout, scramble, seal, generator, validation, session"],
    ["src/server", "Database services: vault (projects and secrets), shares, users, audit, seed, session helpers"],
    ["src/app", "Pages, layouts, Server Actions, the export route and /api/health"],
    ["src/db", "Drizzle schema and the connection pool"],
    ["drizzle", "Numbered SQL migrations"],
    ["scripts", "migrate, seed and the documentation builder"],
    ["tests", "unit, integration and e2e suites"],
  ])}
<h3>Security measures</h3>
${table(["Threat", "Measure"], [
    ["Database leak", "Values encrypted with AES-256-GCM; share links stored as hashes; passwords hashed with bcrypt"],
    ["Ciphertext swapping", "AAD binds each value to its project, environment and key"],
    ["Session theft by scripts", "HTTP-only, SameSite=Lax cookie, Secure in production"],
    ["Brute-force sign-in", "Lockout after 5 failures in 15 minutes; failures logged with IP"],
    ["Seeing other users' data", "Every query filters by the signed-in user's id; other ids return 404"],
    ["Link previews burning a share", "Opening the page does not count; only the Reveal button does"],
    ["Clickjacking and sniffing", "X-Frame-Options DENY, nosniff, no-referrer, HSTS headers"],
  ])}`,

  dataModel: `
<p>The database has five tables. A unique index on <code>(project_id, environment, key)</code> stops duplicate keys even if application code has a bug. Deleting a project deletes its secrets through a cascading foreign key; deleting a secret keeps its share links for the audit trail but clears the link to the secret.</p>`,

  local: `
<p>Requirements: Node.js 20.9 or newer and PostgreSQL 14 or newer.</p>
<pre>service postgresql start
createdb hush
cp .env.example .env          # set DATABASE_URL and SESSION_SECRET
npm install
npm run db:migrate            # apply SQL migrations
npm run db:seed               # demo data dated relative to today
npm run dev                   # http://localhost:3000</pre>
<p>Sign in with <code>demo@hush.ng</code> and <code>demo1234</code>. To freeze the date for a demo, add <code>HUSH_TODAY=2026-10-06</code> to <code>.env</code>.</p>
${table(["Script", "What it does"], [
    ["npm run dev / build / start", "Develop, build and serve the app"],
    ["npm run db:generate", "Create a new SQL migration after changing src/db/schema.ts"],
    ["npm run db:migrate", "Apply migrations (creates the database first if it is missing)"],
    ["npm run db:seed", "Reset and seed demo data; db:seed:if-empty seeds only an empty database"],
    ["npm test", "Unit and integration tests (needs the hush_test database)"],
    ["npm run test:e2e", "Playwright tests on desktop and mobile (needs a build and the hush_e2e database)"],
    ["npm run docs", "Rebuild this PDF"],
  ])}`,

  testing: `
<p>Tests run at three levels. All use a fixed date, and none depend on the network.</p>
${table(["Suite", "Tests", "What it checks"], [
    ["Unit (Vitest)", String(TESTS.unit), "Dates, encryption and AAD, tamper detection, rotation and health score, .env parsing and writing, scanner rules, share states, lockout, scrambling round trip, file sealing, generator bias, validation, session tokens"],
    ["Integration (Vitest, real PostgreSQL)", String(TESTS.integration), "Seed data, ciphertext only in the database, user scoping, create, reveal, rotate, reuse detection, import and export, one-time links including two simultaneous opens, lockout, sign-up"],
    ["End-to-end desktop (Playwright)", String(TESTS.e2eDesktop), "Sign in and up, errors, redirects, project statuses, reveal and audit, add and rotate secrets, import and export, share link opened once, scanner, scrambler, sealing, generator, 404 for other users, health check"],
    ["End-to-end mobile (Playwright, Pixel 7)", String(TESTS.e2eMobile), "No sideways scrolling on eight pages; bottom navigation and revealing a secret"],
    ["<strong>Total</strong>", `<strong>${TESTS.total}</strong>`, "All passing"],
  ])}
<pre>createdb hush_test &amp;&amp; createdb hush_e2e
npm test                 # 79 unit and integration tests
npm run build &amp;&amp; npm run test:e2e   # 19 browser tests</pre>
<h3>Selected test cases</h3>
${table(["Case", "Expected", "Result"], [
    ["Sign in with the pre-filled demo account", "Dashboard greets Friday", "Pass"],
    ["Copy a production ciphertext into another row", "Decryption fails", "Pass"],
    ["Open a one-time link twice at the same moment", "Exactly one succeeds", "Pass"],
    ["Six sign-ins with a wrong password, then the right one", "Locked for 15 minutes", "Pass"],
    ["Import a .env with a line missing =", "Inline error: Line 4: Missing = sign", "Pass"],
    ["Unscramble with a wrong key", "Image stays scrambled", "Pass"],
    ["Open another user's project by URL", "404 page", "Pass"],
    ["View eight pages on a phone", "No horizontal scrolling", "Pass"],
  ])}`,

  deployment: `
<p>Hush runs on Railway in the project <em>school-projects</em> as the service <code>hush</code>, deployed from the <code>main</code> branch of the GitHub repository. Every merge to main triggers a new build.</p>
${table(["Setting", "Value"], [
    ["Build", "npm run build"],
    ["Start", "npm run db:migrate, then npm run db:seed:if-empty, then next start -H 0.0.0.0"],
    ["Health check", "/api/health runs select 1 on the database and returns {\"status\":\"ok\"}"],
    ["DATABASE_URL", "Reference to the Postgres service in the project, database name hush"],
    ["SESSION_SECRET", "48 random characters, set once in Railway variables"],
    ["NODE_ENV", "production"],
    ["Public URL", LIVE],
  ])}
<div class="note">The Railway project already had ten database volumes, the most it allows, so Hush uses its own database named <code>hush</code> on an existing Postgres server instead of a new volume. The migrate script creates the database on first start if it does not exist.</div>
<p>Changing <code>SESSION_SECRET</code> signs everyone out and makes stored values unreadable, because the vault key is derived from it. To rotate the session key without losing data, set <code>VAULT_KEY</code> to the old secret first.</p>`,

  script: `
<p>Sign in on the live site before you start and keep a second browser window (or a phone) ready for the share link.</p>
${table(["Time", "What to say and do"], [
    ["0:00 to 0:40", "Problem. \"Developers keep passwords and API keys in .env files and share them on WhatsApp. Keys never get rotated and nobody knows who saw what.\" Show the landing page and the six features."],
    ["0:40 to 1:30", "Sign in (the demo login is pre-filled). On the overview, point at the health score of 75, then the Needs attention list: an expired SMTP password, an overdue Paystack key and keys due this week. Point at Reused values: 2."],
    ["1:30 to 2:30", "Open Campus Pay API. Reveal DATABASE_URL and say the database only holds ciphertext. Point at the Reused badge on JWT_SECRET and the Expired badge. Switch to staging and show the missing-keys panel. Click Export .env."],
    ["2:30 to 3:15", "Open Hostel Finder, edit ADMIN_PASSWORD, use the generator value as the new password and save. Show it turn Healthy and the version go up."],
    ["3:15 to 4:00", "Share links: create a one-time link for a staging key, open it on the phone, press Reveal, then refresh to show it no longer works. Back on Activity, show the Share link opened event and the three failed sign-ins from 41.203.72.6."],
    ["4:00 to 4:40", "Leak scanner: Load a leaky sample and show the findings. Tools: scramble the student ID card, unscramble with a wrong key (still noise), then the right key (restored)."],
    ["4:40 to 5:00", "Close: AES-256-GCM with bound AAD, hashed share links, lockout, 98 automated tests, deployed on Railway. Invite questions."],
  ], "script")}
<h3>Likely questions</h3>
${table(["Question", "Short answer"], [
    ["What if the database is stolen?", "The attacker gets ciphertext and hashes. Without SESSION_SECRET or VAULT_KEY, which lives only in Railway, the values cannot be read."],
    ["Can the admin of the server read secrets?", "Yes, the server can decrypt to show values. A future version would encrypt in the browser with per-user keys so the server never sees plaintext."],
    ["Is the image scrambler real encryption?", "No. It keeps the file a viewable image. Use Seal a file for confidential data."],
    ["Why not just use a password manager?", "Hush is built around projects and environments: rotation periods, .env import and export, differences between environments and reuse detection."],
  ])}`,
};

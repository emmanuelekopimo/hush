import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// Secrets are encrypted at rest with AES-256-GCM. The key is derived from the
// server secret with HKDF, so the database alone is not enough to read them.
// Each value is bound to its location (project, environment, key name) with
// additional authenticated data, so a ciphertext copied to another row fails.

const VERSION = "v1";

export function deriveKey(secret: string, purpose: string): Buffer {
  if (!secret || secret.length < 16) throw new Error("Server secret must be at least 16 characters");
  return Buffer.from(hkdfSync("sha256", secret, "hush-salt-v1", purpose, 32));
}

export function encrypt(plaintext: string, key: Buffer, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string, key: Buffer, aad = ""): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unknown ciphertext format");
  const [, iv, tag, ct] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** AAD that ties a secret value to where it lives. */
export function secretAad(projectId: number, environment: string, name: string): string {
  return `secret:${projectId}:${environment}:${name}`;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Show the first few characters and hide the rest. */
export function maskValue(value: string): string {
  if (value.length <= 4) return "•".repeat(8);
  const visible = Math.min(4, Math.floor(value.length / 4));
  return value.slice(0, visible) + "•".repeat(8);
}

/** Fingerprint used to detect duplicate or reused secret values without showing them. */
export function fingerprint(value: string): string {
  return sha256(`hush-fp:${value}`).slice(0, 12);
}

import { deriveKey } from "@/lib/crypto";

let cached: { source: string; key: Buffer } | null = null;

/** Vault key for secrets at rest. VAULT_KEY if set, otherwise derived from SESSION_SECRET. */
export function vaultKey(): Buffer {
  const source = process.env.VAULT_KEY || process.env.SESSION_SECRET || "";
  if (!cached || cached.source !== source) cached = { source, key: deriveKey(source, "hush-vault-v1") };
  return cached.key;
}

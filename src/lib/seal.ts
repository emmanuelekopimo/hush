// Seal any file with a passphrase, entirely in the browser. Uses Web Crypto:
// PBKDF2-SHA256 to turn the passphrase into a key, AES-256-GCM to encrypt.
// File layout: "HUSH1" | salt (16) | iv (12) | ciphertext. The original file
// name and type are encrypted together with the contents.

const MAGIC = new TextEncoder().encode("HUSH1");
export const PBKDF2_ITERATIONS = 210_000;

export interface SealedFile {
  name: string;
  type: string;
  data: Uint8Array;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("Web Crypto is not available");
  return s;
}

async function keyFrom(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealFile(file: SealedFile, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  if (passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = new TextEncoder().encode(JSON.stringify({ name: file.name, type: file.type }));
  const plain = new Uint8Array(4 + header.length + file.data.length);
  new DataView(plain.buffer).setUint32(0, header.length);
  plain.set(header, 4);
  plain.set(file.data, 4 + header.length);
  const key = await keyFrom(passphrase, salt, iterations);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(MAGIC.length + 16 + 12 + ct.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + 16);
  out.set(ct, MAGIC.length + 28);
  return out;
}

export function isSealed(data: Uint8Array): boolean {
  return data.length > MAGIC.length + 28 && MAGIC.every((b, i) => data[i] === b);
}

export async function unsealFile(data: Uint8Array, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<SealedFile> {
  if (!isSealed(data)) throw new Error("This is not a Hush sealed file");
  const salt = data.slice(MAGIC.length, MAGIC.length + 16);
  const iv = data.slice(MAGIC.length + 16, MAGIC.length + 28);
  const ct = data.slice(MAGIC.length + 28);
  const key = await keyFrom(passphrase, salt, iterations);
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv }, key, ct));
  } catch {
    throw new Error("Wrong passphrase or the file was changed");
  }
  const headerLen = new DataView(plain.buffer).getUint32(0);
  const header = JSON.parse(new TextDecoder().decode(plain.slice(4, 4 + headerLen))) as { name: string; type: string };
  return { name: header.name, type: header.type, data: plain.slice(4 + headerLen) };
}

export function sealedName(name: string): string {
  return `${name}.hush`;
}

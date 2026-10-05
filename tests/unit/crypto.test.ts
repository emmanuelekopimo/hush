import { describe, expect, it } from "vitest";
import { decrypt, deriveKey, encrypt, fingerprint, maskValue, randomToken, safeEqual, secretAad, sha256 } from "@/lib/crypto";

const key = deriveKey("unit-test-secret-0123456789", "vault");

describe("crypto", () => {
  it("round-trips a value", () => {
    const ct = encrypt("postgres://user:pass@host/db", key, "aad");
    expect(ct.startsWith("v1.")).toBe(true);
    expect(decrypt(ct, key, "aad")).toBe("postgres://user:pass@host/db");
  });
  it("uses a fresh IV every time", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });
  it("rejects the wrong key", () => {
    const other = deriveKey("another-secret-0123456789", "vault");
    expect(() => decrypt(encrypt("x", key), other)).toThrow();
  });
  it("rejects a ciphertext moved to another secret (AAD)", () => {
    const ct = encrypt("value", key, secretAad(1, "production", "API_KEY"));
    expect(() => decrypt(ct, key, secretAad(1, "staging", "API_KEY"))).toThrow();
  });
  it("detects tampering", () => {
    const ct = encrypt("value", key);
    const parts = ct.split(".");
    const data = Buffer.from(parts[3], "base64url");
    data[0] ^= 1;
    parts[3] = data.toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
  });
  it("derives different keys for different purposes", () => {
    expect(deriveKey("s".repeat(20), "a").equals(deriveKey("s".repeat(20), "b"))).toBe(false);
    expect(() => deriveKey("short", "a")).toThrow();
  });
  it("masks values", () => {
    expect(maskValue("abc")).toBe("•".repeat(8));
    expect(maskValue("supersecretvalue").startsWith("supe")).toBe(true);
  });
  it("hashes, fingerprints and compares safely", () => {
    expect(sha256("a")).toHaveLength(64);
    expect(fingerprint("x")).toBe(fingerprint("x"));
    expect(fingerprint("x")).not.toBe(fingerprint("y"));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});

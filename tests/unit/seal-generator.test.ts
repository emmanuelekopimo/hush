import { describe, expect, it } from "vitest";
import { isSealed, sealFile, sealedName, unsealFile } from "@/lib/seal";
import { ALPHABETS, entropyBits, generateSecret, strengthLabel } from "@/lib/generator";

const FAST = 1000; // fewer PBKDF2 rounds keep unit tests quick

describe("seal", () => {
  const file = { name: "notes.txt", type: "text/plain", data: new TextEncoder().encode("exam answers") };
  it("seals and unseals with the same passphrase", async () => {
    const sealed = await sealFile(file, "correct horse", FAST);
    expect(isSealed(sealed)).toBe(true);
    const back = await unsealFile(sealed, "correct horse", FAST);
    expect(back.name).toBe("notes.txt");
    expect(back.type).toBe("text/plain");
    expect(new TextDecoder().decode(back.data)).toBe("exam answers");
  });
  it("rejects a wrong passphrase and tampered data", async () => {
    const sealed = await sealFile(file, "correct horse", FAST);
    await expect(unsealFile(sealed, "wrong horse", FAST)).rejects.toThrow("Wrong passphrase");
    sealed[sealed.length - 1] ^= 1;
    await expect(unsealFile(sealed, "correct horse", FAST)).rejects.toThrow();
  });
  it("hides the file name and refuses short passphrases or non-Hush files", async () => {
    const sealed = await sealFile(file, "correct horse", FAST);
    expect(Buffer.from(sealed).includes(Buffer.from("notes.txt"))).toBe(false);
    await expect(sealFile(file, "short")).rejects.toThrow();
    await expect(unsealFile(new Uint8Array(100), "whatever1")).rejects.toThrow("not a Hush");
    expect(sealedName("a.pdf")).toBe("a.pdf.hush");
  });
});

describe("generator", () => {
  it("generates the requested length from the alphabet", () => {
    const s = generateSecret(40, "hex");
    expect(s).toHaveLength(40);
    expect([...s].every((c) => ALPHABETS.hex.includes(c))).toBe(true);
  });
  it("rejects biased bytes (rejection sampling)", () => {
    // 62 chars: bytes >= 248 must be skipped
    const bytes = [250, 255, 0, 61, 62];
    const s = generateSecret(3, "alphanumeric", () => Uint8Array.from(bytes));
    expect(s).toBe("A9A");
  });
  it("estimates entropy and strength", () => {
    expect(entropyBits(32, "alphanumeric")).toBe(191);
    expect(strengthLabel(40)).toBe("Weak");
    expect(strengthLabel(64)).toBe("Fair");
    expect(strengthLabel(100)).toBe("Strong");
    expect(strengthLabel(191)).toBe("Very strong");
  });
});

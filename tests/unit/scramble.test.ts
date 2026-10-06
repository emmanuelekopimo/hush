import { describe, expect, it } from "vitest";
import { permutation, prng, scramblePixels, seedFromKey } from "@/lib/scramble";

function image(w: number, h: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i++) d[i] = (i * 7) % 256;
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  return d;
}

describe("scramble", () => {
  it("makes the same seed from the same key", () => {
    expect(seedFromKey("abc")).toBe(seedFromKey("abc"));
    expect(seedFromKey("abc")).not.toBe(seedFromKey("abd"));
  });
  it("produces a valid permutation", () => {
    const p = permutation(100, prng(42));
    expect([...p].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect(p).not.toEqual(Array.from({ length: 100 }, (_, i) => i));
  });
  it("scrambles and restores exactly with the right key", () => {
    const w = 37, h = 29; // not multiples of the block size
    const original = image(w, h);
    const opts = { width: w, height: h, key: "secret", blockSize: 8 };
    const scrambled = scramblePixels(original, { ...opts, mode: "scramble" });
    expect(Buffer.from(scrambled).equals(Buffer.from(original))).toBe(false);
    const restored = scramblePixels(scrambled, { ...opts, mode: "unscramble" });
    expect(Buffer.from(restored).equals(Buffer.from(original))).toBe(true);
  });
  it("does not restore with a wrong key or block size", () => {
    const original = image(32, 32);
    const scrambled = scramblePixels(original, { width: 32, height: 32, key: "right", blockSize: 8, mode: "scramble" });
    const wrongKey = scramblePixels(scrambled, { width: 32, height: 32, key: "wrong", blockSize: 8, mode: "unscramble" });
    const wrongBlock = scramblePixels(scrambled, { width: 32, height: 32, key: "right", blockSize: 4, mode: "unscramble" });
    expect(Buffer.from(wrongKey).equals(Buffer.from(original))).toBe(false);
    expect(Buffer.from(wrongBlock).equals(Buffer.from(original))).toBe(false);
  });
  it("keeps alpha unchanged", () => {
    const out = scramblePixels(image(16, 16), { width: 16, height: 16, key: "k", blockSize: 4, mode: "scramble" });
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
  });
  it("validates input", () => {
    expect(() => scramblePixels(new Uint8ClampedArray(10), { width: 2, height: 2, key: "k", blockSize: 1, mode: "scramble" })).toThrow();
    expect(() => scramblePixels(image(2, 2), { width: 2, height: 2, key: "", blockSize: 1, mode: "scramble" })).toThrow();
  });
});

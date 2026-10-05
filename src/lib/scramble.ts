// Reversible image scrambling. A key is turned into a seed, the seed drives a
// pseudo-random generator, and the generator decides how blocks of pixels are
// shuffled and how each colour value is masked. Running the same steps backwards
// with the same key restores the exact original pixels (for lossless PNG files).
//
// This is keyed obfuscation for images that must stay viewable as images, not a
// replacement for real encryption. Use "Seal a file" for confidential files.

export type Mode = "scramble" | "unscramble";

/** FNV-1a then SplitMix32 to spread a text key into a 32-bit seed. */
export function seedFromKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h = (h + 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Small, fast, deterministic generator (Mulberry32). Same seed, same sequence. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates permutation of 0..n-1. */
export function permutation(n: number, rand: () => number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

export interface ScrambleOptions {
  width: number;
  height: number;
  key: string;
  blockSize: number;
  mode: Mode;
}

/**
 * Scramble or unscramble RGBA pixels. Full blocks are shuffled; every pixel's
 * RGB values are XOR-masked. Alpha is left alone. Returns a new array.
 */
export function scramblePixels(data: Uint8ClampedArray, opts: ScrambleOptions): Uint8ClampedArray {
  const { width, height, key, mode } = opts;
  const bs = Math.max(1, Math.floor(opts.blockSize));
  if (data.length !== width * height * 4) throw new Error("Pixel data does not match the image size");
  if (!key) throw new Error("A key is required");

  const seed = seedFromKey(key);
  const cols = Math.floor(width / bs);
  const rows = Math.floor(height / bs);
  const perm = permutation(cols * rows, prng(seed));

  const maskRand = prng(seed ^ 0xa5a5a5a5);
  const mask = new Uint8Array(width * height * 3);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.floor(maskRand() * 256);

  const applyMask = (buf: Uint8ClampedArray) => {
    for (let p = 0, m = 0; p < buf.length; p += 4, m += 3) {
      buf[p] ^= mask[m];
      buf[p + 1] ^= mask[m + 1];
      buf[p + 2] ^= mask[m + 2];
    }
  };

  const moveBlocks = (src: Uint8ClampedArray, forward: boolean) => {
    const out = new Uint8ClampedArray(src);
    for (let b = 0; b < perm.length; b++) {
      const from = forward ? b : perm[b];
      const to = forward ? perm[b] : b;
      const fx = (from % cols) * bs, fy = Math.floor(from / cols) * bs;
      const tx = (to % cols) * bs, ty = Math.floor(to / cols) * bs;
      for (let y = 0; y < bs; y++) {
        const s = ((fy + y) * width + fx) * 4;
        const d = ((ty + y) * width + tx) * 4;
        out.set(src.subarray(s, s + bs * 4), d);
      }
    }
    return out;
  };

  if (mode === "scramble") {
    const moved = moveBlocks(data, true);
    applyMask(moved);
    return moved;
  }
  const unmasked = new Uint8ClampedArray(data);
  applyMask(unmasked);
  return moveBlocks(unmasked, false);
}

export const BLOCK_SIZES = [4, 8, 16, 32] as const;

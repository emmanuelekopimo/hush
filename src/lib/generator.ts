// Strong random secret generator. Uses rejection sampling so every character
// in the alphabet is equally likely.

export const ALPHABETS = {
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  hex: "0123456789abcdef",
  symbols: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#%+-.:=@^_~",
} as const;

export type AlphabetName = keyof typeof ALPHABETS;

export function generateSecret(length: number, alphabet: AlphabetName = "alphanumeric", random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const chars = ALPHABETS[alphabet];
  const limit = 256 - (256 % chars.length);
  let out = "";
  while (out.length < length) {
    for (const b of random(length * 2)) {
      if (b < limit) out += chars[b % chars.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Bits of entropy for a random secret of this length and alphabet. */
export function entropyBits(length: number, alphabet: AlphabetName): number {
  return Math.round(length * Math.log2(ALPHABETS[alphabet].length));
}

export function strengthLabel(bits: number): "Weak" | "Fair" | "Strong" | "Very strong" {
  if (bits < 50) return "Weak";
  if (bits < 80) return "Fair";
  if (bits < 128) return "Strong";
  return "Very strong";
}

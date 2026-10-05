// Builds sample text for the leak scanner demo. Tokens are generated at run
// time so no real-looking credentials are stored in the source code.

function rand(chars: string, n: number, random: (n: number) => Uint8Array) {
  return Array.from(random(n), (b) => chars[b % chars.length]).join("");
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HEX = "0123456789abcdef";

export function sampleLeakyCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const r = (c: string, n: number) => rand(c, n, random);
  return [
    "// payments.js",
    'import axios from "axios";',
    "",
    `const PAYSTACK_SECRET_KEY = "sk_live_${r(HEX, 40)}";`,
    `const awsKey = "AKIA${r(UPPER, 16)}";`,
    `const db = "postgres://admin:${r(ALNUM, 14)}@db.campuspay.ng:5432/prod";`,
    "",
    "// this one is fine, it reads from the environment",
    "const jwtSecret = process.env.JWT_SECRET;",
    "",
    "export async function charge(email, amount) {",
    `  const API_TOKEN = "${r(ALNUM, 32)}";`,
    `  const gh = "ghp_${r(ALNUM, 36)}";`,
    "  return axios.post(url, { email, amount });",
    "}",
  ].join("\n");
}

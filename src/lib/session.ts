import { jwtVerify, SignJWT } from "jose";

// Signed session token (HS256 JWT) kept in an HTTP-only cookie.
export const SESSION_COOKIE = "hush_session";
export const SESSION_DAYS = 7;

export interface SessionPayload {
  uid: number;
  name: string;
}

function secretKey(secret: string | undefined): Uint8Array {
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret = process.env.SESSION_SECRET, now = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.uid))
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_DAYS * 86_400)
    .setIssuer("hush")
    .sign(secretKey(secret));
}

export async function verifySession(token: string | undefined, secret = process.env.SESSION_SECRET): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { issuer: "hush", algorithms: ["HS256"] });
    const uid = Number(payload.sub);
    if (!Number.isInteger(uid) || uid <= 0) return null;
    return { uid, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

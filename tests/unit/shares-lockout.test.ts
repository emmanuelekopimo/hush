import { describe, expect, it } from "vitest";
import { expiryDate, shareStatus, timeLeft } from "@/lib/shares";
import { lockoutDecision, MAX_FAILURES } from "@/lib/lockout";

const now = new Date("2026-10-06T12:00:00Z");
const later = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("shareStatus", () => {
  it("is active before expiry with views left", () => {
    expect(shareStatus({ expiresAt: later(1), maxViews: 1, views: 0, revokedAt: null }, now)).toBe("active");
  });
  it("is used when views run out, even before expiry", () => {
    expect(shareStatus({ expiresAt: later(1), maxViews: 2, views: 2, revokedAt: null }, now)).toBe("used");
  });
  it("is expired at the exact expiry time", () => {
    expect(shareStatus({ expiresAt: now, maxViews: 1, views: 0, revokedAt: null }, now)).toBe("expired");
  });
  it("revoked wins", () => {
    expect(shareStatus({ expiresAt: later(1), maxViews: 1, views: 0, revokedAt: now }, now)).toBe("revoked");
  });
  it("computes expiry dates and time left", () => {
    expect(expiryDate("1h", now).toISOString()).toBe("2026-10-06T13:00:00.000Z");
    expect(expiryDate("7d", now).toISOString()).toBe("2026-10-13T12:00:00.000Z");
    expect(timeLeft(later(0.5), now)).toBe("30 min left");
    expect(timeLeft(later(5), now)).toBe("5 h left");
    expect(timeLeft(later(-1), now)).toBe("expired");
  });
});

describe("lockoutDecision", () => {
  const mins = (m: number) => new Date(now.getTime() - m * 60_000);
  it("allows sign-in below the limit", () => {
    expect(lockoutDecision([mins(1), mins(2)], now)).toEqual({ locked: false, remaining: MAX_FAILURES - 2, retryAfterMinutes: 0 });
  });
  it("locks after five recent failures", () => {
    const d = lockoutDecision([mins(1), mins(2), mins(3), mins(4), mins(5)], now);
    expect(d.locked).toBe(true);
    expect(d.retryAfterMinutes).toBe(10);
  });
  it("ignores failures older than the window", () => {
    expect(lockoutDecision([mins(16), mins(20), mins(30), mins(40), mins(50)], now).locked).toBe(false);
  });
});

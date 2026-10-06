// Brute-force protection: after too many failed sign-ins for one email in a
// short window, further attempts are refused until the window passes.

export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

export interface LockoutDecision {
  locked: boolean;
  remaining: number;
  retryAfterMinutes: number;
}

export function lockoutDecision(failures: Date[], now: Date): LockoutDecision {
  const windowStart = now.getTime() - WINDOW_MINUTES * 60_000;
  const recent = failures.filter((d) => d.getTime() > windowStart).sort((a, b) => a.getTime() - b.getTime());
  if (recent.length >= MAX_FAILURES) {
    const unlockAt = recent[recent.length - MAX_FAILURES].getTime() + WINDOW_MINUTES * 60_000;
    return { locked: true, remaining: 0, retryAfterMinutes: Math.max(1, Math.ceil((unlockAt - now.getTime()) / 60_000)) };
  }
  return { locked: false, remaining: MAX_FAILURES - recent.length, retryAfterMinutes: 0 };
}

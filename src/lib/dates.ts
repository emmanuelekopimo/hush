// Date helpers. Business rules work on plain YYYY-MM-DD strings so they are
// easy to reason about and test with a fixed "today".

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date. HUSH_TODAY=YYYY-MM-DD pins it for demos and tests. */
export function getToday(env: Record<string, string | undefined> = process.env, now: Date = new Date()): string {
  const pinned = env.HUSH_TODAY;
  if (pinned && isIsoDate(pinned)) return pinned;
  return toIsoDate(now);
}

/** "Now" as a Date. When HUSH_TODAY is set, the clock time of day is kept but the date is pinned. */
export function getNow(env: Record<string, string | undefined> = process.env, now: Date = new Date()): Date {
  const pinned = env.HUSH_TODAY;
  if (pinned && isIsoDate(pinned)) {
    return new Date(`${pinned}T${now.toISOString().slice(11)}`);
  }
  return now;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

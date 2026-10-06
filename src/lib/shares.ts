// One-time share links. A link can be opened a limited number of times and
// stops working after its expiry time, whichever comes first.

export type ShareStatus = "active" | "used" | "expired" | "revoked";

export interface ShareInput {
  expiresAt: Date;
  maxViews: number;
  views: number;
  revokedAt: Date | null;
}

export function shareStatus(s: ShareInput, now: Date): ShareStatus {
  if (s.revokedAt) return "revoked";
  if (s.views >= s.maxViews) return "used";
  if (s.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

export const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 hour", hours: 1 },
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "7d", label: "7 days", hours: 24 * 7 },
] as const;

export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number]["value"];

export function expiryDate(option: ExpiryOption, now: Date): Date {
  const hours = EXPIRY_OPTIONS.find((o) => o.value === option)?.hours ?? 24;
  return new Date(now.getTime() + hours * 3_600_000);
}

export function timeLeft(expiresAt: Date, now: Date): string {
  const mins = Math.round((expiresAt.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "expired";
  if (mins < 60) return `${mins} min left`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h left`;
  return `${Math.round(hours / 24)} days left`;
}

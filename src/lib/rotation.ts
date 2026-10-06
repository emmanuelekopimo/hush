import { addDays, diffDays } from "./dates";

export type SecretStatus = "ok" | "due" | "overdue" | "expired";

export interface RotationInput {
  lastRotatedOn: string;
  rotationDays: number;
  expiresOn: string | null;
}

export interface RotationResult {
  status: SecretStatus;
  /** Date the next rotation is due. */
  dueOn: string;
  /** Days from today until due (negative when late). */
  daysLeft: number;
  label: string;
}

/** A secret is "due" this many days before its rotation date. */
export const DUE_SOON_DAYS = 7;

export function rotationStatus(input: RotationInput, today: string): RotationResult {
  const dueOn = addDays(input.lastRotatedOn, input.rotationDays);
  const daysLeft = diffDays(today, dueOn);

  if (input.expiresOn && input.expiresOn < today) {
    const ago = diffDays(input.expiresOn, today);
    return { status: "expired", dueOn, daysLeft, label: `Expired ${ago} day${ago === 1 ? "" : "s"} ago` };
  }
  if (daysLeft < 0) {
    return { status: "overdue", dueOn, daysLeft, label: `Rotation ${-daysLeft} day${daysLeft === -1 ? "" : "s"} late` };
  }
  if (daysLeft <= DUE_SOON_DAYS) {
    return {
      status: "due",
      dueOn,
      daysLeft,
      label: daysLeft === 0 ? "Rotate today" : `Rotate in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    };
  }
  return { status: "ok", dueOn, daysLeft, label: `Next rotation in ${daysLeft} days` };
}

export interface HealthSummary {
  total: number;
  ok: number;
  due: number;
  overdue: number;
  expired: number;
  /** 0 to 100. Overdue and expired secrets cost more than ones that are only due. */
  score: number;
  grade: "Good" | "Fair" | "At risk";
}

export function healthSummary(statuses: SecretStatus[]): HealthSummary {
  const count = (s: SecretStatus) => statuses.filter((x) => x === s).length;
  const total = statuses.length;
  const ok = count("ok");
  const due = count("due");
  const overdue = count("overdue");
  const expired = count("expired");
  const score = total === 0 ? 100 : Math.max(0, Math.round(100 - ((due * 0.25 + overdue + expired * 1.5) / total) * 100));
  const grade = score >= 80 ? "Good" : score >= 50 ? "Fair" : "At risk";
  return { total, ok, due, overdue, expired, score, grade };
}

export function statusRank(status: SecretStatus): number {
  return { expired: 0, overdue: 1, due: 2, ok: 3 }[status];
}

import { describe, expect, it } from "vitest";
import { healthSummary, rotationStatus, statusRank } from "@/lib/rotation";

const today = "2026-10-06";

describe("rotationStatus", () => {
  it("is ok when far from due", () => {
    const r = rotationStatus({ lastRotatedOn: "2026-09-20", rotationDays: 90, expiresOn: null }, today);
    expect(r.status).toBe("ok");
    expect(r.dueOn).toBe("2026-12-19");
    expect(r.daysLeft).toBe(74);
  });
  it("is due within 7 days, including today", () => {
    expect(rotationStatus({ lastRotatedOn: "2026-07-13", rotationDays: 90, expiresOn: null }, today).status).toBe("due");
    const r = rotationStatus({ lastRotatedOn: "2026-07-08", rotationDays: 90, expiresOn: null }, today);
    expect(r.daysLeft).toBe(0);
    expect(r.label).toBe("Rotate today");
  });
  it("is overdue after the due date", () => {
    const r = rotationStatus({ lastRotatedOn: "2026-06-01", rotationDays: 90, expiresOn: null }, today);
    expect(r.status).toBe("overdue");
    expect(r.label).toMatch(/late/);
  });
  it("expired wins over every other state", () => {
    const r = rotationStatus({ lastRotatedOn: "2026-10-01", rotationDays: 90, expiresOn: "2026-10-05" }, today);
    expect(r.status).toBe("expired");
    expect(r.label).toBe("Expired 1 day ago");
  });
  it("is not expired on the expiry day itself", () => {
    expect(rotationStatus({ lastRotatedOn: "2026-10-01", rotationDays: 90, expiresOn: today }, today).status).toBe("ok");
  });
});

describe("healthSummary", () => {
  it("gives 100 for an empty or healthy vault", () => {
    expect(healthSummary([]).score).toBe(100);
    expect(healthSummary(["ok", "ok"]).grade).toBe("Good");
  });
  it("weights expired more than overdue more than due", () => {
    const due = healthSummary(["due", "ok", "ok", "ok"]).score;
    const overdue = healthSummary(["overdue", "ok", "ok", "ok"]).score;
    const expired = healthSummary(["expired", "ok", "ok", "ok"]).score;
    expect(due).toBeGreaterThan(overdue);
    expect(overdue).toBeGreaterThan(expired);
  });
  it("counts each status and never goes below zero", () => {
    const s = healthSummary(["expired", "expired", "overdue"]);
    expect(s).toMatchObject({ total: 3, expired: 2, overdue: 1, score: 0, grade: "At risk" });
  });
  it("ranks the worst first", () => {
    expect(statusRank("expired")).toBeLessThan(statusRank("ok"));
  });
});

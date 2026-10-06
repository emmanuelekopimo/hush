import { describe, expect, it } from "vitest";
import { addDays, diffDays, getNow, getToday, isIsoDate, relativeDays } from "@/lib/dates";

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-10-06")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("06/10/2026")).toBe(false);
  });
  it("uses HUSH_TODAY when set", () => {
    expect(getToday({ HUSH_TODAY: "2026-01-15" })).toBe("2026-01-15");
    expect(getToday({}, new Date("2026-03-01T10:00:00Z"))).toBe("2026-03-01");
    expect(getToday({ HUSH_TODAY: "bad" }, new Date("2026-03-01T10:00:00Z"))).toBe("2026-03-01");
  });
  it("pins the date but keeps the clock time in getNow", () => {
    expect(getNow({ HUSH_TODAY: "2026-01-15" }, new Date("2026-03-01T10:30:00.000Z")).toISOString()).toBe("2026-01-15T10:30:00.000Z");
  });
  it("adds and diffs days across months and leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-10-01", "2026-10-06")).toBe(5);
    expect(diffDays("2026-10-06", "2026-10-01")).toBe(-5);
  });
  it("describes relative days", () => {
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(3)).toBe("in 3 days");
    expect(relativeDays(-2)).toBe("2 days ago");
  });
});

import { describe, expect, it } from "vitest";
import { redact, scanSummary, scanText, shannonEntropy } from "@/lib/scanner";
import { sampleLeakyCode } from "@/lib/samples";

// Build token-shaped strings at run time.
const awsId = "AKIA" + "IOSFODNN7EXAMPLE";
const gh = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8";

describe("scanner", () => {
  it("finds known token formats with line and column", () => {
    const f = scanText(`line one\nconst k = "${awsId}";`);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "AWS access key ID", severity: "high", line: 2, column: 12 });
    expect(f[0].redacted).not.toContain(awsId.slice(4, 12));
  });
  it("finds GitHub tokens, private keys and database URLs", () => {
    const text = [gh, "-----BEGIN RSA PRIVATE KEY-----", "postgres://admin:hunter22@db.example.com/app"].join("\n");
    const rules = scanText(text).map((f) => f.rule);
    expect(rules).toEqual(["GitHub token", "Private key block", "Database URL with password"]);
  });
  it("flags high-entropy hard-coded assignments", () => {
    const f = scanText('const API_TOKEN = "Zx9Qw2Lp8Rt5Yh3Nm6Kd1Fg4";');
    expect(f).toHaveLength(1);
    expect(f[0].rule).toBe("Hard-coded API_TOKEN");
  });
  it("ignores environment references, placeholders and low entropy", () => {
    expect(scanText("const API_KEY = process.env.API_KEY;")).toEqual([]);
    expect(scanText('PASSWORD="changeme123"')).toEqual([]);
    expect(scanText('SECRET="aaaaaaaaaaaa"')).toEqual([]);
  });
  it("does not report the same text twice", () => {
    const f = scanText(`DATABASE_PASSWORD=postgres://u:p4ssw0rd@h/db`);
    expect(f).toHaveLength(1);
  });
  it("finds several leaks in the demo sample", () => {
    const fixed = (n: number) => new Uint8Array(n).map((_, i) => (i * 37 + 11) % 256);
    const summary = scanSummary(scanText(sampleLeakyCode(fixed)));
    expect(summary.total).toBeGreaterThanOrEqual(5);
    expect(summary.high).toBeGreaterThanOrEqual(4);
  });
  it("computes entropy and redaction", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
    expect(shannonEntropy("abcd")).toBe(2);
    expect(redact("short")).toBe("•".repeat(5));
    expect(redact("abcdefghijkl").startsWith("abcd")).toBe(true);
  });
});

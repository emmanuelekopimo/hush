// Leak scanner: finds secrets pasted into code, logs or chat messages.
// Uses known token formats first, then Shannon entropy for unknown ones.

export type Severity = "high" | "medium" | "low";

export interface Finding {
  rule: string;
  severity: Severity;
  line: number;
  column: number;
  match: string;
  /** Match with the middle hidden, safe to show on screen. */
  redacted: string;
  advice: string;
}

interface Rule {
  id: string;
  name: string;
  severity: Severity;
  pattern: RegExp;
  advice: string;
}

export const RULES: Rule[] = [
  { id: "private-key", name: "Private key block", severity: "high", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, advice: "Revoke the key pair and generate a new one." },
  { id: "aws-access-key", name: "AWS access key ID", severity: "high", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, advice: "Deactivate the key in AWS IAM and create a new one." },
  { id: "github-token", name: "GitHub token", severity: "high", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, advice: "Revoke the token in GitHub developer settings." },
  { id: "stripe-key", name: "Stripe secret key", severity: "high", pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, advice: "Roll the key in the Stripe dashboard." },
  { id: "paystack-key", name: "Paystack secret key", severity: "high", pattern: /\bsk_(?:live|test)_[a-f0-9]{40}\b/g, advice: "Generate a new secret key in Paystack settings." },
  { id: "slack-token", name: "Slack token", severity: "high", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, advice: "Revoke the token in the Slack app settings." },
  { id: "google-api-key", name: "Google API key", severity: "medium", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, advice: "Restrict or regenerate the key in Google Cloud." },
  { id: "jwt", name: "JSON Web Token", severity: "medium", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, advice: "Treat as a live session. Rotate the signing secret if it is long-lived." },
  { id: "db-url", name: "Database URL with password", severity: "high", pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]+@[^\s"'`]+/g, advice: "Change the database password and update the connection string." },
];

const ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY)[A-Za-z0-9_]*)\s*[:=]\s*["']?([^\s"'`,;]{8,})/gi;

export function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function redact(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 6))}${value.slice(-2)}`;
}

function position(text: string, index: number) {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const column = index - before.lastIndexOf("\n");
  return { line, column };
}

export function scanText(text: string): Finding[] {
  const findings: Finding[] = [];
  const taken: [number, number][] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      taken.push([start, end]);
      findings.push({ rule: rule.name, severity: rule.severity, ...position(text, start), match: m[0], redacted: redact(m[0]), advice: rule.advice });
    }
  }

  for (const m of text.matchAll(ASSIGNMENT)) {
    const value = m[2];
    const start = (m.index ?? 0) + m[0].lastIndexOf(value);
    const end = start + value.length;
    if (overlaps(start, end)) continue;
    if (/^(?:process\.env|\$\{|<|your|xxx|changeme|example)/i.test(value)) continue;
    const entropy = shannonEntropy(value);
    if (entropy < 3) continue;
    taken.push([start, end]);
    findings.push({
      rule: `Hard-coded ${m[1]}`,
      severity: entropy >= 3.8 ? "high" : "medium",
      ...position(text, start),
      match: value,
      redacted: redact(value),
      advice: "Move this value into Hush and read it from the environment.",
    });
  }

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function scanSummary(findings: Finding[]) {
  return {
    total: findings.length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };
}

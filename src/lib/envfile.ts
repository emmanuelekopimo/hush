// Parse and write .env files. Supports comments, blank lines, "export",
// single and double quotes, and escaped newlines inside double quotes.

export interface EnvEntry {
  key: string;
  value: string;
}

export interface ParseResult {
  entries: EnvEntry[];
  errors: { line: number; message: string }[];
}

export const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnv(text: string): ParseResult {
  const entries: EnvEntry[] = [];
  const errors: ParseResult["errors"] = [];
  const seen = new Map<string, number>();
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    let line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (line.startsWith("export ")) line = line.slice(7).trim();

    const eq = line.indexOf("=");
    if (eq === -1) {
      errors.push({ line: lineNo, message: "Missing = sign" });
      return;
    }
    const key = line.slice(0, eq).trim();
    if (!KEY_PATTERN.test(key)) {
      errors.push({ line: lineNo, message: `Invalid key "${key}"` });
      return;
    }
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"')) {
      const end = value.lastIndexOf('"');
      value = end > 0 ? value.slice(1, end) : value.slice(1);
      value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else if (value.startsWith("'")) {
      const end = value.lastIndexOf("'");
      value = end > 0 ? value.slice(1, end) : value.slice(1);
    } else {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    const existing = seen.get(key);
    if (existing !== undefined) {
      entries[existing] = { key, value };
    } else {
      seen.set(key, entries.length);
      entries.push({ key, value });
    }
  });

  return { entries, errors };
}

function quote(value: string): string {
  if (value === "") return "";
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function serializeEnv(entries: EnvEntry[], header?: string): string {
  const lines: string[] = [];
  if (header) header.split("\n").forEach((h) => lines.push(`# ${h}`));
  [...entries]
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach((e) => lines.push(`${e.key}=${quote(e.value)}`));
  return lines.join("\n") + "\n";
}

/** Compare two environments by key name only. Values are never compared in the clear. */
export function diffKeys(left: string[], right: string[]) {
  const l = new Set(left);
  const r = new Set(right);
  return {
    onlyLeft: [...l].filter((k) => !r.has(k)).sort(),
    onlyRight: [...r].filter((k) => !l.has(k)).sort(),
    both: [...l].filter((k) => r.has(k)).sort(),
  };
}

import { describe, expect, it } from "vitest";
import { diffKeys, parseEnv, serializeEnv } from "@/lib/envfile";

describe("parseEnv", () => {
  it("parses comments, export, quotes and inline comments", () => {
    const { entries, errors } = parseEnv(`# comment
export API_URL=https://api.test
NAME="Hush App"
SINGLE='it is #raw'
PORT=3000 # inline
MULTI="line1\\nline2"
EMPTY=
`);
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { key: "API_URL", value: "https://api.test" },
      { key: "NAME", value: "Hush App" },
      { key: "SINGLE", value: "it is #raw" },
      { key: "PORT", value: "3000" },
      { key: "MULTI", value: "line1\nline2" },
      { key: "EMPTY", value: "" },
    ]);
  });
  it("reports bad lines with line numbers", () => {
    const { errors } = parseEnv("GOOD=1\nno equals here\n9BAD=2");
    expect(errors).toEqual([
      { line: 2, message: "Missing = sign" },
      { line: 3, message: 'Invalid key "9BAD"' },
    ]);
  });
  it("keeps the last value of a duplicate key", () => {
    expect(parseEnv("A=1\nA=2").entries).toEqual([{ key: "A", value: "2" }]);
  });
  it("handles Windows line endings", () => {
    expect(parseEnv("A=1\r\nB=2\r\n").entries).toHaveLength(2);
  });
});

describe("serializeEnv", () => {
  it("sorts keys, quotes when needed and round-trips", () => {
    const entries = [
      { key: "B", value: "has space" },
      { key: "A", value: "plain" },
      { key: "C", value: 'quote " and\nnewline' },
    ];
    const text = serializeEnv(entries, "header");
    expect(text.startsWith("# header\nA=plain\nB=")).toBe(true);
    const back = parseEnv(text).entries;
    expect(back.find((e) => e.key === "C")?.value).toBe('quote " and\nnewline');
    expect(back.find((e) => e.key === "B")?.value).toBe("has space");
  });
});

describe("diffKeys", () => {
  it("finds keys missing on each side", () => {
    expect(diffKeys(["A", "B", "C"], ["B", "D"])).toEqual({ onlyLeft: ["A", "C"], onlyRight: ["D"], both: ["B"] });
  });
});

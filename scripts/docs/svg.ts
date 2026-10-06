// Tiny helpers for drawing clean, print-friendly diagrams as SVG strings.

export const INK = "#111111";
export const SOFT = "#f2f2f2";
export const MID = "#d4d4d4";
export const ACCENT = "#000000";

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function box(x: number, y: number, w: number, h: number, title: string, lines: string[] = [], opts: { dark?: boolean; dashed?: boolean } = {}) {
  const fill = opts.dark ? INK : SOFT;
  const text = opts.dark ? "#ffffff" : INK;
  const sub = opts.dark ? "#cfcfcf" : "#555555";
  const dash = opts.dashed ? ' stroke-dasharray="5 4"' : "";
  const lineH = 15;
  const total = 18 + lines.length * lineH;
  const top = y + h / 2 - total / 2 + 13;
  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${opts.dark ? INK : "#bdbdbd"}" stroke-width="1.2"${dash}/>
  <text x="${x + w / 2}" y="${top}" text-anchor="middle" font-size="13.5" font-weight="600" fill="${text}">${esc(title)}</text>
  ${lines.map((l, i) => `<text x="${x + w / 2}" y="${top + 18 + i * lineH}" text-anchor="middle" font-size="11.5" fill="${sub}">${esc(l)}</text>`).join("\n  ")}
</g>`;
}

export function arrow(x1: number, y1: number, x2: number, y2: number, label = "", opts: { dashed?: boolean; labelDy?: number } = {}) {
  const dash = opts.dashed ? ' stroke-dasharray="5 4"' : "";
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + (opts.labelDy ?? -6);
  return `<g>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.4" marker-end="url(#arrow)"${dash}/>
  ${label ? `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#444" paint-order="stroke" stroke="#fff" stroke-width="4">${esc(label)}</text>` : ""}
</g>`;
}

export function svg(w: number, h: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Inter Variable, Inter, sans-serif">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${INK}"/></marker></defs>
<rect width="${w}" height="${h}" fill="#ffffff"/>
${body}
</svg>`;
}

export function entity(x: number, y: number, w: number, name: string, cols: [string, string][]) {
  const h = 30 + cols.length * 19 + 8;
  return {
    h,
    svg: `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
  <path d="M${x} ${y + 10}a10 10 0 0 1 10-10h${w - 20}a10 10 0 0 1 10 10v20h-${w}z" fill="${INK}"/>
  <text x="${x + 12}" y="${y + 20}" font-size="13" font-weight="600" fill="#fff">${esc(name)}</text>
  ${cols.map(([c, t], i) => `<text x="${x + 12}" y="${y + 48 + i * 19}" font-size="11.5" fill="${INK}" font-family="JetBrains Mono, monospace">${esc(c)}</text><text x="${x + w - 12}" y="${y + 48 + i * 19}" text-anchor="end" font-size="10.5" fill="#777">${esc(t)}</text>`).join("\n  ")}
</g>`,
  };
}

import type { Field, Flag, Unpacker } from "./types.ts";

const ENTITY = /&([a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);/g;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶",
  deg: "°", plusmn: "±", times: "×", divide: "÷",
  frac12: "½", frac14: "¼", frac34: "¾", bull: "•", middot: "·",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  agrave: "à", egrave: "è", ograve: "ò", ugrave: "ù",
  auml: "ä", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü",
  ntilde: "ñ", ccedil: "ç", szlig: "ß", yuml: "ÿ",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", alpha: "α", beta: "β", gamma: "γ", delta: "δ",
  larr: "←", uarr: "↑", rarr: "→", darr: "↓", harr: "↔", check: "✓", cross: "✗",
};

function decodeEntity(body: string): string | null {
  if (body.startsWith("#")) {
    const hex = body[1] === "x" || body[1] === "X";
    const digits = hex ? body.slice(2) : body.slice(1);
    const code = Number.parseInt(digits, hex ? 16 : 10);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return null;
    try {
      return String.fromCodePoint(code);
    } catch {
      return null;
    }
  }
  return NAMED[body] ?? null;
}

function decode(input: string): { text: string; count: number } {
  let count = 0;
  const text = input.replace(ENTITY, (full, body: string) => {
    const value = decodeEntity(body);
    if (value === null) return full;
    count++;
    return value;
  });
  return { text, count };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function analyze(input: string) {
  const matches = [...input.matchAll(ENTITY)];
  let decodedCount = 0;
  for (const match of matches) {
    if (decodeEntity(match[1]) !== null) decodedCount++;
  }
  const ampersands = (input.match(/&/g) ?? []).length;
  return { decodedCount, malformed: Math.max(0, ampersands - matches.length) };
}

export const htmlEntities: Unpacker = {
  id: "htmlEntities",
  label: "HTML entities",
  score(input) {
    const { decodedCount } = analyze(input);
    if (!decodedCount) return 0;
    return decodedCount >= 3 ? 0.95 : 0.8;
  },
  unpack(input) {
    const { decodedCount, malformed } = analyze(input);
    if (!decodedCount) return null;
    const { text } = decode(input);
    const flags: Flag[] = [{ severity: "info" as const, text: `Decoded ${decodedCount} ${decodedCount === 1 ? "entity" : "entities"}` }];
    if (malformed) {
      flags.push({ severity: "warn" as const, text: `${malformed} malformed or undecodable ${malformed === 1 ? "entity" : "entities"} left as-is` });
    }
    const fields: Field[] = [
      { label: "encoded form", value: escapeHtml(text) },
      { label: "entities decoded", value: String(decodedCount) },
    ];
    return { id: "htmlEntities", label: "HTML entities", flags, fields, sections: [], text };
  },
};

import type { Unpacked, Unpacker } from "./types.ts";

export const MAX_CHAIN_DEPTH = 5;

export type Detector = (input: string) => { unpacker: Unpacker; score: number }[];

function stringsIn(value: unknown, out: string[], depth: number): void {
  if (depth > 4) return;
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) stringsIn(item, out, depth + 1);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) stringsIn(item, out, depth + 1);
  }
}

export function suggestNext(result: Unpacked, source: string, detect: Detector, depth: number): Unpacked["next"] {
  if (depth >= MAX_CHAIN_DEPTH) return [];

  const candidates: string[] = [];
  if (result.text) candidates.push(result.text);
  for (const section of result.sections) stringsIn(section.json, candidates, 0);

  const seen = new Set([source.trim()]);
  const next: NonNullable<Unpacked["next"]> = [];
  for (const raw of candidates) {
    const value = raw.trim();
    if (value.length < 6 || seen.has(value)) continue;
    seen.add(value);
    for (const match of detect(value)) {
      if (match.score < 0.5 || match.unpacker.id === result.id) continue;
      next.push({ label: `Unpack as ${match.unpacker.label}`, input: value, id: match.unpacker.id });
      if (next.length >= 3) return next;
    }
  }
  return next;
}

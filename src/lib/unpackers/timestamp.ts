import type { Field, Flag, Unpacker } from "./types.ts";
import { relativeTime } from "./util.ts";

interface Interpretation {
  label: string;
  ms: number;
  iso: string;
  local: string;
  relative: string;
}

const UNITS = [
  { label: "Unix seconds", factor: 1000 },
  { label: "Unix milliseconds", factor: 1 },
  { label: "Unix microseconds", factor: 0.001 },
  { label: "Unix nanoseconds", factor: 0.000001 },
] as const;

const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function make(label: string, ms: number, now: number): Interpretation | null {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return {
    label,
    ms,
    iso: date.toISOString(),
    local: date.toLocaleString(),
    relative: relativeTime(ms / 1000, now),
  };
}

function plausible(ms: number): boolean {
  const year = new Date(ms).getUTCFullYear();
  return year >= 1970 && year <= 2100;
}

function primaryLabel(digits: number): string {
  if (digits <= 10) return "Unix seconds";
  if (digits <= 13) return "Unix milliseconds";
  if (digits <= 16) return "Unix microseconds";
  return "Unix nanoseconds";
}

function interpretations(s: string, now: number): Interpretation[] {
  if (ISO.test(s)) {
    const ms = Date.parse(s);
    const best = make("ISO 8601", ms, now);
    if (!best) return [];
    const epoch = make("Unix milliseconds", ms, now)!;
    return [best, epoch];
  }

  const value = Number(s);
  const digits = s.replace(/^[+-]/, "").length;
  const bestLabel = primaryLabel(digits);
  const all: { label: string; interpretation: Interpretation }[] = [];
  for (const unit of UNITS) {
    const interpretation = make(unit.label, value * unit.factor, now);
    if (interpretation) all.push({ label: unit.label, interpretation });
  }

  const ordered = [
    ...all.filter((item) => item.label === bestLabel).map((item) => item.interpretation),
    ...all.filter((item) => item.label !== bestLabel && plausible(item.interpretation.ms)).map((item) => item.interpretation),
  ];
  return ordered.slice(0, 3);
}

export const timestamp: Unpacker = {
  id: "timestamp",
  label: "Timestamp",
  score(input) {
    const s = input.trim();
    if (ISO.test(s)) return 0.95;
    if (/^[+-]?\d{9,19}$/.test(s)) return 0.9;
    return 0;
  },
  unpack(input) {
    const s = input.trim();
    const now = Date.now();
    const options = interpretations(s, now);
    if (!options.length) return null;
    const best = options[0];

    const fields: Field[] = [
      { label: "interpreted as", value: best.label },
      { label: "UTC", value: best.iso },
      { label: "local", value: best.local },
      { label: "relative", value: best.relative },
    ];
    const flags: Flag[] = [{ severity: "info" as const, text: `Best guess: ${best.label}` }];
    if (options.length > 1) {
      flags.push({ severity: "info" as const, text: `${options.length} possible interpretations; best guess first` });
    }

    return {
      id: "timestamp",
      label: "Timestamp",
      headline: best.relative,
      flags,
      fields,
      sections: options.length > 1 ? [{ title: "All interpretations", json: options }] : [],
    };
  },
};

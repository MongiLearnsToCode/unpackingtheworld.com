/** Decode base64 or base64url (with or without padding) to bytes. Returns null if invalid. */
export function b64ToBytes(input: string): Uint8Array | null {
  const s = input.trim().replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(s)) return null;
  if (s.length % 4 === 1) return null;
  const std = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Strict UTF-8 decode. Returns null if the bytes aren't valid UTF-8. */
export function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function tryJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** True if text is mostly printable (so random binary doesn't count as "decoded"). */
export function looksLikeText(text: string): boolean {
  if (!text.length) return false;
  let bad = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 9 || (c > 13 && c < 32) || c === 0xfffd) bad++;
  }
  return bad / text.length < 0.02;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

export function relativeTime(epochSeconds: number, nowMs = Date.now()): string {
  const diff = Math.round(epochSeconds - nowMs / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === "second") {
      return rtf.format(Math.trunc(diff / secs), unit);
    }
  }
  return "now";
}

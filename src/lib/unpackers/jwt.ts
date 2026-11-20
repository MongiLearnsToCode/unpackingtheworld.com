import type { Flag, Unpacker } from "./types.ts";
import { b64ToBytes, relativeTime, tryJson, utf8 } from "./util.ts";

const SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

function part(s: string): Record<string, unknown> | null {
  const bytes = b64ToBytes(s);
  if (!bytes) return null;
  const text = utf8(bytes);
  if (text === null) return null;
  const json = tryJson(text);
  return json && typeof json === "object" && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : null;
}

function stamp(label: string, v: unknown, now: number, flags: Flag[], kind: "exp" | "nbf" | "iat") {
  if (typeof v !== "number") return null;
  const iso = new Date(v * 1000).toISOString();
  const rel = relativeTime(v, now);
  if (kind === "exp") {
    flags.push(
      v * 1000 < now
        ? { severity: "bad", text: `Expired ${rel}` }
        : { severity: "good", text: `Valid, expires ${rel}` },
    );
  }
  if (kind === "nbf" && v * 1000 > now) {
    flags.push({ severity: "warn", text: `Not valid yet (starts ${rel})` });
  }
  return { label, value: `${iso} (${rel})` };
}

export const jwt: Unpacker = {
  id: "jwt",
  label: "JWT",
  score(input) {
    const s = input.trim();
    if (!SHAPE.test(s)) return 0;
    const [h] = s.split(".");
    const header = part(h);
    return header && typeof header.alg === "string" ? 1 : 0;
  },
  unpack(input) {
    const s = input.trim();
    const segs = s.split(".");
    if (segs.length !== 3) return null;
    const header = part(segs[0]);
    const payload = part(segs[1]);
    if (!header || !payload) return null;

    const now = Date.now();
    const flags: Flag[] = [];
    const fields = [];

    const alg = String(header.alg);
    if (alg.toLowerCase() === "none") {
      flags.push({ severity: "bad", text: "alg is “none”: this token is unsigned" });
    } else if (alg.startsWith("HS")) {
      flags.push({ severity: "info", text: `${alg}: symmetric signature (shared secret)` });
    }
    if (!segs[2]) flags.push({ severity: "warn", text: "Signature part is empty" });
    flags.push({ severity: "info", text: "Signature not verified (decoding only)" });

    for (const [k, kind] of [["exp", "exp"], ["nbf", "nbf"], ["iat", "iat"]] as const) {
      const f = stamp(k, payload[k], now, flags, kind);
      if (f) fields.push(f);
    }
    if (payload.exp === undefined) {
      flags.push({ severity: "warn", text: "No exp claim: token never expires" });
    }
    for (const k of ["iss", "sub", "aud"]) {
      if (payload[k] !== undefined) {
        const v = payload[k];
        fields.push({ label: k, value: typeof v === "string" ? v : JSON.stringify(v) });
      }
    }

    const headline = flags.find((f) => /^(Expired|Valid|Not valid)/.test(f.text))?.text;
    return {
      id: "jwt",
      label: "JWT",
      headline,
      flags,
      fields,
      sections: [
        { title: "Header", json: header },
        { title: "Payload", json: payload },
      ],
    };
  },
};

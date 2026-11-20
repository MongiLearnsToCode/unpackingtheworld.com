import type { Field, Flag, Unpacker } from "./types.ts";

function decode(s: string): string | null {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

export const url: Unpacker = {
  id: "url",
  label: "URL",
  score(input) {
    const s = input.trim();
    if (/^https?:\/\//i.test(s)) return 0.9;
    if (/%[0-9A-Fa-f]{2}/.test(s)) return 0.8;
    if (/^[^\s=&]+=[^\s&]*(&[^\s=&]+=[^\s&]*)+$/.test(s)) return 0.6;
    return 0;
  },
  unpack(input) {
    const s = input.trim();
    const flags: Flag[] = [];
    const fields: Field[] = [];
    const sections: { title: string; json: unknown }[] = [];

    let u: URL | null = null;
    try {
      u = new URL(s);
    } catch {
      u = null;
    }

    if (u) {
      fields.push({ label: "protocol", value: u.protocol }, { label: "host", value: u.host });
      if (u.pathname !== "/") fields.push({ label: "path", value: decode(u.pathname) ?? u.pathname });
      if (u.hash) fields.push({ label: "hash", value: u.hash });
      if (u.username) flags.push({ severity: "warn" as const, text: "URL contains credentials" });
      if (u.protocol === "http:") flags.push({ severity: "warn" as const, text: "Not HTTPS" });
      const q: Record<string, string | string[]> = {};
      u.searchParams.forEach((v, k) => {
        const cur = q[k];
        q[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
      });
      if (Object.keys(q).length) sections.push({ title: "Query parameters", json: q });
      return { id: "url", label: "URL", flags, fields, sections };
    }

    const decoded = decode(s);
    if (decoded === null) return null;
    if (/^[^\s=&]+=/.test(s) && s.includes("&")) {
      const q: Record<string, string> = {};
      new URLSearchParams(s).forEach((v, k) => (q[k] = v));
      sections.push({ title: "Form-encoded pairs", json: q });
      return { id: "url", label: "URL", flags, fields, sections };
    }
    return { id: "url", label: "URL", flags, fields, sections, text: decoded };
  },
};

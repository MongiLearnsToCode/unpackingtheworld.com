import type { Field, Flag, Unpacker } from "./types.ts";

interface Cookie {
  name: string;
  value: string;
  attributes: Record<string, string | boolean>;
}

const COOKIE_ATTRS = new Set(["secure", "httponly", "samesite", "max-age", "expires", "domain", "path", "priority", "partitioned"]);

function parseCookie(text: string): Cookie {
  const segments = text.split(";").map((part) => part.trim()).filter(Boolean);
  const first = segments.shift() ?? "";
  const split = first.indexOf("=");
  const name = split === -1 ? first : first.slice(0, split);
  const rawValue = split === -1 ? "" : first.slice(split + 1);
  const attributes: Record<string, string | boolean> = {};
  for (const segment of segments) {
    const at = segment.indexOf("=");
    const key = (at === -1 ? segment : segment.slice(0, at)).trim().toLowerCase();
    const value = at === -1 ? "" : segment.slice(at + 1).trim();
    if (!COOKIE_ATTRS.has(key)) continue;
    attributes[key] = value === "" ? true : value;
  }
  return {
    name,
    value: rawValue.length > 24 ? `${rawValue.slice(0, 24)}…` : rawValue,
    attributes,
  };
}

function parseBlock(input: string): { headers: Record<string, string | string[]>; cookies: Cookie[] } {
  const headers: Record<string, string | string[]> = {};
  const cookies: Cookie[] = [];
  const lines = input.replace(/\r/g, "").split("\n");
  let current = "";

  for (const raw of lines) {
    if (/^\s+\S/.test(raw) && current) {
      current += ` ${raw.trim()}`;
      continue;
    }
    if (current) consume(current, headers, cookies);
    current = raw.trim();
  }
  if (current) consume(current, headers, cookies);
  return { headers, cookies };
}

function consume(line: string, headers: Record<string, string | string[]>, cookies: Cookie[]): void {
  if (!line || /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|HTTP\/)/i.test(line)) return;
  const colon = line.indexOf(":");
  if (colon < 1) return;
  const name = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (!name || !value) return;
  if (name.toLowerCase() === "set-cookie") {
    cookies.push(parseCookie(value));
    return;
  }
  const existing = headers[name];
  headers[name] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function getHeader(headers: Record<string, string | string[]>, name: string): string | null {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  if (!found) return null;
  return Array.isArray(found[1]) ? found[1].join(", ") : found[1];
}

function audit(headers: Record<string, string | string[]>, cookies: Cookie[]): Flag[] {
  const flags: Flag[] = [];
  for (const cookie of cookies) {
    const secure = cookie.attributes.secure === true;
    const httpOnly = cookie.attributes.httponly === true;
    const sameSite = String(cookie.attributes.samesite ?? "").toLowerCase();
    if (!secure) {
      flags.push({ severity: "bad", text: `${cookie.name}: missing Secure — the browser may send it over plain HTTP, exposing the session.` });
    }
    if (!httpOnly) {
      flags.push({ severity: "warn", text: `${cookie.name}: missing HttpOnly — any script on the page can read it after an XSS flaw.` });
    }
    if (sameSite === "none" && !secure) {
      flags.push({ severity: "bad", text: `${cookie.name}: SameSite=None without Secure is rejected by modern browsers.` });
    }
  }

  const hsts = getHeader(headers, "strict-transport-security");
  if (!hsts) {
    flags.push({ severity: "warn", text: "Missing Strict-Transport-Security — browsers can still try plain HTTP first." });
  } else {
    const maxAge = Number(/(?:^|;)\s*max-age\s*=\s*(\d+)/i.exec(hsts)?.[1] ?? 0);
    if (maxAge < 31536000 || !/includeSubDomains/i.test(hsts)) {
      flags.push({ severity: "warn", text: "Weak HSTS — use max-age≥31536000 and includeSubDomains to be effective." });
    }
  }
  if (!getHeader(headers, "content-security-policy")) {
    flags.push({ severity: "warn", text: "Missing Content-Security-Policy — no second line of defence against injected scripts." });
  }
  if (!getHeader(headers, "x-content-type-options")) {
    flags.push({ severity: "warn", text: "Missing X-Content-Type-Options: nosniff — browsers may sniff HTML out of a download." });
  }
  if (!getHeader(headers, "referrer-policy")) {
    flags.push({ severity: "warn", text: "Missing Referrer-Policy — full URLs can leak in the Referer header." });
  }
  if (!flags.length) flags.push({ severity: "good", text: "No obvious security-header or cookie-flag problems found." });
  return flags;
}

export const headers: Unpacker = {
  id: "headers",
  label: "Headers",
  score(input) {
    const value = input.trim();
    if (!value || value.length > 20000) return 0;
    if (/^set-cookie\s*:/i.test(value)) return 0.95;
    if (/\n/.test(value) && /^[A-Za-z][A-Za-z0-9-]*\s*:/m.test(value)) return 0.9;
    if (/^[^;\s=]+=[^;\s]*(;\s*(secure|httponly|samesite|path|domain|expires|max-age)[=;]?)/i.test(value)) return 0.8;
    return 0;
  },
  unpack(input) {
    const value = input.trim();
    const singleCookie = !/\n/.test(value) && !/^[A-Za-z][A-Za-z0-9-]*\s*:/.test(value);
    const cookies: Cookie[] = [];
    let parsed: { headers: Record<string, string | string[]>; cookies: Cookie[] };

    if (singleCookie) {
      parsed = { headers: {}, cookies: [] };
      cookies.push(parseCookie(value.replace(/^set-cookie\s*:\s*/i, "")));
    } else {
      parsed = parseBlock(value);
      cookies.push(...parsed.cookies);
    }

    const fields: Field[] = [
      { label: "header count", value: String(Object.keys(parsed.headers).length) },
      { label: "cookie count", value: String(cookies.length) },
    ];
    const sections = [];
    if (Object.keys(parsed.headers).length) sections.push({ title: "Headers", json: parsed.headers });
    if (cookies.length) sections.push({ title: "Cookies", json: cookies });

    return {
      id: "headers",
      label: "Headers",
      headline: cookies.length ? `${cookies.length} cookie${cookies.length === 1 ? "" : "s"} inspected` : "Headers inspected",
      flags: audit(parsed.headers, cookies),
      fields,
      sections,
    };
  },
};

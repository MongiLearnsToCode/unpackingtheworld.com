import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";

const secureBlock = [
  "HTTP/2 200",
  "content-type: text/html; charset=utf-8",
  "strict-transport-security: max-age=31536000; includeSubDomains",
  "content-security-policy: default-src 'self'",
  "x-content-type-options: nosniff",
  "referrer-policy: no-referrer",
  "set-cookie: session=abc123; Secure; HttpOnly; SameSite=Lax; Path=/",
].join("\n");

const weakBlock = [
  "GET / HTTP/1.1",
  "Host: example.com",
  "Set-Cookie: session=abc123; Path=/",
  "Set-Cookie: tracking=xyz; SameSite=None",
  "x-content-type-options: nosniff",
].join("\n");

test("parses a real-world response header block", () => {
  const result = unpack("headers", secureBlock)!;
  const headers = result.sections[0].json as Record<string, string>;
  assert.equal(headers["content-type"], "text/html; charset=utf-8");
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(result.fields.find((f) => f.label === "cookie count")?.value, "1");
  assert.ok(result.flags.some((f) => f.severity === "good"));
});

test("flags missing and unsafe cookie attributes with a reason", () => {
  const result = unpack("headers", weakBlock)!;
  assert.ok(result.flags.some((f) => /missing Secure/.test(f.text) && /plain HTTP/.test(f.text)));
  assert.ok(result.flags.some((f) => /missing HttpOnly/.test(f.text) && /XSS/.test(f.text)));
  assert.ok(result.flags.some((f) => /SameSite=None without Secure/.test(f.text)));
  assert.ok(result.flags.some((f) => /Missing Strict-Transport-Security/.test(f.text)));
  assert.ok(result.flags.some((f) => /Missing Content-Security-Policy/.test(f.text)));
});

test("handles a single Set-Cookie string", () => {
  const result = unpack("headers", "session=abc123; Secure; HttpOnly; SameSite=Strict; Max-Age=3600; Domain=example.com; Path=/")!;
  const cookies = result.sections[0].json as { name: string; attributes: Record<string, unknown> }[];
  assert.equal(cookies[0].name, "session");
  assert.equal(cookies[0].attributes.secure, true);
  assert.equal(cookies[0].attributes.httponly, true);
  assert.equal(cookies[0].attributes.samesite, "Strict");
  assert.equal(cookies[0].attributes["max-age"], "3600");
});

test("collects duplicate headers and folded continuation lines", () => {
  const input = [
    "HTTP/1.1 200 OK",
    "Set-Cookie: a=1; Secure; HttpOnly",
    "Set-Cookie: b=2; Secure; HttpOnly",
    "x-custom: first",
    "\tsecond",
  ].join("\n");
  const result = unpack("headers", input)!;
  const headers = result.sections[0].json as Record<string, string | string[]>;
  assert.equal(headers["x-custom"], "first second");
  assert.equal(result.fields.find((f) => f.label === "cookie count")?.value, "2");
});

test("collects repeated headers into an array", () => {
  const result = unpack("headers", "HTTP/1.1 200 OK\nlink: <a>\nlink: <b>")!;
  const headers = result.sections[0].json as Record<string, string | string[]>;
  assert.deepEqual(headers.link, ["<a>", "<b>"]);
});

test("flags weak HSTS", () => {
  const input = "strict-transport-security: max-age=300\ncontent-security-policy: default-src 'self'\nreferrer-policy: no-referrer\nx-content-type-options: nosniff";
  const result = unpack("headers", input)!;
  assert.ok(result.flags.some((f) => /Weak HSTS/.test(f.text)));
});

test("masks long cookie values", () => {
  const result = unpack("headers", `session=${"a".repeat(60)}; Secure; HttpOnly`)!;
  const cookies = result.sections[0].json as { value: string }[];
  assert.ok(cookies[0].value.endsWith("…"));
  assert.ok(cookies[0].value.length < 30);
});

test("does not detect arbitrary text or query strings", () => {
  assert.equal(detect("just some words").find((d) => d.unpacker.id === "headers"), undefined);
  assert.equal(detect("a=1&b=2").find((d) => d.unpacker.id === "headers"), undefined);
});

test("scores header blocks above other formats", () => {
  assert.equal(detect(secureBlock)[0].unpacker.id, "headers");
});

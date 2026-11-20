import assert from "node:assert/strict";
import { test } from "node:test";
import { samplePem } from "../samples.ts";
import { detect } from "./index.ts";

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload: object, alg = "HS256") => `${b64url({ alg, typ: "JWT" })}.${b64url(payload)}.c2ln`;
const b64 = (value: string) => Buffer.from(value).toString("base64");

type Case = [string, string];

const cases: Case[] = [
  ["JWT HS256", jwt({ sub: "1" })],
  ["JWT alg none", jwt({ sub: "x" }, "none")],
  ["JWT with exp", jwt({ exp: 2000000000 })],
  ["absolute URL", "https://example.com"],
  ["URL with query and fragment", "https://example.com/a/b?q=1&q=2#top"],
  ["percent-encoded text", "hello%20world%21"],
  ["query string", "a=1&b=2&c=3"],
  ["insecure URL", "http://example.com/login"],
  ["base64 JSON", b64('{"hello":"world"}')],
  ["base64url no padding", "SGVsbG8_V29ybGQ-"],
  ["base64 text with markers", b64("Hello World 123!")],
  ["base64 binary", "AAECA/7+/g=="],
  ["base64 long", b64("the quick brown fox jumps over the lazy dog ".repeat(4))],
  ["PEM public key", samplePem()],
  ["certificate block", "-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----"],
  ["named entity", "&amp;"],
  ["decimal entity", "it&#39;s fine"],
  ["hex entity", "smile &#x1F600; now"],
  ["mixed entities", "&ldquo;quote&rdquo; &copy; &mdash;"],
  ["Unix seconds", "1700000000"],
  ["Unix milliseconds", "1700000000000"],
  ["Unix microseconds", "1700000000000000"],
  ["Unix nanoseconds", "1700000000000000000"],
  ["ISO 8601", "2024-01-02T03:04:05Z"],
  ["UUID v4", "f47ac10b-58cc-4372-a567-0e02b2c3d479"],
  ["UUID nil", "00000000-0000-0000-0000-000000000000"],
  ["UUID v7", "018f4c00-0000-7abc-8123-123456789012"],
  ["plain words", "hello world"],
  ["long plain text", "this is just a sentence with no encoding at all"],
  ["short number", "12345"],
  ["empty JSON", "{}"],
  ["random punctuation", "...!! ?? --"],
  ["cron every five minutes", "*/5 * * * *"],
  ["cron weekdays", "0 9 * * 1-5"],
  ["desktop User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"],
  ["bot User-Agent", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["header block", "HTTP/2 200\ncontent-type: text/html\nset-cookie: a=1; Secure; HttpOnly"],
  ["single Set-Cookie", "session=abc123; Secure; HttpOnly; SameSite=Lax"],
];

test(`detection table covers ${cases.length} samples`, () => {
  assert.ok(cases.length >= 30);
});

const expectations: [string, string, string][] = [
  ["JWT HS256", jwt({ sub: "1" }), "jwt"],
  ["JWT alg none", jwt({ sub: "x" }, "none"), "jwt"],
  ["JWT with exp", jwt({ exp: 2000000000 }), "jwt"],
  ["absolute URL", "https://example.com", "url"],
  ["URL with query and fragment", "https://example.com/a/b?q=1&q=2#top", "url"],
  ["percent-encoded text", "hello%20world%21", "url"],
  ["query string", "a=1&b=2&c=3", "url"],
  ["insecure URL", "http://example.com/login", "url"],
  ["base64 JSON", b64('{"hello":"world"}'), "base64"],
  ["base64url no padding", "SGVsbG8_V29ybGQ-", "base64"],
  ["base64 text with markers", b64("Hello World 123!"), "base64"],
  ["base64 binary", "AAECA/7+/g==", "base64"],
  ["base64 long", b64("the quick brown fox jumps over the lazy dog ".repeat(4)), "base64"],
  ["PEM public key", samplePem(), "pem"],
  ["certificate block", "-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----", "x509"],
  ["named entity", "&amp;", "htmlEntities"],
  ["decimal entity", "it&#39;s fine", "htmlEntities"],
  ["hex entity", "smile &#x1F600; now", "htmlEntities"],
  ["mixed entities", "&ldquo;quote&rdquo; &copy; &mdash;", "htmlEntities"],
  ["Unix seconds", "1700000000", "timestamp"],
  ["Unix milliseconds", "1700000000000", "timestamp"],
  ["Unix microseconds", "1700000000000000", "timestamp"],
  ["Unix nanoseconds", "1700000000000000000", "timestamp"],
  ["ISO 8601", "2024-01-02T03:04:05Z", "timestamp"],
  ["UUID v4", "f47ac10b-58cc-4372-a567-0e02b2c3d479", "uuid"],
  ["UUID nil", "00000000-0000-0000-0000-000000000000", "uuid"],
  ["UUID v7", "018f4c00-0000-7abc-8123-123456789012", "uuid"],
  ["plain words", "hello world", "none"],
  ["long plain text", "this is just a sentence with no encoding at all", "none"],
  ["short number", "12345", "none"],
  ["empty JSON", "{}", "none"],
  ["random punctuation", "...!! ?? --", "none"],
  ["cron every five minutes", "*/5 * * * *", "cron"],
  ["cron weekdays", "0 9 * * 1-5", "cron"],
  ["desktop User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36", "useragent"],
  ["bot User-Agent", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "useragent"],
  ["header block", "HTTP/2 200\ncontent-type: text/html\nset-cookie: a=1; Secure; HttpOnly", "headers"],
  ["single Set-Cookie", "session=abc123; Secure; HttpOnly; SameSite=Lax", "headers"],
];

test("every sample resolves to its expected top format", () => {
  for (const [name, input, expected] of expectations) {
    const top = detect(input)[0]?.unpacker.id ?? "none";
    assert.equal(top, expected, `${name}: expected ${expected}, got ${top}`);
  }
});

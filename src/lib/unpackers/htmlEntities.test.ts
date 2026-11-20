import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";

test("decodes named entities", () => {
  const result = unpack("htmlEntities", "Tom &amp; Jerry &copy; 2026 &ldquo;hello&rdquo;")!;
  assert.equal(result.text, "Tom & Jerry © 2026 “hello”");
  assert.ok(result.flags.some((f) => /3 entities/.test(f.text) || /4 entities/.test(f.text)));
});

test("decodes decimal and hexadecimal entities", () => {
  assert.equal(unpack("htmlEntities", "it&#39;s")!.text, "it's");
  assert.equal(unpack("htmlEntities", "smile &#x1F600;")!.text, "smile 😀");
  assert.equal(unpack("htmlEntities", "&#65;&#x42;")!.text, "AB");
});

test("shows an encoded form preview", () => {
  const result = unpack("htmlEntities", "&lt;script&gt;")!;
  assert.equal(result.text, "<script>");
  assert.equal(result.fields.find((f) => f.label === "encoded form")?.value, "&lt;script&gt;");
});

test("flags malformed entities and leaves them as-is", () => {
  const result = unpack("htmlEntities", "ok &amp; bad &bogus; and &#xyz;")!;
  assert.ok(result.flags.some((f) => f.severity === "warn" && /malformed/i.test(f.text)));
  assert.ok(result.text.includes("&bogus;"));
  assert.ok(result.text.includes("&#xyz;"));
});

test("scores zero for text without entities", () => {
  assert.equal(detect("just plain text").find((d) => d.unpacker.id === "htmlEntities"), undefined);
  assert.equal(detect("a=1&b=2").find((d) => d.unpacker.id === "htmlEntities"), undefined);
});

test("an entity string detects as HTML entities", () => {
  assert.equal(detect("Hello &amp; welcome")[0].unpacker.id, "htmlEntities");
});

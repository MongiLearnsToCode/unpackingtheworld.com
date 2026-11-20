import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";

test("detects Unix seconds", () => {
  const result = unpack("timestamp", "1700000000")!;
  assert.equal(result.fields.find((f) => f.label === "interpreted as")?.value, "Unix seconds");
  assert.equal(result.fields.find((f) => f.label === "UTC")?.value, "2023-11-14T22:13:20.000Z");
});

test("detects Unix milliseconds, microseconds and nanoseconds", () => {
  const expected = "2023-11-14T22:13:20.000Z";
  for (const input of ["1700000000000", "1700000000000000", "1700000000000000000"]) {
    const result = unpack("timestamp", input)!;
    assert.equal(result.fields.find((f) => f.label === "UTC")?.value, expected, input);
  }
  assert.equal(unpack("timestamp", "1700000000000")!.fields.find((f) => f.label === "interpreted as")?.value, "Unix milliseconds");
  assert.equal(unpack("timestamp", "1700000000000000")!.fields.find((f) => f.label === "interpreted as")?.value, "Unix microseconds");
  assert.equal(unpack("timestamp", "1700000000000000000")!.fields.find((f) => f.label === "interpreted as")?.value, "Unix nanoseconds");
});

test("detects ISO 8601 with offsets", () => {
  const result = unpack("timestamp", "2024-01-02T03:04:05Z")!;
  assert.equal(result.fields.find((f) => f.label === "interpreted as")?.value, "ISO 8601");
  assert.equal(result.fields.find((f) => f.label === "UTC")?.value, "2024-01-02T03:04:05.000Z");
  assert.ok(unpack("timestamp", "2024-01-02T03:04:05+02:00"));
  assert.ok(unpack("timestamp", "2024-01-02"));
});

test("ambiguous numbers show alternatives with the best guess first", () => {
  const result = unpack("timestamp", "1700000000")!;
  assert.ok(result.sections.length > 0);
  const options = result.sections[0].json as { label: string }[];
  assert.equal(options[0].label, "Unix seconds");
  assert.ok(options.length >= 2);
});

test("relative time is shown", () => {
  const result = unpack("timestamp", "1700000000000")!;
  assert.ok(result.fields.find((f) => f.label === "relative")?.value);
  assert.equal(result.headline, result.fields.find((f) => f.label === "relative")?.value);
});

test("rejects short and malformed numbers", () => {
  assert.equal(detect("12345").find((d) => d.unpacker.id === "timestamp"), undefined);
  assert.equal(detect("not-a-date").find((d) => d.unpacker.id === "timestamp"), undefined);
});

test("a 10-digit number ranks timestamp above base64", () => {
  const matches = detect("1700000000");
  assert.equal(matches[0].unpacker.id, "timestamp");
});

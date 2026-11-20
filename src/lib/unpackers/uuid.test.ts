import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";

const hex = (value: number | bigint, width: number) => value.toString(16).padStart(width, "0");

test("validates a v4 UUID", () => {
  const result = unpack("uuid", "f47ac10b-58cc-4372-a567-0e02b2c3d479")!;
  assert.ok(result.flags.some((f) => f.severity === "good" && /version 4/.test(f.text)));
  assert.equal(result.fields.find((f) => f.label === "version")?.value, "4");
  assert.equal(result.fields.find((f) => f.label === "variant")?.value, "RFC 4122");
});

test("extracts the embedded timestamp from a v1 UUID", () => {
  const ms = 1700000000000;
  const ticks = BigInt(ms + 12219292800000) * 10000n;
  const low = Number(ticks & 0xffffffffn);
  const mid = Number((ticks >> 32n) & 0xffffn);
  const hi = Number((ticks >> 48n) & 0x0fffn);
  const id = `${hex(low, 8)}-${hex(mid, 4)}-${hex(0x1000 | hi, 4)}-8123-123456789012`;
  const result = unpack("uuid", id)!;
  assert.equal(result.fields.find((f) => f.label === "version")?.value, "1");
  assert.equal(result.fields.find((f) => f.label === "embedded time")?.value, new Date(ms).toISOString());
});

test("extracts the embedded timestamp from a v7 UUID", () => {
  const ms = 1700000000000;
  const prefix = hex(ms, 12);
  const id = `${prefix.slice(0, 8)}-${prefix.slice(8)}-7abc-8123-123456789012`;
  const result = unpack("uuid", id)!;
  assert.equal(result.fields.find((f) => f.label === "version")?.value, "7");
  assert.equal(result.fields.find((f) => f.label === "embedded time")?.value, new Date(ms).toISOString());
});

test("flags nil and max UUIDs", () => {
  const nil = unpack("uuid", "00000000-0000-0000-0000-000000000000")!;
  assert.ok(nil.flags.some((f) => /Nil UUID/.test(f.text)));
  const max = unpack("uuid", "ffffffff-ffff-ffff-ffff-ffffffffffff")!;
  assert.ok(max.flags.some((f) => /Max UUID/.test(f.text)));
});

test("flags a non-RFC variant", () => {
  const result = unpack("uuid", "12345678-1234-1234-1234-123456789012")!;
  assert.ok(result.flags.some((f) => /Non-RFC variant/.test(f.text)));
});

test("rejects malformed UUIDs", () => {
  assert.equal(detect("not-a-uuid").find((d) => d.unpacker.id === "uuid"), undefined);
  assert.equal(detect("f47ac10b58cc4372a5670e02b2c3d479").find((d) => d.unpacker.id === "uuid"), undefined);
});

test("a UUID ranks above base64 and timestamp", () => {
  const matches = detect("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  assert.equal(matches[0].unpacker.id, "uuid");
});

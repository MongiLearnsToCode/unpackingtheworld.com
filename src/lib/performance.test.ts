import assert from "node:assert/strict";
import { test } from "node:test";
import { readArchive } from "./archive/detect.ts";
import { detect, unpack } from "./unpackers/index.ts";

test("1 MB of pasted text does not hang detection", () => {
  const input = "x".repeat(1024 * 1024);
  const started = performance.now();
  const matches = detect(input);
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 2000, `detection took ${elapsed.toFixed(0)} ms`);
  assert.ok(Array.isArray(matches));
});

test("a very long JWT decodes without hanging", () => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "x", data: "a".repeat(200000) })).toString("base64url");
  const token = `${header}.${payload}.${"c2ln".repeat(1000)}`;
  const started = performance.now();
  const result = unpack("jwt", token);
  const elapsed = performance.now() - started;
  assert.ok(result, "JWT should decode");
  assert.ok(elapsed < 2000, `JWT decode took ${elapsed.toFixed(0)} ms`);
});

test("archive listing stays responsive for large archives", async () => {
  const bytes = new Uint8Array(2 * 1024 * 1024);
  const source = {
    size: bytes.length,
    slice: (start: number, end: number) => ({ arrayBuffer: async () => bytes.slice(start, end).buffer }),
    arrayBuffer: async () => bytes.buffer,
  };
  const started = performance.now();
  await assert.rejects(() => readArchive(source), /Not a recognised archive/);
  assert.ok(performance.now() - started < 2000);
});

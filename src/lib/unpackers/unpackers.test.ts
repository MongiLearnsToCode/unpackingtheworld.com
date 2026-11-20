import assert from "node:assert/strict";
import { test } from "node:test";
import { noMatchMessage } from "../messages.ts";
import { detect, unpack } from "./index.ts";

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (payload: object, alg = "HS256") =>
  `${b64url({ alg, typ: "JWT" })}.${b64url(payload)}.c2ln`;

test("detects a JWT and ranks it first", () => {
  const d = detect(token({ sub: "1" }));
  assert.equal(d[0].unpacker.id, "jwt");
});

test("flags expired tokens", () => {
  const r = unpack("jwt", token({ exp: 1000 }))!;
  assert.ok(r.flags.some((f) => f.severity === "bad" && f.text.startsWith("Expired")));
});

test("flags a valid future token", () => {
  const r = unpack("jwt", token({ exp: Math.floor(Date.now() / 1000) + 86400 * 3 }))!;
  assert.ok(r.flags.some((f) => f.severity === "good"));
});

test("flags alg none and missing exp", () => {
  const r = unpack("jwt", token({ sub: "x" }, "none"))!;
  assert.ok(r.flags.some((f) => f.text.includes("unsigned")));
  assert.ok(r.flags.some((f) => f.text.includes("No exp")));
});

test("rejects a non-JWT dotted string", () => {
  assert.equal(detect("a.b.c").find((d) => d.unpacker.id === "jwt"), undefined);
});

test("decodes base64 JSON", () => {
  const input = Buffer.from('{"hello":"world"}').toString("base64");
  assert.equal(detect(input)[0].unpacker.id, "base64");
  const r = unpack("base64", input)!;
  assert.deepEqual(r.sections[0].json, { hello: "world" });
});

test("decodes base64url without padding", () => {
  const r = unpack("base64", "SGVsbG8_V29ybGQ-")!;
  assert.equal(r.text, "Hello?World>");
});

test("binary base64 is reported as binary", () => {
  const r = unpack("base64", Buffer.from([0, 1, 2, 255, 254, 253, 252, 251]).toString("base64"))!;
  assert.ok(r.flags.some((f) => f.text.includes("binary")));
});

test("parses URL query params", () => {
  const r = unpack("url", "https://example.com/a%20b?x=1&y=2&y=3#top")!;
  assert.deepEqual(r.sections[0].json, { x: "1", y: ["2", "3"] });
});

test("percent-decodes plain text", () => {
  assert.equal(unpack("url", "hello%20world%21")!.text, "hello world!");
});

test("empty input detects nothing", () => {
  assert.deepEqual(detect("   "), []);
});

test("no detection never names a format the user did not select", () => {
  const message = noMatchMessage(null);
  assert.equal(message.headline, "No known format matched.");
  for (const id of ["jwt", "url", "base64", "pem"]) {
    assert.ok(!message.headline.includes(id));
    assert.ok(!message.hint.includes(id));
  }
});

test("an explicit override is named in the no-match message", () => {
  const message = noMatchMessage("JWT");
  assert.equal(message.headline, "Can’t unpack this as JWT.");
  assert.match(message.hint, /different format/);
});

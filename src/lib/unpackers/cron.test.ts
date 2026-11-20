import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";

const expressions = [
  "* * * * *",
  "0 * * * *",
  "*/5 * * * *",
  "0 9 * * 1-5",
  "0 0 1 * *",
  "0 0 * * 0",
  "30 4 1,15 * *",
  "0 0 1 1 *",
  "0 12 * * MON",
  "0 0 * * 1,3,5",
  "15 14 1 * *",
  "0 22 * * 1-5",
  "0 */2 * * *",
  "5,10,15 * * * *",
  "0 0 29 2 *",
  "0 0 * * 6,0",
  "0 6-18 * * *",
  "0 0 10 * 1",
  "0 0 12 1,15 *",
  "*/15 9-17 * * 1-5",
];

test(`scores ${expressions.length} valid expressions first`, () => {
  for (const expression of expressions) {
    const top = detect(expression)[0];
    assert.equal(top?.unpacker.id, "cron", `expected cron for ${expression}, got ${top?.unpacker.id ?? "none"}`);
  }
});

test("explains expressions in plain English", () => {
  const result = unpack("cron", "*/5 * * * *")!;
  assert.match(result.headline ?? "", /5 minutes/i);
  assert.equal(result.fields.find((f) => f.label === "expression")?.value, "*/5 * * * *");
});

test("lists seven next runs with local and UTC times", () => {
  const result = unpack("cron", "0 9 * * 1-5")!;
  const runs = result.sections[0].json as { local: string; utc: string }[];
  assert.equal(runs.length, 7);
  for (const run of runs) {
    assert.ok(run.local.length > 0);
    assert.match(run.utc, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test("6-field expressions are flagged", () => {
  const result = unpack("cron", "0 0 12 * * ?")!;
  assert.ok(result.flags.some((f) => /6-field/.test(f.text)));
});

test("both day fields set produces a warning", () => {
  const result = unpack("cron", "0 0 1 * 1")!;
  assert.ok(result.flags.some((f) => f.severity === "warn" && /Day-of-month/.test(f.text)));
});

test("rejects non-cron input", () => {
  assert.equal(detect("hello world this is text").find((d) => d.unpacker.id === "cron"), undefined);
  assert.equal(detect("2024-01-02T03:04:05Z").find((d) => d.unpacker.id === "cron"), undefined);
});

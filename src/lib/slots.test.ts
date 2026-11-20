import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

const { render } = await server.ssrLoadModule("svelte/server");
const { createRawSnippet } = await server.ssrLoadModule("svelte");

after(async () => {
  await server.close();
});

async function markup(file: string, props: Record<string, unknown>): Promise<string> {
  const module = await server.ssrLoadModule(file);
  return render(module.default, { props }).body;
}

const css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
const cssSlots = [...new Set([...css.matchAll(/\[data-slot="([^"]+)"\]/g)].map((m) => m[1]))].sort();

const emptySnippet = createRawSnippet(() => ({ render: () => "<div></div>" }));

const components: [string, string, Record<string, unknown>][] = [
  ["CommandPalette", "/src/lib/components/CommandPalette.svelte", { commands: [{ value: "x", label: "X", group: "G", run: () => {} }], open: true }],
  ["JsonTree / ResultTree", "/src/lib/components/ResultTree.svelte", { title: "T", json: { a: { b: 1 } }, onCopy: () => {} }],
  ["FormatSwitcher", "/src/lib/components/FormatSwitcher.svelte", {
    value: "jwt",
    options: [{ id: "jwt", label: "JWT" }],
    detectedIds: new Set(["jwt"]),
    lockedIds: new Set(["x509"]),
    onManual: () => {},
  }],
  ["ResizableSplit", "/src/lib/components/ResizableSplit.svelte", { narrow: false, inputPane: emptySnippet, resultsPane: emptySnippet }],
];

test("app.css declares at least one data-slot", () => {
  assert.ok(cssSlots.length > 0);
});

for (const [name, file, props] of components) {
  test(`${name} server-renders without throwing`, async () => {
    const html = await markup(file, props);
    assert.ok(html.length > 0, `${name} rendered nothing`);
  });
}

test("every data-slot selector in app.css appears in server-rendered component output", async () => {
  const rendered = await Promise.all(components.map(([, file, props]) => markup(file, props)));
  const html = rendered.join("\n");
  const present = new Set([...html.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]));
  const missing = cssSlots.filter((slot) => !present.has(slot));
  assert.deepEqual(missing, [], `Unmatched data-slot selectors: ${missing.join(", ")}`);
});

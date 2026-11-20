import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "./index.ts";
import type { Env } from "./types.ts";

const FILES: Record<string, { type: string; body: string }> = {
  "/index.html": { type: "text/html", body: "<title>unpacking_the_world — Decode anything, upload nothing</title>" },
  "/app.html": { type: "text/html", body: "<title>Decoder — unpacking_the_world</title>" },
  "/404.html": { type: "text/html", body: "<title>Page not found — unpacking_the_world</title>" },
  "/assets/app.js": { type: "text/javascript", body: "console.log(1)" },
};

function env(): Env {
  return {
    ASSETS: {
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);
        const file = FILES[pathname === "/" ? "/index.html" : pathname];
        if (!file) return new Response("not found", { status: 404, headers: { "Content-Type": "text/plain" } });
        return new Response(file.body, { status: 200, headers: { "Content-Type": file.type } });
      },
    } as unknown as Env["ASSETS"],
  } as Env;
}

async function get(path: string, accept = "text/html") {
  return worker.fetch(new Request(`https://unpackingtheworld.com${path}`, { headers: { Accept: accept } }), env());
}

test("/ serves the prerendered landing document", async () => {
  const response = await get("/");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Decode anything, upload nothing/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(response.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
});

test("/app serves the tool document, not the landing page", async () => {
  const response = await get("/app");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Decoder — unpacking_the_world/);
});

test("/app/ redirects to the canonical /app", async () => {
  const response = await get("/app/");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("Location"), "/app");
});

test("generated documents are not browsable at their raw paths", async () => {
  for (const path of ["/app.html", "/404.html", "/index.html"]) {
    const response = await get(path);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("Location"), "/", path);
  }
});

test("retired blog URLs redirect to the home page", async () => {
  for (const path of ["/blog", "/blog/tar-vs-zip", "/2019/03/one-bag", "/category/packing", "/wp-login.php"]) {
    const response = await get(path);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("Location"), "https://unpackingtheworld.com/", path);
  }
});

test("unknown paths return the 404 document with a 404 status", async () => {
  const response = await get("/nope");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Page not found/);
});

test("missing assets keep their plain 404", async () => {
  const response = await get("/assets/missing.js", "text/javascript");
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "not found");
});

test("health stays JSON and unknown API routes stay JSON", async () => {
  assert.equal((await get("/api/health", "application/json")).status, 200);
  const missing = await get("/api/nope", "application/json");
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), JSON.stringify({ error: "not found" }));
});

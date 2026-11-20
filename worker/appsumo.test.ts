import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { handleExchange, handleOAuth, handleOAuthStart, handleStatus, handleWebhook, isTimestampFresh, verifyWebhookSignature } from "./appsumo.ts";
import type { Env } from "./types.ts";

const API_KEY = "test-api-key";

function memoryKv() {
  const map = new Map<string, string>();
  return {
    get: async (key: string) => map.get(key) ?? null,
    put: async (key: string, value: string) => void map.set(key, value),
    delete: async (key: string) => void map.delete(key),
    list: async () => ({ keys: [] as { name: string }[], list_complete: true, cursor: "" }),
    getWithMetadata: async (key: string) => ({ value: map.get(key) ?? null, metadata: null, cacheMetadata: {} }),
  };
}

function env(): Env {
  return {
    LICENSES: memoryKv() as unknown as Env["LICENSES"],
    APPSUMO_API_KEY: API_KEY,
    APPSUMO_CLIENT_ID: "client",
    APPSUMO_CLIENT_SECRET: "secret",
    APPSUMO_REDIRECT_URI: "https://example.com/api/appsumo/oauth",
    TOKEN_PRIVATE_KEY: "",
    TOKEN_PUBLIC_KEY: "",
    ASSETS: {} as Env["ASSETS"],
  };
}

const now = () => String(Math.floor(Date.now() / 1000));

function sign(raw: string, timestamp: string, key = API_KEY, separator = ""): string {
  return createHmac("sha256", key).update(`${timestamp}${separator}${raw}`).digest("hex");
}

function webhookRequest(payload: Record<string, unknown>, signature: string, timestamp: string): Request {
  return new Request("https://example.com/api/appsumo/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appsumo-Signature": signature,
      "X-Appsumo-Timestamp": timestamp,
    },
    body: JSON.stringify(payload),
  });
}

const event = (overrides: Record<string, unknown> = {}) => ({
  license_key: "22222222-2222-2222-2222-222222222222",
  event: "activate",
  license_status: "inactive",
  created_at: 1111111111,
  event_timestamp: 1111111111000,
  tier: 1,
  test: false,
  ...overrides,
});

async function postJson(path: string, body: unknown, e: Env): Promise<Response> {
  const request = new Request(`https://example.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return path === "/api/license/exchange" ? handleExchange(request, e) : handleStatus(request, e);
}

test("verifies HMAC signatures over timestamp and raw body", async () => {
  const raw = '{"event":"activate"}';
  const timestamp = "1700000000";
  assert.equal(await verifyWebhookSignature(raw, timestamp, sign(raw, timestamp), API_KEY), true);
  assert.equal(await verifyWebhookSignature(raw, timestamp, sign(raw, timestamp, API_KEY, "."), API_KEY), true);
  assert.equal(await verifyWebhookSignature(raw, timestamp, sign(raw, timestamp, "wrong-key"), API_KEY), false);
  assert.equal(await verifyWebhookSignature(`${raw} `, timestamp, sign(raw, timestamp), API_KEY), false);
  assert.equal(await verifyWebhookSignature(raw, "not-a-number", sign(raw, "not-a-number"), API_KEY), false);
});

test("test events get a success response without changing state", async () => {
  const e = env();
  const payload = event({ test: true, license_key: "00000000-aaaa-1111-bbbb-abcdef012345" });
  const raw = JSON.stringify(payload);
  const stamp = now();
  const response = await handleWebhook(webhookRequest(payload, sign(raw, stamp), stamp), e);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { event: "activate", success: true });
  assert.equal(await e.LICENSES.get("license:00000000-aaaa-1111-bbbb-abcdef012345"), null);
});

test("rejects a webhook with a bad signature", async () => {
  const payload = event();
  const response = await handleWebhook(webhookRequest(payload, "deadbeef", now()), env());
  assert.equal(response.status, 401);
});

test("handles purchase, activate, deactivate and reactivation", async () => {
  const e = env();
  const key = event().license_key;
  const sequence = ["purchase", "activate", "deactivate", "activate"];
  for (const [index, name] of sequence.entries()) {
    const payload = event({ event: name, created_at: 1111111111 + index });
    const raw = JSON.stringify(payload);
    const stamp = now();
  const response = await handleWebhook(webhookRequest(payload, sign(raw, stamp), stamp), e);
    assert.equal(response.status, 200);
  }
  const record = JSON.parse((await e.LICENSES.get(`license:${key}`))!) as { status: string; events: unknown[] };
  assert.equal(record.status, "active");
  assert.equal(record.events.length, 4);
});

test("a replayed webhook is ignored", async () => {
  const e = env();
  const payload = event();
  const raw = JSON.stringify(payload);
  const stamp = now();
  const request = () => webhookRequest(payload, sign(raw, stamp), stamp);
  await handleWebhook(request(), e);
  await handleWebhook(request(), e);
  const record = JSON.parse((await e.LICENSES.get(`license:${event().license_key}`))!) as { events: unknown[] };
  assert.equal(record.events.length, 1);
});

test("upgrade deactivates the previous key", async () => {
  const e = env();
  const oldKey = "11111111-1111-1111-1111-111111111111";
  const newKey = event().license_key;
  const first = event({ license_key: oldKey, event: "activate", created_at: 1 });
  const stamp = now();
  await handleWebhook(webhookRequest(first, sign(JSON.stringify(first), stamp), stamp), e);
  const upgrade = event({ event: "upgrade", prev_license_key: oldKey, tier: 2, created_at: 2 });
  await handleWebhook(webhookRequest(upgrade, sign(JSON.stringify(upgrade), stamp), stamp), e);
  const old = JSON.parse((await e.LICENSES.get(`license:${oldKey}`))!) as { status: string };
  const current = JSON.parse((await e.LICENSES.get(`license:${newKey}`))!) as { status: string; tier: number };
  assert.equal(old.status, "deactivated");
  assert.equal(current.status, "active");
  assert.equal(current.tier, 2);
});

test("an unknown license key is not active", async () => {
  const e = env();
  const response = await postJson("/api/license/status", { token: "not-a-token" }, e);
  assert.deepEqual(await response.json(), { active: false });
});

test("exchange codes are single use", async () => {
  const e = env();
  await e.LICENSES.put("exchange:abc123", "a-signed-token");
  const first = await postJson("/api/license/exchange", { code: "abc123" }, e);
  assert.deepEqual(await first.json(), { token: "a-signed-token" });
  const second = await postJson("/api/license/exchange", { code: "abc123" }, e);
  assert.equal(second.status, 400);
});

test("rejects a replayed payload outside the freshness window", async () => {
  const e = env();
  const payload = event();
  const raw = JSON.stringify(payload);
  const stale = String(Math.floor(Date.now() / 1000) - 3600);
  const response = await handleWebhook(webhookRequest(payload, sign(raw, stale), stale), e);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "stale timestamp" });
  assert.equal(await e.LICENSES.get(`license:${payload.license_key}`), null);
});

test("freshness window accepts near-now and rejects non-numeric", () => {
  assert.equal(isTimestampFresh(String(Math.floor(Date.now() / 1000))), true);
  assert.equal(isTimestampFresh("not-a-number"), false);
  assert.equal(isTimestampFresh(""), false);
});

test("an unsigned test ping cannot name a licence key", async () => {
  const e = env();
  const payload = event({ test: true });
  const response = await handleWebhook(
    new Request("https://example.com/api/appsumo/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    e,
  );
  assert.equal(response.status, 401);
});

test("licence sign-in must start from this browser", async () => {
  const e = env();
  const start = await handleOAuthStart(new Request("https://example.com/api/appsumo/start", { method: "POST" }), e);
  assert.equal(start.status, 200);
  const cookie = start.headers.get("Set-Cookie") ?? "";
  assert.match(cookie, /utw_oauth=[0-9a-f]{32}/);
  const state = cookie.match(/utw_oauth=([0-9a-f]{32})/)?.[1] ?? "";
  assert.equal(await e.LICENSES.get(`oauth_state:${state}`), "1");

  const bare = await handleOAuth(new Request("https://example.com/api/appsumo/oauth?code=abc"), e);
  assert.equal(bare.status, 403);
  assert.match(await bare.text(), /must start from the tool/);
});

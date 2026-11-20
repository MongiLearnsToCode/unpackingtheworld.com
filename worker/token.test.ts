import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { verifyToken } from "../src/lib/entitlements.ts";
import { handleStatus } from "./appsumo.ts";
import { licenseHash, signEntitlementToken, verifyEntitlementToken } from "./token.ts";
import type { Env } from "./types.ts";

const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const publicRaw = createPublicKey(publicKey).export({ format: "der", type: "spki" }).subarray(-32);
const publicHex = Buffer.from(publicRaw).toString("hex");
const key = "33333333-3333-3333-3333-333333333333";

function memoryKv() {
  const map = new Map<string, string>();
  return {
    get: async (name: string) => map.get(name) ?? null,
    put: async (name: string, value: string) => void map.set(name, value),
    delete: async (name: string) => void map.delete(name),
  };
}

function env(): Env {
  return {
    LICENSES: memoryKv() as unknown as Env["LICENSES"],
    APPSUMO_API_KEY: "api-key",
    APPSUMO_CLIENT_ID: "id",
    APPSUMO_CLIENT_SECRET: "secret",
    APPSUMO_REDIRECT_URI: "https://example.com/api/appsumo/oauth",
    TOKEN_PRIVATE_KEY: privateKey,
    TOKEN_PUBLIC_KEY: publicHex,
    ASSETS: {} as Env["ASSETS"],
  };
}

test("signs a token the browser can verify offline", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await signEntitlementToken(key, privateKey, now);
  assert.equal(token.split(".").length, 2);
  const workerPayload = await verifyEntitlementToken(token, publicHex, now + 60);
  assert.equal(workerPayload?.tier, "pro");
  assert.equal(workerPayload?.lid, await licenseHash(key));
  const browserPayload = await verifyToken(token, publicHex, (now + 60) * 1000);
  assert.equal(browserPayload?.tier, "pro");
  assert.equal(browserPayload?.lid, workerPayload?.lid);
});

test("rejects tampered and expired tokens", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await signEntitlementToken(key, privateKey, now);
  const [body, signature] = token.split(".");
  const altered = `${Buffer.from(JSON.stringify({ v: 1, tier: "pro", lid: "b".repeat(32), iat: now, exp: now + 100 })).toString("base64url")}.${signature}`;
  assert.equal(await verifyEntitlementToken(altered, publicHex, now), null);
  assert.equal(await verifyToken(altered, publicHex, now * 1000), null);
  assert.equal(body.length > 0, true);
  assert.equal(await verifyEntitlementToken(token, publicHex, now + 20 * 365 * 86400), null);
  assert.equal(await verifyToken(token, publicHex, (now + 20 * 365 * 86400) * 1000), null);
});

test("status endpoint reflects current license state", async () => {
  const e = env();
  const now = Math.floor(Date.now() / 1000);
  const token = await signEntitlementToken(key, privateKey, now);
  const lid = await licenseHash(key);
  await e.LICENSES.put(`lid:${lid}`, key);
  await e.LICENSES.put(`license:${key}`, JSON.stringify({ license_key: key, status: "active", tier: 1, updated_at: now, events: [] }));

  const request = () => new Request("https://example.com/api/license/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.deepEqual(await (await handleStatus(request(), e)).json(), { active: true });

  await e.LICENSES.put(`license:${key}`, JSON.stringify({ license_key: key, status: "deactivated", tier: 1, updated_at: now, events: [] }));
  assert.deepEqual(await (await handleStatus(request(), e)).json(), { active: false });
});

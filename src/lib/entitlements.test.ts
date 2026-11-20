import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  GRACE_DAYS,
  activateToken,
  configureEntitlements,
  deactivate,
  isUnlocked,
  loadEntitlements,
  noteOfflineFailure,
  verifyToken,
} from "./entitlements.ts";

interface Pair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

let keys: Pair;
let publicKeyHex: string;
let storage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

beforeEach(async () => {
  keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as Pair;
  publicKeyHex = Buffer.from(await crypto.subtle.exportKey("raw", keys.publicKey)).toString("hex");
  storage = memoryStorage();
  configureEntitlements({ publicKeyHex, storage });
});

async function signedToken(payload: Record<string, unknown>, keyPair = keys): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = Buffer.from(await crypto.subtle.sign("Ed25519", keyPair.privateKey, new TextEncoder().encode(body))).toString("base64url");
  return `${body}.${signature}`;
}

const validPayload = (now: number) => ({ v: 1, tier: "pro", lid: "a".repeat(16), iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 86400 });

test("a valid token unlocks Pro features but free features are always open", async () => {
  const now = Date.now();
  const token = await signedToken(validPayload(now));
  assert.equal(await activateToken(token, now), true);
  assert.equal(isUnlocked("x509"), true);
  assert.equal(isUnlocked("nested"), true);
  assert.equal(isUnlocked("jwt"), true);
  assert.equal(isUnlocked("timestamp"), true);
});

test("an expired token is rejected", async () => {
  const now = Date.now();
  const token = await signedToken({ v: 1, tier: "pro", lid: "a".repeat(16), iat: 1, exp: Math.floor(now / 1000) - 10 });
  assert.equal(await activateToken(token, now), false);
  assert.equal(isUnlocked("x509"), false);
  assert.equal(await verifyToken(token, publicKeyHex, now), null);
});

test("a tampered payload is rejected", async () => {
  const token = await signedToken(validPayload(Date.now()));
  const [body, signature] = token.split(".");
  const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), tier: "pro", lid: "b".repeat(16) })).toString("base64url");
  assert.equal(await verifyToken(`${changed}.${signature}`, publicKeyHex), null);
});

test("a token signed by the wrong key is rejected", async () => {
  const other = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as Pair;
  const token = await signedToken(validPayload(Date.now()), other);
  assert.equal(await verifyToken(token, publicKeyHex), null);
  assert.equal(await activateToken(token), false);
});

test("works when storage is missing or blocked", async () => {
  configureEntitlements({ publicKeyHex, storage: null });
  const token = await signedToken(validPayload(Date.now()));
  assert.equal(await activateToken(token), true);
  assert.equal(isUnlocked("x509"), true);
  deactivate();
  assert.equal(isUnlocked("x509"), false);

  const throwing = {
    getItem(): string | null { throw new Error("blocked"); },
    setItem(): void { throw new Error("blocked"); },
    removeItem(): void { throw new Error("blocked"); },
  };
  configureEntitlements({ publicKeyHex, storage: throwing });
  assert.equal(await activateToken(token), true);
  assert.equal(isUnlocked("x509"), true);
});

test(`offline grace lasts ${GRACE_DAYS} days`, async () => {
  const now = Date.now();
  const token = await signedToken(validPayload(now));
  assert.equal(await activateToken(token, now), true);
  noteOfflineFailure(now + 86400000);
  assert.equal(isUnlocked("x509"), true);
  noteOfflineFailure(now + (GRACE_DAYS + 1) * 86400000);
  assert.equal(isUnlocked("x509"), false);
});

test("a stored token survives a reload", async () => {
  const now = Date.now();
  const token = await signedToken(validPayload(now));
  assert.equal(await activateToken(token, now), true);
  configureEntitlements({ publicKeyHex, storage });
  await loadEntitlements(now + 1000);
  assert.equal(isUnlocked("x509"), true);
});

test("deactivation removes Pro immediately", async () => {
  const token = await signedToken(validPayload(Date.now()));
  assert.equal(await activateToken(token), true);
  deactivate();
  assert.equal(isUnlocked("x509"), false);
  assert.equal(storage.getItem("utw-entitlement"), null);
});

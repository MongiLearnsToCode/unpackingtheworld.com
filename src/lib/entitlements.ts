import { writable } from "svelte/store";

/**
 * Free:  JWT, Base64/Base64url, URL, HTML entities, timestamps, UUIDs, PEM basics.
 * Pro:   X.509 certificates, nested chaining, cron, User-Agent, headers/cookies,
 *        archive peeker, local history, offline PWA install.
 * Single AppSumo tier: "pro". Owner-confirmed 2026-11-20 (Open Question 1).
 */
export const GRACE_DAYS = 7;
export const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

export const FEATURES = {
  jwt: { tier: "free", name: "JWT", description: "Decode header, payload and claims." },
  base64: { tier: "free", name: "Base64", description: "Decode Base64 and Base64url." },
  url: { tier: "free", name: "URL", description: "Split URLs and percent-encoded text." },
  pem: { tier: "free", name: "PEM key", description: "Identify key type, size and curve." },
  htmlEntities: { tier: "free", name: "HTML entities", description: "Decode named, decimal and hex entities." },
  timestamp: { tier: "free", name: "Timestamp", description: "Read Unix and ISO 8601 times." },
  uuid: { tier: "free", name: "UUID", description: "Validate and explain UUIDs." },
  x509: { tier: "pro", name: "Certificate", description: "Parse X.509 certificates and SANs." },
  nested: { tier: "pro", name: "Unpack result", description: "Chain one decoded result into another." },
  cron: { tier: "pro", name: "Cron", description: "Explain cron expressions and next runs." },
  useragent: { tier: "pro", name: "User-Agent", description: "Break down browser, OS and device." },
  headers: { tier: "pro", name: "Headers", description: "Inspect headers and cookies for security flags." },
  archive: { tier: "pro", name: "Archive", description: "Peek inside zip and tar files." },
  history: { tier: "pro", name: "History", description: "Keep recent inputs locally, off by default." },
  pwa: { tier: "pro", name: "Offline install", description: "Install the tool and use it offline." },
} as const;

export type FeatureId = keyof typeof FEATURES;
export type Tier = "free" | "pro";

interface TokenPayload {
  v: 1;
  tier: "pro";
  lid: string;
  iat: number;
  exp: number;
}

interface Stored {
  token: string;
  lastOnlineCheck: number;
}

interface State {
  tier: Tier;
  token: string | null;
  lastOnlineCheck: number;
  revoked: boolean;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "utw-entitlement";
const DEFAULT_PUBLIC_KEY_HEX = "d7501844acfbad0bffd7c9739195972b0e3d0d6f88a3cbf91686b82171303d81";

function freshState(): State {
  return { tier: "free", token: null, lastOnlineCheck: 0, revoked: false };
}

let publicKeyHex = DEFAULT_PUBLIC_KEY_HEX;
let storage: KeyValueStorage | null = typeof localStorage === "undefined" ? null : localStorage;
let state: State = freshState();

export const entitlementState = writable<State>(state);
entitlementState.subscribe((value) => {
  state = value;
});

function setState(next: State): void {
  state = next;
  entitlementState.set(next);
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function readStored(): Stored | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return typeof parsed.token === "string" && typeof parsed.lastOnlineCheck === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored | null): void {
  try {
    if (value) storage?.setItem(STORAGE_KEY, JSON.stringify(value));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function devPro(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env;
  return Boolean(env?.DEV && env?.VITE_DEV_PRO === "1");
}

export function configureEntitlements(options: { publicKeyHex?: string; storage?: KeyValueStorage | null }): void {
  if (options.publicKeyHex !== undefined) publicKeyHex = options.publicKeyHex;
  if ("storage" in options) storage = options.storage ?? null;
  setState(freshState());
}

export async function verifyToken(token: string, keyHex = publicKeyHex, now = Date.now()): Promise<TokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "Ed25519" }, false, ["verify"]);
    const signature = base64ToBytes(parts[1]);
    const payloadBytes = base64ToBytes(parts[0]);
    if (!signature || !payloadBytes) return null;
    const valid = await crypto.subtle.verify("Ed25519", key, signature, new TextEncoder().encode(parts[0]));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as TokenPayload;
    if (payload?.v !== 1 || payload.tier !== "pro" || typeof payload.exp !== "number" || typeof payload.lid !== "string") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function activateToken(token: string, now = Date.now()): Promise<boolean> {
  if (!(await verifyToken(token, publicKeyHex, now))) return false;
  setState({ tier: "pro", token, lastOnlineCheck: now, revoked: false });
  writeStored({ token, lastOnlineCheck: now });
  return true;
}

export function deactivate(): void {
  writeStored(null);
  setState(freshState());
}

export async function loadEntitlements(now = Date.now()): Promise<void> {
  if (devPro()) {
    setState({ tier: "pro", token: null, lastOnlineCheck: now, revoked: false });
    return;
  }
  const stored = readStored();
  if (!stored) return;
  if (!(await verifyToken(stored.token, publicKeyHex, now))) {
    deactivate();
    return;
  }
  setState({ tier: "pro", token: stored.token, lastOnlineCheck: stored.lastOnlineCheck, revoked: false });
}

export function noteOfflineFailure(now = Date.now()): void {
  if (state.tier !== "pro") return;
  if (now - state.lastOnlineCheck > GRACE_MS) deactivate();
}

export async function checkStatusOnline(now = Date.now()): Promise<void> {
  if (state.tier !== "pro" || !state.token) return;
  try {
    const response = await fetch("/api/license/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.token }),
    });
    if (!response.ok) {
      noteOfflineFailure(now);
      return;
    }
    const data = (await response.json()) as { active?: boolean };
    if (data.active === false) {
      deactivate();
      return;
    }
    setState({ ...state, lastOnlineCheck: now, revoked: false });
    writeStored({ token: state.token, lastOnlineCheck: now });
  } catch {
    noteOfflineFailure(now);
  }
}

export function isUnlocked(featureId: string): boolean {
  const feature = FEATURES[featureId as FeatureId];
  const required = feature?.tier ?? "free";
  if (required === "free") return true;
  return state.tier === "pro" && !state.revoked;
}

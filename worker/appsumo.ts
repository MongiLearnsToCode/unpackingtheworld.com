import { applyEvent, getLicense, idempotencyKey, markProcessed, wasProcessed } from "./license-store.ts";
import { licenseHash, signEntitlementToken, verifyEntitlementToken } from "./token.ts";
import type { Env } from "./types.ts";
import { log, warn } from "./log.ts";

const ALLOWED_EVENTS = new Set(["purchase", "activate", "upgrade", "downgrade", "deactivate", "migrate"]);
/** A signed webhook is only accepted inside this window, so a captured payload cannot be replayed. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;
/** How long a browser may take between starting the AppSumo sign-in and returning. */
const OAUTH_TTL_SECONDS = 600;
const OAUTH_COOKIE = "utw_oauth";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function success(event: string): Response {
  return json({ event, success: true });
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function verifyWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  apiKey: string,
): Promise<boolean> {
  if (!timestamp || !signature || !apiKey) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  const withoutSeparator = await hmacHex(apiKey, timestamp + rawBody);
  if (constantTimeEqual(withoutSeparator, signature.toLowerCase())) return true;
  const withSeparator = await hmacHex(apiKey, `${timestamp}.${rawBody}`);
  return constantTimeEqual(withSeparator, signature.toLowerCase());
}

export function isTimestampFresh(
  timestamp: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  const signedAt = Number(timestamp);
  if (!Number.isSafeInteger(signedAt)) return false;
  return Math.abs(nowSeconds - signedAt) <= toleranceSeconds;
}

function cookieValue(request: Request, name: string): string {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function stateCookie(value: string, maxAgeSeconds: number): string {
  return `${OAUTH_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const raw = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const isTest = payload.test === true;
  const signature = request.headers.get("X-Appsumo-Signature") ?? "";
  const timestamp = request.headers.get("X-Appsumo-Timestamp") ?? "";
  const signed = await verifyWebhookSignature(raw, timestamp, signature, env.APPSUMO_API_KEY);
  // The unsigned test ping AppSumo sends carries no licence key; anything that
  // names a licence must be signed, or an attacker could grant themselves Pro.
  const unsignedTest = isTest && !payload.license_key;
  if (!signed && !unsignedTest) {
    warn("appsumo_invalid_signature", { test: isTest });
    return json({ error: "invalid signature" }, 401);
  }
  if (signed && !isTimestampFresh(timestamp)) {
    warn("appsumo_stale_timestamp");
    return json({ error: "stale timestamp" }, 401);
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const licenseKey = typeof payload.license_key === "string" ? payload.license_key : "";
  if (!ALLOWED_EVENTS.has(event)) {
    warn("appsumo_unknown_event", { event });
    return json({ error: "unknown event" }, 400);
  }
  if (!licenseKey) {
    warn("appsumo_missing_license_key", { event });
    return json({ error: "missing license_key" }, 400);
  }
  if (isTest) {
    if (!signed) warn("appsumo_unsigned_test_ping", { event });
    return success(event);
  }

  const key = idempotencyKey(licenseKey, event, typeof payload.created_at === "number" ? payload.created_at : 0);
  if (!(await wasProcessed(env.LICENSES, key))) {
    if (event !== "migrate") await applyEvent(env.LICENSES, payload);
    await markProcessed(env.LICENSES, key);
    log("appsumo_webhook_applied", { event });
  } else {
    log("appsumo_webhook_replayed", { event });
  }
  return success(event);
}

export async function handleOAuthStart(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const state = crypto.randomUUID().replace(/-/g, "");
  await env.LICENSES.put(`oauth_state:${state}`, "1", { expirationTtl: OAUTH_TTL_SECONDS });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": stateCookie(state, OAUTH_TTL_SECONDS) },
  });
}

export async function handleOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });

  // Only the browser that started the flow may complete it: a crafted
  // `/api/appsumo/oauth?code=...` link cannot bind a licence to someone else.
  const state = cookieValue(request, OAUTH_COOKIE);
  const known = state ? await env.LICENSES.get(`oauth_state:${state}`) : null;
  if (!known) {
    warn("appsumo_oauth_unbound_state", { has_cookie: Boolean(state) });
    const response = new Response("Licence sign-in must start from the tool. Open unpackingtheworld.com and press Go to AppSumo.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Set-Cookie": stateCookie("", 0) },
    });
    return response;
  }
  await env.LICENSES.delete(`oauth_state:${state}`);

  try {
    const tokenResponse = await fetch("https://appsumo.com/openid/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.APPSUMO_CLIENT_ID,
        client_secret: env.APPSUMO_CLIENT_SECRET,
        code,
        redirect_uri: env.APPSUMO_REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenResponse.ok) {
      warn("appsumo_exchange_failed", { stage: "token", status: tokenResponse.status });
      return new Response("Token exchange failed", { status: 502 });
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) return new Response("No access token", { status: 502 });

    const licenseResponse = await fetch(`https://appsumo.com/openid/license_key/?access_token=${encodeURIComponent(tokenData.access_token)}`);
    if (!licenseResponse.ok) {
      warn("appsumo_exchange_failed", { stage: "license", status: licenseResponse.status });
      return new Response("License lookup failed", { status: 502 });
    }
    const licenseData = (await licenseResponse.json()) as { license_key?: string };
    if (!licenseData.license_key) return new Response("No license key", { status: 502 });

    const clear = { "Set-Cookie": stateCookie("", 0) };
    const record = await getLicense(env.LICENSES, licenseData.license_key);
    if (!record || record.status !== "active") {
      return new Response(null, { status: 302, headers: { ...clear, Location: new URL("/?error=inactive#redeem", url.origin).toString() } });
    }

    const token = await signEntitlementToken(licenseData.license_key, env.TOKEN_PRIVATE_KEY);
    const exchangeCode = crypto.randomUUID().replace(/-/g, "");
    await env.LICENSES.put(`exchange:${exchangeCode}`, token, { expirationTtl: 300 });
    await env.LICENSES.put(`lid:${await licenseHash(licenseData.license_key)}`, licenseData.license_key);
    return new Response(null, {
      status: 302,
      headers: { ...clear, Location: new URL(`/?code=${exchangeCode}#redeem`, url.origin).toString() },
    });
  } catch {
    warn("appsumo_exchange_failed", { stage: "oauth" });
    return new Response("OAuth failed", { status: 500 });
  }
}

export async function handleExchange(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const key = `exchange:${code}`;
  const token = code ? await env.LICENSES.get(key) : null;
  if (!token) return json({ error: "invalid or expired code" }, 400);
  await env.LICENSES.delete(key);
  return json({ token });
}

export async function handleStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const payload = await verifyEntitlementToken(token, env.TOKEN_PUBLIC_KEY);
  if (!payload) return json({ active: false }, 200);
  const licenseKey = await env.LICENSES.get(`lid:${payload.lid}`);
  const record = licenseKey ? await getLicense(env.LICENSES, licenseKey) : null;
  return json({ active: record?.status === "active" }, 200);
}

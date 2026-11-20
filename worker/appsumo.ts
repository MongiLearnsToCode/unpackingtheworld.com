import { applyEvent, getLicense, idempotencyKey, markProcessed, wasProcessed } from "./license-store.ts";
import { licenseHash, signEntitlementToken, verifyEntitlementToken } from "./token.ts";
import type { Env } from "./types.ts";

const ALLOWED_EVENTS = new Set(["purchase", "activate", "upgrade", "downgrade", "deactivate", "migrate"]);

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
  if (!(await verifyWebhookSignature(raw, timestamp, signature, env.APPSUMO_API_KEY)) && !isTest) {
    return json({ error: "invalid signature" }, 401);
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const licenseKey = typeof payload.license_key === "string" ? payload.license_key : "";
  if (!ALLOWED_EVENTS.has(event)) return json({ error: "unknown event" }, 400);
  if (!licenseKey) return json({ error: "missing license_key" }, 400);
  if (isTest) return success(event);

  const key = idempotencyKey(licenseKey, event, typeof payload.created_at === "number" ? payload.created_at : 0);
  if (!(await wasProcessed(env.LICENSES, key))) {
    if (event !== "migrate") await applyEvent(env.LICENSES, payload);
    await markProcessed(env.LICENSES, key);
  }
  return success(event);
}

export async function handleOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });

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
    if (!tokenResponse.ok) return new Response("Token exchange failed", { status: 502 });
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) return new Response("No access token", { status: 502 });

    const licenseResponse = await fetch(`https://appsumo.com/openid/license_key/?access_token=${encodeURIComponent(tokenData.access_token)}`);
    if (!licenseResponse.ok) return new Response("License lookup failed", { status: 502 });
    const licenseData = (await licenseResponse.json()) as { license_key?: string };
    if (!licenseData.license_key) return new Response("No license key", { status: 502 });

    const record = await getLicense(env.LICENSES, licenseData.license_key);
    if (!record || record.status !== "active") {
      return Response.redirect(new URL("/?error=inactive#redeem", url.origin).toString(), 302);
    }

    const token = await signEntitlementToken(licenseData.license_key, env.TOKEN_PRIVATE_KEY);
    const exchangeCode = crypto.randomUUID().replace(/-/g, "");
    await env.LICENSES.put(`exchange:${exchangeCode}`, token, { expirationTtl: 300 });
    await env.LICENSES.put(`lid:${await licenseHash(licenseData.license_key)}`, licenseData.license_key);
    return Response.redirect(new URL(`/?code=${exchangeCode}#redeem`, url.origin).toString(), 302);
  } catch {
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

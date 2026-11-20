import { handleExchange, handleOAuth, handleStatus, handleWebhook } from "./appsumo.ts";
import type { Env } from "./types.ts";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function isOldBlogPath(path: string): boolean {
  if (path === "/" || path === "/app" || path === "/app/" || path.startsWith("/assets/")) return false;
  return !/\.[a-zA-Z0-9]+$/.test(path);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") return withSecurityHeaders(json({ ok: true }));
    if (url.pathname === "/api/appsumo/webhook") return withSecurityHeaders(await handleWebhook(request, env));
    if (url.pathname === "/api/appsumo/oauth") return withSecurityHeaders(await handleOAuth(request, env));
    if (url.pathname === "/api/license/exchange") return withSecurityHeaders(await handleExchange(request, env));
    if (url.pathname === "/api/license/status") return withSecurityHeaders(await handleStatus(request, env));
    if (url.pathname.startsWith("/api/")) return withSecurityHeaders(json({ error: "not found" }, 404));

    if (isOldBlogPath(url.pathname)) {
      return withSecurityHeaders(new Response(null, { status: 301, headers: { Location: new URL("/", url.origin).toString() } }));
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;

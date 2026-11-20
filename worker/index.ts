import { handleExchange, handleOAuth, handleOAuthStart, handleStatus, handleWebhook } from "./appsumo.ts";
import type { Env } from "./types.ts";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
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

/** Path shapes that belonged to the retired travel-gear blog. */
const RETIRED_BLOG_EXACT = new Set(["/blog", "/category", "/tag", "/author", "/feed", "/index.php", "/wp-login.php"]);
const RETIRED_BLOG_PREFIXES = ["/blog/", "/category/", "/tag/", "/author/", "/wp-", "/feed/"];
const RETIRED_BLOG_PATTERNS = [/^\/\d{4}\//, /^\/\d{4}$/];

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function isRetiredBlogPath(path: string): boolean {
  if (RETIRED_BLOG_EXACT.has(path)) return true;
  if (RETIRED_BLOG_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  return RETIRED_BLOG_PATTERNS.some((pattern) => pattern.test(path));
}

function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("Accept");
  if (!accept) return true;
  return accept.includes("text/html") || accept.includes("application/xhtml") || accept.includes("*/*");
}

function redirect(location: string): Response {
  return new Response(null, { status: 301, headers: { Location: location } });
}

async function asset(env: Env, request: Request, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, request.url).toString(), request));
}

/** The Worker's own 404 page, always served with a 404 status. */
async function notFound(env: Env, request: Request): Promise<Response> {
  const page = await asset(env, request, "/404.html");
  const body = page.ok ? await page.text() : "<h1>Not found</h1>";
  return new Response(body, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") return withSecurityHeaders(json({ ok: true }));
    if (url.pathname === "/api/appsumo/webhook") return withSecurityHeaders(await handleWebhook(request, env));
    if (url.pathname === "/api/appsumo/oauth") return withSecurityHeaders(await handleOAuth(request, env));
    if (url.pathname === "/api/appsumo/start") return withSecurityHeaders(await handleOAuthStart(request, env));
    if (url.pathname === "/api/license/exchange") return withSecurityHeaders(await handleExchange(request, env));
    if (url.pathname === "/api/license/status") return withSecurityHeaders(await handleStatus(request, env));
    if (url.pathname.startsWith("/api/")) return withSecurityHeaders(json({ error: "not found" }, 404));

    // One canonical URL per document: the build emits app.html and 404.html as
    // sibling assets, so their raw paths must not become browsable duplicates.
    if (url.pathname === "/app/") return withSecurityHeaders(redirect("/app"));
    if (url.pathname === "/") return withSecurityHeaders(await asset(env, request, "/index.html"));
    if (url.pathname === "/app") return withSecurityHeaders(await asset(env, request, "/app.html"));
    if (url.pathname === "/app.html" || url.pathname === "/404.html" || url.pathname === "/index.html") {
      return withSecurityHeaders(redirect("/"));
    }

    if (isRetiredBlogPath(url.pathname)) {
      return withSecurityHeaders(redirect(new URL("/", url.origin).toString()));
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status === 404 && wantsHtml(request) && !/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
      return withSecurityHeaders(await notFound(env, request));
    }
    return withSecurityHeaders(response);
  },
} satisfies ExportedHandler<Env>;

# unpacking_the_world

A paste-first decoder. Drop in a JWT, PEM key, certificate, cron expression, header block,
timestamp, UUID, URL, Base64 or archive and get a flagged, structured result. Everything runs
in the tab: nothing is uploaded, there is no analytics and no third-party request.

Live: <https://unpackingtheworld.com> · Tool: <https://unpackingtheworld.com/app>

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # svelte-check + TypeScript (must stay at 0 errors, 0 warnings)
npm test           # unpacker, archive and worker tests (Node 22+)
npm run build      # vite build + icon set + prerender → dist/
npm run deploy     # build, then deploy the Worker to Cloudflare
```

`npm run build` runs three steps in order: `vite build`, `node scripts/icons.mjs` (PNG icon
set derived from `public/icon.svg`) and `node scripts/prerender.mjs`.

## Architecture

```
index.html                 document template with the prerender placeholders
src/main.ts                entry: hydrates the landing markup, lazily loads the tool
src/LandingApp.svelte      landing-only root (keeps the tool chunk off the marketing page)
src/App.svelte             tool shell: routing, theme, palette, share links, archive state
src/lib/components/        panes and widgets (InputPane, ResultPane, ArchiveView, …)
src/lib/unpackers/         pure TS: detect() + unpack(), one file per format, with tests
src/lib/archive/           limits, capped inflate, zip and tar readers
src/lib/route.ts           which hashes render the landing page vs the tool
src/entry-server.ts        build-time renderer for the landing page + FAQ data
scripts/prerender.mjs      writes dist/index.html, app.html, 404.html and sitemap.xml
worker/index.ts            routing, security headers, retired-URL redirects, real 404s
worker/appsumo.ts          webhook, OAuth and licence signing
```

### Prerendering

`/` is server-rendered at build time into `dist/index.html` (landing markup plus
`SoftwareApplication` / `WebSite` / `Organization` / `FAQPage` JSON-LD), so crawlers and AI
fetchers see real content without running JS. The client hydrates that markup, and falls back
to a clean mount if the markup ever drifts. `/app` and `/404.html` are generated separately
with their own head metadata.

The template contract is two placeholders: `<!--app-html-->` in `<body>` and
`<!--seo-jsonld-->` in `<head>`. `scripts/prerender.mjs` refuses to run if either is missing or
appears twice.

### Worker routing

`wrangler.jsonc` sets `html_handling: "none"` and `not_found_handling: "none"` so the Worker
owns every HTML path:

| Request | Response |
| --- | --- |
| `/` | `dist/index.html`, 200 |
| `/app` | `dist/app.html`, 200 (`/app/` and `/app.html` 301 to `/app`) |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/assets/*` | static asset |
| `/api/*` | JSON from the Worker |
| retired blog paths | 301 to `/` |
| anything else | `dist/404.html`, status 404, `noindex` |

### Bundle

The landing page and the tool are separate chunks: a marketing visitor never downloads the
unpackers, archive readers or the licensing client.

```bash
vite build output (current):
dist/assets/index-*.js   248.02 kB │ gzip 86.52 kB   (landing shell + UI SDK)
dist/assets/App-*.js     233.41 kB │ gzip 82.87 kB   (tool: unpackers, archive, licensing)
dist/assets/index-*.css  103.17 kB │ gzip 15.15 kB   (mostly self-hosted Geist)
```

## Adding an unpacker

Implement `Unpacker` from `src/lib/unpackers/types.ts` (`score()` says how likely the input is
this format, `unpack()` returns flags, fields and JSON sections), then add it to the `unpackers`
array in `src/lib/unpackers/index.ts`. Detection, the format switcher and the palette pick it up
automatically. Add a matching entry to `FEATURES` in `src/lib/entitlements.ts` to set its tier.

## Safety limits

Archives are bounded during decompression, not by declared sizes:

| Limit | Value |
| --- | --- |
| Compressed archive | 200 MB |
| Single unpacked entry | 64 MB |
| Total unpacked bytes | 512 MB |
| Entry count | 10,000 |
| Auto-detection input | 2 MB (above this, detection pauses) |
| Archive text preview | 64 kB |

Constants live in `src/lib/archive/limits.ts`; the streaming caps in
`src/lib/archive/inflate.ts`.

## Entitlements

- Single AppSumo tier, `pro`. The free/Pro feature list is the `FEATURES` table in
  `src/lib/entitlements.ts`.
- Pro is an Ed25519-signed token verified in the browser. `DEFAULT_PUBLIC_KEY_HEX` in
  `src/lib/entitlements.ts` must match the `TOKEN_PUBLIC_KEY` Worker secret.
- Local Pro simulation (development builds only): `VITE_DEV_PRO=1 npm run dev`.
- The daily re-check calls only `/api/license/status` and never sends pasted input. Offline
  failures keep Pro for a 7-day grace period (`GRACE_DAYS`).
- Pro is enforced client-side: see [docs/pro-honour-system.md](docs/pro-honour-system.md) for
  what that means and why.

## Deployment

- `npm run deploy` builds `dist/` and deploys the Worker. Config is in `wrangler.jsonc`.
- Live `workers.dev` URL: `https://unpackingtheworld.sandiledlmn.workers.dev`.
- Custom domain: `https://unpackingtheworld.com`.
- AppSumo Partner Portal URLs:
  - Webhook: `https://unpackingtheworld.com/api/appsumo/webhook`
  - OAuth redirect: `https://unpackingtheworld.com/api/appsumo/oauth`

### Secrets

Set with `wrangler secret put <NAME>` (never commit them):

- `TOKEN_PRIVATE_KEY` — PKCS#8 PEM Ed25519 private key used to sign entitlement tokens.
- `TOKEN_PUBLIC_KEY` — 64 hex chars, the public half of that key; must equal
  `DEFAULT_PUBLIC_KEY_HEX` in `src/lib/entitlements.ts`.
- `APPSUMO_API_KEY` — shared key for webhook HMAC verification.
- `APPSUMO_CLIENT_ID`, `APPSUMO_CLIENT_SECRET` — OAuth credentials.
- `APPSUMO_REDIRECT_URI` — must exactly match the URL registered with AppSumo.

Webhook requests are rejected when their timestamp is more than 300 seconds from now
(`WEBHOOK_TOLERANCE_SECONDS`), and an OAuth callback is only accepted when it carries a
`state` issued to that browser within the last 10 minutes.

Key rotation: generate a new Ed25519 pair, update `TOKEN_PRIVATE_KEY`, `TOKEN_PUBLIC_KEY` and
`DEFAULT_PUBLIC_KEY_HEX` together, then redeploy. Existing offline tokens stop verifying until
users redeem again.

### Pre-deploy checklist

- `npm run check`, `npm test`, `npm run build` all pass (CI enforces this).
- Secret scan:
  `git grep -nE -- 'BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY|APPSUMO_CLIENT_SECRET|APPSUMO_API_KEY' -- . ':(exclude)README.md' ':(exclude)tasks/*' ':(exclude)**/*.test.ts'`
  returns nothing (test fixtures use fake PEM markers).
- No fetch, beacon or analytics call carries pasted input (`src/lib/share.ts` keeps share
  payloads in the URL fragment, which browsers never send).

## Operations

- [Support lookup](docs/support-lookup.md) — read one licence record from KV.
- [Licensing monitoring](docs/licensing-monitoring.md) — logs, metrics and what to alert on.
- [Pro honour system](docs/pro-honour-system.md) — the client-side enforcement model.

## Licence

Proprietary, all rights reserved. See [LICENSE](LICENSE).

## Notes

- UI SDK is pre-1.0. Upgrade deliberately
  (`npm install --save-exact @ui-sdk/svelte@<ver> @ui-sdk/core@<ver>`) and read the docs shipped
  in `node_modules/@ui-sdk/svelte/docs/`.
- Product name is written `unpacking_the_world` everywhere, including prose, so the wordmark and
  the domain match.

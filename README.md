# unpackingtheworld

Paste a JWT, Base64 string or URL and see what's inside. Runs entirely in the browser: nothing is uploaded.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm test         # unpacker unit tests (Node 22+)
npm run check    # svelte-check / TypeScript
```

## Stack

- Svelte 5 + Vite + TypeScript
- [UI SDK](https://ui-sdk.dev) (`@ui-sdk/svelte`, **beta, pinned to an exact version**) for Command, Dialog, Resizable, Tree and Segmented Control
- Geist / Geist Mono, self-hosted via Fontsource (no third-party requests)

## Layout

```
src/lib/unpackers/   pure TS: detect() + unpack(), one file per format, with tests
src/lib/components/  JsonTree (UI SDK Tree), CommandPalette (UI SDK Dialog + Command)
src/App.svelte       split-pane shell
src/app.css          all styling (UI SDK parts are unstyled; styled via data-slot attributes)
```

## Adding an unpacker

Implement `Unpacker` from `src/lib/unpackers/types.ts` (`score()` says how likely the input is this
format, `unpack()` returns flags, fields and JSON sections), then add it to the `unpackers` array in
`src/lib/unpackers/index.ts`. Detection, the format switcher and the palette pick it up automatically.

## Entitlements

- Single AppSumo tier, `pro`. The confirmed free/Pro feature list is at the top of `src/lib/entitlements.ts`.
- Pro is an Ed25519-signed token verified in the browser. Before launch, replace
  `DEFAULT_PUBLIC_KEY_HEX` in `src/lib/entitlements.ts` with the public half of the
  `TOKEN_PRIVATE_KEY` Wrangler secret used by the Worker.
- Local Pro simulation (development builds only): `VITE_DEV_PRO=1 npm run dev`.
- The daily online re-check calls only `/api/license/status` with the token; it never
  sends pasted input. Offline failures keep Pro for a 7-day grace period.

## Deployment (Cloudflare Workers + Static Assets)

- `npm run deploy` builds `dist/` and deploys the Worker. Config is in `wrangler.jsonc`.
- The Worker runs first for every non-asset path so security headers, CSP and old-blog
  301 redirects apply to the SPA too. Assets under `/assets/*` are served directly.
- Live `workers.dev` URL: `https://unpackingtheworld.sandiledlmn.workers.dev`.
- AppSumo Partner Portal URLs to register:
  - Webhook: `https://unpackingtheworld.sandiledlmn.workers.dev/api/appsumo/webhook`
  - OAuth redirect: `https://unpackingtheworld.sandiledlmn.workers.dev/api/appsumo/oauth`

### Secrets

Set with `wrangler secret put <NAME>` (never commit them):

- `TOKEN_PRIVATE_KEY` — PKCS#8 PEM Ed25519 private key used to sign entitlement tokens.
- `TOKEN_PUBLIC_KEY` — 64 hex chars, the public half of that key. It **must** match
  `DEFAULT_PUBLIC_KEY_HEX` in `src/lib/entitlements.ts`, which is embedded in the client.
- `APPSUMO_API_KEY` — shared key for webhook HMAC verification.
- `APPSUMO_CLIENT_ID`, `APPSUMO_CLIENT_SECRET` — OAuth credentials.
- `APPSUMO_REDIRECT_URI` — must exactly match the URL registered with AppSumo.

Key rotation: generate a new Ed25519 pair, update `TOKEN_PRIVATE_KEY`, `TOKEN_PUBLIC_KEY`
and `DEFAULT_PUBLIC_KEY_HEX` together, then redeploy. Existing offline tokens stop
verifying until users redeem again.

### Pre-deploy checklist

- `npm test`, `npm run check`, `npm run build` all pass.
- Secret scan: `git grep -nE -- 'BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY|APPSUMO_CLIENT_SECRET|APPSUMO_API_KEY' -- . ':(exclude)README.md' ':(exclude)tasks/*' ':(exclude)**/*.test.ts'` returns nothing (test fixtures use fake PEM markers).
- No user-input fetch, beacon or analytics call exists in `src/` (privacy promise).

### Support lookup

`npm run support:lookup -- <license_key>` reads the license record from KV. It requires
an authenticated Wrangler session, so it is access-protected by Cloudflare credentials.
There is no manual activate, upgrade or refund path.

## Bundle size

Production build (after 6.0): main JS **467.3 kB / 162.6 kB gzip**, CSS **98.5 kB /
14.2 kB gzip** (mostly self-hosted Geist fonts). The Pro-only cron, User-Agent, header
and archive parsers account for most of the growth. If first paint ever feels slow, the
next step is to lazy-load those unpackers behind a dynamic import.

## Launch checklist

- [x] `npm test` (120 tests), `npm run check`, `npm run build` pass.
- [x] Worker deployed to `workers.dev`; CSP and security headers verified on pages and API.
- [x] Old blog paths 301 to `/`; cache-busted verification done.
- [x] Secrets set: `TOKEN_PRIVATE_KEY`, `TOKEN_PUBLIC_KEY` (no secrets in git; secret scan clean).
- [ ] AppSumo webhook/OAuth URLs registered and licensing validation passed — blocked on credentials.
- [ ] Full AppSumo E2E: purchase → activate → OAuth → Pro → deactivate → Pro removed — blocked.
- [ ] Custom domain `unpackingtheworld.com` attached and HTTPS verified — needs DNS/zone access.
- [ ] Real-browser review: tree, segmented control, palette, resize, light/dark, mobile, screen reader.
- [ ] AppSumo listing assets (hero, screenshots) prepared and listing submitted.

## Notes

- UI SDK is pre-1.0. Upgrade deliberately (`npm install --save-exact @ui-sdk/svelte@<ver> @ui-sdk/core@<ver>`)
  and read the docs shipped in `node_modules/@ui-sdk/svelte/docs/`.
- Share links put the input in the URL `#fragment`, which browsers never send to a server.

## Relevant Files

**Existing (from the prototype zip)**
- `src/lib/unpackers/types.ts` — `Unpacker`, `Unpacked`, `Flag`, `Field` interfaces. Extended for nested results (2.0).
- `src/lib/unpackers/index.ts` — `unpackers` array, `detect()`, `unpack()`. Every new unpacker is registered here.
- `src/lib/unpackers/{jwt,base64,url,util}.ts` — existing unpackers and helpers.
- `src/lib/unpackers/unpackers.test.ts` — existing unit tests (11 in the zip).
- `src/lib/components/CommandPalette.svelte` — UI SDK Dialog + Command wrapper.
- `src/lib/components/JsonTree.svelte` — UI SDK Tree wrapper for decoded JSON.
- `src/lib/samples.ts` — sample inputs for the palette and tests.
- `src/App.svelte`, `src/app.css`, `src/main.ts`, `index.html`, `vite.config.ts` — shell, all styling (keyed on `data-slot`), entry points.

**New**
- `src/lib/unpackers/pem.ts` + `pem.test.ts` — PEM keys (RSA/EC/Ed25519), `.env` prefix and `\n` handling, never prints key material.
- `src/lib/unpackers/x509.ts` + `x509.test.ts` — certificate parsing (subject, issuer, validity, SAN, key, signature algorithm).
- `src/lib/unpackers/htmlEntities.ts` + `htmlEntities.test.ts` — named/decimal/hex entities.
- `src/lib/unpackers/timestamp.ts` + `timestamp.test.ts` — Unix s/ms/µs/ns and ISO 8601.
- `src/lib/unpackers/uuid.ts` + `uuid.test.ts` — UUID validation, version, embedded time for v1/v7.
- `src/lib/unpackers/cron.ts` + `cron.test.ts` — cron explanation and next runs.
- `src/lib/unpackers/useragent.ts` + `useragent.test.ts` — UA breakdown and bot flag.
- `src/lib/unpackers/headers.ts` + `headers.test.ts` — raw headers and Set-Cookie inspector.
- `src/lib/unpackers/nested.ts` + `nested.test.ts` — "unpack result" chaining.
- `src/lib/archive/{zip,tar,detect}.ts` + `archive.test.ts` — archive reading (central-directory zip, tar, tar.gz).
- `src/lib/components/ArchiveTree.svelte`, `DropZone.svelte` — virtualised file tree and file drop.
- `src/lib/components/ResultTree.svelte` — thin wrapper so UI SDK parts can be swapped (Req 38).
- `src/lib/components/LockedFeature.svelte`, `ProNotice.svelte`, `RedeemPage.svelte` — locked-feature states and AppSumo redeem page.
- `src/lib/entitlements.ts` + `entitlements.test.ts` — the only place that decides free vs Pro; verifies the signed token.
- `src/lib/history.ts` + `history.test.ts` — opt-in local history.
- `src/lib/slots.test.ts` — server-renders UI SDK components and checks every `data-slot` used in `app.css` exists (Req 37).
- `worker/index.ts` — Worker `fetch` handler (licensing routes only).
- `worker/appsumo.ts` + `worker/appsumo.test.ts` — webhook, OAuth, signature check, idempotency.
- `worker/license-store.ts` — KV/D1 access for license records.
- `worker/token.ts` + `worker/token.test.ts` — Ed25519 entitlement token signing.
- `wrangler.jsonc` — Worker config, `assets.directory`, bindings, `compatibility_date`.
- `public/_headers` or Worker header logic — CSP and security headers.
- `public/manifest.webmanifest`, `src/sw.ts` — PWA (6.0).
- `tests/samples/` — fixtures; PEM keys are generated at test time, never committed.
- `.github/workflows/ci.yml` (optional) — runs test, check, build.
- `README.md`, `tasks/living_log.md` — docs and issue log.

### Notes

- Unit tests sit next to the code they test. Run `npm test`. `npm run check` (svelte-check, 0 errors) and `npm run build` must pass before any task is marked complete.
- There is no design folder. UI tasks use the `frontend-design` skill and the inspirations in PRD §6 (CyberChef, jwt.io, crontab.guru, regex101, it-tools, Linear/Raycast). The PRD and accessibility win on any conflict.
- Pin every dependency to an exact version (no `^`). UI SDK is beta (prototype used `0.1.0-beta.13`); read its docs in `node_modules/@ui-sdk/svelte/docs/` before using a component.
- Priority (PRD §7): tasks 1–4 are Must, task 5 is Should, task 6 is Could. Cut from the bottom if time runs short.
- Never put real secrets or real private keys in the repo, tests or logs.
- Cloudflare: use Workers with Static Assets, not Pages. Re-check the current Cloudflare docs before writing `wrangler.jsonc`.
- AppSumo: follow `docs.licensing.appsumo.com`. Webhook events come only from AppSumo; never add a manual activate/refund path.

## Tasks

- [ ] 1.0 Baseline, PEM and safety net (PRD Req 1–12, 16, 36–40)
  - [x] 1.1 Unzip `unpackingtheworld.zip`, run `npm install`, `npm test`, `npm run check`, `npm run build`. Record the results in `tasks/living_log.md`. If you have the later zip that already contains PEM, use it and skip 1.3–1.4.
  - [ ] 1.2 Initialise git (if needed), commit the baseline, and create `tasks/living_log.md` using the format in the dev prompt.
  - [x] 1.3 Build `pem.ts`: strip `NAME=` prefixes, accept one-line keys and `\n` escapes, parse the DER header to report algorithm, key size and curve for RSA, EC and Ed25519 in PKCS#1, PKCS#8 and public-key forms. Add the red "private key" flag and the "RSA under 2048 bits" warning. Never include key bytes in the output. Report damaged keys as an error flag, not an exception.
  - [x] 1.4 Write `pem.test.ts` with keys generated at test time (Node `crypto.generateKeyPairSync`) for RSA 1024/2048, EC and Ed25519, plus damaged, truncated and `.env`-style inputs. No real keys.
  - [x] 1.5 Register PEM in `index.ts` and add a PEM sample to `samples.ts`.
  - [x] 1.6 Fix the switcher bug (Req 3–4): only an explicit click or arrow-key press sets a manual override; with no match, show "No known format matched" and never name a format the user did not pick. Add a test or component check for the empty-detection case.
  - [x] 1.7 Add the secret-input attributes to the textarea (`data-gramm="false"`, `data-1p-ignore`, `data-lpignore`, `autocomplete="off"`, `spellcheck="false"`) (Req 40).
  - [x] 1.8 Create thin wrapper components (`ResultTree.svelte`, and keep `CommandPalette.svelte`) so only these files import `@ui-sdk/*` for those parts (Req 38). Update imports.
  - [x] 1.9 Write `src/lib/slots.test.ts`: server-render each wrapped UI SDK component, collect the `data-slot` values in the HTML, and fail if `app.css` references a slot that is not rendered. Run it; confirm it fails when you deliberately misspell a slot, then fix.
  - [x] 1.10 Add the "Runs entirely in your browser. Nothing is uploaded." footer line, the share-link note ("links contain your input"), and confirm no ads, popups or banners exist (Req 10–12).
  - [ ] 1.11 Manual review in a real browser (Chrome plus Firefox or Safari, and a phone-width window): JWT chip, tree indent and chevrons, segmented control, Ctrl/⌘+K palette, resize drag, light/dark, stacking on narrow screens. Fix visual problems using the `frontend-design` skill; log findings.
  - [x] 1.12 Add a short keyboard and screen-reader pass: tab order, visible focus, ARIA roles, contrast (WCAG AA) (Req 35).

- [ ] 2.0 Core text unpackers (PRD Req 14, 17, 18, 22, 23)
  - [ ] 2.1 Extend `types.ts` with an optional `next?: { label: string; input: string }[]` on `Unpacked` for chainable results. Keep it backwards-compatible.
  - [ ] 2.2 Build `nested.ts` and a "Unpack result" button in the results pane: when a decoded Base64/URL result looks like JSON, a JWT, or another known format, offer a one-click chain, with a depth limit of 5 to avoid loops (Req 14). Test with Base64→JWT and URL→Base64.
  - [ ] 2.3 Build `x509.ts`: parse a CERTIFICATE PEM (use a small, exactly-pinned ASN.1/X.509 library or a minimal DER reader) to show subject, issuer, validity dates with expired/valid status, SAN list, key type and size, signature algorithm. Flag expired, not-yet-valid, self-signed and weak (SHA-1, RSA < 2048) certificates. Do not print the raw certificate bytes.
  - [ ] 2.4 Write `x509.test.ts` using certificates generated at test time (for example with Node or an exactly-pinned dev dependency).
  - [ ] 2.5 Build `htmlEntities.ts`: decode named, decimal and hex entities; score high only when entities are present; show an "encoded form" preview. Test `&amp;`, `&#39;`, `&#x1F600;`, malformed entities.
  - [ ] 2.6 Build `timestamp.ts`: detect Unix seconds, ms, µs, ns and ISO 8601 by magnitude and shape; show UTC, local time, relative time. Test boundary values and ambiguous inputs (show alternatives, best guess first).
  - [ ] 2.7 Build `uuid.ts`: validate format, show version and variant; for v1 and v7 show the embedded timestamp. Flag the nil and max UUIDs.
  - [ ] 2.8 Register all four in `index.ts`, add samples to `samples.ts` and to the palette, and tune `score()` values so a plain 10-digit number, a UUID, a JWT and a Base64 string never confuse each other. Add a detection test table with at least 30 sample inputs.
  - [ ] 2.9 Confirm every new result shows copy buttons and meaningful flags; run test, check, build.

- [ ] 3.0 Entitlements and free/Pro gating (PRD Req 25–27, 31, 34)
  - [ ] 3.1 Confirm the free/Pro split with the owner (PRD Open Question 1) and record the final list at the top of `entitlements.ts`.
  - [ ] 3.2 Build `entitlements.ts` with `isUnlocked(featureId)`, a feature-to-tier map, and token loading/saving in `localStorage` wrapped in try/catch (storage may be blocked).
  - [ ] 3.3 Implement signed-token verification in the browser with Web Crypto Ed25519 (or a pinned small library if browser support is a problem), using an embedded public key. Token carries tier, license-id hash and expiry. Reject expired or tampered tokens.
  - [ ] 3.4 Write `entitlements.test.ts`: valid token, expired token, tampered payload, wrong key, missing storage, offline grace period (Open Question 4 default: 7 days).
  - [ ] 3.5 Add a once-a-day online status re-check hook (calls only the site's own `/api/license/status` endpoint); on "deactivated", remove Pro. Offline failures must not remove Pro before the grace period ends.
  - [ ] 3.6 Build `LockedFeature.svelte`: show name, one-line description and "Unlock Pro" for locked unpackers; never hide them (Req 27). Wire it into the format switcher and palette.
  - [ ] 3.7 Build `ProNotice.svelte`: one quiet, dismissible inline notice; remember dismissal locally.
  - [ ] 3.8 Build `RedeemPage.svelte` / `#redeem` view: explains "Redeem your AppSumo code", sends the user to AppSumo's flow, and handles the return from `/api/appsumo/oauth` (token delivery to the page). Use only plain `#name` hashes.
  - [ ] 3.9 Gate the Pro unpackers (cron, User-Agent, headers, certificates, archive, history, PWA install) through `isUnlocked` only; no feature should check tier anywhere else.
  - [ ] 3.10 Add a development-only way to simulate Pro (build flag, not shipped in production builds) so you can test the UI without AppSumo.

- [ ] 4.0 Cloudflare Workers deployment and AppSumo licensing (PRD Req 28–33, 41, 42)
  - [ ] 4.1 Read the current Cloudflare docs for Workers Static Assets, and the AppSumo Licensing guide (`docs.licensing.appsumo.com`): webhook events, signature verification, OAuth steps. Note any differences from this plan in `tasks/living_log.md`.
  - [ ] 4.2 Add `wrangler.jsonc` with `assets.directory = "./dist"`, a `main` Worker for `/api/*`, a current `compatibility_date`, and a KV namespace (or D1; decide per Open Question 9) binding. Add `wrangler` as an exact-pinned dev dependency and `npm run deploy` / `npm run dev:worker` scripts.
  - [ ] 4.3 Deploy a hello-world version to a `workers.dev` URL first; confirm the SPA loads and `/api/health` returns 200.
  - [ ] 4.4 Add security headers: strict CSP (`default-src 'self'`; `script-src 'self'`; `connect-src 'self'`; no third-party hosts), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. Verify nothing in the app breaks (fonts are self-hosted). Test with a CSP report in the browser console (Req 41).
  - [ ] 4.5 Build `worker/license-store.ts`: save/read license records by `license_key` (status, tier, timestamps, raw event log). No emails, no user input, ever (Req 30).
  - [ ] 4.6 Build `worker/appsumo.ts` webhook (POST): respond to the validation `test` request, verify the signature, handle `purchase`, `activate`, `upgrade`, `downgrade` and `deactivate`, idempotent on repeated events, return the response AppSumo expects (Req 28–29, 33).
  - [ ] 4.7 Build the OAuth redirect (GET): return 200 on AppSumo's validation request; on the real flow, exchange the code, fetch the license key, look it up, and redirect to `/#redeem` with the signed token delivered safely (no secrets in the URL hash history; use a one-time code exchanged by POST).
  - [ ] 4.8 Build `worker/token.ts`: sign entitlement tokens with a Wrangler-secret Ed25519 private key; add `/api/license/status`. Document key generation and rotation in `README.md`.
  - [ ] 4.9 Write tests for signature verification, replayed webhooks, unknown license keys, deactivate then reactivate, and tampered requests (`appsumo.test.ts`, `token.test.ts`).
  - [ ] 4.10 Store secrets with `wrangler secret put` (AppSumo client id/secret, webhook secret, token private key). Confirm none are in git; add a secret-scan step to the checklist.
  - [ ] 4.11 Create a minimal, access-protected support lookup by `license_key` (Req 32): a script or Cloudflare Access–protected route. No manual activate/refund actions.
  - [ ] 4.12 In the AppSumo Partner Portal, register the webhook and OAuth redirect URLs and pass AppSumo's validation. Run the full test: purchase → activate → OAuth → Pro unlocks → deactivate → Pro removed.
  - [ ] 4.13 Implement the blog redirect plan decided in PRD Open Question 2 (301 map or none). Confirm old URLs behave as agreed.
  - [ ] 4.14 Attach `unpackingtheworld.com` as the custom domain, verify HTTPS, and run a final CSP and header check against the live domain.

- [ ] 5.0 Developer-ops unpackers (PRD Req 19–21)
  - [ ] 5.1 Add `cronstrue` and a next-run library at exact versions. Build `cron.ts`: accept 5- and 6-field expressions, explain in English, list the next 5–10 run times in local time with a UTC toggle. Flag unusual cases (e.g. day-of-month and day-of-week both set). Test with at least 15 expressions.
  - [ ] 5.2 Add `ua-parser-js` at an exact version. Build `useragent.ts`: browser, version, OS, device, engine; flag bots and crawlers. Test with common desktop, mobile, bot and malformed strings.
  - [ ] 5.3 Build `headers.ts`: parse raw header blocks (with or without a request/status line) and single `Set-Cookie` strings. Explain each attribute (`Secure`, `HttpOnly`, `SameSite`, `Max-Age`, `Expires`, `Domain`, `Path`).
  - [ ] 5.4 Add the security audit to `headers.ts`: flag a cookie missing `Secure`/`HttpOnly`, `SameSite=None` without `Secure`, and missing or weak `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`. Show each flag with a one-line "why it matters".
  - [ ] 5.5 Write `headers.test.ts` with real-world header samples, duplicate headers, folded lines and invalid input.
  - [ ] 5.6 Register the three unpackers as Pro features through `entitlements.ts`; add samples and palette entries; extend the detection test table so cron, UA, headers and existing formats do not collide.
  - [ ] 5.7 Review each result view in the browser (cron: explanation front and centre like crontab.guru) and fix layout issues.

- [ ] 6.0 Archive peeker, history, PWA and launch polish (PRD Req 24, 26, 35)
  - [ ] 6.1 Add `fflate` at an exact version. Build `src/lib/archive/zip.ts`: read only the central directory from the end of the file using `File.slice()`; return a list of paths, sizes and compressed sizes. Handle zip64 or fail with a clear message.
  - [ ] 6.2 Build `tar.ts` (plain tar and `.tgz` / npm tarballs): sequential read with a streaming gunzip where possible. Enforce the 200 MB cap with a visible message (Req 24).
  - [ ] 6.3 Build `detect.ts` to choose the reader from magic bytes, not file names. Write `archive.test.ts` with archives generated at test time, including nested folders, empty archives, corrupt files and path-traversal names (`../`), which must be displayed but never used to write anything.
  - [ ] 6.4 Build `DropZone.svelte` (drag-and-drop and file picker, keyboard-accessible) and `ArchiveTree.svelte` using the UI SDK Tree in flat-path mode with the virtualised option. Verify with a 50,000-entry listing and log the result (this was never tested in the prototype).
  - [ ] 6.5 Add text-file preview for entries under a size limit: decode as UTF-8, show in monospace, never render as HTML, never execute anything. Offer "unpack this" for entries that look like JWT/Base64/JSON.
  - [ ] 6.6 Gate the archive peeker as Pro via `entitlements.ts` and show the size-cap note in the UI.
  - [ ] 6.7 Build `history.ts`: off by default, stores the last N inputs in `localStorage` (try/catch), one-click "Clear history", clear explanation of what is stored. Test with storage unavailable.
  - [ ] 6.8 Add the PWA: `manifest.webmanifest`, a service worker that caches the built assets, an install prompt, and verify the app loads offline. Ensure the CSP and Worker headers still work and updates do not trap users on an old version. Gate install prompt as Pro.
  - [ ] 6.9 Final accessibility pass (keyboard, focus, ARIA, contrast) across all unpackers and the archive tree; fix issues (Req 35).
  - [ ] 6.10 Performance check: paste a 1 MB input and a long JWT without freezing the UI; debounce detection if needed; check the production bundle size and note it in `README.md`.
  - [ ] 6.11 Write privacy, terms and refund-policy pages (PRD Open Question 8), a short FAQ, and update `README.md` with run, test, deploy and key-rotation instructions.
  - [ ] 6.12 Launch checklist: all tests, `check` and `build` pass; CSP verified live; AppSumo end-to-end test repeated on the live domain; redirect plan verified; support contact set; AppSumo listing assets ready.

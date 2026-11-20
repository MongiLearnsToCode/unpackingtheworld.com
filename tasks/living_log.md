# Living Issue Log

Append-only. New entries go at the bottom; never delete or reorder entries.
Baseline verification records and issues both live here. Issue entries use the
format in `dev-prompt.md`.

---

## Baseline verification — prototype zip (task 1.1)
**Date:** 2026-11-20
**Task:** 1.1 Baseline, PEM and safety net
**Severity:** Low

**Problem:** None. Baseline state recorded as required before implementation starts.

**Root Cause:** N/A — information only.

**Resolution:** Verified the existing prototype builds cleanly before any changes:
- `npm test` — 11/11 tests pass (JWT, Base64, URL, empty input).
- `npm run check` — svelte-check reports 0 errors, 0 warnings.
- `npm run build` — succeeds; dist/index.html + assets. Main JS 262.09 kB (92.30 kB gzip); CSS 96.03 kB (13.77 kB gzip, mostly fonts).
- Node v24.19.0; npm dependencies installed; `@ui-sdk/svelte` pinned at exact `0.1.0-beta.13`.
- No design folder in repo root.
- Git not initialized; no `tasks/living_log.md` existed at baseline (both addressed in task 1.2).

**Files Affected:** `tasks/living_log.md` (created).

**Prevention Note:** Re-run test/check/build at the end of every subtask so regressions surface immediately.

---

## Issue #1 — Slot guard needs Vite's SSR module loader and open/expanded props
**Date:** 2026-11-20
**Task:** 1.9 slots.test.ts
**Severity:** Low

**Problem:** Importing `render` from `svelte/server` directly in the Node test produced
`TypeError: Cannot read properties of null (reading 'r')` while rendering UI SDK parts,
and several `data-slot` values (dialog/command/tree-group/tree-indicator) were absent.

**Root Cause:** Vite's SSR pipeline creates a separate Svelte module instance in
`node_modules/.vite/deps_ssr`, so components compiled by Vite and a renderer loaded by
plain Node cannot share component context. Dialog content and tree branches are also
conditional: they only render when the dialog is `open` and the tree node has children.

**Resolution:** Load `render` and `createRawSnippet` through `server.ssrLoadModule()` so
the renderer and components share one Svelte instance. Render `CommandPalette` with
`open: true` and `ResultTree` with nested JSON so every conditional slot appears.
Deliberately misspelling `tree` → `treee` in `app.css` made the test fail as intended;
it was reverted and all 34 tests pass.

**Files Affected:** `src/lib/slots.test.ts`, `src/app.css` (reverted), `package.json`.

**Prevention Note:** When adding a new wrapped UI SDK component, include props that make
all of its conditional `data-slot` parts render in the slot guard.

---

## Issue #2 — Initial git commit blocked by missing author identity
**Date:** 2026-11-20
**Task:** 1.2 Initialise git and commit the baseline
**Severity:** Low

**Problem:** `git commit` failed with `Author identity unknown` / unable to auto-detect
email address.

**Root Cause:** Fresh environment with no global or local `user.name` / `user.email`.

**Resolution:** Owner supplied name `Sandile Mongi Dlamini` and email
`sandiledlmn@gmail.com`. Identity is passed per-command via `GIT_AUTHOR_*` /
`GIT_COMMITTER_*` environment variables so global git config is not modified.
Owner also authorised pushing to `git@github.com:MongiLearnsToCode/unpackingtheworld.com.git`;
the remote was empty, the root commit was created as `016d007` and pushed to `master`.

**Files Affected:** `.git/` only.

**Prevention Note:** Supply commit identity explicitly per command rather than changing
global git config in a shared environment.

---

## Issue #3 — X.509 distinguished names are DER SETs, not SEQUENCEs
**Date:** 2026-11-20
**Task:** 2.3 X.509 certificate parser
**Severity:** Medium

**Problem:** Every generated-certificate test failed with `Expected a DER SEQUENCE`
inside `distinguishedName()`.

**Root Cause:** In ASN.1, `RelativeDistinguishedName ::= SET OF AttributeTypeAndValue`
(tag `0x31`). The parser reused the SEQUENCE-only helper for RDNs.

**Resolution:** Added a `setOf()` reader in `x509.ts` and used it for RDN decoding.
The shared `der.ts` reader is otherwise unchanged. All certificate tests pass,
including subject/issuer, SAN, validity, self-signed, SHA-1, weak RSA and CA-issued cases.

**Files Affected:** `src/lib/unpackers/x509.ts`, `src/lib/unpackers/der.ts`, `src/lib/unpackers/pem.ts`.

**Prevention Note:** When writing DER readers, check the ASN.1 tag of every constructed
type; SET and SEQUENCE are encoded differently despite both holding TLVs.

---

## Issue #4 — Base64 scored plain English as a weak match
**Date:** 2026-11-20
**Task:** 2.8 Detection table
**Severity:** Low

**Problem:** `hello world` was detected as Base64 (score 0.2) because `b64ToBytes()`
strips whitespace and the remaining letters happen to be valid base64 characters.

**Root Cause:** The binary-output branch of `base64.score()` returned a fixed 0.2
regardless of whether the input carried any base64 markers.

**Resolution:** Binary decodes now score 0.45 only when the input contains `+/=_` or a
digit; otherwise they score 0. Real binary base64 such as `AAECA/7+/g==` still detects,
while plain words no longer do. 32-case detection table passes.

**Files Affected:** `src/lib/unpackers/base64.ts`, `src/lib/unpackers/detection.test.ts`.

**Prevention Note:** Weak heuristic scores still surface as detections; keep markers as a
prerequisite in every `score()` branch.

---

## Decision — certificates generated with OpenSSL at test time
**Date:** 2026-11-20
**Task:** 2.4 X.509 tests
**Severity:** Low

**Problem:** No exactly-pinned X.509 generator dependency was present, and committing
fixture certificates would violate the "never commit real keys or certs" rule.

**Root Cause:** Choice between adding a dev dependency and using the available system tool.

**Resolution:** Tests generate RSA 1024/2048, EC P-256, Ed25519, SHA-1 and CA-issued
certificates with the system `openssl` CLI into a temp directory, deleting it afterwards.
No certificate material is committed. OpenSSL 3.0.13 is required on the test machine.

**Files Affected:** `src/lib/unpackers/x509.test.ts`.

**Prevention Note:** If CI lacks OpenSSL, add an exactly-pinned JS certificate generator
instead of committing fixtures.

---

## Issue #5 — Embedded public key is a development placeholder
**Date:** 2026-11-20
**Task:** 3.3 Offline token verification
**Severity:** Medium

**Problem:** Token verification needs a public key in the browser, but the Worker's
Ed25519 private key (task 4.8) does not exist yet and must never be committed.

**Root Cause:** Key generation belongs to the Worker secret; the client public key is a
build-time constant.

**Resolution:** Generated a throwaway Ed25519 pair locally and embedded only its public
half as `DEFAULT_PUBLIC_KEY_HEX` in `entitlements.ts`. The private half is not stored.
Tests generate their own keypairs and inject the public key via `configureEntitlements()`.
README documents replacing the constant with the public half of `TOKEN_PRIVATE_KEY`
before launch; tracked as a launch blocker for task 4.8.

**Files Affected:** `src/lib/entitlements.ts`, `README.md`.

**Prevention Note:** Never derive the embedded public key from a committed private key;
generate it alongside the Wrangler secret and update the constant at deploy time.

---

## Decision — Cloudflare Workers Static Assets configuration (task 4.1)
**Date:** 2026-11-20
**Task:** 4.1 Documentation research
**Severity:** Low

**Problem:** PRD §7 specified `assets.directory` but did not mention SPA fallback or
selective Worker routing.

**Root Cause:** Workers Static Assets needs explicit SPA and routing settings; Pages
used to infer these.

**Resolution:** Current docs require, for a Vite SPA plus `/api/*` Worker:
`assets.directory = "./dist"`, `assets.not_found_handling = "single-page-application"`,
`assets.binding = "ASSETS"` and `assets.run_worker_first = ["/api/*"]`. Use
`compatibility_date` set to the creation date and add `$schema` pointing at
`node_modules/wrangler/config-schema.json`. Secrets via `wrangler secret put`; KV via
`[[kv_namespaces]]`. Owners chose Workers KV and 301 redirects for old blog URLs.

**Files Affected:** `wrangler.jsonc` (to be created).

**Prevention Note:** Re-check the Static Assets routing docs before changing the
Worker's routing or adding new API paths.

---

## Decision — AppSumo Licensing API v2 details (task 4.1)
**Date:** 2026-11-20
**Task:** 4.1 Documentation research
**Severity:** Low

**Problem:** PRD §4.4 summarised the integration; exact wire formats were needed.

**Root Cause:** AppSumo's code samples are rendered client-side and were not available
as plain text from the docs site.

**Resolution:** Confirmed from docs and corroborating implementations:
- Webhook security: HMAC-SHA256 of `X-Appsumo-Timestamp` concatenated with the **raw**
  request body, keyed by the AppSumo API key, hex digest in `X-Appsumo-Signature`.
  The signed concatenation separator is not stated explicitly in the prose; the
  implementation will accept `timestamp + body` and `timestamp + "." + body` and log
  the ambiguity. Verification is marked "optional" by AppSumo but required by our PRD.
- Success response: `200` with `{ "event": "<event>", "success": true }`. Test events
  (`test: true`) must also get this response but must not change state.
- Events: `purchase`, `activate`, `upgrade`, `downgrade`, `deactivate`, plus
  `migrate` for add-ons (not in the PRD list; will be logged but not change tier).
- OAuth validation: AppSumo sends a bare `GET` with no payload; return `200`.
- Live OAuth arrives as `?code=...` (single use). Exchange with
  `POST https://appsumo.com/openid/token/` (`client_id`, `client_secret`, `code`,
  `redirect_uri`, `grant_type=authorization_code`), then
  `GET https://appsumo.com/openid/license_key/?access_token=...`.
- Unknown license keys must be handled without granting Pro.

**Files Affected:** `worker/appsumo.ts`, `worker/index.ts` (to be created).

**Prevention Note:** Verify the signature separator and webhook success response during
the live AppSumo validation in task 4.12.

---

## Issue #6 — Static assets bypassed the Worker, dropping CSP and redirects
**Date:** 2026-11-20
**Task:** 4.3/4.4 Deploy and verify headers
**Severity:** High

**Problem:** On the first deploy, `/` had no CSP or security headers and old blog URLs
returned 200 instead of 301, while `/api/health` was correct.

**Root Cause:** `run_worker_first: ["/api/*"]` only invoked the Worker for API paths;
Cloudflare served static assets and the SPA fallback directly, bypassing all Worker
header and redirect logic.

**Resolution:** Changed to `run_worker_first: ["/*", "!/assets/*"]` (the documented SPA
shell pattern) so the Worker runs for every non-asset path, adds headers and handles
blog redirects, then fetches the page via the `ASSETS` binding. Redeployed and verified:
CSP + all security headers on `/`, 301 on old blog paths, assets still served directly.
An initial 200 on the old URL was only CDN cache; a cache-busted request returned 301.

**Files Affected:** `wrangler.jsonc`.

**Prevention Note:** After every deploy, verify headers and redirects on both `/api/*`
and a static page, using a cache-busting query where Cloudflare may cache a 301.

---

## Decision — Pro parser bundle cost (task 5.6)
**Date:** 2026-11-20
**Task:** 5.0 Developer-ops unpackers
**Severity:** Low

**Problem:** Adding `cronstrue`, `cron-parser` and `ua-parser-js` raised the production
main JS from 289.7 kB (102.5 kB gzip) to 447.6 kB (154.6 kB gzip).

**Root Cause:** All three Pro-only parsers are statically imported by the detection
registry, so every visitor downloads them even on the free tier.

**Resolution:** Accepted for now; bundle size recorded in README. The `Unpacker`
interface is synchronous, so lazy-loading needs a registry change (async `unpack()` or
idle preloading). Deferred to the performance pass in task 6.10.

**Files Affected:** `README.md`, `src/lib/unpackers/index.ts`, `package.json`.

**Prevention Note:** Re-check bundle size after adding any new unpacker library.

---

## Verification — 50,000-entry archive listing (task 6.4)
**Date:** 2026-11-20
**Task:** 6.4 ArchiveTree virtualisation
**Severity:** Low

**Problem:** The prototype never verified the virtualised tree with a large listing.

**Root Cause:** N/A — verification only.

**Resolution:** Generated a ZIP with 50,000 empty entries at test time and listed it
through `readArchive()`. The central directory was parsed in about 100 ms and produced
a 5.2 MB archive. `ArchiveTree` renders only the visible rows via `visibleTreeRows`,
so the DOM stays small. No entries are executed or rendered as HTML; path-traversal
names are kept as text. Result recorded in `archive.test.ts` output and task status.

**Files Affected:** `src/lib/archive/archive.test.ts`, `src/lib/components/ArchiveTree.svelte`.

**Prevention Note:** Re-run the large-listing test after changing the tree wrapper.

---

## Issue #7 — Strict style-src blocked UI SDK split-pane sizing
**Date:** 2026-11-20
**Task:** 4.4 / landing review
**Severity:** Medium

**Problem:** Live browser console reported `Applying inline style violates ... style-src 'self'`
for four elements. The UI SDK's Resizable, ResizablePanel and ResizableHandle set inline
`style` attributes (flex sizes and CSS variables), so the split layout could not size
itself under a strict style CSP.

**Root Cause:** `style-src 'self'` forbids inline style attributes, including ones set by
JavaScript. The UI SDK has no nonce/hash support for these dynamic values.

**Resolution:** Relaxed only `style-src` to `'self' 'unsafe-inline'`. `script-src 'self'`,
`connect-src 'self'` and all other directives remain strict; no user input is ever
rendered as HTML, so the relaxation is limited to presentation. Logged here rather than
silently changing the security posture. Cloudflare also injects its own Insights beacon
on the custom domain; our CSP blocks it, which is intentional for the no-analytics promise.

**Files Affected:** `worker/index.ts`.

**Prevention Note:** Keep `script-src` strict and re-check console diagnostics after any
UI SDK upgrade; prefer hashed styles if the SDK ever supports them.

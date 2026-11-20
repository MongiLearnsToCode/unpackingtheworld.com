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

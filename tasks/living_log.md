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
Owner also authorised pushing to `git@github.com:MongiLearnsToCode/unpackingtheworld.com.git`.

**Files Affected:** `.git/` only.

**Prevention Note:** Supply commit identity explicitly per command rather than changing
global git config in a shared environment.

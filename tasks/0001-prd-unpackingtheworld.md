# PRD: Unpacking the World — "Decode Anything" Developer Tool

**Document:** `tasks/0001-prd-unpackingtheworld.md`
**Owner:** Mongi (Sandile Mongi Dlamini), Fortune Well
**Status:** Draft v1 for review
**Domain:** `unpackingtheworld.com` (root domain)

---

## 1. Introduction / Overview

Developers constantly paste opaque strings into random websites to see what is inside them: JWTs, Base64 blobs, URL-encoded text, PEM keys, cron expressions, User-Agent strings, raw HTTP headers, certificates, timestamps and archives. Most of those sites are single-purpose, cluttered, or upload the input to a server, which is a real risk when the input is a production token or private key.

**Unpacking the World** is one web page with one paste box. It detects what you pasted, "unpacks" it into a readable, highlighted result, and flags what matters (expired token, `alg: none`, private key pasted, missing `Secure` flag). **Everything runs in the browser. Nothing the user pastes or drops is ever uploaded.**

The product will be sold primarily as a **lifetime deal (LTD) on AppSumo**, so it needs a free tier that drives discovery and a Pro tier that AppSumo buyers redeem.

An early prototype already exists (`unpackingtheworld.zip`): Svelte 5 + Vite + TypeScript + UI SDK (beta), with JWT, Base64 and URL unpackers, a command palette, a JSON tree, resizable split panes, dark/light themes and share links. A PEM unpacker was added in a later session of the original chat but is **not in the zip**, so it is a requirement here (Req 16). This PRD builds on that prototype; it does not restart it.

## 2. Goals

1. Ship a fast, trustworthy, paste-first "decode anything" tool that auto-detects the input type and shows a clear, flagged result.
2. Cover these unpackers in v1: JWT, Base64/Base64url, URL/percent-encoding, HTML entities, PEM keys and certificates, cron, User-Agent, HTTP headers / Set-Cookie, timestamps, UUIDs, and a browser-grade archive peeker.
3. Keep the privacy promise absolute: no uploads of user input, no analytics, no third-party requests.
4. Offer a **free tier** and a **Pro tier** that AppSumo lifetime-deal buyers can redeem, using AppSumo's official licensing flow.
5. Deploy on Cloudflare (free tier) at the root of `unpackingtheworld.com`.
6. Target: v1 shipped by a solo developer in about 2 weeks (see §7 for the priority order that makes this realistic).

## 3. User Stories

- As a backend developer, I want to paste a JWT and instantly see the header, payload, expiry and warnings so that I can debug auth without trusting a third-party server.
- As a developer, I want the tool to guess what I pasted so that I don't have to pick a format first.
- As a developer, I want to correct a wrong guess in one click so that detection mistakes don't block me.
- As a DevOps engineer, I want a cron expression explained in plain English with the next run times so that I can check a schedule before deploying.
- As a security-minded developer, I want a warning when I paste a private key, an `alg: none` token or a cookie missing `Secure`/`HttpOnly` so that I catch mistakes.
- As a developer, I want to drop a zip or tar file and browse its contents without extracting it so that I can inspect a package quickly.
- As a keyboard user, I want a Ctrl/⌘+K command palette so that I can switch formats, load samples and toggle theme without a mouse.
- As an AppSumo buyer, I want to redeem my code and unlock Pro on my browser so that my purchase works immediately.
- As a Pro user, I want the tool to keep working offline so that I can use it anywhere.
- As the product owner, I want a refunded AppSumo license to lose Pro access automatically so that I stay compliant with AppSumo's rules.

## 4. Functional Requirements

### 4.1 Core experience (free and Pro)

1. The page must show a single input box, focused on load, with a results area. There is no Submit button: detection and decoding run as the user types or pastes.
2. The system must auto-detect the input type and show a "Detected: X" chip. If several unpackers match, it must show the best match first and offer the others one click away.
3. The user must be able to override detection with a format switcher (segmented control or tabs). Only an explicit user click or arrow-key press counts as an override. (This fixes a prototype bug where a mismatched switcher value caused the message "Can't unpack this as JWT".)
4. If nothing matches, the app must say "No known format matched" and invite the user to pick a format manually. It must not name a format that was not actually selected.
5. Decoded JSON must render as a collapsible, syntax-coloured tree with a copy button on every value, every section and the whole result.
6. Results must show colour-coded flags (good / info / warn / bad), each with a short plain-English explanation.
7. A command palette (Ctrl/⌘+K) must allow: switching format, loading a sample, copying a share link, clearing the input, toggling theme.
8. The layout must be a resizable split (input / results) that stacks vertically on narrow screens.
9. The app must be dark by default, support light mode, and respect the system setting on first load.
10. Share links must store the input only in the URL `#fragment` (never sent to a server). A visible note must tell the user that links contain their input.
11. A visible line must state: "Runs entirely in your browser. Nothing is uploaded."
12. The page must contain no ads, popups, sign-up walls or cookie banners. (Pro upsells are limited to a quiet, dismissible inline notice, see Req 31.)

### 4.2 Unpackers

13. **JWT:** show header and payload as trees; show expired/valid with a relative time ("Expired 3 days ago"); warn on `alg: none`, missing `exp`, empty signature; state clearly that the signature is **not verified**.
14. **Base64 / Base64url:** detect and decode, with a text/hex preview for binary output and a manual override. Detect nested encodings (e.g. a Base64 string that decodes to JSON or to a JWT) and offer "unpack result".
15. **URL / percent-encoding:** decode, and if the input is a full URL, break it into scheme, host, path, query parameters and fragment.
16. **PEM:** handle `NAME=` prefixes, keys pasted on one line, and `\n` escapes from `.env` files. Report algorithm, key size and curve for RSA, EC and Ed25519 in PKCS#1, PKCS#8 and public-key formats. Show a red **"private key"** warning for private keys, and warn on RSA keys under 2048 bits. Report a damaged key instead of crashing. **Never print the key material back.**
17. **Certificates (X.509 PEM):** parse subject, issuer, validity dates (with expired/valid status), SAN list, key type and size, and signature algorithm.
18. **HTML entities:** decode and encode-preview named, decimal and hex entities.
19. **Cron:** explain a 5- or 6-field expression in plain English and show the next 5–10 run times in the user's local time zone, with a UTC toggle. Use a maintained library (e.g. `cronstrue` for text).
20. **User-Agent:** break the string into browser, version, OS, device and engine. Use a maintained library (e.g. `ua-parser-js`) and flag bots/crawlers.
21. **HTTP headers / Set-Cookie:** parse raw header blocks and single `Set-Cookie` strings; explain each cookie attribute (`Secure`, `HttpOnly`, `SameSite`, `Max-Age`, `Expires`, `Domain`, `Path`); flag missing security flags and weak security headers (e.g. missing `Strict-Transport-Security`, `Content-Security-Policy`).
22. **Timestamps:** detect Unix seconds, milliseconds, microseconds, nanoseconds and ISO 8601; show UTC, local time and relative time.
23. **UUIDs:** validate, show version and variant; for v1/v7 show the embedded timestamp.
24. **Archive peeker:** accept a file by drag-and-drop or file picker (`.zip`, `.tar`, `.tar.gz`/`.tgz`, npm tarballs). List the contents as a file tree (UI SDK Tree, virtualised for large lists), show file sizes, and preview text files. Zip listing must read only the central directory at the end of the file. A visible size cap (default **200 MB**, configurable constant) must be shown in the UI, with a clear message when exceeded. Files must be read locally with the browser's File API; nothing is uploaded. Archive contents must never be executed or rendered as HTML.

### 4.3 Free vs Pro (proposed default; confirm in Open Questions)

25. **Free tier:** JWT, Base64/URL, HTML entities, timestamps, UUIDs, and PEM (basic: type, algorithm, size, private-key warning). All core UX in §4.1.
26. **Pro tier:** cron explainer, User-Agent parser, header/cookie inspector with security audit, certificate parsing, archive peeker, nested "unpack result" chaining, offline PWA install, and local history (last N inputs stored only in the user's browser, off by default, one-click clear).
27. Pro features must be visibly present but locked for free users (name and one-line description, with an "Unlock Pro" button), never hidden.

### 4.4 Licensing and AppSumo (the only server-side code)

28. The system must implement AppSumo's licensing integration: a **webhook endpoint (POST)** that handles `purchase`, `activate`, `upgrade`, `downgrade` and `deactivate` events, and an **OAuth redirect endpoint (GET)** that returns `200 OK` on AppSumo's validation request and completes the redemption flow. Follow AppSumo's current docs at `docs.licensing.appsumo.com`.
29. The webhook must verify AppSumo's request signature per AppSumo's docs, be idempotent (the same event delivered twice must not break state), and respond quickly with the success response AppSumo expects.
30. The system must store only license data: `license_key`, status, tier, timestamps and the raw event log. AppSumo does not send customer emails; look-ups are by `license_key`. It must **never receive, log or store anything the user pasted or dropped.**
31. After a successful OAuth redemption, the server must issue a **signed entitlement token** (e.g. an Ed25519-signed token carrying tier and expiry). The browser stores it locally and verifies it offline with an embedded public key, so Pro works offline and no login screen is needed. The app must re-check status online when possible (e.g. once per day) so that a refunded/deactivated license loses Pro; a short offline grace period is acceptable.
32. License webhook events must be triggered only by AppSumo. There must be no manual way to activate, upgrade or refund a license in the product. A support-only lookup page or script (by `license_key`) is allowed and must be access-protected.
33. A deactivated license must be marked invalid but must support reactivation.
34. The Pro upsell must be a single quiet, dismissible inline notice plus the locked-feature buttons from Req 27, and a short "Redeem AppSumo code" page.

### 4.5 Quality, accessibility and hosting

35. All interactive parts must be keyboard-operable, with visible focus, correct ARIA roles and sufficient colour contrast (WCAG AA).
36. Each unpacker must be pure TypeScript implementing the shared `Unpacker` interface (`score()` and `unpack()`), with unit tests. PEM tests must use keys generated at test time, never real keys.
37. A test must server-render each UI SDK-based component and assert that every `data-slot` selector used in `app.css` appears in the rendered output, so a wrong or renamed slot fails `npm test` instead of silently losing styling.
38. Pin all dependencies to exact versions (UI SDK is beta). Wrap each UI SDK component in a thin local component (`CommandPalette`, `ResultTree`, etc.) so that switching to Bits UI touches one file.
39. The app must pass `svelte-check` with 0 errors and a production build must produce a static site.
40. Text inputs that receive secrets must carry attributes that discourage Grammarly and password-manager injection (`data-gramm="false"`, `data-1p-ignore`, `data-lpignore`, `autocomplete="off"`, `spellcheck="false"`).
41. The site must send a strict Content-Security-Policy: scripts from self only; `connect-src` limited to the site's own licensing endpoints; no third-party scripts, fonts or analytics.
42. The root domain must serve the tool. Old blog URLs must be handled by an agreed redirect plan (see Open Questions).

## 5. Non-Goals (Out of Scope for v1)

- Desktop edition (Tauri / Rust archive engine). The architecture should stay swappable but nothing is built.
- Any server-side processing of user input. The only server code is licensing (Req 28–33).
- AI features of any kind.
- Analytics, tracking, A/B testing or third-party scripts of any kind.
- JWT signature verification and other cryptographic verification (decode only).
- Editing or re-encoding ("packing"); v1 is unpack-only. (Showing an "encoded form" preview for HTML entities is the only exception.)
- User accounts, passwords or profiles. Access is by a signed token tied to an AppSumo license.
- RAR, 7z, xz and zstd archives (browser-grade formats only).
- Hosting the affiliate blog. (See Open Questions.)

## 6. Design Considerations

- **No design folder exists.** Use the `frontend-design` skill plus these inspirations: **CyberChef** (functionality and "Magic" auto-detect; beat its polish), **jwt.io** (instant split-pane), **crontab.guru** (the explanation front and centre), **regex101** (inline explanations), **it-tools.tech** (organising many tools), **Linear / Raycast / Vercel dashboard** (clean, dark, keyboard-first).
- **Type:** Geist Sans for interface text, Geist Mono for all decoded data, both self-hosted (no third-party requests).
- **Principles:** paste-first and zero friction; monospace for data, sans for chrome; copy buttons everywhere; transparent detection ("Detected: JWT"); highlight what matters (expired in red, `alg: none` as a warning, missing cookie flags); quiet, honest locked-feature states; no clutter.
- **Layout:** slim top bar (logo, command-palette trigger, theme toggle, "Pro"), input pane, results pane, small footer with the privacy line.
- **Tokens:** define colours, spacing and fonts as CSS variables in one file (`app.css`); never hard-code them in components.
- **UI SDK styling:** parts are unstyled and are styled through `data-slot` and state attributes (see Req 37).
- **Honest uncertainty:** the prototype has been seen in a browser by the owner (resizing works) but only the empty state has been reviewed. The tree, segmented control and palette need a visual review in task planning.

## 7. Technical Considerations

**Stack (carried over from the prototype):** Svelte 5 (5.33+ required by the UI SDK adapter), Vite, TypeScript 6 (svelte-check does not yet support TS 7), `@ui-sdk/core` and `@ui-sdk/svelte` pinned at the exact beta version (prototype: `0.1.0-beta.13`), Geist fonts via Fontsource. Libraries: `cronstrue` + a cron next-run library, `ua-parser-js`, `fflate` (zip/gzip) plus a small tar reader.

**Hosting (Cloudflare, free tier):** Per Cloudflare's current guidance, **use a Worker with Static Assets for new projects rather than Pages**. Pages still works but new features are focused on Workers. Deploy the Vite `dist/` as the Worker's static assets (`assets.directory`), and add a Worker `fetch` handler only for `/api/appsumo/*` licensing routes. Use Workers KV or D1 for license records and Wrangler secrets for AppSumo keys and the token-signing key. Set `compatibility_date` to the creation date. Redirects and headers (CSP) live in the Worker or `_headers`/`_redirects` equivalents; confirm the current Workers approach in the docs when building, because Cloudflare's compatibility notes say Pages-style middleware and redirect features are handled differently on Workers.

**Detection:** each `Unpacker.score(input)` returns 0–1; `detect()` ranks them. New unpackers plug into the `unpackers` array and appear automatically in detection, the switcher and the palette.

**Entitlements:** the token is verified client-side with an embedded public key; the private signing key exists only as a Worker secret. Feature gating lives in one module (`entitlements.ts`) so the free/Pro split can be changed without touching unpackers.

**Archive peeker:** Zip: read the central directory from the end of the file. `.tar.gz` must be decompressed sequentially, so cap the size and stream where possible. Preview only text files below a size limit. Use UI SDK's Tree in flat-path mode with its virtualised option, and test it with a large listing (this was **not verified** in the prototype).

**Delivery priority (to make "about 2 weeks" realistic):** Scope is large for 2 weeks solo, so build in this order and cut from the bottom if needed:
1. *Must:* PEM + certificates, HTML entities, timestamps, UUIDs, test guard for slot names, privacy/CSP/Workers deployment, entitlement gating, AppSumo webhook + OAuth.
2. *Should:* cron, User-Agent, header/cookie inspector, nested unpacking.
3. *Could:* archive peeker, local history, PWA/offline.

AppSumo approval and listing assets happen on AppSumo's timeline, not the 2-week build; start the application early.

**Dependencies and risks:**
- UI SDK is pre-1.0 and about a week old; APIs may change. Mitigated by exact pins, thin wrappers and the slot test.
- AppSumo LTD terms commit the partner to ongoing access for as long as the tool is solvent; keep running costs near zero (static hosting, no per-use server cost).
- Browser clipboard buttons depend on permissions; provide a fallback.
- Grammarly/password-manager attributes cannot be tested for compliance across extensions.

## 8. Success Metrics

Since there is no analytics by design, measure with sources that need no tracking:
- v1 live on the root domain with all Must items done, `npm test`, `npm run check` and `npm run build` all passing.
- A real-browser review checklist (tree, segmented control, palette, resize, light/dark, mobile) completed with no blocking issues.
- Detection correct on the sample set for every unpacker (target: 100% of the bundled samples, ≥ 95% on a larger test corpus).
- AppSumo redemption tested end to end (purchase → activate → OAuth → Pro unlocked → deactivate → Pro removed) using AppSumo's test tooling.
- Business: AppSumo units sold, refund rate, support tickets, and unprompted mentions/links from developers. (Counts come from the AppSumo Partner Portal, not from the site.)

## 9. Open Questions

1. **Free vs Pro split:** is the proposed split in §4.3 right? An LTD needs enough Pro value to justify the price. Should there be a single tier or multiple AppSumo tiers?
2. **Blog retirement (answer 1A):** the root domain currently hosts the Amazon-affiliate travel-gear blog. Should its URLs be 301-redirected to the tool, moved to a subdomain, or dropped? Retiring it ends its affiliate income and any search ranking it has.
3. **AppSumo status:** has an AppSumo partner application been submitted or approved? Which listing type (Select or self-listed)? What are the planned price and tiers?
4. **Entitlement design:** is an offline-verifiable signed token (Req 31) acceptable, or do you want a stricter online check on every Pro use? How long should the offline grace period be?
5. **Support lookup:** what is the simplest acceptable support tool for finding a customer by `license_key`?
6. **Archive size cap:** is 200 MB right, and should archive previews be Pro-only (as proposed) or free with a lower cap?
7. **Brand:** is the product name "Unpacking the World", with the tool tagline "Decode anything", or something else for AppSumo?
8. **Legal and support basics:** privacy policy, terms and refund-policy pages (AppSumo typically expects a refund window); who handles support email?
9. **Cloudflare:** confirm Workers KV vs D1 for license storage at expected volume, and confirm the free-tier limits cover the AppSumo launch spike.

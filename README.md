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

## Notes

- UI SDK is pre-1.0. Upgrade deliberately (`npm install --save-exact @ui-sdk/svelte@<ver> @ui-sdk/core@<ver>`)
  and read the docs shipped in `node_modules/@ui-sdk/svelte/docs/`.
- Share links put the input in the URL `#fragment`, which browsers never send to a server.

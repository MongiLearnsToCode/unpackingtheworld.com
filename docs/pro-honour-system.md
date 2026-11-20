# Pro enforcement: the honour system

Pro features are gated in the browser. There is no server-side check on the decode path, because
there is no server-side decode path: pasted input never leaves the tab. This document states
plainly what that does and does not protect, so nobody assumes the wrong thing later.

## What the Worker controls

- **Issuing a licence.** Only `POST /api/appsumo/webhook` (HMAC-verified, timestamped) writes a
  `license:<key>` record to KV.
- **Signing an entitlement token.** `/api/license/exchange` and `/api/license/status` return an
  Ed25519-signed token describing `{ v, tier: "pro", lid, iat, exp }`. The browser verifies it
  against `DEFAULT_PUBLIC_KEY_HEX`.
- **Revocation.** Deleting the KV record means the next online check fails; the client then has
  `GRACE_DAYS` (7) of offline tolerance before it deactivates.

## What it does not control

- A determined user can bypass the gate: the client bundle is readable, so patching the
  `isUnlocked()` result, replaying a captured token, or writing the `utw-pro` storage key by hand
  all work. Anyone who does this was never going to buy a licence, and none of their input is
  readable by us to detect it.
- There is no device count limit, no seat enforcement and no per-request metering, by design.

## Why that trade is right here

- Every alternative means either sending pasted input to a server (breaking the product promise)
  or shipping a heavier obfuscation layer that only slows honest users.
- The product is a one-time AppSumo lifetime deal in the tens of dollars. The cost of a support
  conversation about a false lockout is higher than the cost of a bypassed licence.
- The visible enforcement keeps the free/Pro list honest for the majority who do not patch code.

## Rules for future work

1. Never move a privacy-sensitive operation server-side to enforce a licence.
2. Never add analytics, telemetry or "phone home" pings to detect bypasses.
3. If a feature genuinely needs server compute, it is out of scope for this product rather than a
   reason to weaken the promise.
4. Keep revocation available: it is the only lever that works, and it works on the next online
   check.

# Licensing monitoring

The licensing Worker is small and mostly silent: a broken webhook is not visible from the UI until
a customer says so. These are the signals to watch, all available with `wrangler tail` on the
deployed Worker (observability is enabled in `wrangler.jsonc`).

## Structured log lines

| Metric / message | Emitted when | Action |
| --- | --- | --- |
| `appsumo_unsigned_test_ping` | a webhook arrived with `test: true` and no signature | none; AppSumo does this when saving the URL |
| `invalid signature` (401) | HMAC mismatch | check that `APPSUMO_API_KEY` matches the Partner Portal |
| `stale timestamp` (401) | `ts` more than 300 s from now | check the sender's clock; a burst means replay attempts |
| `missing fields` (400) | payload lacks `license_key` or `event` | payload shape changed upstream |
| `licence sign-in must start from the tool` (403) | an OAuth callback with no matching `state` cookie | expected for pasted/crafted links |
| `exchange failed` (502) | AppSumo token exchange rejected | check `APPSUMO_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` |

Watch for a run of `invalid signature` after a secret rotation: that is almost always a stale
deployment rather than an attack.

## KV inspection

```bash
npx wrangler kv key list --binding LICENSES --remote            # keys only
npx wrangler kv key get  license:<key> --binding LICENSES --remote
npm run support:lookup -- <key>                                  # same, validated
```

- `license:<key>` → `{ tier, status, email?, updated }`. Absence means never activated or
  refunded/deactivated.
- `oauth_state:<uuid>` → `"1"`, `expirationTtl` 600 s. A large number of live state keys means
  abandoned sign-in attempts, not a leak.

## What to alert on

1. **Zero successful webhooks for 24 h** while the listing is live — check the Partner Portal URL
   and the `APPSUMO_API_KEY` secret.
2. **A burst of 5xx from `/api/license/*`** — the Worker or KV binding is unhealthy.
3. **`exchange failed` on first purchase** — usually a redirect-URI mismatch.

No user input, pasted content or token material is logged. Keep it that way.

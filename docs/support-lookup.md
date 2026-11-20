# Support lookup runbook

One question dominates licensing support: "did my purchase activate?" Answer it from KV, not from
a guess.

## Prerequisite

An authenticated Wrangler session with access to the account that owns the Worker
(`npx wrangler whoami`). The lookup only reads; there is no manual activate, upgrade or refund
path, and none should be added.

## Look up a licence

```bash
npm run support:lookup -- 3f2a1c8e-6b4d-4f2a-9c1e-77d0a5b6c812
```

The script validates the key shape (`^[0-9a-fA-F-]{36}$`) before it runs
`npx wrangler kv key get license:<key> --binding LICENSES --remote`.

## Interpret the result

| Result | Meaning | What to tell the customer |
| --- | --- | --- |
| record with `status: "active"` | activated and signed in at least once | have them press **Restore** in the tool; if it still fails, the token key pair may have been rotated |
| `status: "deactivated"` | refunded or deactivated upstream | Pro is correctly off |
| no record | webhook never arrived for that key | confirm the key from their AppSumo receipt and check the webhook logs |
| record but the customer sees Free | activation happened on another browser profile, or the daily check has failed for more than 7 days | ask them to open `/app#redeem` and sign in again |

## Escalation

1. `wrangler tail unpackingtheworld` and have the customer retry the sign-in; look for
   `invalid signature`, `stale timestamp` or `exchange failed`.
2. If the webhook never fired, verify the Partner Portal URL is
   `https://unpackingtheworld.com/api/appsumo/webhook`.
3. If tokens stopped verifying after a key rotation, redeploy with the matching
   `TOKEN_PUBLIC_KEY` / `DEFAULT_PUBLIC_KEY_HEX` pair; affected users must redeem again.

Never ask a customer to paste a licence key into a chat you do not control, and never ask for
pasted decoder input — support never needs it.

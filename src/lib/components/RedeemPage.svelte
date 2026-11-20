<script lang="ts">
  import { onMount } from "svelte";
  import { activateToken } from "../entitlements.ts";

  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const redeemUrl = env?.VITE_APPSUMO_REDEEM_URL || "https://appsumo.com/";

  type Status = "idle" | "working" | "done" | "error";
  let status = $state<Status>("idle");
  let message = $state("");

  onMount(async () => {
    const code = new URLSearchParams(location.search).get("code");
    if (!code) return;
    status = "working";
    try {
      const response = await fetch("/api/license/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error("Exchange failed");
      const data = (await response.json()) as { token?: string };
      if (!data.token || !(await activateToken(data.token))) throw new Error("Invalid token");
      status = "done";
      history.replaceState(null, "", `${location.pathname}#redeem`);
    } catch {
      status = "error";
      message = "That code could not be redeemed. Please start again from AppSumo.";
    }
  });
</script>

<section class="redeem" aria-labelledby="redeem-title">
  <div class="redeem-card">
    <h2 id="redeem-title" class="big">Redeem your AppSumo code</h2>
    <p class="muted">Redeem on AppSumo, then come back here. Your Pro access is stored in this browser and verified offline — nothing you paste is ever sent anywhere.</p>
    <a class="btn" href={redeemUrl} rel="noopener noreferrer" target="_blank">Go to AppSumo</a>
    {#if status === "working"}<p role="status">Activating Pro…</p>{/if}
    {#if status === "done"}<p class="good-text" role="status">Pro is unlocked on this browser.</p>{/if}
    {#if status === "error"}<p class="bad-text" role="alert">{message}</p>{/if}
    <a class="link" href="#top">Back to the tool</a>
  </div>
</section>

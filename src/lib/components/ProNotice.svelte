<script lang="ts">
  const STORAGE_KEY = "utw-pro-notice-dismissed";

  let dismissed = $state(false);

  if (typeof localStorage !== "undefined") {
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      dismissed = false;
    }
  }

  function dismiss() {
    dismissed = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      return;
    }
  }
</script>

{#if !dismissed}
  <aside class="pro-notice" role="note" aria-label="Pro features">
    <span>Pro adds certificates, nested unpacking, cron, User-Agent, headers, archives and history.</span>
    <a class="link" href="#redeem">Redeem AppSumo code</a>
    <button class="btn small" onclick={dismiss} aria-label="Dismiss Pro notice">Dismiss</button>
  </aside>
{/if}

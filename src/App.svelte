<script lang="ts">
  import { onMount } from "svelte";
  import type { ArchiveEntry } from "./lib/archive/detect.ts";
  import { openArchive, previewEntry } from "./lib/archive/session.ts";
  import InputPane from "./lib/components/InputPane.svelte";
  import ResultPane from "./lib/components/ResultPane.svelte";
  import CommandPalette, { type Cmd } from "./lib/components/CommandPalette.svelte";
  import LandingPage from "./lib/components/LandingPage.svelte";
  import LegalPage from "./lib/components/LegalPage.svelte";
  import ProNotice from "./lib/components/ProNotice.svelte";
  import RedeemPage from "./lib/components/RedeemPage.svelte";
  import ResizableSplit from "./lib/components/ResizableSplit.svelte";
  import { checkStatusOnline, entitlementState, FEATURES, isUnlocked, loadEntitlements } from "./lib/entitlements.ts";
  import { addHistory, clearHistory, configureHistory, getHistory, setHistoryEnabled } from "./lib/history.ts";
  import { noMatchMessage } from "./lib/messages.ts";
  import { buildCommands, type Command } from "./lib/commands.ts";
  import { isLandingRoute } from "./lib/route.ts";
  import { detect, unpack, unpackers } from "./lib/unpackers/index.ts";
  import { decodeShare, shareUrl } from "./lib/share.ts";

  const isBrowser = typeof window !== "undefined";
  const formatOptions = unpackers.map((u) => ({ id: u.id, label: u.label }));
  /** Above this, decoding is skipped instead of locking the tab. */
  const SOFT_INPUT_LIMIT = 2 * 1024 * 1024;
  const DEBOUNCE_MS = 150;

  const landingMode = isBrowser && isLandingRoute(location.pathname, location.hash);

  function fromHash(): string {
    return isBrowser ? decodeShare(location.hash) : "";
  }

  let input = $state(fromHash());
  let override = $state<string | null>(null);
  let narrow = $state(isBrowser ? window.matchMedia("(max-width: 800px)").matches : false);
  let theme = $state<"dark" | "light">(isBrowser && document.documentElement.dataset.theme === "light" ? "light" : "dark");
  let toast = $state("");
  let paletteOpen = $state(false);
  let chainDepth = $state(0);
  let route = $state(isBrowser ? location.hash : "");
  let archiveEntries = $state<ArchiveEntry[] | null>(null);
  let archiveName = $state("");
  let previewPath = $state("");
  let previewText = $state<string | null>(null);
  let historyEnabled = $state(false);
  let historyItems = $state<string[]>([]);

  onMount(() => {
    let storedHistoryFlag = false;
    try {
      storedHistoryFlag = localStorage.getItem("utw-history-enabled") === "1";
    } catch {
      storedHistoryFlag = false;
    }
    historyEnabled = storedHistoryFlag;
    configureHistory({ enabled: storedHistoryFlag });
    historyItems = getHistory();
    void loadEntitlements().then(() => void checkStatusOnline());
    const daily = setInterval(() => void checkStatusOnline(), 24 * 60 * 60 * 1000);
    const onHash = () => (route = location.hash);
    window.addEventListener("hashchange", onHash);
    return () => {
      clearInterval(daily);
      window.removeEventListener("hashchange", onHash);
    };
  });

  const access = $derived.by(() => {
    $entitlementState;
    return {
      x509: isUnlocked("x509"),
      archive: isUnlocked("archive"),
      history: isUnlocked("history"),
      nested: isUnlocked("nested"),
      lockedIds: new Set(Object.keys(FEATURES).filter((id) => !isUnlocked(id))),
    };
  });

  $effect(() => {
    const mq = window.matchMedia("(max-width: 800px)");
    const on = () => (narrow = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });

  // Decoding is deferred so typing stays responsive while a large paste is
  // parsed: `detect` + `unpack` are synchronous and run on the main thread.
  let detectInput = $state(fromHash());
  let decoding = $state(false);
  const tooLargeInput = $derived(input.length > SOFT_INPUT_LIMIT);

  $effect(() => {
    const value = input;
    if (value === detectInput || value.length > SOFT_INPUT_LIMIT) {
      decoding = false;
      return;
    }
    if (value.length <= 4096) {
      detectInput = value;
      decoding = false;
      return;
    }
    decoding = true;
    const timer = setTimeout(() => {
      detectInput = value;
      decoding = false;
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  const detections = $derived(tooLargeInput ? [] : detect(detectInput));
  const detectedIds = $derived(new Set(detections.map((d) => d.unpacker.id)));
  const active = $derived(override ?? detections[0]?.unpacker.id ?? "");
  const result = $derived(active && detectInput.trim() && !tooLargeInput ? unpack(active, detectInput, chainDepth) : null);
  const activeLabel = $derived(unpackers.find((u) => u.id === active)?.label ?? "");
  const noMatch = $derived(noMatchMessage(override ? activeLabel : null));

  function setInput(v: string) {
    input = v;
    detectInput = v;
    decoding = false;
    override = null;
    chainDepth = 0;
    archiveEntries = null;
    previewText = null;
    addHistory(v);
    historyItems = getHistory();
  }

  function toggleHistory() {
    historyEnabled = !historyEnabled;
    setHistoryEnabled(historyEnabled);
    historyItems = getHistory();
    try {
      localStorage.setItem("utw-history-enabled", historyEnabled ? "1" : "0");
    } catch {
      return;
    }
  }

  function clearHistoryAll() {
    clearHistory();
    historyItems = [];
    say("History cleared");
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function say(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 1800);
  }

  async function copy(text: string, what = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      say(what);
    } catch {
      say("Copy failed. Your browser blocked clipboard access.");
    }
  }

  function shareLink() {
    if (!input.trim()) return say("Nothing to share yet");
    copy(shareUrl(input, location), "Link copied. The input stays in the #fragment, never sent to a server");
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("utw-theme", theme);
    } catch {}
  }

  const commands: Command[] = buildCommands({
    setInput,
    force: (id) => (override = id),
    share: shareLink,
    toggleTheme,
  });

  async function loadArchive(file: File) {
    try {
      const { name, entries } = await openArchive(file);
      archiveEntries = entries;
      archiveName = name;
      previewText = null;
      previewPath = "";
      input = "";
      override = null;
      say(`${entries.length} entries listed locally`);
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not read that archive");
    }
  }

  async function selectEntry(entry: ArchiveEntry) {
    try {
      previewPath = entry.path;
      previewText = await previewEntry(entry);
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not preview that entry");
    }
  }

  function unpackPreview() {
    if (previewText === null) return;
    setInput(previewText);
    archiveEntries = null;
    previewText = null;
  }
</script>

{#if landingMode}
  <LandingPage />
{:else}
<div class="app" id="top">
  <header class="topbar">
    <a class="brand" href="/"><span class="logo" aria-hidden="true">📦</span> unpacking_the_world</a>
    <span class="privacy" title="Everything is decoded locally in this tab">Runs entirely in your browser. Nothing is uploaded.</span>
    <div class="spacer-flex"></div>
    <CommandPalette {commands} bind:open={paletteOpen} />
    <button class="icon-btn" onclick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? "☀" : "☾"}</button>
  </header>

  <main class="main">
    {#if route === "#redeem"}
      <RedeemPage />
    {:else if ["#privacy", "#terms", "#refunds", "#faq"].includes(route)}
      <LegalPage kind={route.slice(1)} />
    {:else}
      <ProNotice />
      <h1 class="sr-only">unpacking_the_world decoder</h1>
      {#key narrow}
        <ResizableSplit {narrow}>
        {#snippet inputPane()}
          <InputPane
            {input}
            {setInput}
            {access}
            {decoding}
            onEdit={() => (override = null)}
            {loadArchive}
            history={{
              enabled: historyEnabled,
              items: historyItems,
              toggle: toggleHistory,
              clear: clearHistoryAll,
            }}
          />
        {/snippet}

        {#snippet resultsPane()}
          <ResultPane
            {input}
            {access}
            {active}
            {detectedIds}
            detectedLabel={detections[0]?.unpacker.label ?? ""}
            options={formatOptions}
            onManual={(id) => (override = id)}
            autoDetected={!override && Boolean(detections[0])}
            {result}
            {noMatch}
            {detections}
            onShare={shareLink}
            onCopy={copy}
            onChain={(next, id) => {
              input = next;
              override = id;
              chainDepth += 1;
            }}
            archive={archiveEntries
              ? {
                  name: archiveName,
                  entries: archiveEntries,
                  previewPath,
                  previewText,
                  onSelect: selectEntry,
                  onUnpackPreview: unpackPreview,
                  onClose: () => {
                    archiveEntries = null;
                    previewText = null;
                  },
                }
              : null}
          />
        {/snippet}
        </ResizableSplit>
      {/key}
    {/if}
  </main>

  <footer class="footer">
    <span>Runs entirely in your browser. Nothing is uploaded.</span>
    <span class="muted">
      Share links contain your input.
      <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a> · <a href="#refunds">Refunds</a> · <a href="#faq">FAQ</a>
    </span>
  </footer>

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
{/if}

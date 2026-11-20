<script lang="ts">
  import { onMount } from "svelte";
  import { MAX_ARCHIVE_BYTES, readArchive, type ArchiveEntry } from "./lib/archive/detect.ts";
  import ArchiveTree from "./lib/components/ArchiveTree.svelte";
  import CommandPalette, { type Cmd } from "./lib/components/CommandPalette.svelte";
  import DropZone from "./lib/components/DropZone.svelte";
  import FormatSwitcher from "./lib/components/FormatSwitcher.svelte";
  import LandingPage from "./lib/components/LandingPage.svelte";
  import LegalPage from "./lib/components/LegalPage.svelte";
  import LockedFeature from "./lib/components/LockedFeature.svelte";
  import ProNotice from "./lib/components/ProNotice.svelte";
  import RedeemPage from "./lib/components/RedeemPage.svelte";
  import ResizableSplit from "./lib/components/ResizableSplit.svelte";
  import ResultTree from "./lib/components/ResultTree.svelte";
  import { checkStatusOnline, entitlementState, FEATURES, isUnlocked, loadEntitlements } from "./lib/entitlements.ts";
  import { addHistory, clearHistory, configureHistory, getHistory, setHistoryEnabled } from "./lib/history.ts";
  import { noMatchMessage } from "./lib/messages.ts";
  import { sampleBase64, sampleCron, sampleHeaders, sampleHtmlEntities, sampleJwt, samplePem, sampleTimestamp, sampleUrl, sampleUserAgent, sampleUuid } from "./lib/samples.ts";
  import { detect, unpack, unpackers } from "./lib/unpackers/index.ts";
  import { b64ToBytes, utf8 } from "./lib/unpackers/util.ts";

  const isBrowser = typeof window !== "undefined";
  const formatOptions = unpackers.map((u) => ({ id: u.id, label: u.label }));

  interface InstallPromptEvent extends Event {
    prompt(): Promise<void>;
  }
  const toolHashes = ["#redeem", "#privacy", "#terms", "#refunds", "#faq"];
  const landingMode = isBrowser && location.pathname === "/"
    && !location.hash.startsWith("#d=")
    && !toolHashes.includes(location.hash);
  let installEvent = $state<InstallPromptEvent | null>(null);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    installEvent = null;
  }

  function fromHash(): string {
    if (!isBrowser) return "";
    const m = location.hash.match(/^#d=([A-Za-z0-9_-]+)$/);
    const bytes = m ? b64ToBytes(m[1]) : null;
    return (bytes && utf8(bytes)) || "";
  }

  let input = $state(fromHash());
  let override = $state<string | null>(null);
  let narrow = $state(isBrowser ? window.matchMedia("(max-width: 800px)").matches : false);
  let theme = $state<"dark" | "light">(isBrowser && document.documentElement.dataset.theme === "light" ? "light" : "dark");
  let toast = $state("");
  let paletteOpen = $state(false);
  let chainDepth = $state(0);
  let route = $state(isBrowser ? location.hash : "");
  let textarea: HTMLTextAreaElement | undefined = $state();
  let archiveEntries = $state<ArchiveEntry[] | null>(null);
  let archiveName = $state("");
  let previewPath = $state("");
  let previewText = $state<string | null>(null);
  let historyEnabled = $state(false);
  let historyItems = $state<string[]>([]);

  onMount(() => {
    if (!landingMode) {
      const toolTitle = "unpacking_the_world · Decode tokens, keys and encodings privately";
      const toolDescription = "Paste a JWT, PEM key, certificate, cron expression, header block or archive and see a flagged result instantly. Everything runs in your browser; nothing is uploaded.";
      document.title = toolTitle;
      const setMeta = (selector: string, value: string, attribute = "content") => {
        document.querySelector(selector)?.setAttribute(attribute, value);
      };
      setMeta('meta[name="description"]', toolDescription);
      setMeta('link[rel="canonical"]', "https://unpackingtheworld.com/app", "href");
      setMeta('meta[property="og:title"]', toolTitle);
      setMeta('meta[property="og:description"]', toolDescription);
      setMeta('meta[property="og:url"]', "https://unpackingtheworld.com/app");
      setMeta('meta[name="twitter:title"]', toolTitle);
      setMeta('meta[name="twitter:description"]', toolDescription);
    }

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
    const onInstall = (event: Event) => (installEvent = event as InstallPromptEvent);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      clearInterval(daily);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  });

  const access = $derived.by(() => {
    $entitlementState;
    return {
      x509: isUnlocked("x509"),
      archive: isUnlocked("archive"),
      history: isUnlocked("history"),
      pwa: isUnlocked("pwa"),
      nested: isUnlocked("nested"),
      lockedIds: new Set(Object.keys(FEATURES).filter((id) => !isUnlocked(id))),
    };
  });

  $effect(() => {
    const mq = window.matchMedia("(max-width: 800px)");
    const on = () => (narrow = mq.matches);
    mq.addEventListener("change", on);
    textarea?.focus();
    return () => mq.removeEventListener("change", on);
  });

  const detections = $derived(detect(input));
  const detectedIds = $derived(new Set(detections.map((d) => d.unpacker.id)));
  const active = $derived(override ?? detections[0]?.unpacker.id ?? "");
  const result = $derived(active && input.trim() ? unpack(active, input, chainDepth) : null);
  const activeLabel = $derived(unpackers.find((u) => u.id === active)?.label ?? "");
  const noMatch = $derived(noMatchMessage(override ? activeLabel : null));

  function setInput(v: string) {
    input = v;
    override = null;
    chainDepth = 0;
    archiveEntries = null;
    previewText = null;
    addHistory(v);
    historyItems = getHistory();
    textarea?.focus();
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
    const bin = Array.from(new TextEncoder().encode(input), (b) => String.fromCharCode(b)).join("");
    const enc = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    copy(`${location.origin}${location.pathname}#d=${enc}`, "Link copied. The input stays in the #fragment, never sent to a server");
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("utw-theme", theme);
    } catch {}
  }

  const commands: Cmd[] = [
    { value: "sample-jwt", label: "Load sample JWT", group: "Samples", run: () => setInput(sampleJwt()) },
    { value: "sample-b64", label: "Load sample Base64", group: "Samples", run: () => setInput(sampleBase64()) },
    { value: "sample-url", label: "Load sample URL", group: "Samples", run: () => setInput(sampleUrl()) },
    { value: "sample-pem", label: "Load sample PEM key", group: "Samples", run: () => setInput(samplePem()) },
    { value: "sample-entities", label: "Load sample HTML entities", group: "Samples", run: () => setInput(sampleHtmlEntities()) },
    { value: "sample-timestamp", label: "Load sample Unix timestamp", group: "Samples", run: () => setInput(sampleTimestamp()) },
    { value: "sample-uuid", label: "Load sample UUID", group: "Samples", run: () => setInput(sampleUuid()) },
    { value: "sample-cron", label: "Load sample cron expression", group: "Samples", run: () => setInput(sampleCron()) },
    { value: "sample-ua", label: "Load sample User-Agent", group: "Samples", run: () => setInput(sampleUserAgent()) },
    { value: "sample-headers", label: "Load sample HTTP headers", group: "Samples", run: () => setInput(sampleHeaders()) },
    ...unpackers.map((u) => ({ value: `as-${u.id}`, label: `Unpack as ${u.label}`, group: "Force format", run: () => (override = u.id) })),
    { value: "auto", label: "Auto-detect format", group: "Force format", run: () => (override = null) },
    { value: "share", label: "Copy share link", group: "Actions", run: shareLink },
    { value: "clear", label: "Clear input", group: "Actions", run: () => setInput("") },
    { value: "theme", label: "Toggle light / dark theme", group: "Actions", run: toggleTheme },
  ];

  async function paste() {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      say("Can’t read the clipboard here. Paste with Ctrl/Cmd+V instead");
    }
  }

  async function loadArchive(file: File) {
    if (file.size > MAX_ARCHIVE_BYTES) {
      say("That archive is over the 200 MB cap. Nothing was uploaded.");
      return;
    }
    try {
      const entries = await readArchive(file);
      archiveEntries = entries;
      archiveName = file.name;
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
    if (entry.size > 65536) {
      say("Preview is limited to files under 64 kB");
      return;
    }
    try {
      const bytes = await entry.read();
      if (!bytes) return;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      previewPath = entry.path;
      previewText = text;
    } catch {
      say("That entry is binary, not text");
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
    {#if access.pwa && installEvent}<button class="btn" onclick={installApp}>Install</button>{/if}
    <button class="icon-btn" onclick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? "☀" : "☾"}</button>
  </header>

  <main class="main">
    {#if route === "#redeem"}
      <RedeemPage />
    {:else if ["#privacy", "#terms", "#refunds", "#faq"].includes(route)}
      <LegalPage kind={route.slice(1)} />
    {:else}
      <ProNotice />
      {#key narrow}
        <ResizableSplit {narrow}>
        {#snippet inputPane()}
          <section class="pane input-pane" aria-label="Input">
            <div class="pane-head">
              <h2>Input</h2>
              <div class="actions">
                <button class="btn" onclick={paste}>Paste</button>
                <button class="btn" onclick={() => setInput("")} disabled={!input}>Clear</button>
              </div>
            </div>
            <textarea
              bind:this={textarea}
              bind:value={input}
              oninput={() => (override = null)}
              data-gramm="false"
              data-1p-ignore
              data-lpignore
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
              aria-label="Paste a token, encoded string or URL"
              placeholder="Paste a JWT, Base64 string, PEM key or URL…"
            ></textarea>
            <div class="samples">
              <span class="muted">Try:</span>
              <button class="chip" onclick={() => setInput(sampleJwt())}>JWT</button>
              <button class="chip" onclick={() => setInput(sampleBase64())}>Base64</button>
              <button class="chip" onclick={() => setInput(sampleUrl())}>URL</button>
            </div>
            {#if access.archive}
              <DropZone onFile={loadArchive} />
            {/if}
            {#if access.history}
              <div class="history-strip">
                <label class="small">
                  <input type="checkbox" checked={historyEnabled} onchange={toggleHistory} /> Keep history
                </label>
                {#if historyEnabled && historyItems.length}
                  <span class="muted small">Stored only in this browser:</span>
                  {#each historyItems.slice(0, 4) as item, index (index)}
                    <button class="chip" title={item} onclick={() => setInput(item)}>{item.slice(0, 18)}{item.length > 18 ? "…" : ""}</button>
                  {/each}
                  <button class="btn small" onclick={clearHistoryAll}>Clear history</button>
                {/if}
              </div>
            {:else}
              <div class="history-strip muted small">
                {#if access.archive}
                  Local history is Pro · <a class="link" href="#redeem">Unlock Pro</a>
                {:else}
                  Archive peeker and local history are Pro · <a class="link" href="#redeem">Unlock Pro</a>
                {/if}
              </div>
            {/if}
          </section>
        {/snippet}

        {#snippet resultsPane()}
          <section class="pane result-pane" aria-label="Result" aria-live="polite">
            <div class="pane-head">
              {#if input.trim()}
                <FormatSwitcher value={active} options={formatOptions} {detectedIds} lockedIds={access.lockedIds} onManual={(id) => (override = id)} />
                {#if !override && detections[0]}
                  <span class="detected-chip">Detected: {detections[0].unpacker.label}</span>
                {/if}
              {:else}
                <h2>Result</h2>
              {/if}
              <div class="spacer-flex"></div>
              {#if input.trim()}<span class="muted small share-note">Links contain your input</span>{/if}
              <button class="btn" onclick={shareLink} disabled={!input.trim()}>Copy link</button>
            </div>

            <div class="result-body">
              {#if !input.trim() && archiveEntries}
                <div class="archive-view">
                  <div class="section-head">
                    <h3>{archiveName} · {archiveEntries.length} entries</h3>
                    <button class="btn small" onclick={() => { archiveEntries = null; previewText = null; }}>Close archive</button>
                  </div>
                  <ArchiveTree entries={archiveEntries} onSelect={selectEntry} />
                  {#if previewText !== null}
                    <div class="archive-preview">
                      <div class="section-head">
                        <h3>{previewPath}</h3>
                        <div class="actions">
                          <button class="btn small" onclick={unpackPreview}>Unpack this</button>
                          <button class="btn small" onclick={() => copy(previewText ?? "", "Copied text")}>Copy</button>
                        </div>
                      </div>
                      <pre class="text-out">{previewText}</pre>
                    </div>
                  {/if}
                </div>
              {:else if !input.trim()}
                <div class="empty">
                  <p class="big">Paste something to unpack it.</p>
                  <p class="muted">JWTs, Base64 / Base64url, PEM keys, certificates and percent-encoded URLs. The format is detected as you type.</p>
                  <p class="muted"><kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> opens the command palette.</p>
                </div>
              {:else if !result}
                <div class="empty">
                  <p class="big">{noMatch.headline}</p>
                  <p class="muted">{noMatch.hint}</p>
                  {#if detections.length}
                    <p class="muted">
                      Matched: {#each detections as d, i (d.unpacker.id)}{i ? ", " : ""}<button class="link" onclick={() => (override = d.unpacker.id)}>{d.unpacker.label}</button>{/each}.
                    </p>
                  {/if}
                </div>
              {:else if active && access.lockedIds.has(active)}
                <LockedFeature
                  name={FEATURES[active as keyof typeof FEATURES]?.name ?? active}
                  description={FEATURES[active as keyof typeof FEATURES]?.description ?? "This is a Pro feature."}
                />
              {:else}
                {#if result.headline}
                  <div class="headline" data-tone={result.flags.find((f) => f.text === result.headline)?.severity}>{result.headline}</div>
                {/if}

                {#if result.flags.length}
                  <ul class="flags">
                    {#each result.flags as f (f.text)}
                      <li data-tone={f.severity}><span class="dot" aria-hidden="true"></span>{f.text}</li>
                    {/each}
                  </ul>
                {/if}

                {#if result.fields.length}
                  <dl class="fields">
                    {#each result.fields as f (f.label)}
                      <dt>{f.label}</dt>
                      <dd><button class="copyable" onclick={() => copy(f.value, `Copied ${f.label}`)} title="Click to copy">{f.value}</button></dd>
                    {/each}
                  </dl>
                {/if}

                {#each result.sections as s (s.title)}
                  <ResultTree title={s.title} json={s.json} onCopy={copy} />
                {/each}

                {#if result.text !== undefined}
                  <div class="section">
                    <div class="section-head">
                      <h3>Decoded</h3>
                      <button class="btn small" onclick={() => copy(result.text ?? "", "Copied")}>Copy</button>
                    </div>
                    <pre class="text-out">{result.text}</pre>
                  </div>
                {/if}

                {#if access.nested && result.next && result.next.length}
                  <div class="chain">
                    <span class="muted small">Unpack result:</span>
                    {#each result.next as step (step.input + step.id)}
                      <button
                        class="chip"
                        onclick={() => {
                          input = step.input;
                          override = step.id;
                          chainDepth += 1;
                        }}
                      >{step.label}</button>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          </section>
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

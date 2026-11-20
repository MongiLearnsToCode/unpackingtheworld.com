<script lang="ts">
  import CommandPalette, { type Cmd } from "./lib/components/CommandPalette.svelte";
  import FormatSwitcher from "./lib/components/FormatSwitcher.svelte";
  import ResizableSplit from "./lib/components/ResizableSplit.svelte";
  import ResultTree from "./lib/components/ResultTree.svelte";
  import { noMatchMessage } from "./lib/messages.ts";
  import { sampleBase64, sampleHtmlEntities, sampleJwt, samplePem, sampleTimestamp, sampleUrl, sampleUuid } from "./lib/samples.ts";
  import { detect, unpack, unpackers } from "./lib/unpackers/index.ts";
  import { b64ToBytes, utf8 } from "./lib/unpackers/util.ts";

  const isBrowser = typeof window !== "undefined";
  const formatOptions = unpackers.map((u) => ({ id: u.id, label: u.label }));

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
  let textarea: HTMLTextAreaElement | undefined = $state();

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
    textarea?.focus();
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
</script>

<div class="app">
  <header class="topbar">
    <a class="brand" href="/"><span class="logo" aria-hidden="true">📦</span> unpackingtheworld</a>
    <span class="privacy" title="Everything is decoded locally in this tab">Runs entirely in your browser. Nothing is uploaded.</span>
    <div class="spacer-flex"></div>
    <CommandPalette {commands} bind:open={paletteOpen} />
    <button class="icon-btn" onclick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? "☀" : "☾"}</button>
  </header>

  <main class="main">
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
              <button class="chip" onclick={() => setInput(samplePem())}>PEM</button>
              <button class="chip" onclick={() => setInput(sampleHtmlEntities())}>Entities</button>
              <button class="chip" onclick={() => setInput(sampleTimestamp())}>Time</button>
              <button class="chip" onclick={() => setInput(sampleUuid())}>UUID</button>
            </div>
          </section>
        {/snippet}

        {#snippet resultsPane()}
          <section class="pane result-pane" aria-label="Result" aria-live="polite">
            <div class="pane-head">
              {#if input.trim()}
                <FormatSwitcher value={active} options={formatOptions} {detectedIds} onManual={(id) => (override = id)} />
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
              {#if !input.trim()}
                <div class="empty">
                  <p class="big">Paste something to unpack it.</p>
                  <p class="muted">JWTs, Base64 / Base64url, PEM keys and percent-encoded URLs. The format is detected as you type.</p>
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

                {#if result.next && result.next.length}
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
  </main>

  <footer class="footer">
    <span>Runs entirely in your browser. Nothing is uploaded.</span>
    <span class="muted">Share links contain your input.</span>
  </footer>

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>

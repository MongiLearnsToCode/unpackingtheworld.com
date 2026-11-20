<script lang="ts">
  import type { ArchiveEntry } from "../archive/detect.ts";
  import type { Access } from "../access.ts";
  import DropZone from "./DropZone.svelte";
  import { sampleBase64, sampleJwt, sampleUrl } from "../samples.ts";

  interface Props {
    input: string;
    setInput: (value: string) => void;
    access: Access;
    decoding: boolean;
    onEdit: () => void;
    loadArchive: (file: File) => void;
    /** Pro-only: recent inputs, kept in this browser only. */
    history: {
      enabled: boolean;
      items: string[];
      toggle: () => void;
      clear: () => void;
    };
  }
  let { input, setInput, access, decoding, onEdit, loadArchive, history }: Props = $props();

  /** Above this, detection pauses instead of locking the tab. */
  const SOFT_INPUT_LIMIT = 2 * 1024 * 1024;

  let textarea: HTMLTextAreaElement | undefined = $state();
  const tooLarge = $derived(input.length > SOFT_INPUT_LIMIT);

  async function paste() {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      textarea?.focus();
    }
  }

  $effect(() => {
    textarea?.focus();
  });
</script>

<section class="pane input-pane" aria-label="Input">
  <div class="pane-head">
    <h2>Input</h2>
    <span class="muted small" aria-live="polite">{decoding ? "Decoding…" : ""}</span>
    <div class="actions">
      <button class="btn" onclick={paste}>Paste</button>
      <button class="btn" onclick={() => setInput("")} disabled={!input}>Clear</button>
    </div>
  </div>
  <textarea
    bind:this={textarea}
    value={input}
    oninput={(event) => {
      setInput(event.currentTarget.value);
      onEdit();
    }}
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
  {#if tooLarge}
    <p class="muted small" role="status">
      That input is larger than {(SOFT_INPUT_LIMIT / (1024 * 1024)).toFixed(0)} MB, so detection is paused to keep this tab responsive. Paste a smaller value.
    </p>
  {/if}
  {#if access.archive}
    <DropZone onFile={loadArchive} />
  {/if}
  {#if access.history}
    <div class="history-strip">
      <label class="small">
        <input type="checkbox" checked={history.enabled} onchange={history.toggle} /> Keep history
      </label>
      {#if history.enabled && history.items.length}
        <span class="muted small">Stored only in this browser:</span>
        {#each history.items.slice(0, 4) as item, index (index)}
          <button class="chip" title={item} onclick={() => setInput(item)}>{item.slice(0, 18)}{item.length > 18 ? "…" : ""}</button>
        {/each}
        <button class="btn small" onclick={history.clear}>Clear history</button>
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

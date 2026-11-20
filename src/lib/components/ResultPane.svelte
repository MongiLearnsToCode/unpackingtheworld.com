<script lang="ts">
  import type { Access } from "../access.ts";
  import type { Unpacked } from "../unpackers/types.ts";
  import { FEATURES } from "../entitlements.ts";
  import ArchiveView from "./ArchiveView.svelte";
  import FormatSwitcher from "./FormatSwitcher.svelte";
  import LockedFeature from "./LockedFeature.svelte";
  import ResultTree from "./ResultTree.svelte";
  import type { ArchiveEntry } from "../archive/detect.ts";

  interface Props {
    input: string;
    access: Access;
    /** Best-format id and the ids detection found, for the switcher. */
    active: string;
    detectedIds: Set<string>;
    detectedLabel: string;
    options: { id: string; label: string }[];
    onManual: (id: string) => void;
    /** False when the user forced a format, so "Detected" is not shown. */
    autoDetected: boolean;
    result: Unpacked | null;
    noMatch: { headline: string; hint: string };
    /** Every format that matched, offered as links when nothing decodes. */
    detections: { unpacker: { id: string; label: string } }[];
    onShare: () => void;
    onCopy: (text: string, message: string) => void;
    onChain: (input: string, id: string) => void;
    archive: {
      name: string;
      entries: ArchiveEntry[];
      previewPath: string;
      previewText: string | null;
      onSelect: (entry: ArchiveEntry) => void;
      onUnpackPreview: () => void;
      onClose: () => void;
    } | null;
  }
  let {
    input,
    access,
    active,
    detectedIds,
    detectedLabel,
    options,
    onManual,
    autoDetected,
    result,
    noMatch,
    detections,
    onShare,
    onCopy,
    onChain,
    archive,
  }: Props = $props();

  const trimmed = $derived(input.trim().length > 0);
</script>

<section class="pane result-pane" aria-label="Result" aria-live="polite">
  <div class="pane-head">
    {#if trimmed}
      <FormatSwitcher value={active} {options} {detectedIds} lockedIds={access.lockedIds} onManual={onManual} />
      {#if autoDetected}
        <span class="detected-chip">Detected: {detectedLabel}</span>
      {/if}
    {:else}
      <h2>Result</h2>
    {/if}
    <div class="spacer-flex"></div>
    {#if trimmed}<span class="muted small share-note">Links contain your input</span>{/if}
    <button class="btn" onclick={onShare} disabled={!trimmed}>Copy link</button>
  </div>

  <div class="result-body">
    {#if !trimmed && archive}
      <ArchiveView
        name={archive.name}
        entries={archive.entries}
        previewPath={archive.previewPath}
        previewText={archive.previewText}
        onSelect={archive.onSelect}
        onUnpackPreview={archive.onUnpackPreview}
        onCopy={onCopy}
        onClose={archive.onClose}
      />
    {:else if !trimmed}
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
            Matched:
            {#each detections as d, i (d.unpacker.id)}{i ? ", " : ""}<button class="link" onclick={() => onManual(d.unpacker.id)}>{d.unpacker.label}</button>{/each}.
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
            <dd><button class="copyable" onclick={() => onCopy(f.value, `Copied ${f.label}`)} title="Click to copy">{f.value}</button></dd>
          {/each}
        </dl>
      {/if}

      {#each result.sections as s (s.title)}
        <ResultTree title={s.title} json={s.json} onCopy={onCopy} />
      {/each}

      {#if result.text !== undefined}
        <div class="section">
          <div class="section-head">
            <h3>Decoded</h3>
            <button class="btn small" onclick={() => onCopy(result.text ?? "", "Copied")}>Copy</button>
          </div>
          <pre class="text-out">{result.text}</pre>
        </div>
      {/if}

      {#if access.nested && result.next && result.next.length}
        <div class="chain">
          <span class="muted small">Unpack result:</span>
          {#each result.next as step (step.input + step.id)}
            <button class="chip" onclick={() => onChain(step.input, step.id)}>{step.label}</button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>

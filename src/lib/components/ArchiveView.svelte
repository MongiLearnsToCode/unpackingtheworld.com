<script lang="ts">
  import type { ArchiveEntry } from "../archive/detect.ts";
  import ArchiveTree from "./ArchiveTree.svelte";

  interface Props {
    name: string;
    entries: ArchiveEntry[];
    previewPath: string;
    previewText: string | null;
    onSelect: (entry: ArchiveEntry) => void;
    onUnpackPreview: () => void;
    onCopy: (text: string, message: string) => void;
    onClose: () => void;
  }
  let { name, entries, previewPath, previewText, onSelect, onUnpackPreview, onCopy, onClose }: Props = $props();
</script>

<div class="archive-view">
  <div class="section-head">
    <h3>{name} · {entries.length} entries</h3>
    <button class="btn small" onclick={onClose}>Close archive</button>
  </div>
  <ArchiveTree {entries} onSelect={onSelect} />
  {#if previewText !== null}
    <div class="archive-preview">
      <div class="section-head">
        <h3>{previewPath}</h3>
        <div class="actions">
          <button class="btn small" onclick={onUnpackPreview}>Unpack this</button>
          <button class="btn small" onclick={() => onCopy(previewText ?? "", "Copied text")}>Copy</button>
        </div>
      </div>
      <pre class="text-out">{previewText}</pre>
    </div>
  {/if}
</div>

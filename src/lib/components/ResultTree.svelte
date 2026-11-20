<script lang="ts">
  import JsonTree from "./JsonTree.svelte";

  interface Props {
    title: string;
    json: unknown;
    onCopy: (value: string, what: string) => void;
  }
  let { title, json, onCopy }: Props = $props();
</script>

<div class="section">
  <div class="section-head">
    <h3>{title}</h3>
    <button class="btn small" onclick={() => onCopy(JSON.stringify(json, null, 2), `Copied ${title}`)}>Copy JSON</button>
  </div>
  <JsonTree {json} label={title} />
</div>

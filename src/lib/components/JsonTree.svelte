<script lang="ts">
  import { Tree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel, type TreeItemData } from "@ui-sdk/svelte/tree";

  interface Props {
    json: unknown;
    label: string;
  }
  let { json, label }: Props = $props();

  interface Node {
    value: string;
    key: string;
    kind: "object" | "array" | "string" | "number" | "boolean" | "null";
    preview: string;
    children?: Node[];
  }

  const MAX_CHILDREN = 500;

  function build(v: unknown, key: string, path: string): Node {
    if (Array.isArray(v)) {
      return { value: path, key, kind: "array", preview: `[${v.length}]`, children: kids(v.map((x, i) => [String(i), x] as const), path) };
    }
    if (v && typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      return { value: path, key, kind: "object", preview: `{${entries.length}}`, children: kids(entries, path) };
    }
    if (v === null) return { value: path, key, kind: "null", preview: "null" };
    if (typeof v === "string") return { value: path, key, kind: "string", preview: JSON.stringify(v) };
    if (typeof v === "number") return { value: path, key, kind: "number", preview: String(v) };
    return { value: path, key, kind: "boolean", preview: String(v) };
  }

  function kids(entries: (readonly [string, unknown])[], path: string): Node[] {
    const out = entries.slice(0, MAX_CHILDREN).map(([k, x]) => build(x, k, `${path}/${k}`));
    if (entries.length > MAX_CHILDREN) {
      out.push({ value: `${path}/…`, key: "…", kind: "string", preview: `${entries.length - MAX_CHILDREN} more not shown` });
    }
    return out;
  }

  const root = $derived(build(json, "$", "$"));
  const nodes = $derived(root.children ?? [root]);

  function allBranches(ns: Node[], acc: string[] = []): string[] {
    for (const n of ns) {
      if (n.children) {
        acc.push(n.value);
        allBranches(n.children, acc);
      }
    }
    return acc;
  }

  // Same shape the Tree wants, so keyboard navigation knows the whole hierarchy
  function toItems(ns: Node[]): TreeItemData[] {
    return ns.map((n) => ({ value: n.value, label: n.key, children: n.children ? toItems(n.children) : undefined }));
  }

  const items = $derived(toItems(nodes));
  const expanded = $derived(allBranches(nodes).slice(0, 200));
</script>

{#snippet rows(ns: Node[])}
  {#each ns as n (n.value)}
    <TreeItem value={n.value}>
      <TreeItemLabel>
        {#if n.children}
          <TreeItemIndicator><span aria-hidden="true">▸</span></TreeItemIndicator>
        {:else}
          <span class="spacer" aria-hidden="true"></span>
        {/if}
        <span class="k">{n.key}</span><span class="colon">:</span>
        <span class="v {n.kind}">{n.preview}</span>
      </TreeItemLabel>
      {#if n.children}
        <TreeGroup>{@render rows(n.children)}</TreeGroup>
      {/if}
    </TreeItem>
  {/each}
{/snippet}

{#key json}
  <Tree aria-label={label} {items} defaultExpanded={expanded} mode="none">
    {@render rows(nodes)}
  </Tree>
{/key}

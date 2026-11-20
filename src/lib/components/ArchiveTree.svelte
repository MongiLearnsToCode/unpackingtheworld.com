<script lang="ts">
  import { Tree, TreeItem, TreeItemIndicator, TreeItemLabel, visibleTreeRows, type TreeItemData } from "@ui-sdk/svelte/tree";
  import type { ArchiveEntry } from "../archive/detect.ts";

  interface Props {
    entries: ArchiveEntry[];
    onSelect?: (entry: ArchiveEntry) => void;
  }
  let { entries, onSelect }: Props = $props();

  interface Node {
    value: string;
    label: string;
    size: number;
    entry?: ArchiveEntry;
    children?: Node[];
  }

  function build(items: ArchiveEntry[]): { nodes: Node[]; byValue: Map<string, Node> } {
    const root: Node = { value: "", label: "", size: 0, children: [] };
    const byValue = new Map<string, Node>();
    for (const entry of items) {
      const segments = entry.path.split("/").filter(Boolean);
      let cursor = root;
      for (const [index, segment] of segments.entries()) {
        const isFolder = index < segments.length - 1 || entry.directory;
        const value = `${segments.slice(0, index + 1).join("/")}${isFolder ? "/" : ""}`;
        let child = cursor.children?.find((node) => node.value === value);
        if (!child) {
          child = { value, label: segment, size: 0, children: isFolder ? [] : undefined };
          cursor.children ??= [];
          cursor.children.push(child);
          byValue.set(value, child);
        }
        if (index === segments.length - 1) {
          child.entry = entry;
          child.size = entry.size;
        }
        cursor = child;
      }
    }
    return { nodes: root.children ?? [], byValue };
  }

  function toItems(nodes: Node[]): TreeItemData[] {
    return nodes.map((node) => ({
      value: node.value,
      label: node.label,
      children: node.children?.length ? toItems(node.children) : undefined,
    }));
  }

  const built = $derived(build(entries));
  const items = $derived(toItems(built.nodes));
  let expanded = $state<string[]>([]);
  const rows = $derived(visibleTreeRows(items, expanded));

  const rowHeight = 28;
  const viewportHeight = 320;
  let scroller: HTMLDivElement | undefined = $state();
  let scrollTop = $state(0);
  const start = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - 4));
  const end = $derived(Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 4));

  function onHighlight(_value: string, details: { index: number }) {
    const element = scroller;
    if (!element) return;
    const top = details.index * rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + rowHeight > element.scrollTop + element.clientHeight - 10) {
      element.scrollTop = top + rowHeight - element.clientHeight + 10;
    }
    scrollTop = element.scrollTop;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div class="archive-scroll" bind:this={scroller} onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}>
  <Tree aria-label="Archive contents" {items} bind:expanded {onHighlight} style="height: {rows.length * rowHeight}px">
    {#each rows.slice(start, end) as { item, index } (item.value)}
      {@const node = built.byValue.get(item.value)}
      <TreeItem value={item.value} style="top: {index * rowHeight}px">
        <TreeItemLabel>
          {#if node?.children?.length}
            <TreeItemIndicator><span aria-hidden="true">▸</span></TreeItemIndicator>
          {:else}
            <span class="spacer" aria-hidden="true"></span>
          {/if}
          <span class="archive-name">{item.label}</span>
          {#if node?.entry}<span class="archive-size">{formatSize(node.size)}</span>{/if}
          {#if node?.entry && !node.entry.directory}
            <button class="link small" onclick={() => node.entry && onSelect?.(node.entry)}>preview</button>
          {/if}
        </TreeItemLabel>
      </TreeItem>
    {/each}
  </Tree>
</div>

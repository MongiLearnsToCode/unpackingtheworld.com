<script lang="ts">
  import type { Snippet } from "svelte";
  import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/svelte/resizable";

  interface Props {
    narrow: boolean;
    inputPane: Snippet;
    resultsPane: Snippet;
  }
  let { narrow, inputPane, resultsPane }: Props = $props();
</script>

<Resizable orientation={narrow ? "vertical" : "horizontal"} class="split">
  <ResizablePanel defaultSize={42} minSize={25}>{@render inputPane()}</ResizablePanel>
  <ResizableHandle aria-label="Resize input and results panes" />
  <ResizablePanel minSize={30}>{@render resultsPane()}</ResizablePanel>
</Resizable>

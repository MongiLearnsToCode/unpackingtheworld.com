<script lang="ts">
  import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/svelte/segmented-control";

  interface Props {
    value: string;
    options: { id: string; label: string }[];
    detectedIds: Set<string>;
    onManual: (id: string) => void;
  }
  let { value, options, detectedIds, onManual }: Props = $props();
</script>

<SegmentedControl
  {value}
  onValueChange={(next, details) => {
    if (details.reason === "item-press" || details.reason === "list-navigation") {
      onManual(next as string);
    }
  }}
  aria-label="Format"
>
  <SegmentedControlIndicator />
  {#each options as option (option.id)}
    <SegmentedControlItem value={option.id} data-detected={detectedIds.has(option.id) ? "" : undefined}>{option.label}</SegmentedControlItem>
  {/each}
</SegmentedControl>

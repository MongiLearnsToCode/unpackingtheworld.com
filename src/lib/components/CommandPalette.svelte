<script lang="ts">
  import { Command, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList, CommandShortcut } from "@ui-sdk/svelte/command";
  import { Dialog, DialogBackdrop, DialogContent, DialogShortcut, DialogTitle, DialogTrigger } from "@ui-sdk/svelte/dialog";

  export interface Cmd {
    value: string;
    label: string;
    group: string;
    run: () => void;
    shortcut?: string;
  }

  interface Props {
    commands: Cmd[];
    open?: boolean;
  }
  let { commands, open = $bindable(false) }: Props = $props();

  const groups = $derived([...new Set(commands.map((c) => c.group))]);

  function onAction(value: string) {
    open = false;
    commands.find((c) => c.value === value)?.run();
  }
</script>

<Dialog bind:open>
  <DialogTrigger shortcut="mod+k" class="palette-trigger">
    <span>Commands</span>
    <DialogShortcut />
  </DialogTrigger>
  <DialogBackdrop />
  <DialogContent class="palette">
    <DialogTitle class="sr-only">Command palette</DialogTitle>
    <Command {onAction}>
      <CommandInput aria-label="Search commands" placeholder="Type a command…" />
      <CommandEmpty>No matching command.</CommandEmpty>
      <CommandList>
        {#each groups as g (g)}
          <CommandGroup>
            <CommandGroupLabel>{g}</CommandGroupLabel>
            {#each commands.filter((c) => c.group === g) as c (c.value)}
              <CommandItem value={c.value}>
                <span>{c.label}</span>
                {#if c.shortcut}<CommandShortcut />{/if}
              </CommandItem>
            {/each}
          </CommandGroup>
        {/each}
      </CommandList>
    </Command>
  </DialogContent>
</Dialog>

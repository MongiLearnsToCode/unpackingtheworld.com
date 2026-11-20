<script lang="ts">
  import { MAX_ARCHIVE_BYTES } from "../archive/detect.ts";

  interface Props {
    onFile: (file: File) => void;
  }
  let { onFile }: Props = $props();

  let dragging = $state(false);
  let picker: HTMLInputElement | undefined = $state();
  const limit = Math.round(MAX_ARCHIVE_BYTES / 1024 / 1024);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }

  function onChange(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) onFile(file);
  }
</script>

<div
  class="dropzone"
  role="group"
  aria-label="Archive drop zone"
  class:dragging
  ondragover={(event) => { event.preventDefault(); dragging = true; }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <input
    bind:this={picker}
    type="file"
    class="sr-only"
    accept=".zip,.tar,.tgz,.gz"
    aria-label="Choose a zip or tar archive"
    onchange={onChange}
  />
  <button class="btn" onclick={() => picker?.click()}>Choose archive</button>
  <span class="muted small">or drop a .zip, .tar or .tar.gz here · {limit} MB cap · read locally, never uploaded</span>
</div>

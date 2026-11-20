<script lang="ts">
  import { LEGAL } from "../legal.ts";

  interface Props {
    kind: string;
  }
  let { kind }: Props = $props();
  const page = $derived(LEGAL[kind] ?? LEGAL.faq);
</script>

<article class="legal">
  <h1 class="big">{page.title}</h1>
  {#each page.sections as section (section.title)}
    <section>
      <h2>{section.title}</h2>
      {#each section.paragraphs as paragraph}
        <p>{paragraph}</p>
      {/each}
      {#if section.bullets}
        <ul>
          {#each section.bullets as bullet}
            <li>{bullet}</li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
  <p class="muted small">Questions about licensing? Check the <a class="link" href="#faq">FAQ</a> or contact AppSumo support for purchase issues.</p>
  <a class="link" href="#top">Back to the tool</a>
</article>

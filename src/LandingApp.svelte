<script lang="ts">
  import LandingPage from "./lib/components/LandingPage.svelte";
</script>

<!--
  The marketing route is its own entry so the tool shell (eleven unpackers,
  archive readers, licensing client) never ships to a landing-page visitor.
  Rendering LandingPage as the root keeps this tree byte-identical to the
  prerendered markup, so hydration matches.
-->
<LandingPage />

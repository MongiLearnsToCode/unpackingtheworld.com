<script lang="ts">
  interface Props {
    name: string;
    description: string;
  }
  let { name, description }: Props = $props();
</script>

<div class="locked" role="group" aria-label={`${name} is a Pro feature`}>
  <div class="locked-copy">
    <p class="big">{name} <span class="pro-pill">Pro</span></p>
    <p class="muted">{description}</p>
  </div>
  <a class="btn" href="#redeem">Unlock Pro</a>
</div>

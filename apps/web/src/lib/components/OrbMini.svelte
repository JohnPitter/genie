<script lang="ts">
  import Orb from './Orb.svelte';

  export let state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' = 'idle';
</script>

<div class="orb-mini" aria-hidden="true">
  <Orb {state} size={64} />
</div>

<style>
  .orb-mini {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
</style>

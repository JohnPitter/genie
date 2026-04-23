<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let placeholder = '';
  export let type: 'text' | 'email' | 'password' | 'search' | 'number' = 'text';
  export let disabled = false;
  export let error = '';

  const dispatch = createEventDispatcher<{
    input: Event;
    change: Event;
    keydown: KeyboardEvent;
  }>();

  function onInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    dispatch('input', e);
  }
</script>

<div class="input-wrap" class:input-wrap--error={error}>
  <!--
    Svelte 4: bind:value + dynamic type is unsupported.
    text branch uses bind:value; other types use on:input + manual assignment.
  -->
  {#if type === 'password'}
    <input
      class="input"
      class:input--error={error}
      type="password"
      {value}
      {placeholder}
      {disabled}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? 'input-error' : undefined}
      on:input={onInput}
      on:change={(e) => dispatch('change', e)}
      on:keydown={(e) => dispatch('keydown', e)}
    />
  {:else if type === 'email'}
    <input
      class="input"
      class:input--error={error}
      type="email"
      {value}
      {placeholder}
      {disabled}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? 'input-error' : undefined}
      on:input={onInput}
      on:change={(e) => dispatch('change', e)}
      on:keydown={(e) => dispatch('keydown', e)}
    />
  {:else if type === 'number'}
    <input
      class="input"
      class:input--error={error}
      type="number"
      {value}
      {placeholder}
      {disabled}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? 'input-error' : undefined}
      on:input={onInput}
      on:change={(e) => dispatch('change', e)}
      on:keydown={(e) => dispatch('keydown', e)}
    />
  {:else if type === 'search'}
    <input
      class="input"
      class:input--error={error}
      type="search"
      {value}
      {placeholder}
      {disabled}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? 'input-error' : undefined}
      on:input={onInput}
      on:change={(e) => dispatch('change', e)}
      on:keydown={(e) => dispatch('keydown', e)}
    />
  {:else}
    <input
      class="input"
      class:input--error={error}
      type="text"
      bind:value
      {placeholder}
      {disabled}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? 'input-error' : undefined}
      on:input={(e) => dispatch('input', e)}
      on:change={(e) => dispatch('change', e)}
      on:keydown={(e) => dispatch('keydown', e)}
    />
  {/if}
  {#if error}
    <p id="input-error" class="input__error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .input-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(22, 23, 28, 0.72);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-primary);
    transition:
      border-color var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-fast) var(--ease-standard);
    outline: none;
  }

  .input::placeholder {
    color: var(--text-muted);
  }

  .input:focus {
    border-color: rgba(167, 155, 255, 0.45);
    box-shadow: 0 0 0 4px rgba(167, 155, 255, 0.12);
  }

  .input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Error state ─────────────────────────────────────────── */
  .input--error {
    border-color: rgba(240, 124, 124, 0.6);
  }
  .input--error:focus {
    border-color: var(--status-error);
    box-shadow: 0 0 0 4px rgba(240, 124, 124, 0.12);
  }

  .input__error {
    margin: 0;
    font-size: var(--text-micro);
    color: var(--status-error);
    font-family: var(--font-body);
  }
</style>

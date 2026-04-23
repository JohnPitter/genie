<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Orb from '$lib/components/Orb.svelte';

  let inputValue = '';
  let inputError = '';
  let orbDemo: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' = 'idle';

  const orbStates: Array<'idle' | 'listening' | 'thinking' | 'speaking' | 'error'> = [
    'idle', 'listening', 'thinking', 'speaking', 'error',
  ];

  function toggleError() {
    inputError = inputError ? '' : 'Campo inválido — tente novamente.';
  }
</script>

<svelte:head>
  <title>Orb Quantum — Design System</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <h1 class="page-title">Orb Quantum <span class="page-title--accent">Design System</span></h1>
    <p class="page-subtitle">Primitivos visuais para o Genie — validação visual Fase 2</p>
    <Badge variant="gold" size="sm">v1.0.0 · em construção</Badge>
  </header>

  <!-- ── Buttons ─────────────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Button</h2>

    <div class="row">
      <h3 class="row-label">Variants</h3>
      <div class="group">
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
    </div>

    <div class="row">
      <h3 class="row-label">Sizes</h3>
      <div class="group">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
    </div>

    <div class="row">
      <h3 class="row-label">States</h3>
      <div class="group">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button variant="danger" loading>Danger Loading</Button>
      </div>
    </div>
  </section>

  <!-- ── Cards ──────────────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Card</h2>

    <div class="cards-grid">
      <Card variant="default" padding="md">
        <h3 class="card-inner-title">Default Card</h3>
        <p class="card-inner-body">Glass card com border gradient gold+lilac. Shadow de 40px profundidade.</p>
        <Badge variant="neutral" size="sm">variant: default</Badge>
      </Card>

      <Card variant="glass" padding="md">
        <h3 class="card-inner-title">Glass Card</h3>
        <p class="card-inner-body">Translucent com backdrop-filter blur 18px. Ideal para overlays.</p>
        <Badge variant="info" size="sm">variant: glass</Badge>
      </Card>

      <Card variant="elevated" padding="md">
        <h3 class="card-inner-title">Elevated Card</h3>
        <p class="card-inner-body">Border violet interativo, shadow mais intensa. Para destaque.</p>
        <Badge variant="gold" size="sm">variant: elevated</Badge>
      </Card>

      <Card variant="default" padding="md" hoverable>
        <h3 class="card-inner-title">Hoverable Card</h3>
        <p class="card-inner-body">Passe o mouse — lifts translateY(-4px) com shadow intensificada.</p>
        <Badge variant="success" size="sm">hoverable: true</Badge>
      </Card>
    </div>
  </section>

  <!-- ── Inputs ─────────────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Input</h2>

    <div class="inputs-col">
      <Input bind:value={inputValue} placeholder="Ex: PETR4 — qual é a cotação hoje?" />

      <Input placeholder="Desabilitado" disabled />

      <div>
        <Input
          bind:value={inputValue}
          placeholder="Com erro (clique no botão)"
          error={inputError}
        />
        <button class="toggle-error-btn" on:click={toggleError}>
          {inputError ? 'Limpar erro' : 'Simular erro'}
        </button>
      </div>

      <Input type="password" placeholder="Senha / API key" />
    </div>
  </section>

  <!-- ── Badges ─────────────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Badge</h2>

    <div class="row">
      <h3 class="row-label">Variants · md</h3>
      <div class="group group--wrap">
        <Badge variant="success">Sucesso</Badge>
        <Badge variant="warning">Atenção</Badge>
        <Badge variant="error">Erro</Badge>
        <Badge variant="info">Informação</Badge>
        <Badge variant="neutral">Neutro</Badge>
        <Badge variant="gold">Gold · Premium</Badge>
      </div>
    </div>

    <div class="row">
      <h3 class="row-label">Sizes</h3>
      <div class="group">
        <Badge variant="success" size="sm">Small</Badge>
        <Badge variant="success" size="md">Medium</Badge>
      </div>
    </div>
  </section>

  <!-- ── Skeletons ───────────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Skeleton</h2>

    <Card variant="default" padding="md">
      <div class="skeleton-demo">
        <Skeleton width="48px" height="48px" rounded="full" />
        <div class="skeleton-lines">
          <Skeleton width="60%" height="16px" rounded="sm" />
          <Skeleton width="40%" height="12px" rounded="sm" />
        </div>
      </div>
      <div style="margin-top: 16px;">
        <Skeleton width="100%" height="80px" rounded="md" />
      </div>
    </Card>
  </section>

  <!-- ── Icon Buttons ───────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">IconButton</h2>

    <div class="row">
      <h3 class="row-label">Sizes</h3>
      <div class="group">
        <IconButton label="Fechar pequeno" size={16}>
          <!-- 16×16 inline SVG (Lucide X shape) -->
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </IconButton>

        <IconButton label="Fechar médio" size={20}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </IconButton>

        <IconButton label="Fechar grande" size={24}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </IconButton>

        <IconButton label="Favoritar (desabilitado)" size={20} disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </IconButton>
      </div>
    </div>
  </section>

  <!-- ── Mascote Orb ──────────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Mascote Orb</h2>

    <!-- Interactive state controller -->
    <div class="row">
      <h3 class="row-label">Estado ativo</h3>
      <div class="group group--wrap">
        {#each orbStates as s}
          <button
            class="orb-state-btn"
            class:orb-state-btn--active={orbDemo === s}
            on:click={() => (orbDemo = s)}
          >
            {s}
          </button>
        {/each}
      </div>
    </div>

    <!-- All 5 states side by side -->
    <div class="orb-showcase">
      {#each orbStates as s}
        <div class="orb-showcase__item">
          <Orb state={s} size={120} />
          <span class="orb-showcase__label" class:orb-showcase__label--active={orbDemo === s}>
            {s}
          </span>
        </div>
      {/each}
    </div>

    <!-- Interactive demo: large Orb responding to selected state -->
    <div class="orb-demo">
      <Orb state={orbDemo} size={200} />
      <p class="orb-demo__caption">Estado: <strong>{orbDemo}</strong></p>
    </div>
  </section>

  <!-- ── Color tokens ───────────────────────────────────────── -->
  <section class="section">
    <h2 class="section-title">Paleta de Cores</h2>
    <div class="swatches">
      {#each [
        { name: '--bg-primary', label: 'Void Black' },
        { name: '--bg-surface', label: 'Graphite' },
        { name: '--bg-surface-2', label: 'Soft Charcoal' },
        { name: '--bg-elevated', label: 'Elevated' },
        { name: '--accent-gold', label: 'Champagne Gold' },
        { name: '--accent-lilac', label: 'Iris Glow' },
        { name: '--accent-violet', label: 'Electric Violet' },
        { name: '--status-success', label: 'Success' },
        { name: '--status-warning', label: 'Warning' },
        { name: '--status-error', label: 'Error' },
        { name: '--status-info', label: 'Info' },
      ] as swatch}
        <div class="swatch">
          <div class="swatch__color" style="background: var({swatch.name});" />
          <span class="swatch__label">{swatch.label}</span>
          <code class="swatch__token">{swatch.name}</code>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .page {
    min-height: 100dvh;
    background: var(--gradient-bg);
    padding: var(--space-4xl) var(--space-xl);
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4xl);
  }

  /* ── Header ─────────────────────────────────────────────── */
  .page-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }
  .page-title {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
  }
  .page-title--accent {
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .page-subtitle {
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 0;
  }

  /* ── Sections ───────────────────────────────────────────── */
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }
  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-title);
    font-weight: 600;
    color: var(--accent-gold);
    margin: 0;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border-soft);
  }

  /* ── Rows / groups ──────────────────────────────────────── */
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-xl);
  }
  .row-label {
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
    min-width: 80px;
  }
  .group {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    flex-wrap: nowrap;
  }
  .group--wrap {
    flex-wrap: wrap;
  }

  /* ── Cards grid ──────────────────────────────────────────── */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-lg);
  }
  .card-inner-title {
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-sm);
  }
  .card-inner-body {
    font-size: var(--text-micro);
    color: var(--text-secondary);
    margin: 0 0 var(--space-md);
    line-height: 1.5;
  }

  /* ── Inputs column ───────────────────────────────────────── */
  .inputs-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 480px;
  }
  .toggle-error-btn {
    margin-top: var(--space-sm);
    background: none;
    border: none;
    color: var(--accent-lilac);
    font-size: var(--text-micro);
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  /* ── Skeleton demo ───────────────────────────────────────── */
  .skeleton-demo {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }
  .skeleton-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  /* ── Orb state buttons ───────────────────────────────────── */
  .orb-state-btn {
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-soft);
    background: var(--glass-white);
    color: var(--text-secondary);
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard);
  }
  .orb-state-btn:hover {
    background: var(--glass-lilac);
    border-color: var(--border-interactive);
    color: var(--text-primary);
  }
  .orb-state-btn--active {
    background: var(--glass-lilac);
    border-color: var(--accent-lilac);
    color: var(--accent-lilac);
    font-weight: 600;
  }

  /* ── Orb showcase ─────────────────────────────────────────── */
  .orb-showcase {
    display: flex;
    gap: var(--space-xl);
    align-items: flex-end;
    flex-wrap: wrap;
    justify-content: center;
  }
  .orb-showcase__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }
  .orb-showcase__label {
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    color: var(--text-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: color var(--dur-fast) var(--ease-standard);
  }
  .orb-showcase__label--active {
    color: var(--accent-gold);
    font-weight: 600;
  }

  /* ── Interactive large demo ───────────────────────────────── */
  .orb-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-2xl);
    border: 1px dashed var(--border-soft);
    border-radius: var(--radius-lg);
    background: var(--glass-white);
  }
  .orb-demo__caption {
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    color: var(--text-secondary);
    margin: 0;
  }
  .orb-demo__caption strong {
    color: var(--accent-lilac);
    font-weight: 600;
  }

  /* ── Color swatches ──────────────────────────────────────── */
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-lg);
  }
  .swatch {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    align-items: center;
  }
  .swatch__color {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-soft);
  }
  .swatch__label {
    font-size: var(--text-micro);
    color: var(--text-secondary);
    text-align: center;
  }
  .swatch__token {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
  }
</style>

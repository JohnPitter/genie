<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Activity, Zap, TrendingUp, AlertTriangle, Server,
    RefreshCw, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Clock,
  } from 'lucide-svelte';
  import { apiClient } from '$lib/api/client';
  import type { GoldenSignals } from '$lib/api/client';

  const SESSION_TOKEN_KEY = 'genie_admin_token';
  const REFRESH_MS = 30_000;

  // ── Auth ─────────────────────────────────────────────────
  let unlocked = false;
  let pin = '';
  let pinError = '';
  let showPin = false;
  let pinInput: HTMLInputElement;
  let submitting = false;
  let adminToken = '';

  // ── Stats ─────────────────────────────────────────────────
  let stats: GoldenSignals | null = null;
  let loading = false;
  let statsError = '';
  let lastUpdated = '';
  let intervalId: ReturnType<typeof setInterval> | undefined;

  // ── Computed ──────────────────────────────────────────────
  $: lstatus = stats ? latencyStatus(stats.latency.p95) : 'ok';
  $: estatus = stats ? errorStatus(stats.errors.rate) : 'ok';
  $: sstatus = stats ? saturationStatus(stats.saturation.heapUsedMB, stats.saturation.heapTotalMB) : 'ok';
  $: hpct = stats ? heapPct(stats.saturation.heapUsedMB, stats.saturation.heapTotalMB) : 0;
  $: maxPath = stats?.traffic.topPaths[0]?.count ?? 1;

  // ── Helpers ───────────────────────────────────────────────
  function latencyStatus(p95: number): 'ok' | 'warn' | 'error' {
    if (p95 < 500) return 'ok';
    if (p95 < 2_000) return 'warn';
    return 'error';
  }

  function errorStatus(rate: number): 'ok' | 'warn' | 'error' {
    if (rate < 1) return 'ok';
    if (rate < 5) return 'warn';
    return 'error';
  }

  function saturationStatus(used: number, total: number): 'ok' | 'warn' | 'error' {
    if (total === 0) return 'ok';
    const p = used / total;
    if (p < 0.7) return 'ok';
    if (p < 0.85) return 'warn';
    return 'error';
  }

  function heapPct(used: number, total: number): number {
    return total > 0 ? Math.round((used / total) * 100) : 0;
  }

  function fmtMs(ms: number): string {
    if (ms < 1_000) return `${ms}ms`;
    return `${(ms / 1_000).toFixed(1)}s`;
  }

  function formatUptime(s: number): string {
    const d = Math.floor(s / 86_400);
    const h = Math.floor((s % 86_400) / 3_600);
    const m = Math.floor((s % 3_600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return `${Math.floor(diff / 1_000)}s`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    return `${Math.floor(diff / 3_600_000)}h`;
  }

  function methodColor(method: string): string {
    const map: Record<string, string> = {
      GET:    'var(--status-ok)',
      POST:   'var(--accent-lilac)',
      PUT:    'var(--accent-gold)',
      DELETE: 'var(--status-error)',
      PATCH:  '#60a5fa',
    };
    return map[method] ?? 'var(--text-muted)';
  }

  // ── Auth actions ──────────────────────────────────────────
  async function submitPin() {
    if (!pin.trim()) return;
    submitting = true;
    pinError = '';
    try {
      const ok = await apiClient.verifyAdminToken(pin);
      if (ok) {
        adminToken = pin;
        sessionStorage.setItem(SESSION_TOKEN_KEY, pin);
        unlocked = true;
        await loadStats();
        intervalId = setInterval(loadStats, REFRESH_MS);
      } else {
        pinError = 'PIN incorreto.';
        pin = '';
        setTimeout(() => pinInput?.focus(), 50);
      }
    } catch {
      pinError = 'Erro ao validar PIN. Backend indisponível?';
    } finally {
      submitting = false;
    }
  }

  function lock() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    adminToken = '';
    unlocked = false;
    pin = '';
    stats = null;
    clearInterval(intervalId);
  }

  // ── Stats ─────────────────────────────────────────────────
  async function loadStats() {
    loading = true;
    statsError = '';
    try {
      stats = await apiClient.getStats(adminToken);
      lastUpdated = new Date().toLocaleTimeString('pt-BR');
    } catch (err) {
      statsError = err instanceof Error ? err.message : 'Erro ao carregar métricas';
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored && (await apiClient.verifyAdminToken(stored))) {
      adminToken = stored;
      unlocked = true;
      await loadStats();
      intervalId = setInterval(loadStats, REFRESH_MS);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setTimeout(() => pinInput?.focus(), 50);
    }
  });

  onDestroy(() => clearInterval(intervalId));
</script>

<svelte:head>
  <title>Observabilidade — Genie</title>
</svelte:head>

{#if !unlocked}
  <!-- ── PIN gate ─────────────────────────────────────── -->
  <div class="gate">
    <div class="gate__card">
      <div class="gate__icon" aria-hidden="true">
        <Activity size={28} />
      </div>
      <h1 class="gate__title">Observabilidade</h1>
      <p class="gate__subtitle">Insira o PIN de administrador para visualizar os Golden Signals.</p>

      <form class="gate__form" on:submit|preventDefault={submitPin}>
        <div class="gate__input-wrap">
          {#if showPin}
            <input bind:this={pinInput} bind:value={pin} type="text" placeholder="ADMIN_TOKEN"
              class="gate__input" class:gate__input--error={!!pinError}
              aria-label="PIN de administrador" autocomplete="off" />
          {:else}
            <input bind:this={pinInput} bind:value={pin} type="password" placeholder="ADMIN_TOKEN"
              class="gate__input" class:gate__input--error={!!pinError}
              aria-label="PIN de administrador" autocomplete="off" />
          {/if}
          <button type="button" class="gate__eye" aria-label={showPin ? 'Ocultar' : 'Mostrar'}
            on:click={() => (showPin = !showPin)}>
            {#if showPin}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
          </button>
        </div>

        {#if pinError}
          <p class="gate__error" role="alert">{pinError}</p>
        {/if}

        <button type="submit" class="gate__btn" disabled={submitting || !pin.trim()}>
          {submitting ? 'Validando…' : 'Entrar'}
        </button>
      </form>

      <a href="/settings" class="gate__back">← Voltar ao painel admin</a>
    </div>
  </div>

{:else}
  <!-- ── Dashboard ────────────────────────────────────── -->
  <main class="page">

    <!-- Header -->
    <div class="page__header">
      <div class="page__header-left">
        <a href="/settings" class="back-btn" aria-label="Voltar ao Admin">
          <ArrowLeft size={16} />
        </a>
        <div class="page__icon"><Activity size={20} /></div>
        <div>
          <h1 class="page__title">Observabilidade</h1>
          <p class="page__subtitle">Golden Signals · última hora</p>
        </div>
      </div>
      <div class="page__header-right">
        {#if lastUpdated}
          <span class="update-time">
            <Clock size={11} />
            {lastUpdated}
          </span>
        {/if}
        <button class="icon-btn" on:click={loadStats} disabled={loading} aria-label="Atualizar métricas">
          <RefreshCw size={14} class={loading ? 'spin' : ''} />
        </button>
        <button class="lock-btn" on:click={lock}>
          <Lock size={13} />
          Bloquear
        </button>
      </div>
    </div>

    {#if statsError}
      <div class="error-banner">
        <AlertCircle size={15} />
        {statsError}
      </div>
    {/if}

    {#if !stats && loading}
      <div class="signals-grid">
        {#each [0, 1, 2, 3] as _}
          <div class="signal-card signal-card--skeleton"></div>
        {/each}
      </div>

    {:else if stats}
      <div class="signals-grid">

        <!-- ── LATÊNCIA ─────────────────────────────────── -->
        <div class="signal-card">
          <div class="signal-card__header">
            <div class="signal-card__title-wrap">
              <div class="signal-card__icon signal-card__icon--latency"><Zap size={15} /></div>
              <span class="signal-card__label">Latência</span>
            </div>
            <div class="status-badge status-badge--{lstatus}">
              <span class="status-dot"></span>
              {lstatus === 'ok' ? 'Saudável' : lstatus === 'warn' ? 'Atenção' : 'Crítico'}
            </div>
          </div>

          <div class="latency-grid">
            {#each [
              { label: 'P50', val: stats.latency.p50 },
              { label: 'P95', val: stats.latency.p95 },
              { label: 'P99', val: stats.latency.p99 },
              { label: 'Avg', val: stats.latency.avg },
            ] as { label, val }}
              <div class="lat-cell">
                <span class="lat-cell__label">{label}</span>
                <span class="lat-cell__value"
                  class:lat-cell__value--warn={label === 'P95' && lstatus === 'warn'}
                  class:lat-cell__value--error={label === 'P95' && lstatus === 'error'}>
                  {fmtMs(val)}
                </span>
              </div>
            {/each}
          </div>

          <div class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill progress-fill--{lstatus}"
                style="width: {Math.min(100, Math.round((stats.latency.p95 / 2_000) * 100))}%">
              </div>
            </div>
            <span class="progress-label">P95 / SLO 2s</span>
          </div>
        </div>

        <!-- ── TRÁFEGO ──────────────────────────────────── -->
        <div class="signal-card">
          <div class="signal-card__header">
            <div class="signal-card__title-wrap">
              <div class="signal-card__icon signal-card__icon--traffic"><TrendingUp size={15} /></div>
              <span class="signal-card__label">Tráfego</span>
            </div>
            <div class="rpm-badge">
              <span class="rpm-badge__num">{stats.traffic.rpm}</span>
              <span class="rpm-badge__unit">req/min</span>
            </div>
          </div>

          <div class="traffic-hero">
            <span class="traffic-hero__num">{stats.traffic.total.toLocaleString('pt-BR')}</span>
            <span class="traffic-hero__desc">requisições na última hora</span>
          </div>

          {#if stats.traffic.topPaths.length > 0}
            <div class="path-list">
              {#each stats.traffic.topPaths as { path, count }}
                <div class="path-row">
                  <span class="path-row__name" title={path}>{path}</span>
                  <div class="path-row__bar-track">
                    <div class="path-row__bar-fill"
                      style="width: {Math.round((count / maxPath) * 100)}%">
                    </div>
                  </div>
                  <span class="path-row__count">{count}</span>
                </div>
              {/each}
            </div>
          {/if}

          <div class="method-chips">
            {#each Object.entries(stats.traffic.byMethod).sort(([, a], [, b]) => b - a) as [method, count]}
              <span class="method-chip"
                style="color: {methodColor(method)}; border-color: {methodColor(method)}33">
                {method} {count}
              </span>
            {/each}
          </div>
        </div>

        <!-- ── ERROS ────────────────────────────────────── -->
        <div class="signal-card">
          <div class="signal-card__header">
            <div class="signal-card__title-wrap">
              <div class="signal-card__icon signal-card__icon--errors"><AlertTriangle size={15} /></div>
              <span class="signal-card__label">Erros</span>
            </div>
            <div class="status-badge status-badge--{estatus}">
              <span class="status-dot"></span>
              {estatus === 'ok' ? 'Saudável' : estatus === 'warn' ? 'Atenção' : 'Crítico'}
            </div>
          </div>

          <div class="error-hero">
            <span class="error-hero__rate error-hero__rate--{estatus}">{stats.errors.rate.toFixed(2)}%</span>
            <span class="error-hero__desc">taxa de erro</span>
          </div>

          <div class="error-counts">
            <div class="error-count">
              <span class="error-count__label">4xx</span>
              <span class="error-count__val error-count__val--warn">{stats.errors.total4xx}</span>
            </div>
            <span class="error-sep">·</span>
            <div class="error-count">
              <span class="error-count__label">5xx</span>
              <span class="error-count__val error-count__val--error">{stats.errors.total5xx}</span>
            </div>
          </div>

          {#if stats.errors.recentErrors.length > 0}
            <div class="recent-list">
              <span class="recent-list__header">Recentes</span>
              {#each stats.errors.recentErrors as { path, status, ts }}
                <div class="recent-row">
                  <span class="recent-row__code"
                    class:recent-row__code--4xx={status >= 400 && status < 500}
                    class:recent-row__code--5xx={status >= 500}>
                    {status}
                  </span>
                  <span class="recent-row__path" title={path}>{path}</span>
                  <span class="recent-row__time">{timeAgo(ts)}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-errors">Nenhum erro na janela.</p>
          {/if}
        </div>

        <!-- ── SATURAÇÃO ─────────────────────────────────── -->
        <div class="signal-card">
          <div class="signal-card__header">
            <div class="signal-card__title-wrap">
              <div class="signal-card__icon signal-card__icon--saturation"><Server size={15} /></div>
              <span class="signal-card__label">Saturação</span>
            </div>
            <div class="status-badge status-badge--{sstatus}">
              <span class="status-dot"></span>
              {sstatus === 'ok' ? 'Saudável' : sstatus === 'warn' ? 'Atenção' : 'Crítico'}
            </div>
          </div>

          <div class="heap-section">
            <div class="heap-row">
              <span class="heap-row__label">Heap</span>
              <span class="heap-row__values">
                {stats.saturation.heapUsedMB}MB / {stats.saturation.heapTotalMB}MB
              </span>
              <span class="heap-row__pct heap-row__pct--{sstatus}">{hpct}%</span>
            </div>
            <div class="heap-track">
              <div class="heap-fill heap-fill--{sstatus}" style="width: {hpct}%"></div>
            </div>
          </div>

          <div class="sat-grid">
            <div class="sat-item">
              <span class="sat-item__label">RSS</span>
              <span class="sat-item__val">{stats.saturation.rssMB} MB</span>
            </div>
            <div class="sat-item">
              <span class="sat-item__label">PID</span>
              <span class="sat-item__val">{stats.saturation.pid}</span>
            </div>
            <div class="sat-item sat-item--wide">
              <span class="sat-item__label">Uptime</span>
              <span class="sat-item__val">{formatUptime(stats.saturation.uptimeSeconds)}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="page__footer">
        <Clock size={11} />
        Janela: última {stats.meta.windowMinutes} min ·
        {stats.meta.samples.toLocaleString('pt-BR')} amostras ·
        Auto-refresh a cada 30s
      </div>
    {/if}

  </main>
{/if}

<style>
  /* ── Gate ─────────────────────────────────────────── */
  .gate {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100dvh - 56px);
    padding: var(--space-xl);
  }

  .gate__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: var(--space-3xl) var(--space-2xl);
    width: 100%;
    max-width: 360px;
    box-shadow: var(--shadow-card);
  }

  .gate__icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(167, 155, 255, 0.08);
    border: 1px solid rgba(167, 155, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-lilac);
    margin-bottom: var(--space-xs);
  }

  .gate__title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .gate__subtitle {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 0;
    text-align: center;
  }

  .gate__form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
    margin-top: var(--space-sm);
  }

  .gate__input-wrap { position: relative; width: 100%; }

  .gate__input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-md) 40px var(--space-md) var(--space-lg);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-technical);
    font-size: 16px;
    outline: none;
    transition: border-color var(--dur-fast) var(--ease-standard);
  }

  .gate__input:focus {
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.15);
  }

  .gate__input--error { border-color: var(--status-error); }

  .gate__eye {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
  }
  .gate__eye:hover { color: var(--text-primary); }

  .gate__error {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--status-error);
    margin: 0;
    text-align: center;
  }

  .gate__btn {
    padding: var(--space-md) var(--space-xl);
    background: var(--glass-lilac);
    border: 1px solid var(--border-interactive);
    border-radius: var(--radius-md);
    color: var(--accent-lilac);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard);
  }
  .gate__btn:hover:not(:disabled) { background: rgba(167, 155, 255, 0.18); color: var(--text-primary); }
  .gate__btn:disabled { opacity: 0.5; cursor: default; }

  .gate__back {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
    text-decoration: none;
    margin-top: var(--space-xs);
    transition: color var(--dur-fast) var(--ease-standard);
  }
  .gate__back:hover { color: var(--text-primary); }

  /* ── Page shell ───────────────────────────────────── */
  .page {
    padding: var(--space-3xl) var(--space-xl);
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  /* ── Header ───────────────────────────────────────── */
  .page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .page__header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .back-btn:hover { background: var(--glass-white); color: var(--text-primary); }

  .page__icon {
    color: var(--accent-lilac);
    display: flex;
    align-items: center;
  }

  .page__title {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
    line-height: 1;
  }

  .page__subtitle {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
    margin: 3px 0 0;
  }

  .page__header-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .update-time {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-technical);
    font-size: 11px;
    color: var(--text-muted);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: transparent;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .icon-btn:hover { background: var(--glass-white); color: var(--text-primary); }
  .icon-btn:disabled { opacity: 0.4; cursor: default; }

  .lock-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: var(--text-micro);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .lock-btn:hover { background: var(--glass-white); color: var(--text-primary); border-color: var(--border-strong); }

  /* ── Error banner ─────────────────────────────────── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    background: rgba(240, 124, 124, 0.08);
    border: 1px solid rgba(240, 124, 124, 0.3);
    border-radius: var(--radius-md);
    color: var(--status-error);
    font-family: var(--font-body);
    font-size: var(--text-caption);
  }

  /* ── Signals grid ─────────────────────────────────── */
  .signals-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-lg);
  }

  @media (max-width: 640px) {
    .signals-grid { grid-template-columns: 1fr; }
  }

  /* ── Signal card ──────────────────────────────────── */
  .signal-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    box-shadow: var(--shadow-card);
  }

  .signal-card--skeleton {
    min-height: 220px;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 0.6; }
  }

  .signal-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .signal-card__title-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .signal-card__icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .signal-card__icon--latency   { background: rgba(167, 155, 255, 0.1); color: var(--accent-lilac); }
  .signal-card__icon--traffic   { background: rgba(96, 165, 250, 0.1);  color: #60a5fa; }
  .signal-card__icon--errors    { background: rgba(240, 124, 124, 0.1); color: var(--status-error); }
  .signal-card__icon--saturation{ background: rgba(249, 115, 22, 0.1);  color: #f97316; }

  .signal-card__label {
    font-family: var(--font-technical);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  /* ── Status badge ─────────────────────────────────── */
  .status-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 20px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
  }

  .status-badge--ok {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }

  .status-badge--warn {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    color: #fbbf24;
  }

  .status-badge--error {
    background: rgba(240, 124, 124, 0.1);
    border: 1px solid rgba(240, 124, 124, 0.3);
    color: var(--status-error);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* ── RPM badge ────────────────────────────────────── */
  .rpm-badge {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .rpm-badge__num {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .rpm-badge__unit {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Latency grid ─────────────────────────────────── */
  .latency-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-sm);
  }

  .lat-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: var(--space-sm);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    align-items: center;
  }

  .lat-cell__label {
    font-family: var(--font-technical);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .lat-cell__value {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .lat-cell__value--warn  { color: #fbbf24; }
  .lat-cell__value--error { color: var(--status-error); }

  /* ── Progress bar ─────────────────────────────────── */
  .progress-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .progress-track {
    flex: 1;
    height: 4px;
    background: var(--bg-primary);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s var(--ease-standard);
  }

  .progress-fill--ok    { background: #4ade80; }
  .progress-fill--warn  { background: #fbbf24; }
  .progress-fill--error { background: var(--status-error); }

  .progress-label {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* ── Traffic ──────────────────────────────────────── */
  .traffic-hero {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .traffic-hero__num {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .traffic-hero__desc {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
  }

  .path-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .path-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .path-row__name {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    width: 120px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path-row__bar-track {
    flex: 1;
    height: 4px;
    background: var(--bg-primary);
    border-radius: 2px;
    overflow: hidden;
  }

  .path-row__bar-fill {
    height: 100%;
    background: rgba(96, 165, 250, 0.5);
    border-radius: 2px;
    transition: width 0.4s var(--ease-standard);
  }

  .path-row__count {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    width: 30px;
    text-align: right;
  }

  .method-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .method-chip {
    font-family: var(--font-technical);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 20px;
    border: 1px solid;
    letter-spacing: 0.04em;
  }

  /* ── Errors ───────────────────────────────────────── */
  .error-hero {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .error-hero__rate {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .error-hero__rate--ok    { color: #4ade80; }
  .error-hero__rate--warn  { color: #fbbf24; }
  .error-hero__rate--error { color: var(--status-error); }

  .error-hero__desc {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
  }

  .error-counts {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
  }

  .error-count {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .error-count__label {
    font-family: var(--font-technical);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .error-count__val {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
  }

  .error-count__val--warn  { color: #fbbf24; }
  .error-count__val--error { color: var(--status-error); }

  .error-sep {
    color: var(--border-soft);
    font-size: 20px;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .recent-list__header {
    font-family: var(--font-technical);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  .recent-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 4px 0;
    border-bottom: 1px solid var(--border-soft);
  }

  .recent-row:last-child { border-bottom: none; }

  .recent-row__code {
    font-family: var(--font-technical);
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    width: 32px;
  }

  .recent-row__code--4xx { color: #fbbf24; }
  .recent-row__code--5xx { color: var(--status-error); }

  .recent-row__path {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .recent-row__time {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .no-errors {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
    margin: 0;
    font-style: italic;
  }

  /* ── Saturation ───────────────────────────────────── */
  .heap-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
  }

  .heap-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .heap-row__label {
    font-family: var(--font-technical);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    width: 36px;
    flex-shrink: 0;
  }

  .heap-row__values {
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--text-secondary);
    flex: 1;
  }

  .heap-row__pct {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .heap-row__pct--ok    { color: #4ade80; }
  .heap-row__pct--warn  { color: #fbbf24; }
  .heap-row__pct--error { color: var(--status-error); }

  .heap-track {
    height: 5px;
    background: var(--bg-surface);
    border-radius: 3px;
    overflow: hidden;
  }

  .heap-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s var(--ease-standard);
  }

  .heap-fill--ok    { background: linear-gradient(90deg, #4ade80, #22d3ee); }
  .heap-fill--warn  { background: linear-gradient(90deg, #fbbf24, #f97316); }
  .heap-fill--error { background: var(--status-error); }

  .sat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-sm);
  }

  .sat-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
  }

  .sat-item--wide { grid-column: span 2; }

  .sat-item__label {
    font-family: var(--font-technical);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .sat-item__val {
    font-family: var(--font-technical);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ── Footer ───────────────────────────────────────── */
  .page__footer {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  /* ── Spin ─────────────────────────────────────────── */
  :global(.spin) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

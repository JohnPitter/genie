<script lang="ts">
  import { onMount } from 'svelte';
  import { ShieldCheck, Lock, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Database, Cpu, Clock, Key, Newspaper, Activity } from 'lucide-svelte';
  import { apiClient } from '$lib/api/client';

  const SESSION_TOKEN_KEY = 'genie_admin_token';

  // ── Auth ─────────────────────────────────────────────
  let unlocked = false;
  let pin = '';
  let pinError = '';
  let showPin = false;
  let pinInput: HTMLInputElement;
  let submitting = false;
  /** The validated admin token (= PIN) kept in memory for this session. */
  let adminToken = '';

  // ── System status ─────────────────────────────────────
  interface SystemInfo {
    version: string;
    db: string;
    model: string;
    status: string;
  }
  let systemInfo: SystemInfo | null = null;
  let systemLoading = false;
  let systemError = '';

  // ── Job triggers ───────────────────────────────────────
  let jobStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  let jobMsg = '';

  let predJobStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  let predJobMsg = '';

  let editorialJobStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  let editorialJobMsg = '';
  let editorialSlot: '08' | '12' | '16' | '20' = '12';

  onMount(async () => {
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored && (await apiClient.verifyAdminToken(stored))) {
      adminToken = stored;
      unlocked = true;
      loadSystem();
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setTimeout(() => pinInput?.focus(), 50);
    }
  });

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
        loadSystem();
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
    systemInfo = null;
  }

  async function loadSystem() {
    systemLoading = true;
    systemError = '';
    try {
      const [health, config] = await Promise.all([
        apiClient.health(),
        apiClient.config(),
      ]);
      systemInfo = {
        version: health.version ?? config.version,
        db: health.db ?? 'unknown',
        model: config.model,
        status: health.status,
      };
    } catch (err) {
      systemError = err instanceof Error ? err.message : 'Erro ao carregar status';
    } finally {
      systemLoading = false;
    }
  }

  async function triggerJob() {
    jobStatus = 'running';
    jobMsg = '';
    try {
      await apiClient.triggerDailyRefresh(adminToken);
      jobStatus = 'done';
      jobMsg = 'Job iniciado em background.';
    } catch (err) {
      jobStatus = 'error';
      jobMsg = err instanceof Error ? err.message : 'Erro ao iniciar job';
    }
    setTimeout(() => { jobStatus = 'idle'; jobMsg = ''; }, 4000);
  }

  async function triggerPredictionsJob() {
    predJobStatus = 'running';
    predJobMsg = '';
    try {
      const res = await apiClient.triggerPredictionsRefresh(adminToken);
      predJobStatus = 'done';
      predJobMsg = `Screening iniciado em ${res.tickers} ativos (leva ~5-10 min).`;
    } catch (err) {
      predJobStatus = 'error';
      predJobMsg = err instanceof Error ? err.message : 'Erro ao iniciar screener';
    }
    setTimeout(() => { predJobStatus = 'idle'; predJobMsg = ''; }, 8000);
  }

  async function triggerEditorialJob() {
    editorialJobStatus = 'running';
    editorialJobMsg = '';
    try {
      await apiClient.triggerEditorialRefresh(adminToken, editorialSlot);
      editorialJobStatus = 'done';
      editorialJobMsg = `Edição das ${editorialSlot}h iniciada em background.`;
    } catch (err) {
      editorialJobStatus = 'error';
      editorialJobMsg = err instanceof Error ? err.message : 'Erro ao iniciar editorial';
    }
    setTimeout(() => { editorialJobStatus = 'idle'; editorialJobMsg = ''; }, 6000);
  }
</script>

<svelte:head>
  <title>Admin — Genie</title>
</svelte:head>

{#if !unlocked}
  <!-- ── PIN gate ─────────────────────────────────────── -->
  <div class="gate">
    <div class="gate__card">
      <div class="gate__icon" aria-hidden="true">
        <Lock size={28} />
      </div>
      <h1 class="gate__title">Área restrita</h1>
      <p class="gate__subtitle">Insira o PIN de administrador para continuar.</p>

      <form class="gate__form" on:submit|preventDefault={submitPin}>
        <div class="gate__input-wrap">
          {#if showPin}
            <input
              bind:this={pinInput}
              bind:value={pin}
              type="text"
              placeholder="ADMIN_TOKEN"
              class="gate__input"
              class:gate__input--error={!!pinError}
              aria-label="PIN de administrador"
              autocomplete="off"
            />
          {:else}
            <input
              bind:this={pinInput}
              bind:value={pin}
              type="password"
              placeholder="ADMIN_TOKEN"
              class="gate__input"
              class:gate__input--error={!!pinError}
              aria-label="PIN de administrador"
              autocomplete="off"
            />
          {/if}
          <button
            type="button"
            class="gate__eye"
            aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
            on:click={() => (showPin = !showPin)}
          >
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
    </div>
  </div>

{:else}
  <!-- ── Admin panel ──────────────────────────────────── -->
  <main class="admin">
    <div class="admin__header">
      <div class="admin__header-left">
        <ShieldCheck size={22} />
        <h1 class="admin__title">Painel Admin</h1>
      </div>
      <button class="admin__lock-btn" on:click={lock} aria-label="Bloquear painel">
        <Lock size={15} />
        Bloquear
      </button>
    </div>

    <!-- ── Status do sistema ──────────────────────────── -->
    <section class="card">
      <div class="card__header">
        <h2 class="card__title">Status do sistema</h2>
        <button class="icon-btn" on:click={loadSystem} aria-label="Atualizar status" disabled={systemLoading}>
          <RefreshCw size={15} class={systemLoading ? 'spin' : ''} />
        </button>
      </div>

      {#if systemLoading}
        <div class="status-grid">
          {#each [0,1,2,3] as _}
            <div class="stat-item stat-item--skeleton"></div>
          {/each}
        </div>
      {:else if systemError}
        <p class="error-msg">{systemError}</p>
      {:else if systemInfo}
        <div class="status-grid">
          <div class="stat-item">
            <div class="stat-item__icon"><CheckCircle size={16} /></div>
            <div class="stat-item__body">
              <span class="stat-item__label">API</span>
              <span class="stat-item__value stat-item__value--ok">{systemInfo.status}</span>
            </div>
          </div>

          <div class="stat-item">
            <div class="stat-item__icon"><Database size={16} /></div>
            <div class="stat-item__body">
              <span class="stat-item__label">Banco de dados</span>
              <span class="stat-item__value" class:stat-item__value--ok={systemInfo.db === 'ok'} class:stat-item__value--error={systemInfo.db !== 'ok'}>
                {systemInfo.db}
              </span>
            </div>
          </div>

          <div class="stat-item">
            <div class="stat-item__icon"><Cpu size={16} /></div>
            <div class="stat-item__body">
              <span class="stat-item__label">Modelo LLM</span>
              <span class="stat-item__value stat-item__value--mono">{systemInfo.model}</span>
            </div>
          </div>

          <div class="stat-item">
            <div class="stat-item__icon"><Key size={16} /></div>
            <div class="stat-item__body">
              <span class="stat-item__label">Versão</span>
              <span class="stat-item__value stat-item__value--mono">v{systemInfo.version}</span>
            </div>
          </div>
        </div>
      {/if}
    </section>

    <!-- ── Observabilidade ──────────────────────────────── -->
    <section class="card">
      <div class="obs-row">
        <div class="obs-row__info">
          <div class="obs-row__icon"><Activity size={18} /></div>
          <div>
            <h2 class="card__title">Observabilidade</h2>
            <p class="card__desc">Golden Signals em tempo real: latência, tráfego, erros e saturação.</p>
          </div>
        </div>
        <a href="/stats" class="obs-btn">
          Ver métricas →
        </a>
      </div>
    </section>

    <!-- ── Configuração atual ─────────────────────────── -->
    <section class="card">
      <h2 class="card__title">Configuração via .env</h2>
      <p class="card__desc">Variáveis de ambiente lidas na inicialização do servidor. Para alterar, edite o arquivo <code>.env</code> e reinicie.</p>

      <div class="env-table">
        <div class="env-row">
          <span class="env-key">OPENROUTER_API_KEY</span>
          <span class="env-val env-val--masked">sk-or-v1-••••••••••••••••</span>
        </div>
        <div class="env-row">
          <span class="env-key">OPENROUTER_MODEL</span>
          <span class="env-val">{systemInfo?.model ?? '—'}</span>
        </div>
        <div class="env-row">
          <span class="env-key">PORT</span>
          <span class="env-val">5858</span>
        </div>
        <div class="env-row">
          <span class="env-key">DB_PATH</span>
          <span class="env-val">./genie.db</span>
        </div>
        <div class="env-row">
          <span class="env-key">LOG_LEVEL</span>
          <span class="env-val">info</span>
        </div>
        <div class="env-row">
          <span class="env-key">NEWS_CACHE_TTL_MINUTES</span>
          <span class="env-val">30</span>
        </div>
        <div class="env-row">
          <span class="env-key">QUOTE_CACHE_TTL_SECONDS</span>
          <span class="env-val">60</span>
        </div>
      </div>
    </section>

    <!-- ── Jobs manuais ───────────────────────────────── -->
    <section class="card">
      <h2 class="card__title">Jobs manuais</h2>
      <p class="card__desc">Dispare tarefas de manutenção sem esperar o agendamento automático.</p>

      <div class="job-row">
        <div class="job-row__info">
          <div class="job-row__icon"><Clock size={18} /></div>
          <div>
            <span class="job-row__name">Atualizar favoritos</span>
            <span class="job-row__desc">Busca cotações e notícias recentes para todos os ativos favoritados.</span>
          </div>
        </div>

        <button
          class="job-btn"
          class:job-btn--running={jobStatus === 'running'}
          class:job-btn--done={jobStatus === 'done'}
          class:job-btn--error={jobStatus === 'error'}
          on:click={triggerJob}
          disabled={jobStatus === 'running'}
        >
          {#if jobStatus === 'running'}
            <RefreshCw size={14} class="spin" /> Executando…
          {:else if jobStatus === 'done'}
            <CheckCircle size={14} /> Iniciado
          {:else if jobStatus === 'error'}
            <AlertCircle size={14} /> Erro
          {:else}
            Executar agora
          {/if}
        </button>
      </div>

      {#if jobMsg}
        <p class="job-msg" class:job-msg--error={jobStatus === 'error'}>{jobMsg}</p>
      {/if}

      <!-- Predições IA screener -->
      <div class="job-row">
        <div class="job-row__info">
          <div class="job-row__icon"><Cpu size={18} /></div>
          <div>
            <span class="job-row__name">Gerar predições IA</span>
            <span class="job-row__desc">Roda o screener em ~60 tickers e popula a página /predicoes. Leva 5-10 min.</span>
          </div>
        </div>

        <button
          class="job-btn"
          class:job-btn--running={predJobStatus === 'running'}
          class:job-btn--done={predJobStatus === 'done'}
          class:job-btn--error={predJobStatus === 'error'}
          on:click={triggerPredictionsJob}
          disabled={predJobStatus === 'running'}
        >
          {#if predJobStatus === 'running'}
            <RefreshCw size={14} class="spin" /> Executando…
          {:else if predJobStatus === 'done'}
            <CheckCircle size={14} /> Iniciado
          {:else if predJobStatus === 'error'}
            <AlertCircle size={14} /> Erro
          {:else}
            Executar agora
          {/if}
        </button>
      </div>

      {#if predJobMsg}
        <p class="job-msg" class:job-msg--error={predJobStatus === 'error'}>{predJobMsg}</p>
      {/if}

      <!-- Editorial -->
      <div class="job-row">
        <div class="job-row__info">
          <div class="job-row__icon"><Newspaper size={18} /></div>
          <div>
            <span class="job-row__name">Gerar editorial</span>
            <span class="job-row__desc">Produz uma edição do boletim "Por dentro das notícias" para o slot escolhido.</span>
          </div>
        </div>

        <div class="job-row__actions">
          <select
            class="slot-select"
            bind:value={editorialSlot}
            disabled={editorialJobStatus === 'running'}
            aria-label="Slot do editorial"
          >
            <option value="08">08h — Manhã</option>
            <option value="12">12h — Meio-dia</option>
            <option value="16">16h — Tarde</option>
            <option value="20">20h — Fechamento</option>
          </select>

          <button
            class="job-btn"
            class:job-btn--running={editorialJobStatus === 'running'}
            class:job-btn--done={editorialJobStatus === 'done'}
            class:job-btn--error={editorialJobStatus === 'error'}
            on:click={triggerEditorialJob}
            disabled={editorialJobStatus === 'running'}
          >
            {#if editorialJobStatus === 'running'}
              <RefreshCw size={14} class="spin" /> Gerando…
            {:else if editorialJobStatus === 'done'}
              <CheckCircle size={14} /> Iniciado
            {:else if editorialJobStatus === 'error'}
              <AlertCircle size={14} /> Erro
            {:else}
              Executar agora
            {/if}
          </button>
        </div>
      </div>

      {#if editorialJobMsg}
        <p class="job-msg" class:job-msg--error={editorialJobStatus === 'error'}>{editorialJobMsg}</p>
      {/if}
    </section>

    <!-- ── PIN de acesso ──────────────────────────────── -->
    <section class="card">
      <h2 class="card__title">PIN de administrador</h2>
      <p class="card__desc">
        O PIN é o valor de <code>ADMIN_TOKEN</code> no arquivo <code>.env</code> do backend.
        Sessão expira ao fechar a aba. Para trocar, edite <code>.env</code> e reinicie o servidor.
      </p>
      <div class="pin-hint">
        <Key size={14} />
        Variável de ambiente: <code>ADMIN_TOKEN</code>
      </div>
    </section>
  </main>
{/if}

<style>
  /* ── Gate ──────────────────────────────────────────── */
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
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .gate__btn:hover { background: rgba(167, 155, 255, 0.18); color: var(--text-primary); }

  /* ── Admin shell ───────────────────────────────────── */
  .admin {
    padding: var(--space-3xl) var(--space-xl);
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .admin__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .admin__header-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--accent-lilac);
  }

  .admin__title {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
  }

  .admin__lock-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: var(--text-micro);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
  }
  .admin__lock-btn:hover { background: var(--glass-white); color: var(--text-primary); border-color: var(--border-strong); }

  /* ── Card ──────────────────────────────────────────── */
  .card {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card__title {
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 11px;
    color: var(--text-muted);
  }

  .card__desc {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .card__desc code {
    font-family: var(--font-technical);
    font-size: 12px;
    background: var(--bg-surface-2);
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--accent-gold);
  }

  /* ── Icon button ───────────────────────────────────── */
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .icon-btn:hover { background: var(--glass-white); color: var(--text-primary); }
  .icon-btn:disabled { opacity: 0.5; cursor: default; }

  /* ── Status grid ───────────────────────────────────── */
  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-sm);
  }

  @media (max-width: 520px) {
    .status-grid { grid-template-columns: 1fr; }
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
  }

  .stat-item--skeleton {
    height: 56px;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.8; }
  }

  .stat-item__icon {
    color: var(--accent-lilac);
    flex-shrink: 0;
  }

  .stat-item__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .stat-item__label {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .stat-item__value {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat-item__value--ok    { color: var(--status-ok, #4ade80); }
  .stat-item__value--error { color: var(--status-error); }
  .stat-item__value--mono  { font-family: var(--font-technical); font-size: 11px; }

  /* ── Env table ─────────────────────────────────────── */
  .env-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .env-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 10px var(--space-md);
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-soft);
  }

  .env-row:last-child { border-bottom: none; }

  .env-key {
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--accent-gold);
    flex-shrink: 0;
    width: 220px;
    min-width: 0;
  }

  .env-val {
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  /* Mobile: empilhar key/val para evitar horizontal scroll */
  @media (max-width: 520px) {
    .env-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .env-key {
      width: auto;
    }
    .env-val {
      white-space: normal;
      word-break: break-all;
    }
  }

  .env-val--masked { color: var(--text-muted); letter-spacing: 0.05em; }

  /* ── Job row ───────────────────────────────────────── */
  .job-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
  }

  .job-row__info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .job-row__actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .slot-select {
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: var(--font-technical);
    font-size: 11px;
    cursor: pointer;
    outline: none;
    transition: border-color var(--dur-fast) var(--ease-standard);
  }

  .slot-select:focus {
    border-color: var(--border-interactive);
  }

  .slot-select:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .job-row__icon {
    color: var(--accent-lilac);
    flex-shrink: 0;
  }

  .job-row__name {
    display: block;
    font-family: var(--font-body);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-primary);
  }

  .job-row__desc {
    display: block;
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
    margin-top: 2px;
  }

  .job-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: var(--glass-lilac);
    border: 1px solid var(--border-interactive);
    border-radius: var(--radius-sm);
    color: var(--accent-lilac);
    font-family: var(--font-body);
    font-size: var(--text-micro);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }

  .job-btn:hover:not(:disabled) { background: rgba(167, 155, 255, 0.18); color: var(--text-primary); }
  .job-btn:disabled              { opacity: 0.6; cursor: default; }
  .job-btn--done                 { background: rgba(74, 222, 128, 0.1); border-color: rgba(74, 222, 128, 0.4); color: #4ade80; }
  .job-btn--error                { background: rgba(240, 124, 124, 0.1); border-color: rgba(240, 124, 124, 0.4); color: var(--status-error); }

  .job-msg {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
    margin: 0;
  }
  .job-msg--error { color: var(--status-error); }

  /* ── PIN hint ──────────────────────────────────────── */
  .pin-hint {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
  }

  .pin-hint code {
    font-family: var(--font-technical);
    font-size: 13px;
    letter-spacing: 0.2em;
    color: var(--accent-lilac);
  }

  /* ── Observabilidade ───────────────────────────────── */
  .obs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .obs-row__info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .obs-row__icon {
    color: var(--accent-lilac);
    flex-shrink: 0;
  }

  .obs-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--glass-lilac);
    border: 1px solid var(--border-interactive);
    border-radius: var(--radius-sm);
    color: var(--accent-lilac);
    font-family: var(--font-body);
    font-size: var(--text-micro);
    font-weight: 600;
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  }
  .obs-btn:hover { background: rgba(167, 155, 255, 0.18); color: var(--text-primary); }

  /* ── Spin animation ────────────────────────────────── */
  :global(.spin) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-msg {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--status-error);
    margin: 0;
  }
</style>

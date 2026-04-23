<script lang="ts">
  import { Info } from 'lucide-svelte';
  import type { Fundamentals } from '@genie/shared';

  export let fundamentals: Fundamentals | null = null;
  export let loading = false;

  interface Indicator {
    key: keyof Omit<Fundamentals, 'ticker' | 'source' | 'updatedAt'>;
    label: string;
    description: string;
    format: (v: number) => string;
  }

  const indicators: Indicator[] = [
    {
      key: 'pe',
      label: 'P/L',
      description: 'Preço dividido pelo Lucro por Ação. Indica quantos anos de lucro você paga.',
      format: (v) => v.toFixed(2),
    },
    {
      key: 'pb',
      label: 'P/VP',
      description: 'Preço sobre Valor Patrimonial. Mede o desconto ou prêmio sobre o patrimônio.',
      format: (v) => v.toFixed(2),
    },
    {
      key: 'dividendYield',
      label: 'DY',
      description: 'Dividend Yield: percentual de dividendos pagos em relação ao preço atual.',
      format: (v) => `${v.toFixed(2)}%`,
    },
    {
      key: 'roe',
      label: 'ROE',
      description: 'Retorno sobre Patrimônio. Mede a eficiência da empresa em gerar lucro.',
      format: (v) => `${v.toFixed(2)}%`,
    },
    {
      key: 'debtToEquity',
      label: 'Dív/Patrim.',
      description: 'Dívida sobre Patrimônio. Indica o nível de alavancagem da empresa.',
      format: (v) => v.toFixed(2),
    },
    {
      key: 'netMargin',
      label: 'Margem Líq.',
      description: 'Margem Líquida: percentual de lucro líquido sobre a receita total.',
      format: (v) => `${v.toFixed(2)}%`,
    },
  ];

  function formatValue(ind: Indicator): string {
    if (!fundamentals) return '—';
    const val = fundamentals[ind.key] as number | undefined;
    if (val == null) return '—';
    return ind.format(val);
  }
</script>

<div class="fundamentals">
  {#if loading}
    <!-- Skeleton rows -->
    {#each Array(6) as _}
      <div class="fundamentals__row fundamentals__row--skeleton" aria-hidden="true">
        <div class="skeleton skeleton--label"></div>
        <div class="skeleton skeleton--value"></div>
      </div>
    {/each}
  {:else}
    <table class="fundamentals__table" aria-label="Indicadores fundamentalistas">
      <thead>
        <tr>
          <th scope="col">Indicador</th>
          <th scope="col">Valor</th>
          <th scope="col" class="fundamentals__th-info">Info</th>
        </tr>
      </thead>
      <tbody>
        {#each indicators as ind}
          <tr class="fundamentals__row">
            <td class="fundamentals__label">{ind.label}</td>
            <td class="fundamentals__value">
              {formatValue(ind)}
            </td>
            <td class="fundamentals__info-cell">
              <span title={ind.description} aria-label={ind.description}>
                <Info size={14} aria-hidden="true" />
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if fundamentals}
      <p class="fundamentals__source">
        Fonte: {fundamentals.source} ·
        Atualizado: {new Date(fundamentals.updatedAt).toLocaleDateString('pt-BR')}
      </p>
    {:else}
      <p class="fundamentals__empty">
        Dados fundamentalistas não disponíveis para este ativo.
      </p>
    {/if}
  {/if}
</div>

<style>
  .fundamentals {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .fundamentals__table {
    width: 100%;
    border-collapse: collapse;
  }

  .fundamentals__table thead th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--border-soft);
  }

  .fundamentals__th-info {
    width: 40px;
    text-align: center;
  }

  .fundamentals__row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background var(--dur-fast) var(--ease-standard);
  }

  .fundamentals__row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .fundamentals__label {
    padding: var(--space-md) var(--space-lg);
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .fundamentals__value {
    padding: var(--space-md) var(--space-lg);
    font-family: var(--font-technical, monospace);
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 600;
  }

  .fundamentals__info-cell {
    padding: var(--space-md) var(--space-lg);
    text-align: center;
    color: var(--text-muted);
    cursor: help;
  }

  .fundamentals__info-cell:hover {
    color: var(--accent-lilac);
  }

  .fundamentals__source {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
  }

  .fundamentals__empty {
    font-size: 14px;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }

  /* Skeleton loader */
  .fundamentals__row--skeleton {
    display: flex;
    justify-content: space-between;
    padding: var(--space-md) 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .skeleton {
    background: var(--bg-surface-2, #23242b);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton--label {
    width: 80px;
    height: 16px;
  }

  .skeleton--value {
    width: 60px;
    height: 16px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1;   }
  }
</style>

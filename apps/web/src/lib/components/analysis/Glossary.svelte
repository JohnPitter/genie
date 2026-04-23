<script lang="ts">
  import { ChevronDown, BookOpen } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let defaultOpen = false;

  let open = defaultOpen;

  interface Term {
    name: string;
    short: string;
    full: string;
    example?: string;
  }

  const TERMS: Term[] = [
    {
      name: 'RSI (14)',
      short: 'Índice de Força Relativa',
      full: 'Mede quão forte está o movimento recente do preço, numa escala de 0 a 100. Acima de 70 indica que o ativo pode estar "caro" demais (sobrecomprado) e uma correção é provável. Abaixo de 30 sugere que está "barato" demais (sobrevendido) e pode haver reversão para cima.',
      example: 'RSI 75 = alerta de queda iminente. RSI 25 = oportunidade de compra.',
    },
    {
      name: 'MACD (12, 26, 9)',
      short: 'Convergência e Divergência de Médias',
      full: 'Indicador de momentum que compara duas médias exponenciais (de 12 e 26 períodos). Quando a linha MACD cruza acima da linha de sinal (9 períodos), é um sinal de alta. Quando cruza abaixo, é um sinal de baixa. O histograma (diferença entre as linhas) mostra a força do movimento.',
      example: 'Histograma positivo crescendo = tendência de alta ganhando força.',
    },
    {
      name: 'SMA 20 / SMA 50',
      short: 'Médias Móveis Simples',
      full: 'Média dos preços de fechamento dos últimos N dias. A SMA 20 captura a tendência de curto prazo; a SMA 50 mostra a tendência de médio prazo. Quando o preço está acima das duas e a de 20 está acima da de 50, temos o "golden configuration" (tendência de alta confirmada).',
      example: 'Preço R$ 30 > SMA20 R$ 28 > SMA50 R$ 26 → tendência bullish.',
    },
    {
      name: 'Bollinger Bands',
      short: 'Bandas de Bollinger (20, 2)',
      full: 'Três linhas: a média móvel de 20 períodos (centro) e duas bandas a 2 desvios-padrão acima e abaixo. Mostram a volatilidade: bandas apertadas = baixa volatilidade, bandas largas = alta. Preço tocando a banda superior sugere sobrecompra; tocando a inferior, sobrevenda.',
      example: '%B = 95% significa preço próximo da banda superior (alerta de correção).',
    },
    {
      name: 'Volume relativo',
      short: 'Comparação de volume atual vs média',
      full: 'Compara o volume dos últimos 5 dias com a média dos últimos 20. Volume 30%+ acima da média junto com preço subindo indica interesse forte dos compradores (sinal válido de alta). Com preço caindo, sugere pressão vendedora.',
      example: 'Volume 1.5x a média + preço subindo → interesse real dos investidores.',
    },
    {
      name: 'Contexto IBOV',
      short: 'Tendência do índice Bovespa',
      full: 'O IBOV é o principal índice da bolsa brasileira. Usamos sua tendência como filtro macro: em tendência de alta, reforçamos sinais de compra; em baixa, penalizamos compras (mercado adverso aumenta risco sistêmico).',
      example: 'IBOV caindo 5% no mês = cautela mesmo em ativos com fundamentos fortes.',
    },
    {
      name: 'Score quantitativo',
      short: 'Nota de -6 a +6',
      full: 'Soma dos votos de 6 indicadores técnicos. Cada um vota +1 (bullish), -1 (bearish) ou 0 (neutro). Score ≥ +4 significa que pelo menos 4 indicadores concordam que é momento de compra — alta confluência, sinal mais confiável.',
      example: 'Score +5 é mais confiável que +2, mesmo que ambos sejam "compra".',
    },
    {
      name: 'Backtest walk-forward',
      short: 'Teste histórico da estratégia',
      full: 'Simulamos o mesmo score em cada um dos últimos 60 dias e verificamos se a direção prevista estava correta 5 dias depois. A acertividade reportada é a taxa de acertos observada no histórico — não é garantia futura, mas dá uma ideia realista da qualidade do sinal.',
      example: 'Acurácia 65% significa que 65% dos sinais fortes do passado acertaram D+5.',
    },
    {
      name: 'Confluência',
      short: 'Múltiplos indicadores concordando',
      full: 'Quando vários indicadores (RSI, MACD, volume…) apontam para a mesma direção ao mesmo tempo. Um único indicador pode dar falso sinal; a chance de acerto aumenta quando há 4+ concordando (por isso o filtro ≥ 4 no score).',
      example: 'RSI baixo + MACD positivo + volume alto + IBOV em alta = confluência forte.',
    },
    {
      name: 'Suporte e resistência',
      short: 'Níveis de preço importantes',
      full: 'Suporte é um preço onde o ativo tende a parar de cair (compradores entram). Resistência é onde tende a parar de subir (vendedores aparecem). Ao romper resistência, tende a continuar subindo; ao romper suporte, a cair.',
      example: 'PETR4 fica entre R$ 35 (suporte) e R$ 40 (resistência) há semanas.',
    },
  ];
</script>

<section class="glossary" class:open>
  <button
    class="glossary__toggle"
    on:click={() => (open = !open)}
    aria-expanded={open}
    aria-controls="glossary-content"
  >
    <span class="glossary__toggle-left">
      <BookOpen size={16} />
      Glossário — entenda os termos
    </span>
    <ChevronDown size={16} class="glossary__chevron" />
  </button>

  {#if open}
    <div
      id="glossary-content"
      class="glossary__content"
      transition:slide={{ duration: 220, easing: cubicOut }}
    >
      {#each TERMS as term, i}
        <article
          class="term"
          style="animation-delay: {i * 30}ms"
        >
          <header class="term__header">
            <h3 class="term__name">{term.name}</h3>
            <span class="term__short">{term.short}</span>
          </header>
          <p class="term__full">{term.full}</p>
          {#if term.example}
            <p class="term__example">
              <strong>Exemplo:</strong> {term.example}
            </p>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .glossary {
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    background: var(--bg-surface);
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .glossary.open { border-color: rgba(167, 155, 255, 0.3); }

  .glossary__toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-lg);
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .glossary__toggle:hover {
    background: rgba(167, 155, 255, 0.04);
  }

  .glossary__toggle-left {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .glossary__toggle-left :global(svg) { color: var(--accent-lilac); }

  :global(.glossary__chevron) {
    transition: transform 0.22s ease;
    color: var(--text-muted);
  }

  .open :global(.glossary__chevron) { transform: rotate(180deg); }

  .glossary__content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
    padding: 0 var(--space-lg) var(--space-lg);
    border-top: 1px solid var(--border-soft);
    padding-top: var(--space-lg);
  }

  @media (max-width: 720px) {
    .glossary__content {
      grid-template-columns: 1fr;
    }
  }

  .term {
    padding: var(--space-md);
    background: rgba(167, 155, 255, 0.04);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    animation: term-in 360ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
  }

  @keyframes term-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .term__header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--space-sm);
  }

  .term__name {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--accent-lilac);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .term__short {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .term__full {
    font-family: var(--font-body);
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.55;
    margin: 0 0 var(--space-xs);
  }

  .term__example {
    font-family: var(--font-body);
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.45;
    margin: 0;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 2px solid var(--accent-gold);
    border-radius: 3px;
  }

  .term__example strong { color: var(--accent-gold); }

  @media (prefers-reduced-motion: reduce) {
    .term,
    :global(.glossary__chevron) {
      animation: none;
      transition: none;
    }
  }
</style>

export type Category =
  | 'financeiro'
  | 'commodities'
  | 'varejo'
  | 'energia'
  | 'saneamento'
  | 'tecnologia'
  | 'saude';

// Primary search name for each ticker, used to build richer news queries.
// Prefer the most commonly used name in financial news headlines.
const TICKER_PRIMARY_NAME: Record<string, string> = {
  // Financeiro
  ITUB4: 'Itaú', ITUB3: 'Itaú', BBDC4: 'Bradesco', BBDC3: 'Bradesco',
  BBAS3: 'Banco do Brasil', SANB11: 'Santander', BPAC11: 'BTG Pactual',
  BPAC3: 'BTG Pactual', IRBR3: 'IRB Brasil', B3SA3: 'B3', CIEL3: 'Cielo',
  SULA11: 'SulAmérica', WIZC3: 'Wiz Soluções', BBSE3: 'BB Seguridade', PSSA3: 'Porto Seguro',
  // Commodities
  VALE3: 'Vale', PETR4: 'Petrobras', PETR3: 'Petrobras',
  SUZB3: 'Suzano', CSNA3: 'CSN', GGBR4: 'Gerdau', GGBR3: 'Gerdau',
  USIM5: 'Usiminas', USIM3: 'Usiminas', GOAU4: 'Metalúrgica Gerdau',
  BRAP4: 'Bradespar', CBAV3: 'CBA', CMIN3: 'CSN Mineração',
  PRIO3: 'PetroRio', RECV3: 'Recôncavo', RRRP3: '3R Petroleum',
  UGPA3: 'Ultrapar', VBBR3: 'Vibra Energia',
  AGRO3: 'BrasilAgro', SLCE3: 'SLC Agrícola', SMTO3: 'São Martinho',
  CAML3: 'Camil', JALL3: 'Jalles Machado', TTEN3: '3tentos',
  // Varejo
  MGLU3: 'Magazine Luiza', LREN3: 'Lojas Renner', AMER3: 'Americanas',
  VIIA3: 'Via Varejo', ASAI3: 'Assaí', PCAR3: 'Grupo Pão de Açúcar',
  CRFB3: 'Carrefour', SOMA3: 'Grupo Soma', ARZZ3: 'Arezzo',
  VIVA3: 'Vivara', CEAB3: 'C&A', AMAR3: 'Marisa',
  ALPA4: 'Alpargatas', GRND3: 'Grendene', NTCO3: 'Natura',
  SMFT3: 'SmartFit', ESPA3: 'Espaçolaser', LWSA3: 'Locaweb',
  // Energia
  ELET3: 'Eletrobras', ELET6: 'Eletrobras', ENGI11: 'Energisa',
  EGIE3: 'Engie Brasil', CPFE3: 'CPFL Energia', TAEE11: 'Taesa',
  TAEE4: 'Taesa', CMIG4: 'Cemig', CMIG3: 'Cemig',
  CPLE6: 'Copel', CPLE3: 'Copel', AURE3: 'Auren Energia',
  ENEV3: 'Eneva', CESP3: 'Cesp', ENBR3: 'EDP Brasil',
  EQTL3: 'Equatorial', NEOE3: 'Neoenergia', AESB3: 'AES Brasil',
  TRPL4: 'ISA CTEEP', TRPL3: 'ISA CTEEP',
  // Saneamento
  SBSP3: 'Sabesp', CSMG3: 'Copasa', SAPR11: 'Sanepar',
  SAPR4: 'Sanepar', SAPR3: 'Sanepar', IGUA3: 'Iguá Saneamento', AEGP3: 'AES Eletropaulo',
  // Tecnologia
  TOTS3: 'Totvs', POSI3: 'Positivo', INTB3: 'Intelbras',
  CASH3: 'Méliuz', IFCM3: 'Infracommerce', TIMS3: 'TIM',
  VIVT3: 'Vivo Telefônica', OIBR3: 'Oi', OIBR4: 'Oi',
  DESK3: 'Desk Manager', BRIT3: 'Brisanet', ENJU3: 'Enjoei',
  AAPL34: 'Apple', MSFT34: 'Microsoft', GOGL34: 'Google Alphabet',
  AMZO34: 'Amazon', META34: 'Meta', NVDC34: 'Nvidia',
  TSLA34: 'Tesla', NFLX34: 'Netflix', GOOGL34: 'Alphabet',
  UBER34: 'Uber',
  // Saúde
  RDOR3: 'Rede Dor', HAPV3: 'Hapvida', FLRY3: 'Fleury',
  DASA3: 'Dasa', GNDI3: 'Gndi', QUAL3: 'Qualicorp',
  PARD3: 'Pardini', BLAU3: 'Blau Farmacêutica', ODPV3: 'Odontoprev',
  ONCO3: 'Oncoclínicas', MATD3: 'Mater Dei', AALR3: 'Alliar', CRVS3: 'Corcovado',
};

/**
 * FIIs (fundos imobiliários) na B3 têm tickers terminados em '11' e seguem
 * código de 4 letras + '11' (ex: HGLG11, XPML11, MXRF11). Diferente de units
 * (ex: SANB11, BPAC11) que são empresas com ações + ações preferenciais
 * agrupadas — essas estão no catálogo de TICKER_PRIMARY_NAME.
 *
 * Heurística: termina em '11' E não está mapeado como ação no catálogo.
 * Para FIIs, métricas fundamentais tradicionais (P/L, ROE, margem líquida)
 * não fazem sentido — usar isFII() para pular fontes de fundamentals.
 */
export function isFII(ticker: string): boolean {
  const t = ticker.toUpperCase();
  if (!/^[A-Z]{4}11$/.test(t)) return false;
  // Units conhecidas (empresas que terminam em 11 mas são ações, não FIIs)
  return !(t in TICKER_PRIMARY_NAME);
}

export function primaryNameFor(ticker: string): string | undefined {
  return TICKER_PRIMARY_NAME[ticker.toUpperCase()];
}

export const ALL_CATEGORIES: Category[] = [
  'financeiro', 'commodities', 'varejo', 'energia', 'saneamento', 'tecnologia', 'saude',
];

const TICKERS_BY_CATEGORY: Record<Category, string[]> = {
  financeiro: [
    'ITUB4', 'ITUB3', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'BPAC11', 'BPAC3',
    'IRBR3', 'B3SA3', 'CIEL3', 'SULA11', 'WIZC3', 'BBSE3', 'PSSA3',
    'MXRF11', 'KNCR11', 'KNRI11', 'HGLG11', 'XPML11', 'BCFF11', 'BCIA11',
    'RBRF11', 'VGIR11', 'CPTS11', 'PLCR11', 'KDIF11', 'RBRR11', 'DEVA11',
    'IMAB11', 'FIXA11', 'IRFM11',
  ],
  commodities: [
    'VALE3', 'PETR4', 'PETR3', 'SUZB3', 'CSNA3', 'GGBR4', 'GGBR3',
    'USIM5', 'USIM3', 'GOAU4', 'BRAP4', 'CBAV3', 'CMIN3',
    'PRIO3', 'RECV3', 'RRRP3', 'UGPA3', 'VBBR3',
    'AGRO3', 'SLCE3', 'SMTO3', 'CAML3', 'JALL3', 'TTEN3',
    'GOLD11', 'HASH11',
  ],
  varejo: [
    'MGLU3', 'LREN3', 'AMER3', 'VIIA3', 'ASAI3', 'PCAR3', 'CRFB3',
    'SOMA3', 'ARZZ3', 'VIVA3', 'CEAB3', 'AMAR3', 'ALPA4', 'GRND3',
    'NTCO3', 'SMFT3', 'ESPA3', 'LWSA3',
    'ARCO34', 'MEAL3', 'FHER3',
  ],
  energia: [
    'ELET3', 'ELET6', 'ENGI11', 'EGIE3', 'CPFE3', 'TAEE11', 'TAEE4',
    'CMIG4', 'CMIG3', 'CPLE6', 'CPLE3', 'AURE3', 'ENEV3', 'CESP3',
    'ENBR3', 'EQTL3', 'NEOE3', 'AESB3', 'TRPL4', 'TRPL3',
    'INFR11', 'BTLG11',
    'ECOO11',
  ],
  saneamento: [
    'SBSP3', 'CSMG3', 'SAPR11', 'SAPR4', 'SAPR3',
    'IGUA3', 'AEGP3',
  ],
  tecnologia: [
    'TOTS3', 'POSI3', 'INTB3', 'CASH3', 'IFCM3', 'TIMS3', 'VIVT3',
    'OIBR3', 'OIBR4', 'DESK3', 'BRIT3', 'ENJU3', 'LINX3',
    'AAPL34', 'MSFT34', 'GOGL34', 'AMZO34', 'META34', 'NVDC34',
    'TSLA34', 'NFLX34', 'GOOGL34', 'UBER34',
    'NASD11', 'SPXI11', 'IVVB11',
  ],
  saude: [
    'RDOR3', 'HAPV3', 'FLRY3', 'DASA3', 'GNDI3', 'QUAL3', 'PARD3',
    'BLAU3', 'ODPV3', 'ONCO3', 'MATD3', 'AALR3', 'CRVS3',
    'HCTR11', 'NSLU11', 'HGRU11',
  ],
};

// O(1) reverse index: ticker → category
const REVERSE_INDEX = new Map<string, Category>();
for (const [cat, tickers] of Object.entries(TICKERS_BY_CATEGORY) as [Category, string[]][]) {
  for (const t of tickers) REVERSE_INDEX.set(t, cat);
}

export function tickersFor(cat: Category): string[] {
  return TICKERS_BY_CATEGORY[cat] ?? [];
}

/**
 * Retorna uma lista intercalada com até `perCategory` tickers de cada categoria,
 * garantindo cobertura balanceada (vs. allTickers() que agrupa por categoria
 * e, ao usar `slice(N)`, deixa categorias inteiras de fora).
 *
 * Usado no news_refresh para que o editorial tenha manchetes de TODAS as
 * categorias e o LLM possa gerar seções diversas.
 */
export function balancedTickers(perCategory: number): string[] {
  const out: string[] = [];
  for (const cat of ALL_CATEGORIES) {
    const tickers = TICKERS_BY_CATEGORY[cat];
    if (tickers) out.push(...tickers.slice(0, perCategory));
  }
  return out;
}

export function categoryOf(ticker: string): Category | undefined {
  return REVERSE_INDEX.get(ticker.toUpperCase());
}

export function allTickers(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cat of ALL_CATEGORIES) {
    for (const t of TICKERS_BY_CATEGORY[cat]) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

export function searchTickers(query: string): string[] {
  const q = query.toUpperCase();
  if (!q) return allTickers();
  return allTickers().filter(t => t.startsWith(q));
}

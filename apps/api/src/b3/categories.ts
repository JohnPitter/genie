export type Category =
  | 'financeiro'
  | 'commodities'
  | 'varejo'
  | 'energia'
  | 'saneamento'
  | 'tecnologia'
  | 'saude';

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
    'SBSP3', 'CSMG3', 'SAPR11', 'SAPR4', 'SAPR3', 'SANB3',
    'IGUASANEAMENTO', 'CSUD3',
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

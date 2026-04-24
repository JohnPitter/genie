// Types locais do módulo editorial. Mantidos em sync com packages/shared/src/types.ts
// (mesmo padrão dos outros módulos do api: types compartilhados são re-declarados
// localmente para evitar quebrar `rootDir` do tsc).

export type EditorialSlot = '08' | '12' | '16' | '20';

export type EditorialCategory =
  | 'financeiro'
  | 'commodities'
  | 'varejo'
  | 'energia'
  | 'saneamento'
  | 'tecnologia'
  | 'saude';

export const EDITORIAL_CATEGORIES: EditorialCategory[] = [
  'financeiro',
  'commodities',
  'varejo',
  'energia',
  'saneamento',
  'tecnologia',
  'saude',
];

export interface EditorialSection {
  category: EditorialCategory;
  title: string;
  body: string;
  highlightTickers: string[];
  sourceArticleIds: number[];
}

export interface EditorialArticleRef {
  id: number;
  url: string;
  title: string;
  source: string;
  summary?: string;
  tickers: string[];
  category?: string;
  publishedAt?: string;
  fetchedAt: string;
}

export interface Editorial {
  id: number;
  slot: EditorialSlot;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  leadTitle: string;
  leadBody: string;
  sections: EditorialSection[];
  modelUsed: string | null;
  generatedAt: string;
  sourceArticles?: EditorialArticleRef[];
}

export interface EditorialSummary {
  id: number;
  slot: EditorialSlot;
  editionDate: string;
  leadTitle: string;
  generatedAt: string;
}

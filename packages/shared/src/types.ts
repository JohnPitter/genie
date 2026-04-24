// Shared types between frontend and backend.
// Keep in sync with Go structs in apps/api/internal/.

// ── Roles & Messages ────────────────────────────────────────────────────────

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: Role;
  content?: string;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

// ── Market data ──────────────────────────────────────────────────────────────

/** Real-time quote for a B3 asset. */
export interface Quote {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap?: number;
  currency: string;
  updatedAt: string; // ISO 8601
  source: string;
}

/** Fundamental indicators for an asset. */
export interface Fundamentals {
  ticker: string;
  pe?: number;
  pb?: number;
  dividendYield?: number;
  roe?: number;
  debtToEquity?: number;
  netMargin?: number;
  source: string;
  updatedAt: string; // ISO 8601
}

/** Published article fetched or scraped for a ticker/category. */
export interface Article {
  id?: number;
  title: string;
  url: string;
  source: string;
  summary?: string;
  publishedAt?: string; // ISO 8601
  tickers: string[];
  category?: string;
  fetchedAt: string; // ISO 8601
}

/** A watched ticker in user's favorites list. */
export interface Favorite {
  ticker: string;
  addedAt: string;   // ISO 8601
  lastNewsAt?: string; // ISO 8601
}

/** Favorite enriched with live quote and latest news — returned by GET /api/favorites?enrich=true. */
export interface FavoriteEnriched extends Favorite {
  quote?: Quote;
  newsCount: number;
  latestNews?: Article;
}

// ── Categories ───────────────────────────────────────────────────────────────

export type Category =
  | 'financeiro'
  | 'commodities'
  | 'varejo'
  | 'energia'
  | 'saneamento'
  | 'tecnologia'
  | 'saude';

export const ALL_CATEGORIES: Category[] = [
  'financeiro',
  'commodities',
  'varejo',
  'energia',
  'saneamento',
  'tecnologia',
  'saude',
];

// ── Technical Analysis ───────────────────────────────────────────────────────

export interface MACD {
  line: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  /** Percentage of price position within the bands (0=lower, 100=upper) */
  percentB: number;
}

export interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  macd: MACD | null;
  bollinger: BollingerBands | null;
  /** Price return over last 30 trading days (%) */
  return30d: number | null;
  /** Annualised volatility over last 30 trading days (%) */
  volatility30d: number | null;
  /** 52-week high */
  high52w: number | null;
  /** 52-week low */
  low52w: number | null;
}

export interface AIAnalysis {
  sinal: 'compra' | 'venda' | 'neutro';
  confianca: 'baixa' | 'media' | 'alta';
  tendencia_curto: 'alta' | 'lateral' | 'baixa';
  tendencia_medio: 'alta' | 'lateral' | 'baixa';
  suporte: number;
  resistencia: number;
  positivos: string[];
  negativos: string[];
  racional: string;
  horizonte: '1 semana' | '1 mês' | '3 meses';
}

export interface HistoryPoint {
  date: string;  // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockAnalysis {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  indicators: TechnicalIndicators;
  analysis: AIAnalysis;
  /** Last 60 trading days for sparkline / mini chart */
  history: HistoryPoint[];
  generatedAt: string;  // ISO 8601
}

// ── Prediction / Screener ────────────────────────────────────────────────────

export type Signal = 'compra_forte' | 'compra' | 'neutro' | 'venda' | 'venda_forte';

export interface IndicatorVote {
  name: string;
  vote: -1 | 0 | 1;
  rationale: string;
}

export interface PredictionItem {
  id: number;
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  signal: Signal;
  score: number;              // -6 a +6
  confidence: 'baixa' | 'media' | 'alta';
  votes: IndicatorVote[];
  backtestAccuracy: number | null;
  backtestTotal: number | null;
  rationale: string | null;
  computedAt: string;
}

export interface PredictionsResponse {
  topBuy: PredictionItem[];
  topSell: PredictionItem[];
  all: PredictionItem[];
  lastRunAt: string | null;
  totalAnalysed: number;
  message?: string;
}

// ── Editorial (Por Dentro das Notícias) ──────────────────────────────────────

export type EditorialSlot = '08' | '12' | '16' | '20';

export interface EditorialSection {
  category: Category;
  title: string;
  body: string;
  highlightTickers: string[];
  sourceArticleIds: number[];
}

export interface Editorial {
  id: number;
  slot: EditorialSlot;
  editionDate: string;     // YYYY-MM-DD (BRT)
  periodStart: string;     // ISO 8601 UTC
  periodEnd: string;       // ISO 8601 UTC
  leadTitle: string;
  leadBody: string;
  sections: EditorialSection[];
  modelUsed: string | null;
  generatedAt: string;     // ISO 8601 UTC
  /** Articles referenced across all sections — joined by service for UI convenience. */
  sourceArticles?: Article[];
}

export interface EditorialSummary {
  id: number;
  slot: EditorialSlot;
  editionDate: string;
  leadTitle: string;
  generatedAt: string;
}

// ── SSE streaming events ─────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD?: number;
}

export type StreamEvent =
  | { type: 'conversation_start'; conversationId: string }
  | { type: 'token'; delta: string }
  | { type: 'tool_call_start'; toolCallId: string; toolName: string; toolArgs?: unknown }
  | { type: 'tool_call_end'; toolCallId: string; toolResult?: unknown; durationMs?: number }
  | { type: 'message_end'; usage?: TokenUsage }
  | { type: 'error'; error: string };

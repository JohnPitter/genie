export class B3Error extends Error {
  constructor(
    public readonly code: 'TICKER_NOT_FOUND' | 'SOURCE_UNAVAILABLE' | 'ALL_SOURCES_FAILED' | 'INVALID_TICKER',
    message: string,
  ) {
    super(message);
    this.name = 'B3Error';
  }
}

export function isTickerNotFound(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'TICKER_NOT_FOUND';
}

export function isSourceUnavailable(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE';
}

export function isAllSourcesFailed(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'ALL_SOURCES_FAILED';
}

export function isInvalidTicker(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'INVALID_TICKER';
}

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

// ── Technical Analysis types ────────────────────────────────────────────────

export interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MACD {
  line: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  percentB: number;
}

export interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  macd: MACD | null;
  bollinger: BollingerBands | null;
  return30d: number | null;
  volatility30d: number | null;
  high52w: number | null;
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

export interface StockAnalysis {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  indicators: TechnicalIndicators;
  analysis: AIAnalysis;
  history: HistoryPoint[];
  generatedAt: string;
}

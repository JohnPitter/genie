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

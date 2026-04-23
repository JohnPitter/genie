// ── Asset utilities ───────────────────────────────────────────────────────────

/**
 * Generates the Status Invest URL for a given B3 ticker.
 * Tickers are lowercased per Status Invest URL convention.
 */
export function statusInvestURL(ticker: string): string {
  return `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`;
}

/**
 * Returns a CSS class string for a price change percentage.
 *
 * - Positive change → `'text-success'`
 * - Negative change → `'text-error'`
 * - Zero / unavailable → `'text-muted'`
 */
export function changeColor(changePct: number | undefined | null): string {
  if (changePct == null || changePct === 0) return 'text-muted';
  return changePct > 0 ? 'text-success' : 'text-error';
}

/**
 * Returns a sign-prefixed string for a change percentage.
 * e.g.  1.23  → "+1.23%"
 *       -0.45 → "-0.45%"
 *       0     → "0.00%"
 */
export function formatChangePct(changePct: number | undefined | null): string {
  if (changePct == null) return '—';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

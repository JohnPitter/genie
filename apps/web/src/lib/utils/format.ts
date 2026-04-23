/**
 * Formats a number as Brazilian Real currency: "R$ 38,12".
 */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Formats a percentage with explicit sign: "+1.23%" or "-0.80%".
 * The sign prefix (+/-) is always included.
 */
export function formatPct(n: number, decimals = 2): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

/**
 * Formats a number using pt-BR locale: 1.234,56
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

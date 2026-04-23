/**
 * Relative time formatter for Portuguese Brazilian.
 * Returns strings like "agora mesmo", "há 3min", "há 2h", "há 5d", "12 abr".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return 'agora mesmo';
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `há ${diffMin}min`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `há ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `há ${diffDays}d`;
  }

  // More than 7 days: show date "12 abr"
  const MONTHS_PT: Record<number, string> = {
    0: 'jan',
    1: 'fev',
    2: 'mar',
    3: 'abr',
    4: 'mai',
    5: 'jun',
    6: 'jul',
    7: 'ago',
    8: 'set',
    9: 'out',
    10: 'nov',
    11: 'dez',
  };

  // Use UTC date parts to avoid timezone-related day-off-by-one
  return `${date.getUTCDate()} ${MONTHS_PT[date.getUTCMonth()]}`;
}

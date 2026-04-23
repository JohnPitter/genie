import { B3Error } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';
import { validateTicker } from './source.ts';
import type { Source } from './source.ts';
import { buildHeaders, SCRAPER_TIMEOUT_MS, fetchWithTimeout } from './http.ts';
import type { Logger } from 'pino';

const BASE_URL = 'https://www.google.com/finance/quote';

function extractAttrFloat(body: string, attr: string): number {
  const idx = body.indexOf(attr);
  if (idx === -1) return 0;
  const start = idx + attr.length;
  const end = body.indexOf('"', start);
  if (end === -1) return 0;
  return parseFloat(body.slice(start, end)) || 0;
}

function parseFromDataAttrs(body: string): number {
  return extractAttrFloat(body, 'data-last-price="');
}

function parseFromInlineJSON(body: string): { price: number; changePct: number; name: string } | null {
  const idx = body.indexOf('"@type":"StockDataItem"');
  if (idx === -1) return null;

  const start = body.lastIndexOf('{', idx);
  if (start === -1) return null;

  const chunk = body.slice(start);
  let end = chunk.indexOf('}</script>');
  if (end === -1) {
    end = chunk.indexOf('},');
    if (end === -1 || end > 2000) return null;
  }

  try {
    const obj = JSON.parse(chunk.slice(0, end + 1)) as Record<string, string>;
    const price = parseFloat(obj['price'] ?? '') || 0;
    if (!price) return null;

    let changePct = 0;
    const pctRaw = (obj['percentChange'] ?? '').replace('%', '').trim();
    if (pctRaw) changePct = parseFloat(pctRaw) || 0;

    return { price, changePct, name: obj['name'] ?? '' };
  } catch {
    return null;
  }
}

function parseName(body: string): string {
  const zzIdx = body.indexOf('class="zzDege"');
  if (zzIdx !== -1) {
    const rest = body.slice(zzIdx + 14);
    const open = rest.indexOf('>');
    const close = rest.indexOf('<');
    if (open !== -1 && close !== -1 && open < close) {
      const name = rest.slice(open + 1, close).trim();
      if (name) return name;
    }
  }

  const titleIdx = body.indexOf('<title>');
  if (titleIdx !== -1) {
    const s = titleIdx + 7;
    const e = body.indexOf('</title>', s);
    if (e !== -1) {
      let title = body.slice(s, e).trim();
      for (const suffix of [' Stock Price & News - Google Finance', ' - Google Finance']) {
        title = title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
      }
      const paren = title.lastIndexOf(' (');
      if (paren !== -1) title = title.slice(0, paren);
      return title.trim();
    }
  }
  return '';
}

export class GoogleFinanceSource implements Source {
  constructor(
    private readonly log: Logger,
    private readonly baseURL = BASE_URL,
  ) {}

  name(): string { return 'googlefinance'; }

  async quote(ticker: string, signal?: AbortSignal): Promise<Quote> {
    validateTicker(ticker);
    const t0 = Date.now();

    const url = `${this.baseURL}/${encodeURIComponent(ticker)}:BVMF`;
    let resp: Response;
    try {
      resp = await fetchWithTimeout(
        url,
        { ...buildHeaders('text/html,application/xhtml+xml'), 'Accept-Language': 'pt-BR,pt;q=0.9' },
        SCRAPER_TIMEOUT_MS,
        signal,
      );
    } catch (err) {
      throw new B3Error('SOURCE_UNAVAILABLE', `googlefinance: request failed: ${String(err)}`);
    }

    if (resp.status === 404) throw new B3Error('TICKER_NOT_FOUND', 'googlefinance: ticker not found');
    if (resp.status === 429) throw new B3Error('SOURCE_UNAVAILABLE', 'googlefinance: rate limited');
    if (resp.status >= 500) throw new B3Error('SOURCE_UNAVAILABLE', `googlefinance: HTTP ${resp.status}`);
    if (resp.status !== 200) throw new Error(`googlefinance: unexpected HTTP ${resp.status}`);

    const body = await resp.text();

    const fromJSON = parseFromInlineJSON(body);
    let price = fromJSON?.price ?? 0;
    let changePct = fromJSON?.changePct ?? 0;
    let name = fromJSON?.name ?? '';

    if (!price) {
      price = parseFromDataAttrs(body);
      if (!name) name = parseName(body);
    }

    if (!price) throw new B3Error('TICKER_NOT_FOUND', `googlefinance: could not extract price for ${ticker}`);

    this.log.info({ ticker, price, durationMs: Date.now() - t0 }, 'quote fetched');
    return { ticker, name, price, changePct, volume: 0, currency: 'BRL', updatedAt: new Date().toISOString(), source: this.name() };
  }

  async fundamentals(ticker: string): Promise<Fundamentals> {
    validateTicker(ticker);
    throw new B3Error('SOURCE_UNAVAILABLE', 'googlefinance does not provide fundamentals');
  }
}

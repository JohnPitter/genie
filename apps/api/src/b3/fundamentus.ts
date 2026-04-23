import { B3Error } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';
import { validateTicker } from './source.ts';
import type { Source } from './source.ts';
import { SCRAPER_TIMEOUT_MS, fetchWithTimeout, buildHeaders } from './http.ts';
import type { Logger } from 'pino';

const BASE_URL = 'https://www.fundamentus.com.br/detalhes.php';

function parseBrazilian(raw: string): number | null {
  // Handles: "10,80", "-2,09", "0,00%", "14.845.200.000"
  const cleaned = raw.replace(/[%\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function extractCells(html: string): string[] {
  // Decode latin-1 HTML entities manually for key chars
  const decoded = html
    .replace(/&#231;/g, 'ç').replace(/&#227;/g, 'ã').replace(/&#245;/g, 'õ')
    .replace(/&#233;/g, 'é').replace(/&#250;/g, 'ú').replace(/&#237;/g, 'í')
    .replace(/&#225;/g, 'á').replace(/&#244;/g, 'ô').replace(/&#226;/g, 'â');

  const cells: string[] = [];
  const rowRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(decoded)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0 && text.length < 120) {
      cells.push(text);
    }
  }
  return cells;
}

export class FundamentusSource implements Source {
  constructor(
    private readonly log: Logger,
    private readonly baseURL = BASE_URL,
  ) {}

  name(): string { return 'fundamentus'; }

  async quote(ticker: string, signal?: AbortSignal): Promise<Quote> {
    validateTicker(ticker);
    const t0 = Date.now();

    const { cells } = await this.fetchCells(ticker, signal);

    // Fixed positions (stable Fundamentus layout):
    // [1]=ticker, [3]=price, [5]=type, [9]=company name, [31]=day change
    // Use fixed indices as primary, label search as fallback
    const price = cells[3] ? parseBrazilian(cells[3]) : null;
    if (price === null || price === 0) {
      throw new B3Error('TICKER_NOT_FOUND', `fundamentus: no price found for ${ticker}`);
    }

    const name = cells[9] && !cells[9].startsWith('?') ? cells[9] : ticker;
    const changePctRaw = cells[31] ?? null;
    const changePct = changePctRaw ? parseBrazilian(changePctRaw) ?? 0 : 0;

    this.log.info({ ticker, price, durationMs: Date.now() - t0 }, 'fundamentus: quote fetched');

    return {
      ticker,
      name: name !== null ? String(name) : ticker,
      price,
      changePct,
      volume: 0,
      currency: 'BRL',
      updatedAt: new Date().toISOString(),
      source: this.name(),
    };
  }

  async fundamentals(ticker: string, signal?: AbortSignal): Promise<Fundamentals> {
    validateTicker(ticker);
    const t0 = Date.now();

    const { cells } = await this.fetchCells(ticker, signal);

    const f: Fundamentals = {
      ticker,
      source: this.name(),
      updatedAt: new Date().toISOString(),
    };

    const pe = this.findValueAfterLabel(cells, ['P/L']);
    if (pe !== null && pe > 0) f.pe = pe;

    const pb = this.findValueAfterLabel(cells, ['P/VP']);
    if (pb !== null && pb > 0) f.pb = pb;

    const dy = this.findValueAfterLabel(cells, ['Div. Yield', 'Div.Yield', 'D.Y.', 'DY']);
    if (dy !== null && dy > 0) f.dividendYield = dy;

    const roe = this.findValueAfterLabel(cells, ['ROE']);
    if (roe !== null) f.roe = roe;

    const ml = this.findValueAfterLabel(cells, ['Mrg Liq', 'Mg Liq', 'Margem L']);
    if (ml !== null) f.netMargin = ml;

    // Dívida Bruta / Patrimônio
    const de = this.findValueAfterLabel(cells, ['Dív.Brut/Pat', 'Div.Brut', 'Dív Bruta/Pat']);
    if (de !== null) f.debtToEquity = de;

    const hasData = f.pe !== undefined || f.pb !== undefined || f.dividendYield !== undefined || f.roe !== undefined;
    if (!hasData) {
      throw new B3Error('SOURCE_UNAVAILABLE', `fundamentus: no fundamental data for ${ticker}`);
    }

    this.log.info({ ticker, durationMs: Date.now() - t0 }, 'fundamentus: fundamentals fetched');
    return f;
  }

  private async fetchCells(ticker: string, signal?: AbortSignal): Promise<{ cells: string[] }> {
    const url = `${this.baseURL}?papel=${ticker.toUpperCase()}`;
    let resp: Response;
    try {
      resp = await fetchWithTimeout(
        url,
        { ...buildHeaders('text/html,application/xhtml+xml'), 'Accept-Language': 'pt-BR,pt;q=0.9' },
        SCRAPER_TIMEOUT_MS,
        signal,
      );
    } catch (err) {
      throw new B3Error('SOURCE_UNAVAILABLE', `fundamentus: request failed: ${String(err)}`);
    }

    if (resp.status === 404) throw new B3Error('TICKER_NOT_FOUND', 'fundamentus: ticker not found');
    if (resp.status >= 500) throw new B3Error('SOURCE_UNAVAILABLE', `fundamentus: HTTP ${resp.status}`);
    if (resp.status !== 200) throw new Error(`fundamentus: unexpected HTTP ${resp.status}`);

    // Fundamentus returns ISO-8859-1
    const buf = await resp.arrayBuffer();
    const html = new TextDecoder('iso-8859-1').decode(buf);

    // Check if ticker exists (page shows "Papel" in a table)
    if (!html.includes('Papel') || html.includes('Nenhum papel')) {
      throw new B3Error('TICKER_NOT_FOUND', `fundamentus: ticker ${ticker} not found`);
    }

    return { cells: extractCells(html) };
  }

  private findValueAfterLabel(cells: string[], labels: string[]): number | null {
    const raw = this.findRawAfterLabel(cells, labels);
    if (raw === null) return null;
    return parseBrazilian(raw);
  }

  private findRawAfterLabel(cells: string[], labels: string[]): string | null {
    for (let i = 0; i < cells.length - 1; i++) {
      const cell = cells[i]!;
      // Labels may start with '?' (tooltip marker) — strip it
      const stripped = cell.startsWith('?') ? cell.slice(1) : cell;
      for (const label of labels) {
        if (stripped.startsWith(label) || stripped.includes(label)) {
          const next = cells[i + 1];
          if (next && next !== '?' && !next.startsWith('?')) return next;
        }
      }
    }
    return null;
  }
}

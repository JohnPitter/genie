import * as cheerio from 'cheerio';
import { B3Error } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';
import { validateTicker } from './source.ts';
import type { Source } from './source.ts';
import { buildHeaders, SCRAPER_TIMEOUT_MS, fetchWithTimeout } from './http.ts';
import type { Logger } from 'pino';

const DEFAULT_BASE_URL = 'https://statusinvest.com.br';

export function parseBrazilianFloat(raw: string): number | null {
  // Strip percent, spaces, handle sign
  let cleaned = raw.replace(/[%\s]/g, '');
  // Brazilian format: dots = thousands separator, comma = decimal
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export class StatusInvestScraper implements Source {
  constructor(
    private readonly log: Logger,
    private readonly baseURL = DEFAULT_BASE_URL,
  ) {}

  name(): string {
    return 'statusinvest';
  }

  async quote(ticker: string, signal?: AbortSignal): Promise<Quote> {
    validateTicker(ticker);
    const t0 = Date.now();

    const html = await this.fetchHTML(ticker, signal);
    const $ = cheerio.load(html);

    const price = this.parsePrice($);
    if (price === null) {
      throw new B3Error('SOURCE_UNAVAILABLE', `statusinvest: price element not found for ${ticker}`);
    }

    const q: Quote = {
      ticker,
      name: this.parseName($),
      price,
      changePct: this.parseChangePct($),
      volume: 0,
      currency: 'BRL',
      updatedAt: new Date().toISOString(),
      source: this.name(),
    };

    this.log.info({ ticker, price: q.price, durationMs: Date.now() - t0 }, 'quote scraped');
    return q;
  }

  async fundamentals(ticker: string, signal?: AbortSignal): Promise<Fundamentals> {
    validateTicker(ticker);
    const t0 = Date.now();

    const html = await this.fetchHTML(ticker, signal);
    const $ = cheerio.load(html);

    const f: Fundamentals = {
      ticker,
      source: this.name(),
      updatedAt: new Date().toISOString(),
    };

    // Current layout: h3.title (label) + strong.value (number) inside .indicator-today-container
    $('.indicator-today-container').find('h3.title, h3.title.uppercase').each((_i, el) => {
      const title = $(el).text().trim();
      // The value is in the next strong.value sibling within the parent wrapper
      const rawVal = $(el).closest('div').find('strong.value').first().text().trim()
        || $(el).parent().next().find('strong.value').first().text().trim();
      const val = parseBrazilianFloat(rawVal);
      if (val === null) return;

      switch (title) {
        case 'P/L': f.pe = val; break;
        case 'P/VP': f.pb = val; break;
        // DY label changed to 'D.Y' in 2025 redesign; also accept old label
        case 'D.Y':
        case 'DY':
        case 'Dividend Yield': f.dividendYield = val; break;
        case 'ROE': f.roe = val; break;
        // Debt/equity label changed; also accept HTML-entity decoded variants
        case 'Dív. Bruta/Patrim.':
        case 'Dív. líquida/PL':
        case 'Dív. bruta/PL': f.debtToEquity = val; break;
        // Net margin label changed to 'M. Líquida'
        case 'Margem Líquida':
        case 'M. Líquida': f.netMargin = val; break;
      }
    });

    this.log.info({ ticker, durationMs: Date.now() - t0 }, 'fundamentals scraped');
    return f;
  }

  private async fetchHTML(ticker: string, signal?: AbortSignal): Promise<string> {
    const url = `${this.baseURL}/acoes/${ticker.toLowerCase()}`;
    let resp: Response;
    try {
      resp = await fetchWithTimeout(
        url,
        buildHeaders('text/html,application/xhtml+xml'),
        SCRAPER_TIMEOUT_MS,
        signal,
      );
    } catch (err) {
      throw new B3Error('SOURCE_UNAVAILABLE', `statusinvest: request failed: ${String(err)}`);
    }

    if (resp.status === 404) throw new B3Error('TICKER_NOT_FOUND', 'statusinvest: ticker not found');
    if (resp.status === 429) throw new B3Error('SOURCE_UNAVAILABLE', 'statusinvest: rate limited');
    if (resp.status >= 500) throw new B3Error('SOURCE_UNAVAILABLE', `statusinvest: HTTP ${resp.status}`);
    if (resp.status !== 200) throw new Error(`statusinvest: unexpected HTTP ${resp.status}`);

    return resp.text();
  }

  private parsePrice($: cheerio.CheerioAPI): number | null {
    let raw = '';

    // Layout 2025: h3.title "Valor atual" + adjacent strong.value (no data-title attr)
    $('h3.title').each((_i, el) => {
      if (raw) return;
      if ($(el).text().trim() === 'Valor atual') {
        raw = $(el).closest('div').find('strong.value').first().text().trim();
      }
    });

    // Fallback: legacy layout with data-title attribute
    if (!raw) {
      $('[data-title="Valor atual"] strong.value, [data-title="Valor atual"] .value-top strong.value').each(
        (_i, el) => { if (!raw) raw = $(el).text().trim(); },
      );
    }

    // Last resort: first strong.value on the page
    if (!raw) {
      $('strong.value').each((_i, el) => { if (!raw) raw = $(el).text().trim(); });
    }

    return raw ? parseBrazilianFloat(raw) : null;
  }

  private parseChangePct($: cheerio.CheerioAPI): number {
    let raw = '';

    // Layout 2025: look for span.sub-value near "Valor atual" section
    // The change % is in a span with class containing "sub-value" right after strong.value
    $('h3.title').each((_i, el) => {
      if (raw) return;
      if ($(el).text().trim() === 'Valor atual') {
        const wrapper = $(el).closest('div').parent();
        const subVal = wrapper.find('.sub-value').first().text().trim();
        if (subVal) raw = subVal;
      }
    });

    // Fallback: legacy data-title attribute
    if (!raw) {
      $('[data-title="Variação"] strong.value, [data-title="Variação"] .value-top strong.value').each(
        (_i, el) => { if (!raw) raw = $(el).text().trim(); },
      );
    }

    return parseBrazilianFloat(raw) ?? 0;
  }

  private parseName($: cheerio.CheerioAPI): string {
    // Try various selectors — page layout changes across versions
    return (
      $('h1.lp-title').first().text().trim() ||
      $('.company-description h1').first().text().trim() ||
      $('h1').first().text().trim() ||
      ''
    );
  }
}

/**
 * Seeds the news DB with real articles from Google News RSS.
 * Run once: pnpm --filter @genie/api tsx src/scripts/seed-news.ts
 */
import 'dotenv/config';
import { openAndMigrate } from '../store/db.ts';
import { upsertArticles } from '../store/news.ts';
import type { Article } from '../store/news.ts';
import { getConfig } from '../lib/config.ts';

const CATEGORY_TICKERS: Record<string, string[]> = {
  financeiro:  ['ITUB4', 'BBDC4', 'BBAS3', 'BPAC11', 'SANB11'],
  commodities: ['VALE3', 'PETR4', 'SUZB3', 'PRIO3', 'GGBR4'],
  varejo:      ['MGLU3', 'LREN3', 'ASAI3', 'SOMA3', 'NTCO3'],
  energia:     ['ELET3', 'ENGI11', 'EGIE3', 'CPFE3', 'CMIG4'],
  saneamento:  ['SBSP3', 'CSMG3', 'SAPR11'],
  tecnologia:  ['TOTS3', 'TIMS3', 'VIVT3', 'POSI3'],
  saude:       ['RDOR3', 'HAPV3', 'FLRY3', 'DASA3'],
};

function extractItems(xml: string): Array<{ title: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; pubDate: string }> = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const body = m[1] ?? '';
    const title = (body.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/) ?? [])[1]?.trim() ?? '';
    const link = (body.match(/<link>([^<\s]+)/) ?? [])[1]?.trim() ?? '';
    const pubDate = (body.match(/<pubDate>([^<]+)/) ?? [])[1]?.trim() ?? '';
    if (title && link) items.push({ title, link, pubDate });
  }
  return items;
}

function normalizeURL(u: string): string {
  return u.toLowerCase().trim().replace(/\/$/, '');
}

function extractDomain(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function fetchNewsForTicker(ticker: string, category: string): Promise<Article[]> {
  const query = encodeURIComponent(`${ticker} B3`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Genie/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) return [];
  const xml = await resp.text();
  const items = extractItems(xml).slice(0, 5);

  return items.map(item => ({
    url: normalizeURL(item.link),
    title: item.title,
    source: extractDomain(item.link),
    tickers: [ticker],
    category,
    fetchedAt: new Date().toISOString(),
    ...(item.pubDate ? { publishedAt: new Date(item.pubDate).toISOString() } : {}),
  }));
}

async function main() {
  const config = getConfig();
  const db = openAndMigrate(config.DB_PATH);
  console.log(`Seeding news into ${config.DB_PATH}...`);

  let total = 0;
  for (const [category, tickers] of Object.entries(CATEGORY_TICKERS)) {
    for (const ticker of tickers) {
      process.stdout.write(`  ${ticker} (${category})... `);
      try {
        const articles = await fetchNewsForTicker(ticker, category);
        if (articles.length > 0) {
          upsertArticles(db, articles);
          total += articles.length;
        }
        console.log(`${articles.length} articles`);
      } catch (err) {
        console.log(`ERROR: ${String(err)}`);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\nDone! Inserted ${total} articles total.`);
  db.close();
}

main().catch(console.error);

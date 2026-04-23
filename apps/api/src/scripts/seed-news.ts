/**
 * Seeds the news DB with real articles from Google News RSS.
 * Run once: cd apps/api && node_modules/.bin/tsx src/scripts/seed-news.ts
 *
 * Filters out static pages (cotação, gráficos, dados da empresa) and YouTube
 * videos — keeps only real news articles that mention the ticker or company.
 */
import 'dotenv/config';
import { openAndMigrate } from '../store/db.ts';
import { upsertArticles } from '../store/news.ts';
import type { Article } from '../store/news.ts';
import { getConfig } from '../lib/config.ts';

// Ticker → company name(s) used to validate that the article is relevant.
// An article is only kept if its title mentions the ticker OR any of the names.
const TICKER_NAMES: Record<string, string[]> = {
  // Financeiro
  ITUB4:  ['Itaú', 'Itau Unibanco', 'ITUB4'],
  BBDC4:  ['Bradesco', 'BBDC4'],
  BBAS3:  ['Banco do Brasil', 'BBAS3', 'BB '],
  BPAC11: ['BTG Pactual', 'BTG', 'BPAC11'],
  SANB11: ['Santander', 'SANB11'],
  // Commodities
  VALE3:  ['Vale', 'VALE3'],
  PETR4:  ['Petrobras', 'PETR4'],
  SUZB3:  ['Suzano', 'SUZB3'],
  PRIO3:  ['PetroRio', 'PRIO', 'PRIO3'],
  GGBR4:  ['Gerdau', 'GGBR4'],
  // Varejo
  MGLU3:  ['Magazine Luiza', 'Magalu', 'MGLU3'],
  LREN3:  ['Lojas Renner', 'Renner', 'LREN3'],
  ASAI3:  ['Assaí', 'Assai', 'ASAI3'],
  SOMA3:  ['Grupo Soma', 'Soma', 'SOMA3'],
  NTCO3:  ['Natura', 'NTCO3'],
  // Energia
  ELET3:  ['Eletrobras', 'ELET3'],
  ENGI11: ['Energisa', 'ENGI11'],
  EGIE3:  ['Engie', 'EGIE3'],
  CPFE3:  ['CPFL', 'CPFE3'],
  CMIG4:  ['Cemig', 'CMIG4'],
  // Saneamento
  SBSP3:  ['Sabesp', 'SBSP3'],
  CSMG3:  ['Copasa', 'CSMG3'],
  SAPR11: ['Sanepar', 'SAPR11'],
  // Tecnologia
  TOTS3:  ['Totvs', 'TOTS3'],
  TIMS3:  ['TIM ', 'TIMS3'],
  VIVT3:  ['Vivo', 'Telefônica', 'VIVT3'],
  POSI3:  ['Positivo', 'POSI3'],
  // Saúde
  RDOR3:  ['Rede D\'Or', 'Rede Dor', 'RDOR3'],
  HAPV3:  ['Hapvida', 'HAPV3'],
  FLRY3:  ['Fleury', 'FLRY3'],
  DASA3:  ['Dasa', 'DASA3'],
};

const CATEGORY_TICKERS: Record<string, string[]> = {
  financeiro:  ['ITUB4', 'BBDC4', 'BBAS3', 'BPAC11', 'SANB11'],
  commodities: ['VALE3', 'PETR4', 'SUZB3', 'PRIO3', 'GGBR4'],
  varejo:      ['MGLU3', 'LREN3', 'ASAI3', 'SOMA3', 'NTCO3'],
  energia:     ['ELET3', 'ENGI11', 'EGIE3', 'CPFE3', 'CMIG4'],
  saneamento:  ['SBSP3', 'CSMG3', 'SAPR11'],
  tecnologia:  ['TOTS3', 'TIMS3', 'VIVT3', 'POSI3'],
  saude:       ['RDOR3', 'HAPV3', 'FLRY3', 'DASA3'],
};

// URLs/domínios que são páginas estáticas (não notícias)
const URL_BLACKLIST_PATTERNS = [
  /\/cotacoes?\//i,
  /\/acoes?\//i,
  /statusinvest\.com\.br\/acoes/i,
  /advfn\.com\/.*cotacao/i,
  /money[\-]?times\.com\.br\/cotacao/i,
  /fundamentus\.com\.br\/detalhes/i,
  /investidor10\.com\.br\/acoes/i,
  /suno\.com\.br\/acoes/i,
  /youtube\.com\//i,
  /youtu\.be\//i,
  /instagram\.com\//i,
  /facebook\.com\//i,
  /twitter\.com\//i,
  /x\.com\//i,
];

// Títulos genéricos que indicam página estática, não notícia
const TITLE_BLACKLIST_PATTERNS = [
  /^cotação/i,
  /^cotacao/i,
  /^(dados|informaç|informac)/i,
  /análise completa/i,
  /analise completa/i,
  /indicadores (e|completos|fundamentais)/i,
  /gráficos? histórico/i,
  /^notícias (de |sobre |banco )/i,
  /^ações (de |do |da )/i,
  /tudo sobre/i,
  /veja a cotação/i,
  /^[A-Z]{4}[0-9]{1,2}:/i,  // Starts with "TICKER: ..."
  /^[A-Z]{4}[0-9]{1,2}\s*-\s*[A-Z]/i,  // "TICKER - TITULO" (página de ativo)
  /a bolsa do brasil/i,     // Institutional B3 content
  /conheça a b3/i,
];

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

function isBlacklistedURL(url: string): boolean {
  return URL_BLACKLIST_PATTERNS.some(rx => rx.test(url));
}

function isBlacklistedTitle(title: string): boolean {
  return TITLE_BLACKLIST_PATTERNS.some(rx => rx.test(title));
}

function titleMentionsTicker(title: string, ticker: string): boolean {
  const names = TICKER_NAMES[ticker] ?? [ticker];
  const lowerTitle = title.toLowerCase();
  return names.some(name => lowerTitle.includes(name.toLowerCase().trim()));
}

async function fetchNewsForTicker(ticker: string, category: string): Promise<{ articles: Article[]; stats: { total: number; filtered: number } }> {
  const names = TICKER_NAMES[ticker] ?? [ticker];
  // Query: "TICKER CompanyName notícias" — mais específica que só "TICKER B3"
  const primaryName = names[0] ?? ticker;
  const query = encodeURIComponent(`${ticker} ${primaryName} notícias`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Genie/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) return { articles: [], stats: { total: 0, filtered: 0 } };
  const xml = await resp.text();
  const items = extractItems(xml).slice(0, 15); // fetch more, filter down

  const articles: Article[] = [];
  let filtered = 0;
  for (const item of items) {
    // Filter 1: blacklisted URL (cotação, YouTube, etc)
    if (isBlacklistedURL(item.link)) { filtered++; continue; }
    // Filter 2: blacklisted title (static page heuristics)
    if (isBlacklistedTitle(item.title)) { filtered++; continue; }
    // Filter 3: title must mention the ticker OR the company name
    if (!titleMentionsTicker(item.title, ticker)) { filtered++; continue; }

    articles.push({
      url: normalizeURL(item.link),
      title: item.title,
      source: extractDomain(item.link),
      tickers: [ticker],
      category,
      fetchedAt: new Date().toISOString(),
      ...(item.pubDate ? { publishedAt: new Date(item.pubDate).toISOString() } : {}),
    });

    if (articles.length >= 5) break; // cap at 5 quality articles per ticker
  }

  return { articles, stats: { total: items.length, filtered } };
}

async function main() {
  const config = getConfig();
  const db = openAndMigrate(config.DB_PATH);
  console.log(`Seeding news into ${config.DB_PATH}...\n`);

  let total = 0;
  let totalFiltered = 0;
  for (const [category, tickers] of Object.entries(CATEGORY_TICKERS)) {
    for (const ticker of tickers) {
      process.stdout.write(`  ${ticker.padEnd(8)} (${category.padEnd(12)}) `);
      try {
        const { articles, stats } = await fetchNewsForTicker(ticker, category);
        if (articles.length > 0) {
          upsertArticles(db, articles);
          total += articles.length;
        }
        totalFiltered += stats.filtered;
        console.log(`kept ${articles.length} / filtered ${stats.filtered} / from ${stats.total}`);
      } catch (err) {
        console.log(`ERROR: ${String(err)}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\nDone! Inserted ${total} articles (filtered out ${totalFiltered} noise items).`);
  db.close();
}

main().catch(console.error);

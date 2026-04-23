import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import type { Tool } from '../agent/tool.ts';
import type { Logger } from 'pino';

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT = 8_000;
const TRUNCATION_SUFFIX = '\n\n[... conteúdo truncado ...]';
const USER_AGENT = 'Mozilla/5.0 (Genie/1.0)';

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', 'metadata.google.internal', '169.254.169.254']);

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /<\|im_(start|end|sep)\|>/g,
  /<\|system\|>/g,
  /<\|user\|>/g,
  /<\|assistant\|>/g,
  /#{1,6}\s+system\s*\n/gi,
  /(you are now|act as|pretend (you are|to be))\s+.{0,60}(jailbreak|DAN|unrestricted|no\s+filter)/gi,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>/g,
];

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  length: number;
}

function sanitize(content: string): string {
  for (const rx of INJECTION_PATTERNS) {
    content = content.replace(rx, '[CONTEÚDO REMOVIDO]');
  }
  return content;
}

function validateURL(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`web_fetch: invalid URL: ${raw}`);
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`web_fetch: SSRF blocked — scheme "${u.protocol}" not allowed`);
  }

  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error(`web_fetch: SSRF blocked — hostname "${host}" is blocked`);
  }
}

export class WebFetch {
  constructor(
    private readonly log: Logger,
    private readonly skipSSRFCheck = false,
  ) {}

  async fetch(rawURL: string, signal?: AbortSignal): Promise<FetchResult> {
    if (!this.skipSSRFCheck) validateURL(rawURL);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    const t0 = Date.now();
    let resp: Response;
    try {
      resp = await fetch(rawURL, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,*/*' },
        signal: combined,
      });
    } finally {
      clearTimeout(timer);
    }

    if (resp.status < 200 || resp.status > 299) {
      throw new Error(`web_fetch: HTTP ${resp.status} for ${rawURL}`);
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const reader = resp.body!.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > MAX_BYTES) throw new Error(`web_fetch: response exceeds ${MAX_BYTES} bytes`);
      chunks.push(value);
    }

    const html = new TextDecoder().decode(
      chunks.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; }, new Uint8Array(0)),
    );

    const dom = new JSDOM(html, { url: rawURL });
    const reader2 = new Readability(dom.window.document);
    const article = reader2.parse();

    const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
    td.remove(['script', 'style', 'iframe', 'noscript', 'nav', 'footer', 'header']);

    let content = '';
    if (article?.content) {
      try {
        content = td.turndown(article.content);
      } catch {
        content = article.textContent ?? '';
      }
    } else {
      content = html.replace(/<[^>]+>/g, ' ').trim();
    }

    content = sanitize(content);
    const runes = [...content];
    if (runes.length > MAX_CONTENT) {
      content = runes.slice(0, MAX_CONTENT).join('') + TRUNCATION_SUFFIX;
    }

    this.log.info({ url: rawURL, bytes: totalBytes, contentChars: content.length, durationMs: Date.now() - t0 }, 'fetch completed');

    return {
      url: rawURL,
      title: article?.title ?? '',
      content,
      excerpt: article?.excerpt ?? undefined,
      byline: article?.byline ?? undefined,
      siteName: article?.siteName ?? undefined,
      length: content.length,
    };
  }

  asTool(): Tool {
    return {
      name: 'web_fetch',
      description: 'Busca o conteúdo de uma URL pública e retorna o texto principal da página em Markdown (máx 8000 caracteres).',
      schema: {
        type: 'object',
        properties: { url: { type: 'string', format: 'uri' } },
        required: ['url'],
      },
      concurrent: true,
      handler: async (args, signal) => {
        const { url } = args as { url?: string };
        if (!url?.trim()) return { error: 'url must not be empty' };
        return this.fetch(url, signal);
      },
    };
  }
}

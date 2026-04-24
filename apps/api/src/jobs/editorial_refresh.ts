import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';
import { generateEditorial } from '../editorial/generator.ts';
import { fetchArticlesInWindow, saveEditorial } from '../editorial/store.ts';
import type { EditorialSlot } from '../editorial/types.ts';
import { getConfig } from '../lib/config.ts';

const PERIOD_HOURS_BY_SLOT: Record<EditorialSlot, number> = {
  '08': 12, // edição matinal cobre overnight + véspera tarde
  '12': 4,
  '16': 4,
  '20': 4,
};

const SLOT_LABELS: Record<EditorialSlot, string> = {
  '08': 'Manhã',
  '12': 'Meio-dia',
  '16': 'Tarde',
  '20': 'Fechamento',
};

export class EditorialRefreshJob {
  constructor(private readonly db: DB, private readonly log: Logger) {}

  async run(_signal?: AbortSignal): Promise<void> {
    const slot = currentSlot();
    if (!slot) {
      this.log.debug({ brtHour: brtHour() }, 'editorial: not at scheduled slot, skipping');
      return;
    }
    return this.runForSlot(slot);
  }

  /** Disparo manual (admin/dev) — calcula janela a partir da hora atual. */
  async runForSlot(slot: EditorialSlot): Promise<void> {
    const config = getConfig();
    const hours = PERIOD_HOURS_BY_SLOT[slot];
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - hours * 3600_000);

    const articles = fetchArticlesInWindow(this.db, periodStart, periodEnd);
    this.log.info(
      { slot, articleCount: articles.length, windowHours: hours },
      'editorial: starting generation',
    );

    if (articles.length === 0) {
      this.log.warn({ slot }, 'editorial: no articles in window, leaving previous edition in place');
      return;
    }

    const periodLabel = `${SLOT_LABELS[slot]} (${slot}h BRT) — últimas ${hours}h`;
    const generateOpts: Parameters<typeof generateEditorial>[0] = {
      articles,
      periodLabel,
      apiKey: config.OPENROUTER_API_KEY,
      model: config.OPENROUTER_MODEL,
      log: this.log,
    };
    if (config.OPENROUTER_MODEL_FALLBACK) {
      generateOpts.modelFallback = config.OPENROUTER_MODEL_FALLBACK;
    }
    const result = await generateEditorial(generateOpts);

    if (!result) {
      this.log.warn({ slot }, 'editorial: generation failed, previous edition remains');
      return;
    }

    const editionDate = formatBrtDate(periodEnd);
    const articleIds = collectArticleIds(result.sections);

    saveEditorial(this.db, {
      slot,
      editionDate,
      periodStart,
      periodEnd,
      leadTitle: result.leadTitle,
      leadBody: result.leadBody,
      sections: result.sections,
      articleIds,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
    });
    this.log.info(
      {
        slot,
        editionDate,
        model: result.modelUsed,
        sections: result.sections.length,
        sourceArticles: articleIds.length,
      },
      'editorial: saved',
    );
  }
}

function brtHour(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }).format(date),
  );
}

function currentSlot(): EditorialSlot | null {
  const h = brtHour();
  if (h === 8) return '08';
  if (h === 12) return '12';
  if (h === 16) return '16';
  if (h === 20) return '20';
  return null;
}

/**
 * Retorna o slot mais recente cujo horário BRT já passou no momento da chamada.
 * Usado pelo bootstrap quando a tabela de editoriais está vazia — garante que
 * o usuário sempre encontre uma edição ao acessar /editorial após um deploy.
 *
 * Exemplos: 09:00 BRT → '08'; 13:30 → '12'; 17:00 → '16'; 03:00 → '20' (véspera).
 */
export function lastPassedSlot(now: Date = new Date()): EditorialSlot {
  const h = brtHour(now);
  if (h >= 20) return '20';
  if (h >= 16) return '16';
  if (h >= 12) return '12';
  if (h >= 8) return '08';
  return '20'; // antes das 08h BRT — usa fechamento da véspera
}

/** Returns 'YYYY-MM-DD' in BRT — used as edition_date so an 8pm edition
 *  belongs to the same calendar day as the rest, not the next UTC day. */
function formatBrtDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function collectArticleIds(sections: { sourceArticleIds: number[] }[]): number[] {
  const ids = new Set<number>();
  for (const sec of sections) {
    for (const id of sec.sourceArticleIds) ids.add(id);
  }
  return [...ids];
}

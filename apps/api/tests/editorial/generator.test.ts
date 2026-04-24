import { describe, it, expect } from 'vitest';
import { parseEditorialResponse } from '../../src/editorial/generator.ts';

const VALID_IDS = new Set([1, 2, 3, 4, 5]);

describe('parseEditorialResponse', () => {
  it('returns null for empty input', () => {
    expect(parseEditorialResponse('', VALID_IDS)).toBeNull();
    expect(parseEditorialResponse('   ', VALID_IDS)).toBeNull();
  });

  it('returns null when no JSON object present', () => {
    expect(parseEditorialResponse('apenas texto sem json', VALID_IDS)).toBeNull();
  });

  it('returns null when JSON malformed', () => {
    expect(parseEditorialResponse('{ broken', VALID_IDS)).toBeNull();
    expect(parseEditorialResponse('{"foo": }', VALID_IDS)).toBeNull();
  });

  it('returns null when leadTitle or leadBody missing', () => {
    expect(parseEditorialResponse('{"leadTitle": "x", "sections": [{}]}', VALID_IDS)).toBeNull();
    expect(parseEditorialResponse('{"leadBody": "x", "sections": [{}]}', VALID_IDS)).toBeNull();
  });

  it('returns null when sections array is empty after filtering', () => {
    const raw = JSON.stringify({
      leadTitle: 'T',
      leadBody: 'B',
      sections: [{ category: 'invalida', title: 'x', body: 'y' }],
    });
    expect(parseEditorialResponse(raw, VALID_IDS)).toBeNull();
  });

  it('parses a valid response and filters invalid article ids', () => {
    const raw = JSON.stringify({
      leadTitle: 'Lead title aqui',
      leadBody: 'Corpo do lead com 3-5 frases.',
      sections: [
        {
          category: 'energia',
          title: 'Energia sob pressão',
          body: 'Texto investigativo.',
          highlightTickers: ['petr4', 'PRIO3', 'too-long-ticker', 123],
          sourceArticleIds: [1, 99, 3, 'x', 4],
        },
      ],
    });
    const out = parseEditorialResponse(raw, VALID_IDS);
    expect(out).not.toBeNull();
    expect(out!.leadTitle).toBe('Lead title aqui');
    expect(out!.sections).toHaveLength(1);
    expect(out!.sections[0]!.category).toBe('energia');
    expect(out!.sections[0]!.highlightTickers).toEqual(['PETR4', 'PRIO3']);
    expect(out!.sections[0]!.sourceArticleIds).toEqual([1, 3, 4]);
  });

  it('strips markdown wrappers around JSON', () => {
    const raw = '```json\n' + JSON.stringify({
      leadTitle: 'X',
      leadBody: 'Y',
      sections: [{ category: 'financeiro', title: 'A', body: 'B', highlightTickers: [], sourceArticleIds: [] }],
    }) + '\n```';
    const out = parseEditorialResponse(raw, VALID_IDS);
    expect(out).not.toBeNull();
    expect(out!.sections[0]!.category).toBe('financeiro');
  });

  it('caps title at 100 chars and tickers at 5', () => {
    const longTitle = 'a'.repeat(200);
    const tickers = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const raw = JSON.stringify({
      leadTitle: 'L',
      leadBody: 'B',
      sections: [{
        category: 'varejo',
        title: longTitle,
        body: 'b',
        highlightTickers: tickers,
        sourceArticleIds: [1],
      }],
    });
    const out = parseEditorialResponse(raw, VALID_IDS);
    expect(out!.sections[0]!.title.length).toBe(100);
    expect(out!.sections[0]!.highlightTickers).toHaveLength(5);
  });

  it('discards sections without category/title/body', () => {
    const raw = JSON.stringify({
      leadTitle: 'L',
      leadBody: 'B',
      sections: [
        { category: 'financeiro', title: '', body: 'x' },
        { category: 'varejo', title: 'ok', body: 'corpo' },
      ],
    });
    const out = parseEditorialResponse(raw, VALID_IDS);
    expect(out!.sections).toHaveLength(1);
    expect(out!.sections[0]!.category).toBe('varejo');
  });
});

import { describe, it, expect } from 'vitest';
import { parseTolerantJson } from '../../src/lib/json-tolerant.ts';

describe('parseTolerantJson', () => {
  it('returns null for empty/null input', () => {
    expect(parseTolerantJson('')).toBeNull();
    expect(parseTolerantJson('   ')).toBeNull();
  });

  it('parses pure JSON', () => {
    expect(parseTolerantJson('{"a": 1}')).toEqual({ a: 1 });
    expect(parseTolerantJson('{"a": [1, 2, 3]}')).toEqual({ a: [1, 2, 3] });
  });

  it('strips ```json ... ``` markdown fences', () => {
    const raw = '```json\n{"foo": "bar"}\n```';
    expect(parseTolerantJson(raw)).toEqual({ foo: 'bar' });
  });

  it('strips plain ``` ... ``` fences', () => {
    const raw = '```\n{"foo": "bar"}\n```';
    expect(parseTolerantJson(raw)).toEqual({ foo: 'bar' });
  });

  it('extracts JSON from preamble', () => {
    const raw = 'Aqui está o resultado:\n{"foo": "bar"}\nEspero ter ajudado!';
    expect(parseTolerantJson(raw)).toEqual({ foo: 'bar' });
  });

  it('respects strings with curly braces inside', () => {
    const raw = '{"text": "use {placeholders}"}';
    expect(parseTolerantJson(raw)).toEqual({ text: 'use {placeholders}' });
  });

  it('respects escaped quotes in strings', () => {
    const raw = '{"text": "ele disse \\"oi\\""}';
    expect(parseTolerantJson(raw)).toEqual({ text: 'ele disse "oi"' });
  });

  describe('truncated JSON repair', () => {
    it('repairs JSON truncated mid-string', () => {
      // Resposta cortada no meio de uma string
      const raw = '{"leadTitle": "FIIs lideram", "leadBody": "Os gestores de fundos imobi';
      const result = parseTolerantJson(raw) as { leadTitle: string; leadBody?: string } | null;
      expect(result).not.toBeNull();
      expect(result!.leadTitle).toBe('FIIs lideram');
      // leadBody pode ter sido truncado (resultado: descartado ou string parcial)
    });

    it('repairs JSON truncated after first complete property', () => {
      // Tem leadTitle completo, leadBody começou mas truncou
      const raw = '{"leadTitle": "Síntese do dia", "leadBody": "início incompleto';
      const result = parseTolerantJson(raw) as { leadTitle: string } | null;
      expect(result).not.toBeNull();
      expect(result!.leadTitle).toBe('Síntese do dia');
    });

    it('repairs JSON truncated mid-array', () => {
      const raw = '{"items": [1, 2, 3, ';
      const result = parseTolerantJson(raw) as { items: number[] } | null;
      expect(result).not.toBeNull();
      expect(result!.items).toEqual([1, 2, 3]);
    });

    it('repairs nested objects truncated mid-section', () => {
      // Cenário real do editorial: 1 seção completa + 1 começada (truncada no body)
      const raw = `{
        "leadTitle": "T",
        "leadBody": "B",
        "sections": [
          {"category": "energia", "title": "Energia", "body": "Texto.", "highlightTickers": ["PETR4"], "sourceArticleIds": [1]},
          {"category": "varejo", "title": "Varejo", "body": "Tex`;
      const result = parseTolerantJson(raw) as {
        leadTitle: string;
        leadBody: string;
        sections: Array<{ category: string; title: string; body?: string }>;
      } | null;
      expect(result).not.toBeNull();
      expect(result!.leadTitle).toBe('T');
      // Seção completa preservada; segunda preservada parcialmente (sem body)
      // Validador do editorial vai descartar a segunda por falta de body — o
      // importante aqui é que a primeira sobreviveu intacta.
      expect(result!.sections.length).toBeGreaterThanOrEqual(1);
      expect(result!.sections[0]!.category).toBe('energia');
      expect(result!.sections[0]!.body).toBe('Texto.');
    });

    it('returns null for completely malformed input', () => {
      expect(parseTolerantJson('{ broken: not json at all')).toBeNull();
      expect(parseTolerantJson('apenas texto sem json')).toBeNull();
    });

    it('handles real-world editorial truncation case from logs', () => {
      // Replica o cenário exato do log: leadBody truncado no meio
      const raw = `{
 "leadTitle":"FIIs antecipam alta de juros e lideram volume na B3 com XPML11 e HGLG11",
 "leadBody": "Os gestores de fundos imobiliários já sinalizam a virada da taxa de juros em março, o que deve`;
      const result = parseTolerantJson(raw) as { leadTitle: string } | null;
      expect(result).not.toBeNull();
      expect(result!.leadTitle).toContain('FIIs');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { lastPassedSlot } from '../../src/jobs/editorial_refresh.ts';

// Helper: monta um Date que, quando lido em America/Sao_Paulo, devolve a hora desejada.
// BRT = UTC-3 (sem DST desde 2019), então BRT 09:00 = UTC 12:00.
function brtAt(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 3, 24, hour + 3, minute));
}

describe('lastPassedSlot', () => {
  it('retorna 08 às 09h BRT', () => {
    expect(lastPassedSlot(brtAt(9))).toBe('08');
  });

  it('retorna 08 exatamente às 08:00 BRT', () => {
    expect(lastPassedSlot(brtAt(8))).toBe('08');
  });

  it('retorna 12 às 13:30 BRT', () => {
    expect(lastPassedSlot(brtAt(13, 30))).toBe('12');
  });

  it('retorna 16 às 17h BRT', () => {
    expect(lastPassedSlot(brtAt(17))).toBe('16');
  });

  it('retorna 16 às 19:59 BRT', () => {
    expect(lastPassedSlot(brtAt(19, 59))).toBe('16');
  });

  it('retorna 20 às 20h BRT exato', () => {
    expect(lastPassedSlot(brtAt(20))).toBe('20');
  });

  it('retorna 20 às 23h BRT', () => {
    expect(lastPassedSlot(brtAt(23))).toBe('20');
  });

  it('retorna 20 (véspera) antes das 08h BRT', () => {
    expect(lastPassedSlot(brtAt(3))).toBe('20');
    expect(lastPassedSlot(brtAt(7, 59))).toBe('20');
    expect(lastPassedSlot(brtAt(0))).toBe('20');
  });
});

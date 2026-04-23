import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPct, formatNumber } from './format';

describe('formatCurrency', () => {
  it('formats positive value in BRL', () => {
    expect(formatCurrency(38.12)).toBe('R$\u00a038,12');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('R$\u00a00,00');
  });

  it('formats large values with thousands separator', () => {
    const result = formatCurrency(1234.56);
    // Should contain 1.234,56 in pt-BR notation
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });

  it('formats negative values', () => {
    const result = formatCurrency(-10.5);
    expect(result).toContain('10,50');
    expect(result).toContain('R$');
  });
});

describe('formatPct', () => {
  it('prefixes positive values with +', () => {
    expect(formatPct(1.23)).toBe('+1.23%');
  });

  it('prefixes zero with +', () => {
    expect(formatPct(0)).toBe('+0.00%');
  });

  it('prefixes negative values with - (no extra +)', () => {
    expect(formatPct(-0.8)).toBe('-0.80%');
  });

  it('respects custom decimal places', () => {
    expect(formatPct(1.5, 1)).toBe('+1.5%');
  });

  it('rounds correctly with 0 decimals', () => {
    expect(formatPct(1.6, 0)).toBe('+2%');
  });
});

describe('formatNumber', () => {
  it('formats using pt-BR notation', () => {
    expect(formatNumber(1234.56)).toBe('1.234,56');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0,00');
  });

  it('formats large number', () => {
    expect(formatNumber(1000000)).toBe('1.000.000,00');
  });

  it('formats small decimal', () => {
    expect(formatNumber(0.1)).toBe('0,10');
  });
});

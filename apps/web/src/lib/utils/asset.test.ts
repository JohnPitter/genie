import { describe, it, expect } from 'vitest';
import { statusInvestURL, changeColor, formatChangePct } from './asset';

describe('statusInvestURL', () => {
  it('generates lowercase URL for a ticker', () => {
    expect(statusInvestURL('PETR4')).toBe('https://statusinvest.com.br/acoes/petr4');
  });

  it('handles already lowercase ticker', () => {
    expect(statusInvestURL('vale3')).toBe('https://statusinvest.com.br/acoes/vale3');
  });

  it('handles FII ticker with 11 suffix', () => {
    expect(statusInvestURL('MXRF11')).toBe('https://statusinvest.com.br/acoes/mxrf11');
  });
});

describe('changeColor', () => {
  it('returns text-success for positive change', () => {
    expect(changeColor(1.23)).toBe('text-success');
  });

  it('returns text-error for negative change', () => {
    expect(changeColor(-0.5)).toBe('text-error');
  });

  it('returns text-muted for zero change', () => {
    expect(changeColor(0)).toBe('text-muted');
  });

  it('returns text-muted for null', () => {
    expect(changeColor(null)).toBe('text-muted');
  });

  it('returns text-muted for undefined', () => {
    expect(changeColor(undefined)).toBe('text-muted');
  });
});

describe('formatChangePct', () => {
  it('prefixes + for positive values', () => {
    expect(formatChangePct(1.23)).toBe('+1.23%');
  });

  it('keeps - for negative values', () => {
    expect(formatChangePct(-0.5)).toBe('-0.50%');
  });

  it('returns 0.00% for zero', () => {
    expect(formatChangePct(0)).toBe('0.00%');
  });

  it('returns — for null', () => {
    expect(formatChangePct(null)).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(formatChangePct(undefined)).toBe('—');
  });
});

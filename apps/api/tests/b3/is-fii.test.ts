import { describe, it, expect } from 'vitest';
import { isFII } from '../../src/b3/categories.ts';

describe('isFII', () => {
  describe('classifica FIIs corretamente', () => {
    it.each([
      'HGLG11', 'XPML11', 'MXRF11', 'KNRI11', 'KNCR11',
      'BCFF11', 'FIXA11', 'VISC11', 'IRDM11', 'RECT11',
    ])('%s é FII', (ticker) => {
      expect(isFII(ticker)).toBe(true);
    });

    it('aceita lowercase', () => {
      expect(isFII('hglg11')).toBe(true);
    });
  });

  describe('rejeita units conhecidas (empresas com 11)', () => {
    it.each(['SANB11', 'BPAC11', 'SULA11'])('%s não é FII (é unit/ação)', (ticker) => {
      expect(isFII(ticker)).toBe(false);
    });
  });

  describe('rejeita ações comuns', () => {
    it.each([
      'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'BBAS3',
      'PETR3', 'MGLU3', 'WEGE3', 'ABEV3',
    ])('%s não é FII', (ticker) => {
      expect(isFII(ticker)).toBe(false);
    });
  });

  describe('rejeita formatos inválidos', () => {
    it.each(['', 'PETR', 'PETR411', 'PE4', '1234', 'TICKER1', 'AB12'])(
      '%s não é FII (formato inválido)',
      (ticker) => {
        expect(isFII(ticker)).toBe(false);
      },
    );
  });
});

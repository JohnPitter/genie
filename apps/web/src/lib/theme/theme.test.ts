import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(__dirname, 'orb-quantum.css'), 'utf-8');

describe('Orb Quantum CSS tokens', () => {
  const requiredTokens = [
    '--bg-primary',
    '--bg-surface',
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--accent-gold',
    '--accent-lilac',
    '--accent-violet',
    '--status-success',
    '--status-error',
    '--status-warning',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--shadow-card',
    '--glow-violet',
    '--glow-gold',
    '--orb-glow',
    '--gradient-brand',
    '--gradient-bg',
    '--ease-standard',
    '--dur-fast',
    '--dur-medium',
    '--dur-smooth',
    '--dur-cinematic',
    '--font-display',
    '--font-body',
    '--font-technical',
  ];

  for (const token of requiredTokens) {
    it(`defines ${token}`, () => {
      expect(css).toContain(token);
    });
  }

  it('defines orb-breathe keyframe animation', () => {
    expect(css).toContain('@keyframes orb-breathe');
  });

  it('defines orb-pulse keyframe animation', () => {
    expect(css).toContain('@keyframes orb-pulse');
  });

  it('defines orb-rotate keyframe animation', () => {
    expect(css).toContain('@keyframes orb-rotate');
  });
});

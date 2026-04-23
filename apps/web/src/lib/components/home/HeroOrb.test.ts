import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import HeroOrb from './HeroOrb.svelte';

describe('HeroOrb', () => {
  it('renders without crash', () => {
    const { container } = render(HeroOrb);
    expect(container.querySelector('.hero-orb')).toBeInTheDocument();
  });

  it('renders title "Genie"', () => {
    const { getByText } = render(HeroOrb);
    expect(getByText('Genie')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    const { container } = render(HeroOrb);
    expect(container.querySelector('.hero-orb__subtitle')).toBeInTheDocument();
  });

  it('has aria-label for section', () => {
    const { container } = render(HeroOrb);
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toContain('Genie');
  });

  it('renders the orb wrapper', () => {
    const { container } = render(HeroOrb);
    expect(container.querySelector('.hero-orb__orb-wrap')).toBeInTheDocument();
  });

  it('accepts orbState prop', () => {
    // Should not throw when orbState is set
    expect(() =>
      render(HeroOrb, { props: { orbState: 'thinking' } })
    ).not.toThrow();
  });

  it('renders h1 heading', () => {
    const { container } = render(HeroOrb);
    const h1 = container.querySelector('h1');
    expect(h1).toBeInTheDocument();
    expect(h1?.textContent).toBe('Genie');
  });
});

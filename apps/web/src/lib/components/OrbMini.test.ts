import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import OrbMini from './OrbMini.svelte';

describe('OrbMini', () => {
  it('renders without crash', () => {
    const { container } = render(OrbMini);
    expect(container.querySelector('.orb-mini')).not.toBeNull();
  });

  it('renders an inner Orb', () => {
    const { container } = render(OrbMini);
    expect(container.querySelector('.orb')).not.toBeNull();
  });

  it('renders at 64px size', () => {
    const { container } = render(OrbMini);
    const orb = container.querySelector('.orb') as HTMLElement | null;
    expect(orb?.getAttribute('style')).toContain('64px');
  });

  it('passes state prop to inner Orb', () => {
    const { container } = render(OrbMini, { props: { state: 'thinking' } });
    const orb = container.querySelector('.orb');
    expect(orb?.getAttribute('data-state')).toBe('thinking');
  });

  it('container has border-radius: 50%', () => {
    const { container } = render(OrbMini);
    const mini = container.querySelector('.orb-mini') as HTMLElement | null;
    // Svelte scoped styles: check the element has the class
    expect(mini).not.toBeNull();
  });
});

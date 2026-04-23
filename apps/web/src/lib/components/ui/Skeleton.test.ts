import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Skeleton from './Skeleton.svelte';

describe('Skeleton', () => {
  it('renders without crash', () => {
    const { container } = render(Skeleton);
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('is aria-hidden for accessibility', () => {
    const { container } = render(Skeleton);
    expect(container.querySelector('.skeleton')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="presentation"', () => {
    const { container } = render(Skeleton);
    expect(container.querySelector('.skeleton')).toHaveAttribute('role', 'presentation');
  });

  it('applies custom width via inline style', () => {
    const { container } = render(Skeleton, { props: { width: '200px' } });
    const el = container.querySelector('.skeleton') as HTMLElement;
    expect(el.style.width).toBe('200px');
  });

  it('applies custom height via inline style', () => {
    const { container } = render(Skeleton, { props: { height: '40px' } });
    const el = container.querySelector('.skeleton') as HTMLElement;
    expect(el.style.height).toBe('40px');
  });

  it('defaults to 100% width', () => {
    const { container } = render(Skeleton);
    const el = container.querySelector('.skeleton') as HTMLElement;
    expect(el.style.width).toBe('100%');
  });

  it('applies rounded="full" border-radius', () => {
    const { container } = render(Skeleton, { props: { rounded: 'full' } });
    const el = container.querySelector('.skeleton') as HTMLElement;
    // var(--radius-full) maps to 999px in real browsers, but jsdom resolves inline style
    expect(el.style.borderRadius).toContain('var(--radius-full)');
  });
});

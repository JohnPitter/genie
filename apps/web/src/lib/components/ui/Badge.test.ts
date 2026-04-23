import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Badge from './Badge.svelte';

describe('Badge', () => {
  it('renders without crash', () => {
    const { container } = render(Badge);
    expect(container.querySelector('.badge')).toBeInTheDocument();
  });

  it('applies success variant class', () => {
    const { container } = render(Badge, { props: { variant: 'success' } });
    expect(container.querySelector('.badge--success')).toBeInTheDocument();
  });

  it('applies warning variant class', () => {
    const { container } = render(Badge, { props: { variant: 'warning' } });
    expect(container.querySelector('.badge--warning')).toBeInTheDocument();
  });

  it('applies error variant class', () => {
    const { container } = render(Badge, { props: { variant: 'error' } });
    expect(container.querySelector('.badge--error')).toBeInTheDocument();
  });

  it('applies info variant class', () => {
    const { container } = render(Badge, { props: { variant: 'info' } });
    expect(container.querySelector('.badge--info')).toBeInTheDocument();
  });

  it('applies neutral variant class', () => {
    const { container } = render(Badge, { props: { variant: 'neutral' } });
    expect(container.querySelector('.badge--neutral')).toBeInTheDocument();
  });

  it('applies gold variant class', () => {
    const { container } = render(Badge, { props: { variant: 'gold' } });
    expect(container.querySelector('.badge--gold')).toBeInTheDocument();
  });

  it('applies size sm class', () => {
    const { container } = render(Badge, { props: { size: 'sm' } });
    expect(container.querySelector('.badge--sm')).toBeInTheDocument();
  });

  it('applies size md class by default', () => {
    const { container } = render(Badge);
    expect(container.querySelector('.badge--md')).toBeInTheDocument();
  });
});

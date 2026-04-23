import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Card from './Card.svelte';

describe('Card', () => {
  it('renders without crash', () => {
    const { container } = render(Card);
    expect(container.querySelector('.card')).toBeInTheDocument();
  });

  it('applies default variant class', () => {
    const { container } = render(Card, { props: { variant: 'default' } });
    expect(container.querySelector('.card--default')).toBeInTheDocument();
  });

  it('applies glass variant class', () => {
    const { container } = render(Card, { props: { variant: 'glass' } });
    expect(container.querySelector('.card--glass')).toBeInTheDocument();
  });

  it('applies elevated variant class', () => {
    const { container } = render(Card, { props: { variant: 'elevated' } });
    expect(container.querySelector('.card--elevated')).toBeInTheDocument();
  });

  it('applies padding sm class', () => {
    const { container } = render(Card, { props: { padding: 'sm' } });
    expect(container.querySelector('.card--pad-sm')).toBeInTheDocument();
  });

  it('applies padding lg class', () => {
    const { container } = render(Card, { props: { padding: 'lg' } });
    expect(container.querySelector('.card--pad-lg')).toBeInTheDocument();
  });

  it('does not add hoverable class by default', () => {
    const { container } = render(Card);
    expect(container.querySelector('.card--hoverable')).not.toBeInTheDocument();
  });

  it('adds hoverable class when prop is true', () => {
    const { container } = render(Card, { props: { hoverable: true } });
    expect(container.querySelector('.card--hoverable')).toBeInTheDocument();
  });
});

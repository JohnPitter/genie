import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
  it('renders without crash', () => {
    render(IconButton, { props: { label: 'Close' } });
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('sets aria-label from label prop', () => {
    render(IconButton, { props: { label: 'Favoritar' } });
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Favoritar');
  });

  it('dispatches click event', async () => {
    const handler = vi.fn();
    const { component } = render(IconButton, { props: { label: 'Delete' } });
    component.$on('click', handler);
    await fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch click when disabled', async () => {
    const handler = vi.fn();
    const { component } = render(IconButton, { props: { label: 'Delete', disabled: true } });
    component.$on('click', handler);
    await fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects disabled prop', () => {
    render(IconButton, { props: { label: 'Remove', disabled: true } });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies size-based inline width/height for size 16', () => {
    render(IconButton, { props: { label: 'Small', size: 16 } });
    const btn = screen.getByRole('button') as HTMLElement;
    expect(btn.style.width).toBe('28px');
    expect(btn.style.height).toBe('28px');
  });

  it('applies size-based inline width/height for size 24', () => {
    render(IconButton, { props: { label: 'Large', size: 24 } });
    const btn = screen.getByRole('button') as HTMLElement;
    expect(btn.style.width).toBe('44px');
    expect(btn.style.height).toBe('44px');
  });
});

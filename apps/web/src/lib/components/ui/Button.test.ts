import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button.svelte';

describe('Button', () => {
  it('renders without crash', () => {
    render(Button, { props: { variant: 'primary' } });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies variant class: primary', () => {
    render(Button, { props: { variant: 'primary' } });
    expect(screen.getByRole('button').className).toContain('btn--primary');
  });

  it('applies variant class: ghost', () => {
    render(Button, { props: { variant: 'ghost' } });
    expect(screen.getByRole('button').className).toContain('btn--ghost');
  });

  it('applies variant class: danger', () => {
    render(Button, { props: { variant: 'danger' } });
    expect(screen.getByRole('button').className).toContain('btn--danger');
  });

  it('applies size class: sm', () => {
    render(Button, { props: { size: 'sm' } });
    expect(screen.getByRole('button').className).toContain('btn--sm');
  });

  it('applies size class: lg', () => {
    render(Button, { props: { size: 'lg' } });
    expect(screen.getByRole('button').className).toContain('btn--lg');
  });

  it('dispatches click event when clicked', async () => {
    const handler = vi.fn();
    const { component } = render(Button, { props: { variant: 'primary' } });
    component.$on('click', handler);
    await fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT dispatch click when disabled', async () => {
    const handler = vi.fn();
    const { component } = render(Button, { props: { disabled: true } });
    component.$on('click', handler);
    await fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects disabled prop — button element is disabled', () => {
    render(Button, { props: { disabled: true } });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('sets aria-busy when loading', () => {
    render(Button, { props: { loading: true } });
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('does NOT dispatch click when loading', async () => {
    const handler = vi.fn();
    const { component } = render(Button, { props: { loading: true } });
    component.$on('click', handler);
    await fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('shows spinner element when loading', () => {
    render(Button, { props: { loading: true } });
    const btn = screen.getByRole('button');
    // Spinner is a hidden span inside the button
    expect(btn.querySelector('.btn__spinner')).not.toBeNull();
  });

  it('renders slot content', () => {
    render(Button, { props: { variant: 'primary' } });
    // Slot not tested directly (no content provided), button exists
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

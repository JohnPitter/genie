import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Input from './Input.svelte';

describe('Input', () => {
  it('renders without crash', () => {
    render(Input);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders placeholder text', () => {
    render(Input, { props: { placeholder: 'Digite aqui' } });
    expect(screen.getByPlaceholderText('Digite aqui')).toBeInTheDocument();
  });

  it('binds value prop', () => {
    render(Input, { props: { value: 'PETR4' } });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('PETR4');
  });

  it('is disabled when prop is true', () => {
    render(Input, { props: { disabled: true } });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows error message when error prop is set', () => {
    render(Input, { props: { error: 'Campo obrigatório' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obrigatório');
  });

  it('sets aria-invalid when error is set', () => {
    render(Input, { props: { error: 'Erro' } });
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(Input, { props: { error: '' } });
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('applies error class when error prop is set', () => {
    render(Input, { props: { error: 'err' } });
    expect(screen.getByRole('textbox').className).toContain('input--error');
  });

  it('dispatches input event on user typing', async () => {
    const handler = vi.fn();
    const { component } = render(Input);
    component.$on('input', handler);
    const input = screen.getByRole('textbox');
    await fireEvent.input(input, { target: { value: 'a' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches change event', async () => {
    const handler = vi.fn();
    const { component } = render(Input);
    component.$on('change', handler);
    await fireEvent.change(screen.getByRole('textbox'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches keydown event', async () => {
    const handler = vi.fn();
    const { component } = render(Input);
    component.$on('keydown', handler);
    await fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('renders password type correctly', () => {
    const { container } = render(Input, { props: { type: 'password' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders email type correctly', () => {
    const { container } = render(Input, { props: { type: 'email' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders number type correctly', () => {
    const { container } = render(Input, { props: { type: 'number' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('renders search type correctly', () => {
    const { container } = render(Input, { props: { type: 'search' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'search');
  });

  it('dispatches input event for password type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'password' } });
    component.$on('input', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.input(input, { target: { value: 'secret' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches change event for email type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'email' } });
    component.$on('change', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.change(input);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches keydown event for number type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'number' } });
    component.$on('keydown', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches input event for search type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'search' } });
    component.$on('input', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.input(input, { target: { value: 'VALE3' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches keydown for email type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'email' } });
    component.$on('keydown', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.keyDown(input, { key: 'Tab' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches change for search type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'search' } });
    component.$on('change', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.change(input);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches input and change for number type', async () => {
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'number' } });
    component.$on('input', inputHandler);
    component.$on('change', changeHandler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.input(input, { target: { value: '42' } });
    await fireEvent.change(input);
    expect(inputHandler).toHaveBeenCalledTimes(1);
    expect(changeHandler).toHaveBeenCalledTimes(1);
  });

  it('dispatches keydown for password type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'password' } });
    component.$on('keydown', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches change for password type', async () => {
    const handler = vi.fn();
    const { component, container } = render(Input, { props: { type: 'password' } });
    component.$on('change', handler);
    const input = container.querySelector('input') as HTMLElement;
    await fireEvent.change(input);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('shows error message for password type', () => {
    const { container } = render(Input, { props: { type: 'password', error: 'Senha inválida' } });
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Senha inválida');
  });

  it('sets aria-invalid for email type with error', () => {
    const { container } = render(Input, { props: { type: 'email', error: 'Email inválido' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-invalid for number type with error', () => {
    const { container } = render(Input, { props: { type: 'number', error: 'Número inválido' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-invalid for search type with error', () => {
    const { container } = render(Input, { props: { type: 'search', error: 'Busca inválida' } });
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

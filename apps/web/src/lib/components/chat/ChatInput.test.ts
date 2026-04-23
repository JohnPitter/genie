import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from './ChatInput.svelte';

describe('ChatInput', () => {
  it('renders textarea', () => {
    const { container } = render(ChatInput);
    expect(container.querySelector('textarea')).toBeInTheDocument();
  });

  it('renders send button', () => {
    const { container } = render(ChatInput);
    expect(container.querySelector('.chat-input__send')).toBeInTheDocument();
  });

  it('send button is disabled when textarea is empty', () => {
    const { container } = render(ChatInput);
    const btn = container.querySelector('.chat-input__send') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('dispatches submit event on Enter key with content', async () => {
    const handler = vi.fn();
    const { container, component } = render(ChatInput);
    component.$on('submit', handler);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'Olá Genie' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ message: 'Olá Genie' });
  });

  it('does NOT dispatch submit on Shift+Enter', async () => {
    const handler = vi.fn();
    const { container, component } = render(ChatInput);
    component.$on('submit', handler);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'hello' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT dispatch submit for empty/whitespace input', async () => {
    const handler = vi.fn();
    const { container, component } = render(ChatInput);
    component.$on('submit', handler);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: '   ' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handler).not.toHaveBeenCalled();
  });

  it('disables textarea and button when disabled prop is true', () => {
    const { container } = render(ChatInput, { props: { disabled: true } });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('disables textarea and button when loading prop is true', () => {
    const { container } = render(ChatInput, { props: { loading: true } });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('shows spinner when loading', () => {
    const { container } = render(ChatInput, { props: { loading: true } });
    expect(container.querySelector('.chat-input__spinner')).toBeInTheDocument();
  });

  it('clears input after submit', async () => {
    const handler = vi.fn();
    const { container, component } = render(ChatInput);
    component.$on('submit', handler);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'Minha pergunta' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // After submit, value should be cleared
    expect(textarea.value).toBe('');
  });

  it('uses custom placeholder', () => {
    const { container } = render(ChatInput, {
      props: { placeholder: 'Digite aqui...' },
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('Digite aqui...');
  });

  it('dispatches submit on form submit event', async () => {
    const handler = vi.fn();
    const { container, component } = render(ChatInput);
    component.$on('submit', handler);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'test message' } });

    const form = container.querySelector('form') as HTMLFormElement;
    await fireEvent.submit(form);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

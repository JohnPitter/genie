import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { writable } from 'svelte/store';
import ChatPanel from './ChatPanel.svelte';
import { chatStore } from '$lib/stores/chat';
import type { ChatState, ChatActions } from '$lib/stores/chat';

// Reset store before each test
const INITIAL_STATE: ChatState = {
  conversationId: null,
  messages: [],
  orbState: 'idle',
  streaming: false,
  error: null,
};

beforeEach(() => {
  chatStore.set({ ...INITIAL_STATE });
});

function makeMockActions(): ChatActions {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    setListening: vi.fn(),
  };
}

describe('ChatPanel', () => {
  it('renders without crash', () => {
    const { container } = render(ChatPanel, {
      props: { actions: makeMockActions() },
    });
    expect(container.querySelector('.chat-panel')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    const { getByText } = render(ChatPanel, {
      props: { actions: makeMockActions() },
    });
    expect(getByText(/Pergunte sobre qualquer ativo/)).toBeInTheDocument();
  });

  it('renders messages from the store', async () => {
    chatStore.update((s) => ({
      ...s,
      messages: [
        { id: 'u1', role: 'user', content: 'Olá!', status: 'complete' },
      ],
    }));

    const { getByText } = render(ChatPanel, {
      props: { actions: makeMockActions() },
    });
    expect(getByText('Olá!')).toBeInTheDocument();
  });

  it('calls actions.send when submit event fires', async () => {
    const actions = makeMockActions();
    const { container } = render(ChatPanel, { props: { actions } });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'minha pergunta' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(actions.send).toHaveBeenCalledWith('minha pergunta');
    });
  });

  it('calls actions.clear when "Nova conversa" button clicked', async () => {
    const actions = makeMockActions();
    const { container } = render(ChatPanel, { props: { actions } });

    const clearBtn = container.querySelector('[aria-label="Nova conversa"]') as HTMLButtonElement;
    await fireEvent.click(clearBtn);

    expect(actions.clear).toHaveBeenCalledTimes(1);
  });

  it('shows subtitle "pensando..." when streaming', async () => {
    chatStore.update((s) => ({ ...s, streaming: true, orbState: 'thinking' }));

    const { getByText } = render(ChatPanel, {
      props: { actions: makeMockActions() },
    });
    expect(getByText('pensando...')).toBeInTheDocument();
  });

  it('shows "Nova conversa" button', () => {
    const { container } = render(ChatPanel, {
      props: { actions: makeMockActions() },
    });
    expect(container.querySelector('[aria-label="Nova conversa"]')).toBeInTheDocument();
  });

  it('inline mode applies correct class', () => {
    const { container } = render(ChatPanel, {
      props: { mode: 'inline', actions: makeMockActions() },
    });
    expect(container.querySelector('.chat-panel--inline')).toBeInTheDocument();
  });

  it('overlay mode applies correct class', () => {
    const { container } = render(ChatPanel, {
      props: { mode: 'overlay', actions: makeMockActions() },
    });
    expect(container.querySelector('.chat-panel--overlay')).toBeInTheDocument();
  });

  it('overlay mode shows close button when onClose is provided', () => {
    const onClose = vi.fn();
    const { container } = render(ChatPanel, {
      props: { mode: 'overlay', onClose, actions: makeMockActions() },
    });
    expect(container.querySelector('[aria-label="Fechar chat"]')).toBeInTheDocument();
  });

  it('compact mode applies correct class', () => {
    const { container } = render(ChatPanel, {
      props: { compact: true, actions: makeMockActions() },
    });
    expect(container.querySelector('.chat-panel--compact')).toBeInTheDocument();
  });

  it('renders messages area with aria-live', () => {
    const { container } = render(ChatPanel, {
      props: { actions: makeMockActions() },
    });
    const msgs = container.querySelector('[aria-live="polite"]');
    expect(msgs).toBeInTheDocument();
  });
});

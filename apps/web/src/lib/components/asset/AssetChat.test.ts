import { render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssetChat from './AssetChat.svelte';
import { chatStore } from '$lib/stores/chat';

// Prevent actual network calls from chatActions.send
vi.mock('$lib/api/chat-stream', () => ({
  streamChat: vi.fn().mockReturnValue(
    (async function* () {})(),
  ),
}));

const EMPTY_STATE = {
  conversationId: null,
  messages: [],
  orbState: 'idle' as const,
  streaming: false,
  error: null,
};

beforeEach(() => {
  chatStore.set({ ...EMPTY_STATE });
});

describe('AssetChat', () => {
  it('renders without crash', () => {
    const { container } = render(AssetChat, {
      props: { ticker: 'PETR4', price: 38.12, name: 'Petróleo Brasileiro SA' },
    });
    expect(container.querySelector('.asset-chat')).toBeTruthy();
  });

  it('renders the chat title with ticker', () => {
    const { getByText } = render(AssetChat, {
      props: { ticker: 'PETR4', price: 38.12, name: 'Petróleo Brasileiro SA' },
    });
    expect(getByText(/pergunte sobre petr4/i)).toBeTruthy();
  });

  it('shows empty state when no messages', () => {
    const { container } = render(AssetChat, {
      props: { ticker: 'VALE3', price: 60.0, name: 'Vale SA' },
    });
    expect(container.querySelector('.asset-chat__empty')).toBeTruthy();
  });

  it('has aria-live=polite on messages container', () => {
    const { container } = render(AssetChat, {
      props: { ticker: 'PETR4', price: 38.12, name: 'Petróleo Brasileiro SA' },
    });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('has correct aria-label on messages container', () => {
    const { container } = render(AssetChat, {
      props: { ticker: 'PETR4', price: 38.12, name: 'Petróleo Brasileiro SA' },
    });
    const liveRegion = container.querySelector('[aria-label="Histórico do chat"]');
    expect(liveRegion).toBeTruthy();
  });
});

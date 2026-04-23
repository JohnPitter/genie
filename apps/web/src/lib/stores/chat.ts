import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { TokenUsage, StreamEvent } from '@genie/shared';
import { streamChat } from '$lib/api/chat-stream';
import type { StreamChatParams } from '$lib/api/chat-stream';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RenderedToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
  status: 'running' | 'done' | 'error';
}

export interface ChatMessage {
  /** Locally generated UUID. */
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: RenderedToolCall[];
  status: 'pending' | 'streaming' | 'complete' | 'error';
  usage?: TokenUsage;
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  orbState: OrbState;
  streaming: boolean;
  error: string | null;
  /** Last user input + context — used by retry() */
  lastSend: { message: string; contextData?: Record<string, string> } | null;
}

// ── StreamFn type ─────────────────────────────────────────────────────────────

export type StreamFn = (
  params: StreamChatParams,
) => AsyncGenerator<StreamEvent, void, void>;

// ── Store ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: ChatState = {
  conversationId: null,
  messages: [],
  orbState: 'idle',
  streaming: false,
  error: null,
  lastSend: null,
};

export const chatStore: Writable<ChatState> = writable<ChatState>({ ...INITIAL_STATE });

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
  // Use crypto.randomUUID() when available (Node 19+, all modern browsers).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments (should not be needed in production).
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function updateMessages(
  store: Writable<ChatState>,
  updater: (messages: ChatMessage[]) => ChatMessage[],
): void {
  store.update((state) => ({ ...state, messages: updater([...state.messages]) }));
}

function updateLastAssistant(
  store: Writable<ChatState>,
  updater: (msg: ChatMessage) => ChatMessage,
): void {
  updateMessages(store, (messages) => {
    const idx = findLastAssistantIndex(messages);
    if (idx === -1) return messages;
    const updated = [...messages];
    updated[idx] = updater({ ...updated[idx] });
    return updated;
  });
}

function findLastAssistantIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return i;
  }
  return -1;
}

// ── Actions factory ───────────────────────────────────────────────────────────

export interface ChatActions {
  send: (message: string, contextData?: Record<string, string>) => Promise<void>;
  /** Retry the last message — removes the failed assistant response and resends. */
  retry: () => Promise<void>;
  clear: () => void;
  setListening: (v: boolean) => void;
}

/**
 * Creates chat actions bound to the given store and stream function.
 * Pass a custom `streamFn` in tests to avoid real network calls.
 */
export function createChatActions(
  store: Writable<ChatState> = chatStore,
  streamFn: StreamFn = streamChat,
): ChatActions {
  return {
    async send(message: string, contextData?: Record<string, string>): Promise<void> {
      // 1. Append user message.
      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: message,
        status: 'complete',
      };
      store.update((s) => ({
        ...s,
        messages: [...s.messages, userMsg],
        error: null,
        lastSend: { message, ...(contextData ? { contextData } : {}) },
      }));

      // 2. Append placeholder assistant message.
      const assistantId = uuid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        status: 'streaming',
      };
      store.update((s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        orbState: 'thinking',
        streaming: true,
      }));

      // 3. Get current conversationId.
      let convId: string | null = null;
      store.update((s) => {
        convId = s.conversationId;
        return s;
      });

      const params: StreamChatParams = {
        message,
        ...(convId ? { conversationId: convId } : {}),
        ...(contextData ? { contextData } : {}),
      };

      // 4. Stream events.
      try {
        const gen = streamFn(params);

        for await (const event of gen) {
          handleEvent(store, event);
        }
      } finally {
        // 5. Ensure streaming flag is cleared regardless of outcome.
        store.update((s) => ({ ...s, streaming: false }));
      }
    },

    async retry(): Promise<void> {
      let last: ChatState['lastSend'] = null;
      store.update((s) => {
        last = s.lastSend;
        // Remove the last user-message + last failed assistant-message pair
        // so send() can append fresh ones without duplication.
        const msgs = [...s.messages];
        // Find last assistant with error status and remove it + the user msg right before it
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant' && (msgs[i].status === 'error' || msgs[i].content === '')) {
            msgs.splice(i, 1);
            // remove the preceding user message (the one we'll re-send)
            if (i - 1 >= 0 && msgs[i - 1]?.role === 'user') msgs.splice(i - 1, 1);
            break;
          }
        }
        return { ...s, messages: msgs, error: null };
      });

      const resolvedLast = last as ChatState['lastSend'];
      if (!resolvedLast) return;
      await this.send(resolvedLast.message, resolvedLast.contextData);
    },

    clear(): void {
      store.set({ ...INITIAL_STATE });
    },

    setListening(v: boolean): void {
      store.update((s) => ({ ...s, orbState: v ? 'listening' : 'idle' }));
    },
  };
}

// ── Event handler ─────────────────────────────────────────────────────────────

function handleEvent(store: Writable<ChatState>, event: StreamEvent): void {
  switch (event.type) {
    case 'conversation_start': {
      store.update((s) => ({ ...s, conversationId: event.conversationId }));
      break;
    }

    case 'token': {
      updateLastAssistant(store, (msg) => ({
        ...msg,
        content: msg.content + event.delta,
      }));
      store.update((s) => ({ ...s, orbState: 'speaking' }));
      break;
    }

    case 'tool_call_start': {
      const newCall: RenderedToolCall = {
        id: event.toolCallId,
        name: event.toolName,
        args: event.toolArgs,
        status: 'running',
      };
      updateLastAssistant(store, (msg) => ({
        ...msg,
        toolCalls: [...(msg.toolCalls ?? []), newCall],
      }));
      store.update((s) => ({ ...s, orbState: 'thinking' }));
      break;
    }

    case 'tool_call_end': {
      updateLastAssistant(store, (msg) => ({
        ...msg,
        toolCalls: (msg.toolCalls ?? []).map((tc) =>
          tc.id === event.toolCallId
            ? { ...tc, result: event.toolResult, durationMs: event.durationMs, status: 'done' as const }
            : tc,
        ),
      }));
      store.update((s) => ({ ...s, orbState: 'speaking' }));
      break;
    }

    case 'message_end': {
      updateLastAssistant(store, (msg) => ({
        ...msg,
        status: 'complete',
        ...(event.usage ? { usage: event.usage } : {}),
      }));
      store.update((s) => ({ ...s, orbState: 'idle' }));
      break;
    }

    case 'error': {
      updateLastAssistant(store, (msg) => ({ ...msg, status: 'error' }));
      store.update((s) => ({ ...s, orbState: 'error', error: event.error }));
      // Reset orbState to 'idle' after 400ms.
      setTimeout(() => {
        store.update((s) => ({ ...s, orbState: 'idle' }));
      }, 400);
      break;
    }
  }
}

// ── Default exported actions ──────────────────────────────────────────────────

export const chatActions = createChatActions(chatStore, streamChat);

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';
import { createChatActions } from './chat';
import type { ChatState, StreamFn } from './chat';
import type { StreamEvent } from '@genie/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInitialStore() {
  return writable<ChatState>({
    conversationId: null,
    messages: [],
    orbState: 'idle',
    streaming: false,
    error: null,
  });
}

/** Creates a StreamFn that yields the given events in order. */
function makeStream(events: StreamEvent[]): StreamFn {
  return async function* () {
    for (const event of events) {
      yield event;
    }
  };
}

/** Runs send() and returns the final store state. */
async function runSend(
  events: StreamEvent[],
  overrides?: Partial<ChatState>,
): Promise<ChatState> {
  const store = makeInitialStore();
  if (overrides) store.update((s) => ({ ...s, ...overrides }));
  const actions = createChatActions(store, makeStream(events));
  await actions.send('Hello');
  return get(store);
}

// ── send() — basic flow ───────────────────────────────────────────────────────

describe('chatActions.send() — basic message flow', () => {
  it('appends user message with status complete', async () => {
    const state = await runSend([{ type: 'message_end' }]);

    const userMsg = state.messages.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toBe('Hello');
    expect(userMsg!.status).toBe('complete');
  });

  it('appends assistant placeholder with status streaming', async () => {
    // Track the state DURING streaming (before message_end).
    const store = makeInitialStore();
    const capturedStates: ChatState[] = [];

    // Stream that yields a token first so we can capture streaming state.
    const gen = makeStream([
      { type: 'token', delta: 'Hi' },
      { type: 'message_end' },
    ]);

    const wrappedStream: StreamFn = async function* (params) {
      const inner = gen(params);
      for await (const event of inner) {
        capturedStates.push({ ...get(store) });
        yield event;
      }
    };

    const actions = createChatActions(store, wrappedStream);
    await actions.send('Hello');

    const streamingSnapshot = capturedStates[0];
    const assistantMsg = streamingSnapshot?.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.status).toBe('streaming');
  });

  it('clears streaming flag after completion', async () => {
    const state = await runSend([{ type: 'message_end' }]);
    expect(state.streaming).toBe(false);
  });

  it('has two messages after send (user + assistant)', async () => {
    const state = await runSend([{ type: 'message_end' }]);
    expect(state.messages).toHaveLength(2);
  });
});

// ── token events ──────────────────────────────────────────────────────────────

describe('chatActions.send() — token events', () => {
  it('appends delta to assistant content', async () => {
    const state = await runSend([
      { type: 'token', delta: 'Hello' },
      { type: 'token', delta: ' world' },
      { type: 'message_end' },
    ]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    expect(assistant!.content).toBe('Hello world');
  });

  it('sets orbState to speaking on token', async () => {
    // Capture state after the token event.
    const store = makeInitialStore();
    const statesAfterToken: string[] = [];

    const streamFn: StreamFn = async function* () {
      yield { type: 'token', delta: 'Hi' };
      statesAfterToken.push(get(store).orbState);
      yield { type: 'message_end' };
    };

    const actions = createChatActions(store, streamFn);
    await actions.send('Hello');

    expect(statesAfterToken[0]).toBe('speaking');
  });
});

// ── tool_call_start / tool_call_end ───────────────────────────────────────────

describe('chatActions.send() — tool calls', () => {
  it('adds RenderedToolCall with status running on tool_call_start', async () => {
    const store = makeInitialStore();
    const statesAfterStart: ChatState[] = [];

    const streamFn: StreamFn = async function* () {
      yield { type: 'tool_call_start', toolCallId: 'tc_1', toolName: 'get_quote', toolArgs: { ticker: 'PETR4' } };
      statesAfterStart.push({ ...get(store), messages: [...get(store).messages] });
      yield { type: 'tool_call_end', toolCallId: 'tc_1', toolResult: { price: 38.5 }, durationMs: 100 };
      yield { type: 'message_end' };
    };

    const actions = createChatActions(store, streamFn);
    await actions.send('price?');

    const snapshot = statesAfterStart[0];
    const assistant = snapshot.messages.find((m) => m.role === 'assistant');
    expect(assistant!.toolCalls).toHaveLength(1);
    expect(assistant!.toolCalls![0]).toMatchObject({
      id: 'tc_1',
      name: 'get_quote',
      status: 'running',
    });
  });

  it('updates RenderedToolCall with result and status done on tool_call_end', async () => {
    const state = await runSend([
      { type: 'tool_call_start', toolCallId: 'tc_1', toolName: 'get_quote', toolArgs: {} },
      { type: 'tool_call_end', toolCallId: 'tc_1', toolResult: { price: 42 }, durationMs: 200 },
      { type: 'message_end' },
    ]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    const call = assistant!.toolCalls!.find((tc) => tc.id === 'tc_1');
    expect(call!.status).toBe('done');
    expect(call!.result).toEqual({ price: 42 });
    expect(call!.durationMs).toBe(200);
  });

  it('sets orbState to thinking on tool_call_start', async () => {
    const store = makeInitialStore();
    const orbStates: string[] = [];

    const streamFn: StreamFn = async function* () {
      yield { type: 'tool_call_start', toolCallId: 'tc_1', toolName: 'x', toolArgs: {} };
      orbStates.push(get(store).orbState);
      yield { type: 'message_end' };
    };

    await createChatActions(store, streamFn).send('test');
    expect(orbStates[0]).toBe('thinking');
  });

  it('handles multiple tool calls', async () => {
    const state = await runSend([
      { type: 'tool_call_start', toolCallId: 'tc_1', toolName: 'tool_a', toolArgs: {} },
      { type: 'tool_call_end', toolCallId: 'tc_1', toolResult: 'a', durationMs: 10 },
      { type: 'tool_call_start', toolCallId: 'tc_2', toolName: 'tool_b', toolArgs: {} },
      { type: 'tool_call_end', toolCallId: 'tc_2', toolResult: 'b', durationMs: 20 },
      { type: 'message_end' },
    ]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    expect(assistant!.toolCalls).toHaveLength(2);
    expect(assistant!.toolCalls![0].name).toBe('tool_a');
    expect(assistant!.toolCalls![1].name).toBe('tool_b');
  });
});

// ── message_end ───────────────────────────────────────────────────────────────

describe('chatActions.send() — message_end', () => {
  it('sets assistant status to complete', async () => {
    const state = await runSend([{ type: 'message_end' }]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    expect(assistant!.status).toBe('complete');
  });

  it('stores usage when provided', async () => {
    const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUSD: 0.001 };
    const state = await runSend([{ type: 'message_end', usage }]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    expect(assistant!.usage).toEqual(usage);
  });

  it('sets orbState to idle on message_end', async () => {
    const state = await runSend([{ type: 'message_end' }]);
    expect(state.orbState).toBe('idle');
  });

  it('does not set usage when message_end has no usage', async () => {
    const state = await runSend([{ type: 'message_end' }]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    expect(assistant!.usage).toBeUndefined();
  });
});

// ── error events ──────────────────────────────────────────────────────────────

describe('chatActions.send() — error events', () => {
  it('sets assistant status to error', async () => {
    const state = await runSend([{ type: 'error', error: 'model overloaded' }]);

    const assistant = state.messages.find((m) => m.role === 'assistant');
    expect(assistant!.status).toBe('error');
  });

  it('sets orbState to error', async () => {
    const store = makeInitialStore();
    const orbStates: string[] = [];

    const streamFn: StreamFn = async function* () {
      yield { type: 'error', error: 'fail' };
      orbStates.push(get(store).orbState);
    };

    await createChatActions(store, streamFn).send('test');
    expect(orbStates[0]).toBe('error');
  });

  it('sets error string on store', async () => {
    const state = await runSend([{ type: 'error', error: 'model overloaded' }]);
    expect(state.error).toBe('model overloaded');
  });

  it('orbState reverts to idle after 400ms', async () => {
    vi.useFakeTimers();

    const store = makeInitialStore();
    const actions = createChatActions(store, makeStream([{ type: 'error', error: 'fail' }]));
    await actions.send('test');

    expect(get(store).orbState).toBe('error');

    await vi.advanceTimersByTimeAsync(400);

    expect(get(store).orbState).toBe('idle');

    vi.useRealTimers();
  });
});

// ── orbState initial transitions ──────────────────────────────────────────────

describe('chatActions.send() — orbState transitions', () => {
  it('sets orbState to thinking when send starts', async () => {
    const store = makeInitialStore();
    const capturedOrb: string[] = [];

    const streamFn: StreamFn = async function* () {
      capturedOrb.push(get(store).orbState);
      yield { type: 'message_end' };
    };

    await createChatActions(store, streamFn).send('test');
    expect(capturedOrb[0]).toBe('thinking');
  });
});

// ── clear() ───────────────────────────────────────────────────────────────────

describe('chatActions.clear()', () => {
  it('resets store to initial state', async () => {
    const store = makeInitialStore();
    const actions = createChatActions(store, makeStream([{ type: 'message_end' }]));
    await actions.send('hello');

    // Verify there are messages first.
    expect(get(store).messages.length).toBeGreaterThan(0);

    actions.clear();

    const state = get(store);
    expect(state.messages).toHaveLength(0);
    expect(state.orbState).toBe('idle');
    expect(state.streaming).toBe(false);
    expect(state.error).toBeNull();
    expect(state.conversationId).toBeNull();
  });
});

// ── setListening() ────────────────────────────────────────────────────────────

describe('chatActions.setListening()', () => {
  it('sets orbState to listening when true', () => {
    const store = makeInitialStore();
    const actions = createChatActions(store, makeStream([]));

    actions.setListening(true);

    expect(get(store).orbState).toBe('listening');
  });

  it('sets orbState to idle when false', () => {
    const store = makeInitialStore();
    store.update((s) => ({ ...s, orbState: 'listening' }));
    const actions = createChatActions(store, makeStream([]));

    actions.setListening(false);

    expect(get(store).orbState).toBe('idle');
  });
});

// ── conversationId ────────────────────────────────────────────────────────────

describe('chatActions.send() — conversationId', () => {
  it('passes existing conversationId to stream', async () => {
    const store = makeInitialStore();
    store.update((s) => ({ ...s, conversationId: 'conv-abc' }));

    const capturedParams: { conversationId?: string }[] = [];

    const streamFn: StreamFn = async function* (params) {
      capturedParams.push(params);
      yield { type: 'message_end' };
    };

    await createChatActions(store, streamFn).send('test');
    expect(capturedParams[0].conversationId).toBe('conv-abc');
  });

  it('omits conversationId when store has null', async () => {
    const store = makeInitialStore();
    const capturedParams: { conversationId?: string }[] = [];

    const streamFn: StreamFn = async function* (params) {
      capturedParams.push(params);
      yield { type: 'message_end' };
    };

    await createChatActions(store, streamFn).send('test');
    expect(capturedParams[0].conversationId).toBeUndefined();
  });
});

// ── error cleared on new send ─────────────────────────────────────────────────

describe('chatActions.send() — error cleared', () => {
  it('clears previous error on new send', async () => {
    const store = makeInitialStore();
    // First send causes an error.
    const errActions = createChatActions(store, makeStream([{ type: 'error', error: 'fail' }]));
    await errActions.send('oops');

    expect(get(store).error).toBe('fail');

    // Second send should clear the error.
    const okActions = createChatActions(store, makeStream([{ type: 'message_end' }]));
    await okActions.send('retry');

    expect(get(store).error).toBeNull();
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});

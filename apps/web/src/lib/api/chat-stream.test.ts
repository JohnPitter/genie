import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChat } from './chat-stream';
import type { StreamEvent } from '@genie/shared';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Creates a Response whose body streams the given SSE events as a single chunk. */
function makeSSEResponse(events: StreamEvent[]): Response {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(
    new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode(lines));
        ctrl.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

/**
 * Creates a Response whose body streams events split into multiple chunks,
 * simulating network fragmentation.
 */
function makeFragmentedSSEResponse(events: StreamEvent[], splitAt: number): Response {
  const full = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const chunk1 = full.slice(0, splitAt);
  const chunk2 = full.slice(splitAt);

  return new Response(
    new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode(chunk1));
        ctrl.enqueue(new TextEncoder().encode(chunk2));
        ctrl.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function makeFetch(response: Response) {
  return vi.fn().mockResolvedValueOnce(response);
}

async function collectEvents(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const results: StreamEvent[] = [];
  for await (const event of gen) {
    results.push(event);
  }
  return results;
}

// ── Single-chunk: all events in one read ──────────────────────────────────────

describe('streamChat — single chunk', () => {
  it('yields all events from a single chunk', async () => {
    const events: StreamEvent[] = [
      { type: 'token', delta: 'Hello' },
      { type: 'token', delta: ' world' },
      { type: 'message_end', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    ];

    const gen = streamChat({ message: 'hi' }, { fetch: makeFetch(makeSSEResponse(events)) });
    const received = await collectEvents(gen);

    expect(received).toEqual(events);
  });

  it('yields tool_call_start and tool_call_end events', async () => {
    const events: StreamEvent[] = [
      { type: 'tool_call_start', toolCallId: 'tc_1', toolName: 'get_quote', toolArgs: { ticker: 'PETR4' } },
      { type: 'tool_call_end', toolCallId: 'tc_1', toolResult: { price: 38.5 }, durationMs: 123 },
      { type: 'message_end' },
    ];

    const gen = streamChat({ message: 'price?' }, { fetch: makeFetch(makeSSEResponse(events)) });
    const received = await collectEvents(gen);

    expect(received).toHaveLength(3);
    expect(received[0]).toEqual(events[0]);
    expect(received[1]).toEqual(events[1]);
  });

  it('yields error event', async () => {
    const events: StreamEvent[] = [{ type: 'error', error: 'model overloaded' }];

    const gen = streamChat({ message: 'hi' }, { fetch: makeFetch(makeSSEResponse(events)) });
    const received = await collectEvents(gen);

    expect(received).toEqual([{ type: 'error', error: 'model overloaded' }]);
  });
});

// ── Fragmented chunks ─────────────────────────────────────────────────────────

describe('streamChat — fragmented chunks', () => {
  it('correctly assembles events split across two chunks', async () => {
    const events: StreamEvent[] = [
      { type: 'token', delta: 'Alpha' },
      { type: 'token', delta: 'Beta' },
      { type: 'message_end' },
    ];

    // Split in the middle of the second event's JSON
    const fullText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const splitAt = Math.floor(fullText.length / 2);

    const gen = streamChat(
      { message: 'test' },
      { fetch: makeFetch(makeFragmentedSSEResponse(events, splitAt)) },
    );
    const received = await collectEvents(gen);

    expect(received).toEqual(events);
  });

  it('handles chunk split right inside a data: line', async () => {
    // The split point will be inside the first JSON object
    const events: StreamEvent[] = [
      { type: 'token', delta: 'X' },
      { type: 'token', delta: 'Y' },
    ];

    const gen = streamChat(
      { message: 'test' },
      { fetch: makeFetch(makeFragmentedSSEResponse(events, 5)) },
    );
    const received = await collectEvents(gen);

    expect(received).toEqual(events);
  });
});

// ── Non-OK response ───────────────────────────────────────────────────────────

describe('streamChat — non-OK response', () => {
  it('yields error event when server returns 500', async () => {
    const errorBody = { message: 'internal server error' };
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const gen = streamChat({ message: 'hi' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received).toEqual([{ type: 'error', error: 'internal server error' }]);
  });

  it('yields generic error when no message field in body', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response('Bad Gateway', { status: 502 }),
    );

    const gen = streamChat({ message: 'hi' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received[0]).toEqual({ type: 'error', error: 'HTTP 502' });
  });

  it('yields error when response body is null', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );

    const gen = streamChat({ message: 'hi' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received[0].type).toBe('error');
  });
});

// ── Network error ─────────────────────────────────────────────────────────────

describe('streamChat — network error', () => {
  it('yields error event when fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

    const gen = streamChat({ message: 'hi' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received).toEqual([{ type: 'error', error: 'Network failure' }]);
  });
});

// ── AbortSignal cancellation ──────────────────────────────────────────────────

describe('streamChat — signal cancellation', () => {
  it('passes signal to fetch', async () => {
    const mockFetch = makeFetch(makeSSEResponse([{ type: 'message_end' }]));
    const controller = new AbortController();

    await collectEvents(streamChat({ message: 'hi' }, { fetch: mockFetch, signal: controller.signal }));

    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).signal).toBe(controller.signal);
  });

  it('yields error when aborted before fetch resolves', async () => {
    const abortErr = new DOMException('The operation was aborted.', 'AbortError');
    const mockFetch = vi.fn().mockRejectedValueOnce(abortErr);

    const gen = streamChat({ message: 'hi' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received[0].type).toBe('error');
    expect((received[0] as { type: 'error'; error: string }).error).toContain('aborted');
  });
});

// ── conversationId propagation ────────────────────────────────────────────────

describe('streamChat — request body', () => {
  it('sends conversationId when provided', async () => {
    const mockFetch = makeFetch(makeSSEResponse([{ type: 'message_end' }]));

    await collectEvents(
      streamChat(
        { conversationId: 'conv-123', message: 'hi' },
        { fetch: mockFetch },
      ),
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.conversationId).toBe('conv-123');
    expect(body.message).toBe('hi');
  });

  it('sends contextData when provided', async () => {
    const mockFetch = makeFetch(makeSSEResponse([{ type: 'message_end' }]));

    await collectEvents(
      streamChat(
        { message: 'hi', contextData: { ticker: 'VALE3' } },
        { fetch: mockFetch },
      ),
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.contextData).toEqual({ ticker: 'VALE3' });
  });

  it('uses baseURL when provided', async () => {
    const mockFetch = makeFetch(makeSSEResponse([{ type: 'message_end' }]));

    await collectEvents(
      streamChat({ message: 'hi' }, { baseURL: 'http://localhost:5858', fetch: mockFetch }),
    );

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toBe('http://localhost:5858/api/chat/stream');
  });
});

// ── SSE lines that should be ignored ─────────────────────────────────────────

describe('streamChat — SSE format robustness', () => {
  it('ignores event:, id:, retry: and comment lines', async () => {
    const rawSSE =
      ':keep-alive\n\n' +
      'event: message\n' +
      'id: 1\n' +
      'retry: 1000\n' +
      `data: ${JSON.stringify({ type: 'token', delta: 'hi' })}\n\n`;

    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(ctrl) {
            ctrl.enqueue(new TextEncoder().encode(rawSSE));
            ctrl.close();
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );

    const gen = streamChat({ message: 'test' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received).toEqual([{ type: 'token', delta: 'hi' }]);
  });

  it('ignores [DONE] sentinel', async () => {
    const rawSSE = `data: ${JSON.stringify({ type: 'token', delta: 'x' })}\n\ndata: [DONE]\n\n`;

    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(ctrl) {
            ctrl.enqueue(new TextEncoder().encode(rawSSE));
            ctrl.close();
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );

    const gen = streamChat({ message: 'test' }, { fetch: mockFetch });
    const received = await collectEvents(gen);

    expect(received).toEqual([{ type: 'token', delta: 'x' }]);
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});

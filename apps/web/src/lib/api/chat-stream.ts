import type { StreamEvent } from '@genie/shared';
import { ApiError } from './client';

// ── Public API ────────────────────────────────────────────────────────────────

export interface StreamChatParams {
  conversationId?: string;
  message: string;
  contextData?: Record<string, string>;
}

export interface StreamChatOptions {
  baseURL?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Streams SSE events from POST /api/chat/stream.
 *
 * Yields `StreamEvent` objects as they arrive. The generator finishes when
 * the server closes the connection or the signal is aborted. Network errors
 * are yielded as `{ type: 'error', error: string }` before the generator
 * returns normally — so callers never need to catch from the generator itself.
 */
export async function* streamChat(
  params: StreamChatParams,
  opts?: StreamChatOptions,
): AsyncGenerator<StreamEvent, void, void> {
  const fetchFn = opts?.fetch ?? globalThis.fetch.bind(globalThis);
  const url = `${opts?.baseURL ?? ''}/api/chat/stream`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(params),
      signal: opts?.signal,
    });
  } catch (err: unknown) {
    yield makeNetworkError(err);
    return;
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }
    const message =
      isObjectWithMessage(body) ? String(body.message) : `HTTP ${response.status}`;
    yield { type: 'error', error: message };
    return;
  }

  if (!response.body) {
    yield { type: 'error', error: 'Response body is null' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;

      try {
        ({ done, value } = await reader.read());
      } catch (err: unknown) {
        yield makeNetworkError(err);
        return;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are delimited by double newlines.
      const blocks = buffer.split('\n\n');
      // Keep the last (potentially incomplete) block in the buffer.
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const event = parseSSEBlock(block);
        if (event !== null) yield event;
      }
    }

    // Flush any remaining content in the decoder.
    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parseSSEBlock(buffer);
      if (event !== null) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses a single SSE block (the content between two `\n\n` separators).
 * Returns a `StreamEvent` if a `data:` line with valid JSON is found,
 * or `null` to skip the block (comments, keep-alives, unknown fields).
 */
function parseSSEBlock(block: string): StreamEvent | null {
  const lines = block.split('\n');

  for (const line of lines) {
    if (line.startsWith('data:')) {
      const json = line.slice(5).trim();
      if (!json || json === '[DONE]') continue;

      try {
        const parsed: unknown = JSON.parse(json);
        if (isStreamEvent(parsed)) return parsed;
      } catch {
        // Malformed JSON — skip this data line.
      }
    }
    // Lines starting with 'event:', 'id:', 'retry:', or ':' (comments) are
    // intentionally ignored to keep the parser simple.
  }

  return null;
}

/** Narrows `unknown` to `StreamEvent` by checking the `type` field. */
function isStreamEvent(value: unknown): value is StreamEvent {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const type = obj['type'];
  return (
    type === 'conversation_start' ||
    type === 'token' ||
    type === 'tool_call_start' ||
    type === 'tool_call_end' ||
    type === 'message_end' ||
    type === 'error'
  );
}

function makeNetworkError(err: unknown): StreamEvent {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error';
  return { type: 'error', error: message };
}

function isObjectWithMessage(value: unknown): value is { message: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

import type { Logger } from 'pino';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const REFERER = 'https://github.com/joaopedro/genie';
const TITLE = 'Genie';
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

export interface Message {
  role: string;
  content: string | ContentPart[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ContentPart {
  type: string;
  text?: string;
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: unknown;
}

export interface ToolCall {
  index?: number;
  id?: string;
  type?: string;
  function: { name?: string; arguments?: string };
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  tool_choice?: unknown;
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface StreamChunk {
  delta: string;
  toolCallDelta?: ToolCall;
  finishReason?: string;
  usage?: Usage;
}

export interface OpenRouterOptions {
  retryDelaysMs?: number[];
  baseURL?: string;
}

export class OpenRouterClient {
  private readonly retryDelays: number[];
  private readonly baseURL: string;

  constructor(
    private readonly apiKey: string,
    private readonly log: Logger,
    opts: OpenRouterOptions = {},
  ) {
    this.retryDelays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.baseURL = opts.baseURL ?? DEFAULT_BASE_URL;
  }

  async *streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const body = JSON.stringify(req);
    const resp = await this.doWithRetry(body, signal);

    if (!req.stream) {
      yield* this.parseNonStream(resp);
      return;
    }

    yield* this.parseSSE(resp, signal);
  }

  private async doWithRetry(body: string, signal?: AbortSignal): Promise<Response> {
    const url = `${this.baseURL}/chat/completions`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': TITLE,
      'Accept': 'text/event-stream',
    };

    let lastErr: Error | null = null;
    const attempts = 1 + this.retryDelays.length;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const init: RequestInit = { method: 'POST', headers, body };
        if (signal) init.signal = signal;
        const resp = await fetch(url, init);

        if (resp.status === 429 || resp.status >= 500) {
          lastErr = new Error(`openrouter: HTTP ${resp.status}`);
          resp.body?.cancel();
        } else if (resp.status < 200 || resp.status >= 300) {
          const text = await resp.text();
          throw new Error(`openrouter: HTTP ${resp.status}: ${text}`);
        } else {
          return resp;
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        lastErr = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < this.retryDelays.length) {
        await sleep(this.retryDelays[attempt]!, signal);
      }
    }

    throw new Error(`openrouter: all ${attempts} attempts failed: ${lastErr?.message}`);
  }

  private async *parseNonStream(resp: Response): AsyncGenerator<StreamChunk> {
    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: Usage;
    };
    const choice = data.choices[0];
    if (!choice) return;
    const c: StreamChunk = { delta: choice.message.content ?? '', finishReason: choice.finish_reason };
    if (data.usage) c.usage = data.usage;
    yield c;
  }

  private async *parseSSE(resp: Response, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          let raw: SSEChunk;
          try {
            raw = JSON.parse(data) as SSEChunk;
          } catch {
            continue;
          }

          const chunk = parseSSEChunk(raw);
          if (chunk) yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

interface SSEChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning?: string; tool_calls?: ToolCall[] };
    finish_reason?: string | null;
  }>;
  usage?: Usage;
}

function parseSSEChunk(raw: SSEChunk): StreamChunk | null {
  const choice = raw.choices?.[0];
  const chunk: StreamChunk = { delta: choice?.delta?.content ?? '' };
  if (raw.usage) chunk.usage = raw.usage;
  if (!choice) return chunk.usage ? chunk : null;
  if (choice.finish_reason) chunk.finishReason = choice.finish_reason;
  const tc = choice.delta?.tool_calls?.[0];
  if (tc) chunk.toolCallDelta = tc;
  return chunk;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); });
  });
}

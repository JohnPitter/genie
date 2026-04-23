import { describe, it, expect } from 'vitest';
import { QueryLoop } from '../../src/agent/loop.ts';
import type { AgentEvent, Emitter } from '../../src/agent/loop.ts';
import { Registry } from '../../src/agent/tool.ts';
import type { OpenRouterClient, StreamChunk } from '../../src/agent/openrouter.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function makeLLM(chunks: StreamChunk[][]): OpenRouterClient {
  let call = 0;
  return {
    streamChat: async function* (_req, _signal) {
      const batch = chunks[call++ % chunks.length] ?? [];
      for (const c of batch) yield c;
    },
  } as unknown as OpenRouterClient;
}

function collectEvents(emitter: (emit: Emitter) => Promise<void>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  return emitter(e => { events.push(e); }).then(() => events);
}

describe('QueryLoop', () => {
  it('emits token events and message_end for a text-only response', async () => {
    const llm = makeLLM([[
      { delta: 'Hello' },
      { delta: ' world' },
      { delta: '', finishReason: 'stop', usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
    ]]);

    const reg = new Registry();
    const loop = new QueryLoop(llm, reg, 'test-model', nop);
    const events: AgentEvent[] = [];

    const messages = await loop.run([{ role: 'user', content: 'hi' }], e => { events.push(e); });

    const tokens = events.filter(e => e.type === 'token');
    expect(tokens).toHaveLength(2);
    expect((tokens[0] as { delta: string }).delta).toBe('Hello');
    expect((tokens[1] as { delta: string }).delta).toBe(' world');

    const end = events.find(e => e.type === 'message_end');
    expect(end).toBeDefined();

    const lastMsg = messages[messages.length - 1];
    expect(lastMsg?.role).toBe('assistant');
    expect(lastMsg?.content).toBe('Hello world');
  });

  it('executes a tool call and appends tool result to messages', async () => {
    const toolChunks: StreamChunk[] = [
      { delta: '', toolCallDelta: { index: 0, id: 'tc1', type: 'function', function: { name: 'echo', arguments: '{"msg":"hi"}' } } },
    ];
    const finalChunks: StreamChunk[] = [
      { delta: 'Done', finishReason: 'stop' },
    ];

    let call = 0;
    const llm = makeLLM([toolChunks, finalChunks]);
    void llm;

    const mockLLM = {
      streamChat: async function* (_req: unknown, _signal: unknown) {
        const batch = call++ === 0 ? toolChunks : finalChunks;
        for (const c of batch) yield c;
      },
    } as unknown as OpenRouterClient;

    const reg = new Registry();
    reg.register({
      name: 'echo',
      description: 'echoes',
      schema: {},
      concurrent: false,
      handler: async (args) => ({ echoed: (args as { msg: string }).msg }),
    });

    const loop = new QueryLoop(mockLLM, reg, 'test-model', nop);
    const events: AgentEvent[] = [];
    const messages = await loop.run([{ role: 'user', content: 'test' }], e => { events.push(e); });

    const toolStart = events.find(e => e.type === 'tool_call_start');
    expect(toolStart).toBeDefined();
    expect((toolStart as { toolName: string }).toolName).toBe('echo');

    const toolEnd = events.find(e => e.type === 'tool_call_end');
    expect(toolEnd).toBeDefined();

    const toolMsg = messages.find(m => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(JSON.parse(toolMsg!.content)).toMatchObject({ echoed: 'hi' });
  });

  it('returns error result for unknown tool without throwing', async () => {
    const toolChunks: StreamChunk[] = [
      { delta: '', toolCallDelta: { index: 0, id: 'tc1', type: 'function', function: { name: 'nonexistent', arguments: '{}' } } },
    ];
    const finalChunks: StreamChunk[] = [{ delta: 'OK', finishReason: 'stop' }];

    let call = 0;
    const mockLLM = {
      streamChat: async function* (_req: unknown, _signal: unknown) {
        const batch = call++ === 0 ? toolChunks : finalChunks;
        for (const c of batch) yield c;
      },
    } as unknown as OpenRouterClient;

    const reg = new Registry();
    const loop = new QueryLoop(mockLLM, reg, 'test-model', nop);
    const messages = await loop.run([{ role: 'user', content: 'test' }], () => {});

    const toolMsg = messages.find(m => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(JSON.parse(toolMsg!.content)).toMatchObject({ error: expect.stringContaining('not found') });
  });
});

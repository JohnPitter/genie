import type { Message, ToolCallRequest } from './message.ts';
import type { Registry } from './tool.ts';
import type { OpenRouterClient, Usage } from './openrouter.ts';
import { buildModelsChain } from './llm-fallback.ts';
import type { Logger } from 'pino';

const DEFAULT_MAX_STEPS = 20;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type AgentEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_call_start'; toolCallId: string; toolName: string; toolArgs?: unknown }
  | { type: 'tool_call_end'; toolCallId: string; toolName: string; toolResult?: unknown; durationMs: number }
  | { type: 'message_end'; usage?: TokenUsage }
  | { type: 'error'; error: string };

export type Emitter = (event: AgentEvent) => void | Promise<void>;

interface ToolCallBuilder {
  id: string;
  name: string;
  argsAccum: string;
}

export class QueryLoop {
  private readonly maxSteps: number;
  private readonly modelsChain: string[] | undefined;

  constructor(
    private readonly llm: OpenRouterClient,
    private readonly registry: Registry,
    private readonly model: string,
    private readonly log: Logger,
    opts: { maxSteps?: number; fallbackModels?: string[] | string } = {},
  ) {
    this.maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
    this.modelsChain = buildModelsChain(model, opts.fallbackModels);

    if (this.modelsChain && this.modelsChain.length > 1) {
      this.log.info(
        { primary: model, chain: this.modelsChain },
        'agent: model fallback chain active',
      );
    }
  }

  async run(
    messages: Message[],
    emit: Emitter,
    signal?: AbortSignal,
  ): Promise<Message[]> {
    const tools = this.registry.schemas();
    const modelsChain = this.modelsChain;

    for (let step = 0; step < this.maxSteps; step++) {
      if (signal?.aborted) return messages;

      this.log.debug({ step, messages: messages.length }, 'agent: loop step');

      const orMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map(tc => ({
                id: tc.id,
                type: tc.type,
                function: { name: tc.function.name, arguments: tc.function.arguments },
              })),
            }
          : {}),
        ...(m.name ? { name: m.name } : {}),
      }));

      const llmStart = Date.now();
      let firstTokenAt = 0;

      const stream = this.llm.streamChat(
        {
          model: this.model,
          ...(modelsChain ? { models: modelsChain } : {}),
          messages: orMessages,
          tools,
          stream: true,
        },
        signal,
      );

      let content = '';
      const builders = new Map<number, ToolCallBuilder>();
      let usage: Usage | undefined;

      for await (const chunk of stream) {
        if (firstTokenAt === 0 && (chunk.delta || chunk.toolCallDelta)) {
          firstTokenAt = Date.now();
        }

        if (chunk.delta) {
          content += chunk.delta;
          await emit({ type: 'token', delta: chunk.delta });
        }

        if (chunk.toolCallDelta) {
          const tc = chunk.toolCallDelta;
          const idx = tc.index ?? 0;
          let b = builders.get(idx);
          if (!b) {
            b = { id: '', name: '', argsAccum: '' };
            builders.set(idx, b);
          }
          if (tc.id) b.id = tc.id;
          if (tc.function?.name) b.name = tc.function.name;
          if (tc.function?.arguments) b.argsAccum += tc.function.arguments;
        }

        if (chunk.usage) usage = chunk.usage;
      }

      const llmMs = Date.now() - llmStart;
      const ttftMs = firstTokenAt > 0 ? firstTokenAt - llmStart : llmMs;

      const toolCalls: ToolCallRequest[] = [];
      for (let i = 0; i < builders.size; i++) {
        const b = builders.get(i);
        if (b) {
          toolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: b.argsAccum } });
        }
      }

      // Model returned empty content with no tool calls — it silently failed
      // (common with slow :free models under load). Emit a user-friendly fallback.
      if (toolCalls.length === 0 && content.trim() === '') {
        this.log.warn({ step, ttftMs, llmMs }, 'agent: model returned empty response — emitting fallback');
        const fallback = 'Não consegui gerar uma resposta agora. O modelo pode estar sobrecarregado — tente novamente em instantes.';
        await emit({ type: 'token', delta: fallback });
        await emit({ type: 'message_end' });
        await emit({ type: 'error', error: 'empty response from model' });
        return [...messages, { role: 'assistant', content: fallback }];
      }

      messages = [...messages, { role: 'assistant', content, ...(toolCalls.length ? { toolCalls } : {}) }];

      if (toolCalls.length === 0) {
        this.log.info(
          { step, ttftMs, llmMs, toolsMs: 0, totalMs: llmMs },
          'agent: step timing (final)',
        );
        const tu: TokenUsage | undefined = usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined;
        await emit({ type: 'message_end', ...(tu ? { usage: tu } : {}) });
        this.log.info({ step, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0 }, 'agent: finished');
        return messages;
      }

      const toolsStart = Date.now();
      const toolMessages = await this.executeTools(toolCalls, emit, signal);
      const toolsMs = Date.now() - toolsStart;

      this.log.info(
        { step, ttftMs, llmMs, toolsMs, totalMs: llmMs + toolsMs, toolCalls: toolCalls.length, tools: toolCalls.map(t => t.function.name) },
        'agent: step timing',
      );

      messages = [...messages, ...toolMessages];
    }

    // Max steps reached — give the user the partial context we have so far
    // rather than nothing. Emit the partial content as a fallback assistant msg.
    const fallback = 'Cheguei ao limite de passos sem conseguir uma resposta final. Os dados que consegui coletar estão acima; por favor, reformule a pergunta ou tente novamente.';
    await emit({ type: 'token', delta: fallback });
    await emit({ type: 'message_end' });
    await emit({ type: 'error', error: 'max steps reached' });
    return [...messages, { role: 'assistant', content: fallback }];
  }

  private async executeTools(
    calls: ToolCallRequest[],
    emit: Emitter,
    signal?: AbortSignal,
  ): Promise<Message[]> {
    const allConcurrent = calls.every(tc => this.registry.get(tc.function.name)?.concurrent ?? false);

    if (allConcurrent && calls.length > 1) {
      const ordered = new Array<Message>(calls.length);
      await Promise.all(
        calls.map(async (tc, i) => {
          ordered[i] = await this.executeSingle(tc, emit, signal);
        }),
      );
      return ordered;
    }

    const results: Message[] = [];
    for (const tc of calls) {
      results.push(await this.executeSingle(tc, emit, signal));
    }
    return results;
  }

  private async executeSingle(tc: ToolCallRequest, emit: Emitter, signal?: AbortSignal): Promise<Message> {
    const t0 = Date.now();

    let argsAny: unknown;
    try {
      argsAny = JSON.parse(tc.function.arguments);
    } catch {
      argsAny = tc.function.arguments;
    }

    await emit({ type: 'tool_call_start', toolCallId: tc.id, toolName: tc.function.name, toolArgs: argsAny });
    this.log.debug({ tool: tc.function.name, toolCallId: tc.id }, 'agent: tool call start');

    let result: unknown;
    const tool = this.registry.get(tc.function.name);
    if (!tool) {
      result = { error: `tool not found: ${tc.function.name}` };
    } else {
      try {
        result = await tool.handler(argsAny, signal);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    const durationMs = Date.now() - t0;
    this.log.debug({ tool: tc.function.name, toolCallId: tc.id, durationMs }, 'agent: tool call end');
    await emit({ type: 'tool_call_end', toolCallId: tc.id, toolName: tc.function.name, toolResult: result, durationMs });

    return {
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId: tc.id,
      name: tc.function.name,
    };
  }
}

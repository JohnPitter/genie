import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppDeps } from '../app.ts';
import { buildMessages, detectPromptInjection } from '../../agent/prompt.ts';
import { createConversation, appendMessage, getMessages } from '../../store/conversations.ts';
import type { Message } from '../../agent/message.ts';

const MAX_HISTORY = 20;

/** Split text into small chunks for streaming as fake tokens. */
function* chunkText(text: string, size: number): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

interface ChatStreamBody {
  conversationId?: string;
  message: string;
  contextData?: Record<string, string>;
}

export async function registerChatRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.post<{ Body: ChatStreamBody }>('/api/chat/stream', async (req: FastifyRequest<{ Body: ChatStreamBody }>, reply: FastifyReply) => {
    if (!deps.loop) return reply.status(503).send({ error: 'agent not available' });

    const { message, contextData } = req.body;
    let { conversationId } = req.body;

    if (!message?.trim()) {
      return reply.status(400).send({ error: 'message is required' });
    }

    // Detecta tentativas de prompt injection em linguagem natural.
    // Não bloqueamos (pode haver falso-positivo em perguntas legítimas) —
    // apenas logamos para telemetria; as defesas do prompt (sandwich +
    // sanitização + system rules) continuam ativas.
    const detection = detectPromptInjection(message);
    if (detection.suspicious) {
      deps.log.warn(
        { patterns: detection.patterns, preview: message.slice(0, 120), conversationId },
        'chat: possible prompt injection attempt detected',
      );
    }

    if (!conversationId) {
      conversationId = createConversation(deps.db, '');
    }

    // Load history — filtra apenas user/assistant. Se por algum motivo uma
    // mensagem de outra role foi persistida, ignoramos para prevenir que o
    // histórico seja usado como vetor de prompt injection.
    const dbMsgs = getMessages(deps.db, conversationId);
    const recent = dbMsgs.length > MAX_HISTORY ? dbMsgs.slice(-MAX_HISTORY) : dbMsgs;
    const history: Message[] = recent
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as Message['role'], content: m.content }));

    // buildMessages() sanitiza o input do usuário e filtra contextData
    // para whitelist — blinda contra prompt injection.
    const messages = buildMessages(history, message, contextData);

    // SSE headers — Fastify raw response
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendSSE = (data: unknown): void => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send conversation_start
    sendSSE({ type: 'conversation_start', conversationId });

    let finalMessages: Message[] = messages;
    try {
      finalMessages = await deps.loop.run(messages, sendSSE);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      deps.log.error({ err, conversationId }, 'chat: agent loop failed');

      // Friendly fallback: always give the user *something*, even on failure.
      const fallback =
        'Não consegui gerar uma resposta completa agora (possivelmente o modelo LLM está indisponível ou sobrecarregado). ' +
        'Tente novamente em alguns segundos, ou reformule a pergunta. Se preferir, consulte a cotação diretamente na aba do ativo.';

      // Stream the fallback as normal tokens so the user sees an answer
      for (const chunk of chunkText(fallback, 20)) {
        sendSSE({ type: 'token', delta: chunk });
      }
      sendSSE({ type: 'message_end' });
      sendSSE({ type: 'error', error: errMsg });

      // Record the fallback in history so the conversation stays coherent
      finalMessages = [...messages, { role: 'assistant', content: fallback }];
    }

    // Persist user + last assistant message
    try {
      appendMessage(deps.db, conversationId, 'user', message);
      for (let i = finalMessages.length - 1; i >= 0; i--) {
        const m = finalMessages[i]!;
        if (m.role === 'assistant' && m.content) {
          appendMessage(deps.db, conversationId, 'assistant', m.content);
          break;
        }
      }
    } catch (err) {
      deps.log.error({ err }, 'chat: persist failed');
    }

    reply.raw.end();
  });
}

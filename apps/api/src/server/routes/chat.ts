import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppDeps } from '../app.ts';
import { buildMessages } from '../../agent/prompt.ts';
import { createConversation, appendMessage, getMessages } from '../../store/conversations.ts';
import type { Message } from '../../agent/message.ts';

const MAX_HISTORY = 20;

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

    if (!conversationId) {
      conversationId = createConversation(deps.db, '');
    }

    // Load history
    const dbMsgs = getMessages(deps.db, conversationId);
    const recent = dbMsgs.length > MAX_HISTORY ? dbMsgs.slice(-MAX_HISTORY) : dbMsgs;
    const history: Message[] = recent.map(m => ({ role: m.role as Message['role'], content: m.content }));

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
      sendSSE({ type: 'error', error: err instanceof Error ? err.message : String(err) });
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

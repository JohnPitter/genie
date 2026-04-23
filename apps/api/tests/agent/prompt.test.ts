import { describe, it, expect } from 'vitest';
import { buildMessages, SYSTEM_PROMPT } from '../../src/agent/prompt.ts';

describe('buildMessages', () => {
  it('starts with system prompt', () => {
    const msgs = buildMessages([], 'hello');
    expect(msgs[0]?.role).toBe('system');
    expect(msgs[0]?.content).toBe(SYSTEM_PROMPT);
  });

  it('ends with the user message', () => {
    const msgs = buildMessages([], 'what is PETR4?');
    const last = msgs[msgs.length - 1];
    expect(last?.role).toBe('user');
    expect(last?.content).toBe('what is PETR4?');
  });

  it('includes history between system and user', () => {
    const history = [
      { role: 'user' as const, content: 'first question' },
      { role: 'assistant' as const, content: 'first answer' },
    ];
    const msgs = buildMessages(history, 'second question');
    // system, history[0], history[1], new user
    expect(msgs).toHaveLength(4);
    expect(msgs[1]?.content).toBe('first question');
    expect(msgs[2]?.content).toBe('first answer');
  });

  it('inserts context hint as second system message when provided', () => {
    const msgs = buildMessages([], 'hello', { ticker: 'PETR4', user: 'test' });
    expect(msgs[1]?.role).toBe('system');
    expect(msgs[1]?.content).toContain('PETR4');
    expect(msgs[1]?.content).toContain('ticker');
  });

  it('does not insert context hint when contextData is empty', () => {
    const msgs = buildMessages([], 'hello', {});
    // Only system + user
    expect(msgs).toHaveLength(2);
  });
});

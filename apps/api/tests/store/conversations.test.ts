import { describe, it, expect, beforeEach } from 'vitest';
import { openTestDB } from './helpers.ts';
import {
  createConversation,
  appendMessage,
  getMessages,
  listConversations,
} from '../../src/store/conversations.ts';
import type { DB } from '../../src/store/db.ts';

let db: DB;

beforeEach(() => {
  db = openTestDB();
});

describe('createConversation', () => {
  it('returns a non-empty 32-char hex ID', () => {
    const id = createConversation(db, 'Test');
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it('each call returns a unique ID', () => {
    const id1 = createConversation(db, 'A');
    const id2 = createConversation(db, 'B');
    expect(id1).not.toBe(id2);
  });
});

describe('appendMessage + getMessages', () => {
  it('returns messages in chronological order', () => {
    const id = createConversation(db, 'Chat');

    appendMessage(db, id, 'user', JSON.stringify({ text: 'hello' }));
    appendMessage(db, id, 'assistant', JSON.stringify({ text: 'hi' }));
    appendMessage(db, id, 'user', JSON.stringify({ text: 'how are you?' }));

    const msgs = getMessages(db, id);
    expect(msgs).toHaveLength(3);
    expect(msgs[0]?.role).toBe('user');
    expect(msgs[1]?.role).toBe('assistant');
    expect(msgs[2]?.role).toBe('user');
    expect(msgs[0]?.content).toBe(JSON.stringify({ text: 'hello' }));
  });

  it('returns empty array for conversation with no messages', () => {
    const id = createConversation(db, 'Empty');
    const msgs = getMessages(db, id);
    expect(msgs).toHaveLength(0);
  });

  it('returns empty array for unknown conversation ID', () => {
    const msgs = getMessages(db, 'nonexistent-id');
    expect(msgs).toHaveLength(0);
  });
});

describe('listConversations', () => {
  it('supports limit and offset pagination', () => {
    for (let i = 0; i < 5; i++) {
      createConversation(db, `Conv ${i + 1}`);
    }

    const page1 = listConversations(db, 3, 0);
    expect(page1).toHaveLength(3);

    const page2 = listConversations(db, 3, 3);
    expect(page2).toHaveLength(2);
  });

  it('returns conversations ordered by updated_at desc', () => {
    const id1 = createConversation(db, 'First');
    const id2 = createConversation(db, 'Second');

    // Append a message to id1 so it gets a newer updated_at
    appendMessage(db, id1, 'user', '"ping"');

    const list = listConversations(db, 10, 0);
    expect(list[0]?.id).toBe(id1);
    expect(list[1]?.id).toBe(id2);
  });

  it('returns empty array when no conversations exist', () => {
    const list = listConversations(db, 10, 0);
    expect(list).toHaveLength(0);
  });

  it('populates createdAt and updatedAt', () => {
    createConversation(db, 'Timestamps');
    const [conv] = listConversations(db, 1, 0);
    expect(conv?.createdAt).toBeTruthy();
    expect(conv?.updatedAt).toBeTruthy();
  });
});

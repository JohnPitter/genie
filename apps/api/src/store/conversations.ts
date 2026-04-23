import { randomBytes } from 'node:crypto';
import type { DB } from './db.ts';

export interface Message {
  id: number;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export function createConversation(db: DB, title: string): string {
  const id = generateId();
  db.prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(id, title);
  return id;
}

export function appendMessage(db: DB, conversationId: string, role: string, contentJson: string): void {
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
    conversationId,
    role,
    contentJson,
  );
  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
}

export function getMessages(db: DB, conversationId: string): Message[] {
  return db
    .prepare<string, Message>(
      `SELECT id, conversation_id as conversationId, role, content, created_at as createdAt
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(conversationId);
}

export function listConversations(db: DB, limit: number, offset: number): Conversation[] {
  return db
    .prepare<[number, number], Conversation>(
      `SELECT id, title, created_at as createdAt, updated_at as updatedAt
       FROM conversations
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset);
}

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const favorites = sqliteTable('favorites', {
  ticker: text('ticker').primaryKey(),
  addedAt: text('added_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastNewsAt: text('last_news_at'),
});

export const newsCache = sqliteTable('news_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  source: text('source'),
  summary: text('summary'),
  publishedAt: text('published_at'),
  fetchedAt: text('fetched_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const newsArticles = sqliteTable('news_articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  source: text('source'),
  summary: text('summary'),
  tickersJson: text('tickers_json').notNull().default('[]'),
  category: text('category'),
  publishedAt: text('published_at'),
  fetchedAt: text('fetched_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

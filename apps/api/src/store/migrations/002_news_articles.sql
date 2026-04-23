-- Migration 002: news_articles table with multi-ticker support.
-- news_cache remains for backward compatibility; new code uses news_articles.

CREATE TABLE IF NOT EXISTS news_articles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    url          TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    source       TEXT,
    summary      TEXT,
    tickers_json TEXT NOT NULL DEFAULT '[]',  -- JSON array of ticker strings
    category     TEXT,
    published_at DATETIME,
    fetched_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_articles_fetched ON news_articles(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category, fetched_at DESC);

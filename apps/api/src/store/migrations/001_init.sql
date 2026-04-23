CREATE TABLE IF NOT EXISTS favorites (
    ticker       TEXT PRIMARY KEY,
    added_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_news_at DATETIME
);

CREATE TABLE IF NOT EXISTS news_cache (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker       TEXT NOT NULL,
    url          TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    source       TEXT,
    summary      TEXT,
    published_at DATETIME,
    fetched_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_ticker ON news_cache(ticker, published_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

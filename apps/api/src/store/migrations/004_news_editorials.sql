-- Migration 004: news_editorials — editoriais financeiros gerados por IA
-- 4 edições/dia (08, 12, 16, 20 BRT). Falhas não inserem; UI cai na última válida.

CREATE TABLE IF NOT EXISTS news_editorials (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    slot             TEXT NOT NULL,                  -- '08' | '12' | '16' | '20' (hora BRT)
    edition_date     TEXT NOT NULL,                  -- 'YYYY-MM-DD' (data BRT da edição)
    period_start     DATETIME NOT NULL,              -- início do período coberto (UTC)
    period_end       DATETIME NOT NULL,              -- fim do período coberto (UTC)
    lead_title       TEXT NOT NULL,
    lead_body        TEXT NOT NULL,
    sections_json    TEXT NOT NULL,                  -- EditorialSection[]
    article_ids_json TEXT NOT NULL DEFAULT '[]',     -- ids referenciados (lookup rápido)
    model_used       TEXT,
    tokens_used      INTEGER,
    generated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(edition_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_editorials_generated ON news_editorials(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorials_date_slot ON news_editorials(edition_date DESC, slot DESC);

-- Predições IA: cache do screener + histórico de acurácia
CREATE TABLE IF NOT EXISTS predictions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker         TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  price          REAL    NOT NULL,
  change_pct     REAL    NOT NULL,
  signal         TEXT    NOT NULL,     -- compra_forte | compra | neutro | venda | venda_forte
  score          INTEGER NOT NULL,      -- -6 to +6
  confidence     TEXT    NOT NULL,     -- baixa | media | alta
  votes_json     TEXT    NOT NULL,     -- [{name, vote, rationale}, ...]
  backtest_accuracy REAL,               -- 0-100 accuracy from last 60d backtest
  backtest_total    INTEGER,            -- total predictions in backtest window
  rationale      TEXT,                  -- short LLM summary (1-2 phrases)
  computed_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_predictions_ticker_computed
  ON predictions(ticker, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_computed
  ON predictions(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_signal_score
  ON predictions(signal, score DESC);

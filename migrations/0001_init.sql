-- 미사 메타 + 전체 MassSession JSON
CREATE TABLE IF NOT EXISTS masses (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_masses_scheduled ON masses (scheduled_at);

-- 에셋 메타 (바이너리는 asset_chunks)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  byte_length INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS asset_chunks (
  asset_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  PRIMARY KEY (asset_id, chunk_index),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_chunks_asset ON asset_chunks (asset_id);

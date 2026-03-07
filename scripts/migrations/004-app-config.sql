-- app_config: key-value 設定テーブル（自動化設定等）
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期値: 自動化設定
INSERT INTO app_config (key, value)
VALUES ('automation_config', '{"dailyPipeline": true, "pdcaBatch": true, "autoRewrite": false}')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON app_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

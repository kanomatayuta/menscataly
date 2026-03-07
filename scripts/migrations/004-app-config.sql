-- ============================================================
-- Migration 004: app_config テーブル (キー・バリュー設定ストア)
-- ============================================================
-- 用途: 自動化設定、サイト設定などをJSON形式で保存
-- ============================================================

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_config IS 'アプリケーション設定 (key-value)';

-- デフォルトの自動化設定を挿入（安全なデフォルト: すべて無効）
INSERT INTO app_config (key, value)
VALUES ('automation_config', '{"dailyPipeline": false, "pdcaBatch": false, "autoRewrite": false, "enabledCategories": ["aga", "hair-removal", "skincare", "ed", "column"]}')
ON CONFLICT (key) DO NOTHING;

-- RLS ポリシー
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- service_role: フルアクセス
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_role_full_access_app_config'
      AND tablename = 'app_config'
  ) THEN
    CREATE POLICY "service_role_full_access_app_config"
      ON app_config FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- authenticated: 読み取りのみ
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_select_app_config'
      AND tablename = 'app_config'
  ) THEN
    CREATE POLICY "authenticated_select_app_config"
      ON app_config FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

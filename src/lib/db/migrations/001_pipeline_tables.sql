-- ============================================================
-- Migration: 001_pipeline_tables
-- パイプライン実行管理テーブルの追加
-- 既存の schema.sql は変更しない
-- ============================================================

-- ============================================================
-- ENUM 型
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_status') THEN
    CREATE TYPE pipeline_status AS ENUM (
      'idle',
      'running',
      'success',
      'failed',
      'partial'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_type') THEN
    CREATE TYPE pipeline_type AS ENUM (
      'daily',
      'pdca',
      'manual'
    );
  END IF;
END$$;

-- ============================================================
-- pipeline_runs テーブル
-- パイプライン実行履歴を管理する
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         TEXT NOT NULL CHECK (type IN ('daily', 'pdca', 'manual')),
  status       TEXT NOT NULL CHECK (status IN ('idle', 'running', 'success', 'failed', 'partial'))
               DEFAULT 'idle',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  steps_json   JSONB NOT NULL DEFAULT '[]',   -- StepLog[] の JSON 配列
  error        TEXT,                           -- エラーメッセージ (失敗時)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pipeline_runs IS 'パイプライン実行履歴';
COMMENT ON COLUMN pipeline_runs.id IS 'ランID (UUID)';
COMMENT ON COLUMN pipeline_runs.type IS 'パイプライン種別 (daily/pdca/manual)';
COMMENT ON COLUMN pipeline_runs.status IS '実行ステータス';
COMMENT ON COLUMN pipeline_runs.started_at IS '実行開始時刻';
COMMENT ON COLUMN pipeline_runs.completed_at IS '実行完了時刻 (NULL=実行中)';
COMMENT ON COLUMN pipeline_runs.steps_json IS 'ステップログのJSON配列';
COMMENT ON COLUMN pipeline_runs.error IS 'エラーメッセージ';

-- ============================================================
-- pipeline_logs テーブル
-- パイプライン実行の詳細ログを管理する
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id      UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')) DEFAULT 'info',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pipeline_logs IS 'パイプライン実行詳細ログ';
COMMENT ON COLUMN pipeline_logs.run_id IS '紐付くパイプラインランID';
COMMENT ON COLUMN pipeline_logs.step_name IS 'ステップ名';
COMMENT ON COLUMN pipeline_logs.level IS 'ログレベル (info/warn/error)';
COMMENT ON COLUMN pipeline_logs.message IS 'ログメッセージ';

-- ============================================================
-- インデックス
-- ============================================================

-- pipeline_runs
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type
  ON pipeline_runs(type);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status
  ON pipeline_runs(status);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at
  ON pipeline_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type_started
  ON pipeline_runs(type, started_at DESC);

-- pipeline_logs
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_run_id
  ON pipeline_logs(run_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created_at
  ON pipeline_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_level
  ON pipeline_logs(level);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

-- service_role は RLS をデフォルトでバイパスするため追加ポリシー不要

-- anon ロール: アクセス不可 (セキュリティ上パイプライン情報は非公開)
-- authenticated ロール: SELECT のみ (管理者確認用)
CREATE POLICY IF NOT EXISTS "authenticated_select_pipeline_runs"
  ON pipeline_runs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "authenticated_select_pipeline_logs"
  ON pipeline_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- ビュー: パイプライン実行サマリー
-- ============================================================

CREATE OR REPLACE VIEW v_pipeline_summary AS
SELECT
  type,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'success') AS successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  COUNT(*) FILTER (WHERE status = 'running') AS running_runs,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0),
    2
  ) AS success_rate_pct,
  MAX(started_at) AS last_run_at,
  AVG(
    EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
  ) FILTER (WHERE completed_at IS NOT NULL) AS avg_duration_ms
FROM pipeline_runs
GROUP BY type;

COMMENT ON VIEW v_pipeline_summary IS 'パイプライン種別ごとの実行サマリー';

-- ============================================================
-- Migration: 002_phase2_tables
-- Phase 2 テーブル追加: コスト管理、アラート、バッチ生成、レビューキュー、ASPプログラム
-- ============================================================

-- ============================================================
-- generation_costs テーブル
-- AI生成コストの追跡
-- ============================================================

CREATE TABLE IF NOT EXISTS generation_costs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID,
  article_id    UUID REFERENCES articles(id) ON DELETE SET NULL,
  cost_type     TEXT NOT NULL CHECK (cost_type IN ('article_generation', 'image_generation', 'analysis', 'compliance_check')),
  input_tokens  INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  model         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE generation_costs IS 'AI生成コスト追跡';
COMMENT ON COLUMN generation_costs.cost_type IS 'コスト種別 (article_generation/image_generation/analysis/compliance_check)';
COMMENT ON COLUMN generation_costs.input_tokens IS '入力トークン数';
COMMENT ON COLUMN generation_costs.output_tokens IS '出力トークン数';
COMMENT ON COLUMN generation_costs.cost_usd IS 'USD換算コスト';
COMMENT ON COLUMN generation_costs.model IS '使用モデル名';

-- ============================================================
-- monitoring_alerts テーブル
-- システムモニタリングアラート管理
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  status          TEXT NOT NULL CHECK (status IN ('active', 'acknowledged', 'resolved'))
                  DEFAULT 'active',
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

COMMENT ON TABLE monitoring_alerts IS 'システムモニタリングアラート';
COMMENT ON COLUMN monitoring_alerts.type IS 'アラート種別 (pipeline_failure/compliance_violation/cost_threshold/performance_degradation/api_error)';
COMMENT ON COLUMN monitoring_alerts.severity IS '重要度 (critical/warning/info)';
COMMENT ON COLUMN monitoring_alerts.status IS 'ステータス (active/acknowledged/resolved)';

-- ============================================================
-- batch_generation_jobs テーブル
-- バッチ記事生成ジョブ管理
-- ============================================================

CREATE TABLE IF NOT EXISTS batch_generation_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
                  DEFAULT 'queued',
  total_keywords  INT NOT NULL,
  completed_count INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  total_cost_usd  NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_by      TEXT NOT NULL,
  error_messages  JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE batch_generation_jobs IS 'バッチ記事生成ジョブ';
COMMENT ON COLUMN batch_generation_jobs.total_keywords IS '対象キーワード総数';
COMMENT ON COLUMN batch_generation_jobs.completed_count IS '完了数';
COMMENT ON COLUMN batch_generation_jobs.failed_count IS '失敗数';
COMMENT ON COLUMN batch_generation_jobs.total_cost_usd IS '合計コスト (USD)';

-- ============================================================
-- article_review_queue テーブル
-- 記事レビューキュー
-- ============================================================

CREATE TABLE IF NOT EXISTS article_review_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  microcms_id      TEXT,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL,
  category         TEXT NOT NULL,
  compliance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected'))
                   DEFAULT 'pending',
  author_name      TEXT NOT NULL DEFAULT 'MENS CATALY 編集部',
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      TEXT,
  review_notes     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE article_review_queue IS '記事レビューキュー';
COMMENT ON COLUMN article_review_queue.compliance_score IS 'コンプライアンススコア (0-100)';
COMMENT ON COLUMN article_review_queue.status IS 'レビューステータス (pending/approved/rejected)';

-- ============================================================
-- asp_programs テーブル
-- ASPアフィリエイトプログラム管理
-- ============================================================

CREATE TABLE IF NOT EXISTS asp_programs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asp_name            TEXT NOT NULL,
  program_name        TEXT NOT NULL,
  program_id          TEXT NOT NULL,
  category            TEXT NOT NULL,
  affiliate_url       TEXT NOT NULL,
  reward_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  reward_type         TEXT NOT NULL DEFAULT 'fixed',
  approval_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  epc                 NUMERIC(10,4) NOT NULL DEFAULT 0,
  itp_support         BOOLEAN NOT NULL DEFAULT FALSE,
  cookie_duration     INT NOT NULL DEFAULT 30,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  recommended_anchors JSONB NOT NULL DEFAULT '[]',
  landing_page_url    TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE asp_programs IS 'ASPアフィリエイトプログラム';
COMMENT ON COLUMN asp_programs.asp_name IS 'ASP名 (afb/a8/accesstrade/valuecommerce/felmat)';
COMMENT ON COLUMN asp_programs.reward_amount IS '報酬金額 (円)';
COMMENT ON COLUMN asp_programs.approval_rate IS '承認率 (0-100)';
COMMENT ON COLUMN asp_programs.epc IS 'EPC (Earnings Per Click)';
COMMENT ON COLUMN asp_programs.itp_support IS 'ITP対応状況';

-- ============================================================
-- インデックス
-- ============================================================

-- generation_costs
CREATE INDEX IF NOT EXISTS idx_generation_costs_job_id
  ON generation_costs(job_id);

CREATE INDEX IF NOT EXISTS idx_generation_costs_article_id
  ON generation_costs(article_id);

CREATE INDEX IF NOT EXISTS idx_generation_costs_cost_type
  ON generation_costs(cost_type);

CREATE INDEX IF NOT EXISTS idx_generation_costs_created_at
  ON generation_costs(created_at DESC);

-- monitoring_alerts
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type
  ON monitoring_alerts(type);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity
  ON monitoring_alerts(severity);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_status
  ON monitoring_alerts(status);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at
  ON monitoring_alerts(created_at DESC);

-- batch_generation_jobs
CREATE INDEX IF NOT EXISTS idx_batch_generation_jobs_status
  ON batch_generation_jobs(status);

CREATE INDEX IF NOT EXISTS idx_batch_generation_jobs_created_by
  ON batch_generation_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_batch_generation_jobs_started_at
  ON batch_generation_jobs(started_at DESC);

-- article_review_queue
CREATE INDEX IF NOT EXISTS idx_article_review_queue_article_id
  ON article_review_queue(article_id);

CREATE INDEX IF NOT EXISTS idx_article_review_queue_status
  ON article_review_queue(status);

CREATE INDEX IF NOT EXISTS idx_article_review_queue_category
  ON article_review_queue(category);

CREATE INDEX IF NOT EXISTS idx_article_review_queue_generated_at
  ON article_review_queue(generated_at DESC);

-- asp_programs
CREATE INDEX IF NOT EXISTS idx_asp_programs_asp_name
  ON asp_programs(asp_name);

CREATE INDEX IF NOT EXISTS idx_asp_programs_category
  ON asp_programs(category);

CREATE INDEX IF NOT EXISTS idx_asp_programs_is_active
  ON asp_programs(is_active);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE generation_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE asp_programs ENABLE ROW LEVEL SECURITY;

-- service_role は RLS をデフォルトでバイパスするため追加ポリシー不要

-- authenticated ロール: SELECT のみ (管理画面用)
CREATE POLICY IF NOT EXISTS "authenticated_select_generation_costs"
  ON generation_costs FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "authenticated_select_monitoring_alerts"
  ON monitoring_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "authenticated_select_batch_generation_jobs"
  ON batch_generation_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "authenticated_select_article_review_queue"
  ON article_review_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "authenticated_select_asp_programs"
  ON asp_programs FOR SELECT TO authenticated USING (true);

-- ============================================================
-- ビュー: v_cost_summary
-- コスト種別・月別の集計サマリ
-- ============================================================

CREATE OR REPLACE VIEW v_cost_summary AS
SELECT
  cost_type,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS record_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(cost_usd) AS avg_cost_usd
FROM generation_costs
GROUP BY cost_type, DATE_TRUNC('month', created_at)
ORDER BY month DESC, cost_type;

COMMENT ON VIEW v_cost_summary IS 'コスト種別・月別集計サマリ';

-- ============================================================
-- ビュー: v_revenue_by_asp
-- ASP別のアフィリエイトリンク収益集計
-- (affiliate_links テーブルが未作成の場合、asp_programs ベースの集計)
-- ============================================================

CREATE OR REPLACE VIEW v_revenue_by_asp AS
SELECT
  asp_name,
  COUNT(*) AS program_count,
  SUM(reward_amount) AS total_potential_reward,
  AVG(approval_rate) AS avg_approval_rate,
  AVG(epc) AS avg_epc,
  COUNT(*) FILTER (WHERE itp_support = TRUE) AS itp_supported_count
FROM asp_programs
WHERE is_active = TRUE
GROUP BY asp_name
ORDER BY avg_epc DESC;

COMMENT ON VIEW v_revenue_by_asp IS 'ASP別収益集計';

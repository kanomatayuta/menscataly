-- ============================================================
-- MENS CATALY - Consolidated Supabase Migration
-- ============================================================
--
-- This script combines all migrations into a single idempotent file.
-- Sources:
--   - src/lib/db/schema.sql (v2.0 base schema)
--   - src/lib/db/migrations/001_pipeline_tables.sql
--   - src/lib/db/migrations/002_phase2_tables.sql
--   - src/lib/db/migrations/003_phase3b_compliance_queue.sql
--
-- All statements use IF NOT EXISTS / IF EXISTS guards so this script
-- can be run multiple times safely (idempotent).
--
-- Usage:
--   psql $DATABASE_URL -f scripts/migrate-supabase.sql
-- ============================================================

-- ============================================================
-- 1. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 2. ENUM Types
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_status') THEN
    CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_status') THEN
    CREATE TYPE pipeline_status AS ENUM (
      'idle', 'running', 'success', 'failed', 'partial'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_type') THEN
    CREATE TYPE pipeline_type AS ENUM (
      'daily', 'pdca', 'manual'
    );
  END IF;
END$$;

-- ============================================================
-- 3. Base Tables (from schema.sql)
-- ============================================================

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE categories IS 'カテゴリマスタ';

-- articles
CREATE TABLE IF NOT EXISTS articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  microcms_id     TEXT UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  content         TEXT,
  excerpt         TEXT,
  category        TEXT NOT NULL DEFAULT 'uncategorized',
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  status          article_status NOT NULL DEFAULT 'draft',
  seo_title       TEXT,
  seo_description TEXT,
  author_name     TEXT NOT NULL DEFAULT 'MENS CATALY 編集部',
  quality_score   NUMERIC(5, 2) NOT NULL DEFAULT 0,
  pv_count        INTEGER NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE articles IS '記事テーブル (microCMS同期 + 分析データ保持)';

-- keywords
CREATE TABLE IF NOT EXISTS keywords (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword       TEXT NOT NULL,
  search_volume INTEGER NOT NULL DEFAULT 0,
  difficulty    NUMERIC(5, 2) NOT NULL DEFAULT 0,
  trend_score   NUMERIC(5, 2) NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'general',
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  tracked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (keyword, category)
);
COMMENT ON TABLE keywords IS 'キーワード調査データ';

-- analytics_daily
CREATE TABLE IF NOT EXISTS analytics_daily (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id   UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  pageviews    INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  avg_time     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bounce_rate  NUMERIC(5, 4) NOT NULL DEFAULT 0,
  ctr          NUMERIC(5, 4) NOT NULL DEFAULT 0,
  conversions  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, date)
);
COMMENT ON TABLE analytics_daily IS '記事別日次アナリティクス';

-- affiliate_links
CREATE TABLE IF NOT EXISTS affiliate_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE SET NULL,
  asp_name          TEXT NOT NULL,
  program_name      TEXT NOT NULL,
  url               TEXT NOT NULL,
  click_count       INTEGER NOT NULL DEFAULT 0,
  conversion_count  INTEGER NOT NULL DEFAULT 0,
  revenue           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE affiliate_links IS 'ASPアフィリエイトリンク管理';

-- compliance_logs
CREATE TABLE IF NOT EXISTS compliance_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE,
  check_type  TEXT NOT NULL CHECK (check_type IN ('yakuji_ho', 'keihyo_ho', 'ymyl', 'stealth_marketing')),
  result      TEXT NOT NULL CHECK (result IN ('passed', 'warning', 'failed')),
  violations  JSONB NOT NULL DEFAULT '[]',
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE compliance_logs IS '薬機法・景表法コンプライアンスチェックログ';

-- ============================================================
-- 4. Pipeline Tables (from 001_pipeline_tables.sql)
-- ============================================================

-- pipeline_runs
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         TEXT NOT NULL CHECK (type IN ('daily', 'pdca', 'manual')),
  status       TEXT NOT NULL CHECK (status IN ('idle', 'running', 'success', 'failed', 'partial'))
               DEFAULT 'idle',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  steps_json   JSONB NOT NULL DEFAULT '[]',
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE pipeline_runs IS 'パイプライン実行履歴';

-- pipeline_logs
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id      UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')) DEFAULT 'info',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE pipeline_logs IS 'パイプライン実行詳細ログ';

-- ============================================================
-- 5. Phase 2 Tables (from 002_phase2_tables.sql)
-- ============================================================

-- generation_costs
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

-- monitoring_alerts
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

-- batch_generation_jobs
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

-- article_review_queue
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

-- asp_programs
CREATE TABLE IF NOT EXISTS asp_programs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asp_name            TEXT NOT NULL,
  program_name        TEXT NOT NULL,
  program_id          TEXT NOT NULL UNIQUE,
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

-- ============================================================
-- 6. Phase 3b Constraints (from 003_phase3b_compliance_queue.sql)
-- ============================================================

-- slug にユニーク制約を追加 (upsert の onConflict に必要)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'article_review_queue_slug_key'
  ) THEN
    ALTER TABLE article_review_queue ADD CONSTRAINT article_review_queue_slug_key UNIQUE (slug);
  END IF;
END $$;

-- program_id にユニーク制約を追加 (upsert の onConflict に必要)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'asp_programs_program_id_key'
  ) THEN
    ALTER TABLE asp_programs ADD CONSTRAINT asp_programs_program_id_key UNIQUE (program_id);
  END IF;
END $$;

COMMENT ON COLUMN article_review_queue.review_notes IS 'JSON形式のレビューメモ: decision, reason, eeatScore, violationCount, runId, queueStatus, retryCount';

-- ============================================================
-- 7. Indexes
-- ============================================================

-- articles
CREATE INDEX IF NOT EXISTS idx_articles_status         ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category       ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_category_id    ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at   ON articles(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_microcms_id    ON articles(microcms_id) WHERE microcms_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_updated_at     ON articles(updated_at DESC);

-- keywords
CREATE INDEX IF NOT EXISTS idx_keywords_category       ON keywords(category);
CREATE INDEX IF NOT EXISTS idx_keywords_search_volume  ON keywords(search_volume DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_tracked_at     ON keywords(tracked_at DESC);

-- analytics_daily
CREATE INDEX IF NOT EXISTS idx_analytics_article_date  ON analytics_daily(article_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_date          ON analytics_daily(date DESC);

-- affiliate_links
CREATE INDEX IF NOT EXISTS idx_affiliate_article_id    ON affiliate_links(article_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_asp_name      ON affiliate_links(asp_name);

-- compliance_logs
CREATE INDEX IF NOT EXISTS idx_compliance_article_id   ON compliance_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checked_at   ON compliance_logs(checked_at DESC);

-- full-text search (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm     ON articles USING gin(title gin_trgm_ops);

-- pipeline_runs
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type       ON pipeline_runs(type);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status     ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type_started ON pipeline_runs(type, started_at DESC);

-- pipeline_logs
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_run_id     ON pipeline_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created_at ON pipeline_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_level      ON pipeline_logs(level);

-- generation_costs
CREATE INDEX IF NOT EXISTS idx_generation_costs_job_id      ON generation_costs(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_costs_article_id   ON generation_costs(article_id);
CREATE INDEX IF NOT EXISTS idx_generation_costs_cost_type    ON generation_costs(cost_type);
CREATE INDEX IF NOT EXISTS idx_generation_costs_created_at   ON generation_costs(created_at DESC);

-- monitoring_alerts
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type        ON monitoring_alerts(type);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity     ON monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_status       ON monitoring_alerts(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at   ON monitoring_alerts(created_at DESC);

-- batch_generation_jobs
CREATE INDEX IF NOT EXISTS idx_batch_generation_jobs_status      ON batch_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_generation_jobs_created_by  ON batch_generation_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_batch_generation_jobs_started_at  ON batch_generation_jobs(started_at DESC);

-- article_review_queue
CREATE INDEX IF NOT EXISTS idx_article_review_queue_article_id    ON article_review_queue(article_id);
CREATE INDEX IF NOT EXISTS idx_article_review_queue_status        ON article_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_article_review_queue_category      ON article_review_queue(category);
CREATE INDEX IF NOT EXISTS idx_article_review_queue_generated_at  ON article_review_queue(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_review_queue_slug          ON article_review_queue(slug);

-- asp_programs
CREATE INDEX IF NOT EXISTS idx_asp_programs_asp_name   ON asp_programs(asp_name);
CREATE INDEX IF NOT EXISTS idx_asp_programs_category   ON asp_programs(category);
CREATE INDEX IF NOT EXISTS idx_asp_programs_is_active  ON asp_programs(is_active);

-- ============================================================
-- 8. Triggers
-- ============================================================

-- updated_at 自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルに適用
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['articles', 'categories', 'keywords', 'affiliate_links', 'asp_programs'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || t || '_updated_at'
        AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END$$;

-- ============================================================
-- 9. Views
-- ============================================================

-- 記事パフォーマンス集計 (30日間)
CREATE OR REPLACE VIEW v_article_performance AS
SELECT
  a.id,
  a.microcms_id,
  a.slug,
  a.title,
  a.category,
  a.status,
  a.quality_score,
  a.pv_count,
  COALESCE(SUM(ad.pageviews), 0)    AS total_pv_30d,
  COALESCE(AVG(ad.ctr), 0)          AS avg_ctr_30d,
  COALESCE(SUM(ad.conversions), 0)  AS total_conversions_30d,
  a.published_at,
  a.updated_at
FROM articles a
LEFT JOIN analytics_daily ad
  ON ad.article_id = a.id
  AND ad.date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY a.id;

-- コンプライアンス最新ステータス
CREATE OR REPLACE VIEW v_compliance_status AS
SELECT DISTINCT ON (cl.article_id, cl.check_type)
  cl.article_id,
  a.title,
  cl.check_type,
  cl.result,
  cl.violations,
  cl.checked_at
FROM compliance_logs cl
JOIN articles a ON a.id = cl.article_id
ORDER BY cl.article_id, cl.check_type, cl.checked_at DESC;

-- パイプライン実行サマリー
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

-- コスト種別・月別集計
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

-- ASP別収益集計
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

-- ============================================================
-- 10. Row Level Security (RLS)
-- ============================================================

-- RLS有効化 (IF NOT EXISTS は ALTER TABLE ENABLE RLS にはないが、再実行しても問題なし)
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords        ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_costs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_review_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asp_programs          ENABLE ROW LEVEL SECURITY;

-- service_role は RLS をデフォルトでバイパスするため追加ポリシー不要

-- anon ロール: articles / categories の SELECT のみ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_published_articles' AND tablename = 'articles') THEN
    CREATE POLICY "anon_select_published_articles" ON articles FOR SELECT TO anon USING (status = 'published');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_categories' AND tablename = 'categories') THEN
    CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- authenticated ロール
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_articles' AND tablename = 'articles') THEN
    CREATE POLICY "authenticated_select_articles" ON articles FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_categories' AND tablename = 'categories') THEN
    CREATE POLICY "authenticated_select_categories" ON categories FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Pipeline: authenticated SELECT
CREATE POLICY IF NOT EXISTS "authenticated_select_pipeline_runs"
  ON pipeline_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "authenticated_select_pipeline_logs"
  ON pipeline_logs FOR SELECT TO authenticated USING (true);

-- Phase 2 tables: authenticated SELECT
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
-- 11. Seed Data (カテゴリマスタ)
-- ============================================================

INSERT INTO categories (name, slug, description, display_order) VALUES
  ('AGA・薄毛治療',    'aga',           'AGA治療・発毛・育毛関連',     1),
  ('ED・性機能',       'ed',            'ED治療・性機能改善関連',       2),
  ('脱毛・ヒゲ',       'hair-removal',  '医療脱毛・ヒゲ脱毛関連',       3),
  ('スキンケア・美容', 'skincare',      'メンズスキンケア・美容医療',   4),
  ('ダイエット・健康', 'diet',          'メンズダイエット・健康管理',   5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Done
-- ============================================================

-- ============================================================
-- MENS CATALY - Consolidated Supabase Migration (v2.0 Improved)
-- ============================================================
--
-- This script combines all migrations into a single idempotent file.
-- v2.0 improvements (Phase 4 review):
--   - FK追加: generation_costs.job_id, affiliate_links.program_id
--   - 新テーブル: article_keywords (記事↔キーワード追跡), audit_log (監査ログ), schema_migrations
--   - articles.primary_keyword_id FK追加
--   - 複合インデックス追加 (review_queue, compliance_logs, pipeline_logs)
--   - NUMERIC列のCHECK制約追加
--   - UUID生成関数の統一 (uuid_generate_v4)
--   - anon用 asp_programs SELECTポリシー追加
--   - カテゴリシードに column 追加
--
-- All statements use IF NOT EXISTS / IF EXISTS guards (idempotent).
--
-- Usage:
--   Supabase SQL Editor にペーストして Run
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
-- 3. Schema Migrations Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT
);
COMMENT ON TABLE schema_migrations IS 'マイグレーションバージョン管理';

INSERT INTO schema_migrations (version, description) VALUES
  ('001', 'Base schema + pipeline tables'),
  ('002', 'Phase 2: costs, alerts, batch, review, ASP'),
  ('003', 'Phase 3b: compliance queue slug unique'),
  ('004', 'Phase 4: FK追加, article_keywords, audit_log, CHECK制約, 複合インデックス')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 4. Base Tables
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
-- 5. Pipeline Tables
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
-- 6. Phase 2 Tables
-- ============================================================

-- batch_generation_jobs (generation_costsより先に作成 — FK参照のため)
CREATE TABLE IF NOT EXISTS batch_generation_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- generation_costs (batch_generation_jobs の後に作成)
CREATE TABLE IF NOT EXISTS generation_costs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID REFERENCES batch_generation_jobs(id) ON DELETE CASCADE,
  article_id    UUID REFERENCES articles(id) ON DELETE SET NULL,
  cost_type     TEXT NOT NULL CHECK (cost_type IN ('article_generation', 'image_generation', 'analysis', 'compliance_check')),
  input_tokens  INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  model         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE generation_costs IS 'AI生成コスト追跡';

-- generation_costs.job_id に FK が未定義の場合は追加 (既存DB対応)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'generation_costs_job_id_fkey'
      AND table_name = 'generation_costs'
  ) THEN
    BEGIN
      ALTER TABLE generation_costs
        ADD CONSTRAINT generation_costs_job_id_fkey
        FOREIGN KEY (job_id) REFERENCES batch_generation_jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'FK generation_costs_job_id_fkey already exists or failed: %', SQLERRM;
    END;
  END IF;
END $$;

-- monitoring_alerts
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- article_review_queue
CREATE TABLE IF NOT EXISTS article_review_queue (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
COMMENT ON COLUMN asp_programs.epc IS 'Earnings Per Click (アフィリエイト指標)';

-- ============================================================
-- 7. Phase 4 新テーブル
-- ============================================================

-- article_keywords: 記事↔キーワード追跡 (どのKWからどの記事が生成されたか)
CREATE TABLE IF NOT EXISTS article_keywords (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  keyword_id  UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, keyword_id)
);
COMMENT ON TABLE article_keywords IS '記事↔キーワード関連付け (生成元キーワード追跡)';

-- articles.primary_keyword_id (1記事:1プライマリKW のショートカット)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'primary_keyword_id'
  ) THEN
    ALTER TABLE articles ADD COLUMN primary_keyword_id UUID REFERENCES keywords(id) ON DELETE SET NULL;
  END IF;
END $$;

-- affiliate_links.program_id FK (asp_programs との関連付け)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_links' AND column_name = 'program_id'
  ) THEN
    ALTER TABLE affiliate_links ADD COLUMN program_id UUID REFERENCES asp_programs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- audit_log: 監査ログ
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id   UUID,
  changed_by  TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE audit_log IS '変更監査ログ';

-- ============================================================
-- 8. Phase 3b Constraints
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
-- 9. CHECK Constraints (NUMERIC列の範囲制約)
-- ============================================================

DO $$
BEGIN
  -- articles.quality_score: 0〜100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_articles_quality_score') THEN
    ALTER TABLE articles ADD CONSTRAINT chk_articles_quality_score
      CHECK (quality_score >= 0 AND quality_score <= 100);
  END IF;

  -- keywords.difficulty: 0〜100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_keywords_difficulty') THEN
    ALTER TABLE keywords ADD CONSTRAINT chk_keywords_difficulty
      CHECK (difficulty >= 0 AND difficulty <= 100);
  END IF;

  -- keywords.trend_score: 0〜100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_keywords_trend_score') THEN
    ALTER TABLE keywords ADD CONSTRAINT chk_keywords_trend_score
      CHECK (trend_score >= 0 AND trend_score <= 100);
  END IF;

  -- analytics_daily.bounce_rate: 0〜1
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_analytics_bounce_rate') THEN
    ALTER TABLE analytics_daily ADD CONSTRAINT chk_analytics_bounce_rate
      CHECK (bounce_rate >= 0 AND bounce_rate <= 1);
  END IF;

  -- analytics_daily.ctr: 0〜1
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_analytics_ctr') THEN
    ALTER TABLE analytics_daily ADD CONSTRAINT chk_analytics_ctr
      CHECK (ctr >= 0 AND ctr <= 1);
  END IF;

  -- asp_programs.approval_rate: 0〜100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_asp_approval_rate') THEN
    ALTER TABLE asp_programs ADD CONSTRAINT chk_asp_approval_rate
      CHECK (approval_rate >= 0 AND approval_rate <= 100);
  END IF;

  -- article_review_queue.compliance_score: 0〜100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_compliance_score') THEN
    ALTER TABLE article_review_queue ADD CONSTRAINT chk_review_compliance_score
      CHECK (compliance_score >= 0 AND compliance_score <= 100);
  END IF;
END $$;

-- ============================================================
-- 10. Indexes
-- ============================================================

-- articles
CREATE INDEX IF NOT EXISTS idx_articles_status         ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category       ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_category_id    ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at   ON articles(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_microcms_id    ON articles(microcms_id) WHERE microcms_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_updated_at     ON articles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_primary_kw     ON articles(primary_keyword_id) WHERE primary_keyword_id IS NOT NULL;

-- keywords
CREATE INDEX IF NOT EXISTS idx_keywords_category       ON keywords(category);
CREATE INDEX IF NOT EXISTS idx_keywords_search_volume  ON keywords(search_volume DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_tracked_at     ON keywords(tracked_at DESC);

-- article_keywords
CREATE INDEX IF NOT EXISTS idx_article_keywords_article  ON article_keywords(article_id);
CREATE INDEX IF NOT EXISTS idx_article_keywords_keyword  ON article_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_article_keywords_primary  ON article_keywords(article_id) WHERE is_primary = TRUE;

-- analytics_daily
CREATE INDEX IF NOT EXISTS idx_analytics_article_date  ON analytics_daily(article_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_date          ON analytics_daily(date DESC);

-- affiliate_links
CREATE INDEX IF NOT EXISTS idx_affiliate_article_id    ON affiliate_links(article_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_asp_name      ON affiliate_links(asp_name);
CREATE INDEX IF NOT EXISTS idx_affiliate_program_id    ON affiliate_links(program_id) WHERE program_id IS NOT NULL;

-- compliance_logs
CREATE INDEX IF NOT EXISTS idx_compliance_article_id   ON compliance_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checked_at   ON compliance_logs(checked_at DESC);
-- [NEW] 複合インデックス: DISTINCT ON クエリ高速化
CREATE INDEX IF NOT EXISTS idx_compliance_article_checktype_checked
  ON compliance_logs(article_id, check_type, checked_at DESC);

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
-- [NEW] 複合インデックス: run_id + level フィルタ
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_run_level  ON pipeline_logs(run_id, level);

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
-- [NEW] 複合インデックス: status + generated_at (ダッシュボードクエリ高速化)
CREATE INDEX IF NOT EXISTS idx_article_review_queue_status_generated
  ON article_review_queue(status, generated_at DESC);

-- asp_programs
CREATE INDEX IF NOT EXISTS idx_asp_programs_asp_name   ON asp_programs(asp_name);
CREATE INDEX IF NOT EXISTS idx_asp_programs_category   ON asp_programs(category);
CREATE INDEX IF NOT EXISTS idx_asp_programs_is_active  ON asp_programs(is_active);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name    ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id     ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by    ON audit_log(changed_by);

-- ============================================================
-- 11. Triggers
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
-- 12. Views
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
-- 13. Row Level Security (RLS)
-- ============================================================

-- RLS有効化 (再実行しても問題なし)
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
ALTER TABLE article_keywords      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- service_role は RLS をデフォルトでバイパスするため追加ポリシー不要

-- anon ロール: 公開データのSELECTのみ
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

-- [NEW] anon: asp_programs のアクティブなプログラムのみ閲覧可
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_asp_programs' AND tablename = 'asp_programs') THEN
    CREATE POLICY "anon_select_asp_programs" ON asp_programs FOR SELECT TO anon USING (is_active = TRUE);
  END IF;
END $$;

-- authenticated ロール: SELECT
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_keywords' AND tablename = 'keywords') THEN
    CREATE POLICY "authenticated_select_keywords" ON keywords FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_analytics_daily' AND tablename = 'analytics_daily') THEN
    CREATE POLICY "authenticated_select_analytics_daily" ON analytics_daily FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_affiliate_links' AND tablename = 'affiliate_links') THEN
    CREATE POLICY "authenticated_select_affiliate_links" ON affiliate_links FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_compliance_logs' AND tablename = 'compliance_logs') THEN
    CREATE POLICY "authenticated_select_compliance_logs" ON compliance_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_pipeline_runs' AND tablename = 'pipeline_runs') THEN
    CREATE POLICY "authenticated_select_pipeline_runs" ON pipeline_runs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_pipeline_logs' AND tablename = 'pipeline_logs') THEN
    CREATE POLICY "authenticated_select_pipeline_logs" ON pipeline_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_generation_costs' AND tablename = 'generation_costs') THEN
    CREATE POLICY "authenticated_select_generation_costs" ON generation_costs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_monitoring_alerts' AND tablename = 'monitoring_alerts') THEN
    CREATE POLICY "authenticated_select_monitoring_alerts" ON monitoring_alerts FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_batch_generation_jobs' AND tablename = 'batch_generation_jobs') THEN
    CREATE POLICY "authenticated_select_batch_generation_jobs" ON batch_generation_jobs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_article_review_queue' AND tablename = 'article_review_queue') THEN
    CREATE POLICY "authenticated_select_article_review_queue" ON article_review_queue FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_asp_programs' AND tablename = 'asp_programs') THEN
    CREATE POLICY "authenticated_select_asp_programs" ON asp_programs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_article_keywords' AND tablename = 'article_keywords') THEN
    CREATE POLICY "authenticated_select_article_keywords" ON article_keywords FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- audit_log: authenticated SELECT only (書き込みは service_role のみ)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_audit_log' AND tablename = 'audit_log') THEN
    CREATE POLICY "authenticated_select_audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================
-- 14. Seed Data (カテゴリマスタ)
-- ============================================================

INSERT INTO categories (name, slug, description, display_order) VALUES
  ('AGA・薄毛治療',    'aga',           'AGA治療・発毛・育毛関連',     1),
  ('ED・性機能',       'ed',            'ED治療・性機能改善関連',       2),
  ('脱毛・ヒゲ',       'hair-removal',  '医療脱毛・ヒゲ脱毛関連',       3),
  ('スキンケア・美容', 'skincare',      'メンズスキンケア・美容医療',   4),
  ('ダイエット・健康', 'diet',          'メンズダイエット・健康管理',   5),
  ('コラム',           'column',        'メンズ美容コラム・トレンド',   6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 15. Migration 005: admin_audit_log (管理者認証監査ログ)
-- ============================================================

INSERT INTO schema_migrations (version, description) VALUES
  ('005', 'admin_audit_log: 管理者認証監査ログ')
ON CONFLICT (version) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_audit_event_type') THEN
    CREATE TYPE admin_audit_event_type AS ENUM (
      'login_success',
      'login_failure',
      'logout',
      'session_expired',
      'unauthorized_access'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      admin_audit_event_type  NOT NULL,
  actor           TEXT,
  ip_address      INET,
  user_agent      TEXT,
  request_path    TEXT,
  request_method  TEXT,
  success         BOOLEAN     NOT NULL DEFAULT FALSE,
  failure_reason  TEXT,
  http_status     SMALLINT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_audit_log IS '管理者認証イベントの監査ログ';

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_event_type ON admin_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_ip_address ON admin_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_success_created ON admin_audit_log(success, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_admin_audit_log' AND tablename = 'admin_audit_log'
  ) THEN
    CREATE POLICY "service_role_all_admin_audit_log" ON admin_audit_log FOR ALL TO service_role USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_admin_audit_log' AND tablename = 'admin_audit_log'
  ) THEN
    CREATE POLICY "authenticated_select_admin_audit_log" ON admin_audit_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Cleanup function (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_admin_audit_log(retention_days INT DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM admin_audit_log WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 16. Migration 006: article_review_comments + asp_programs columns
-- ============================================================

INSERT INTO schema_migrations (version, description) VALUES
  ('006', 'article_review_comments テーブル + asp_programs priority/conversion_condition カラム追加')
ON CONFLICT (version) DO NOTHING;

-- article_review_comments: レビューコメント履歴テーブル
-- (article_review_queue の article_id を FK として参照)
CREATE TABLE IF NOT EXISTS article_review_comments (
  id          TEXT        PRIMARY KEY,
  article_id  UUID        NOT NULL,
  author      TEXT        NOT NULL DEFAULT 'admin',
  content     TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('approve', 'reject', 'revision', 'comment')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE article_review_comments IS '記事レビューコメント履歴 (approve/reject/revision/comment)';

CREATE INDEX IF NOT EXISTS idx_article_review_comments_article_id
  ON article_review_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_article_review_comments_created_at
  ON article_review_comments(created_at DESC);

ALTER TABLE article_review_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_role_all_article_review_comments'
      AND tablename = 'article_review_comments'
  ) THEN
    CREATE POLICY "service_role_all_article_review_comments"
      ON article_review_comments FOR ALL TO service_role USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_select_article_review_comments'
      AND tablename = 'article_review_comments'
  ) THEN
    CREATE POLICY "authenticated_select_article_review_comments"
      ON article_review_comments FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- asp_programs: priority カラム追加 (GET /api/admin/asp が .order('priority') を使用)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asp_programs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE asp_programs ADD COLUMN priority SMALLINT NOT NULL DEFAULT 3;
  END IF;
END $$;
COMMENT ON COLUMN asp_programs.priority IS '表示優先度 (1=最高〜5=最低, DEFAULT 3)';

-- asp_programs: conversion_condition カラム追加 (POST /api/admin/asp が挿入に使用)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asp_programs' AND column_name = 'conversion_condition'
  ) THEN
    ALTER TABLE asp_programs ADD COLUMN conversion_condition TEXT;
  END IF;
END $$;
COMMENT ON COLUMN asp_programs.conversion_condition IS 'コンバージョン条件 (例: 初回購入, 会員登録)';

-- asp_programs: notes カラム追加 (POST /api/admin/asp が挿入に使用、未存在の場合)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asp_programs' AND column_name = 'notes'
  ) THEN
    ALTER TABLE asp_programs ADD COLUMN notes TEXT;
  END IF;
END $$;
COMMENT ON COLUMN asp_programs.notes IS '備考・メモ';

-- priority インデックス追加 (ORDER BY priority クエリの高速化)
CREATE INDEX IF NOT EXISTS idx_asp_programs_priority
  ON asp_programs(priority ASC);

-- ============================================================
-- 17. Migration 007: asp_programs.ad_creatives JSONB
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asp_programs' AND column_name = 'ad_creatives'
  ) THEN
    ALTER TABLE asp_programs ADD COLUMN ad_creatives JSONB DEFAULT '[]';
    RAISE NOTICE 'Migration 007: ad_creatives column added to asp_programs';
  ELSE
    RAISE NOTICE 'Migration 007: ad_creatives column already exists, skipping';
  END IF;
END $$;

COMMENT ON COLUMN asp_programs.ad_creatives IS '広告クリエイティブ (テキストリンク/バナー) JSONB配列';

-- ============================================================
-- Done — v2.3 (Migration 007: asp_programs.ad_creatives JSONB)
-- ============================================================

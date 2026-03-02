-- ============================================================
-- MENS CATALY - Supabase DBスキーマ
-- version: 2.0
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 全文検索用

-- ============================================================
-- ENUM 型
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_status') THEN
    CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

-- ============================================================
-- テーブル定義
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
  microcms_id     TEXT UNIQUE,                            -- microCMS コンテンツID (NULL許容: Supabase直接管理の場合)
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  content         TEXT,
  excerpt         TEXT,
  category        TEXT NOT NULL DEFAULT 'uncategorized',  -- 非正規化カテゴリスラッグ (高速参照用)
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
  difficulty    NUMERIC(5, 2) NOT NULL DEFAULT 0,       -- 0.0〜100.0
  trend_score   NUMERIC(5, 2) NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'general',         -- 非正規化カテゴリスラッグ
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  tracked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (keyword, category)
);
COMMENT ON TABLE keywords IS 'キーワード調査データ';

-- analytics_daily (旧 analytics テーブルを拡張)
CREATE TABLE IF NOT EXISTS analytics_daily (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id   UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  pageviews    INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  avg_time     NUMERIC(10, 2) NOT NULL DEFAULT 0,      -- 秒
  bounce_rate  NUMERIC(5, 4) NOT NULL DEFAULT 0,       -- 0.0000〜1.0000
  ctr          NUMERIC(5, 4) NOT NULL DEFAULT 0,       -- Google Search Console CTR
  conversions  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, date)
);
COMMENT ON TABLE analytics_daily IS '記事別日次アナリティクス';

-- affiliate_links
CREATE TABLE IF NOT EXISTS affiliate_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE SET NULL,
  asp_name          TEXT NOT NULL,           -- afb, A8, アクセストレード, etc.
  program_name      TEXT NOT NULL,
  url               TEXT NOT NULL,
  click_count       INTEGER NOT NULL DEFAULT 0,
  conversion_count  INTEGER NOT NULL DEFAULT 0,
  revenue           NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- 円
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE affiliate_links IS 'ASPアフィリエイトリンク管理';

-- compliance_logs (既存互換: check_type enum → text へ変更)
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
-- パフォーマンスインデックス
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

-- 全文検索 (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm     ON articles USING gin(title gin_trgm_ops);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
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
  FOREACH t IN ARRAY ARRAY['articles', 'categories', 'keywords', 'affiliate_links'] LOOP
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
-- ビュー
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

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- RLSを有効化
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords        ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;

-- service_role は全テーブルに全アクセス (bypass RLS)
-- service_role は RLS をデフォルトでバイパスするため追加ポリシー不要

-- anon ロール: articles / categories の SELECT のみ
CREATE POLICY "anon_select_published_articles"
  ON articles
  FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "anon_select_categories"
  ON categories
  FOR SELECT
  TO anon
  USING (true);

-- authenticated ロール: articles / categories の SELECT (下書き含む)
CREATE POLICY "authenticated_select_articles"
  ON articles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 初期データ (カテゴリマスタ)
-- ============================================================
INSERT INTO categories (name, slug, description, display_order) VALUES
  ('AGA・薄毛治療',    'aga',           'AGA治療・発毛・育毛関連',     1),
  ('ED・性機能',       'ed',            'ED治療・性機能改善関連',       2),
  ('脱毛・ヒゲ',       'hair-removal',  '医療脱毛・ヒゲ脱毛関連',       3),
  ('スキンケア・美容', 'skincare',      'メンズスキンケア・美容医療',   4),
  ('ダイエット・健康', 'diet',          'メンズダイエット・健康管理',   5)
ON CONFLICT (slug) DO NOTHING;

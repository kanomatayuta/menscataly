-- ============================================================
-- MENS CATALY - Supabase PostgreSQL Schema
-- Version: 1.0.0
-- Created: 2026-03-02
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 全文検索用

-- ============================================================
-- 1. articles テーブル
--    microCMSの記事と紐付けるマスターテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    microcms_id   TEXT        NOT NULL UNIQUE,
    title         TEXT        NOT NULL,
    slug          TEXT        NOT NULL UNIQUE,
    category      TEXT        NOT NULL,
    quality_score NUMERIC(4,2) DEFAULT 0.0 CHECK (quality_score >= 0 AND quality_score <= 100),
    pv_count      BIGINT      DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_microcms_id ON articles(microcms_id);
CREATE INDEX idx_articles_slug        ON articles(slug);
CREATE INDEX idx_articles_category    ON articles(category);
CREATE INDEX idx_articles_quality_score ON articles(quality_score DESC);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. keywords テーブル
--    トレンドキーワード管理・SEO難易度管理
-- ============================================================
CREATE TABLE IF NOT EXISTS keywords (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword       TEXT        NOT NULL UNIQUE,
    search_volume INTEGER     DEFAULT 0 CHECK (search_volume >= 0),
    difficulty    NUMERIC(4,2) DEFAULT 0.0 CHECK (difficulty >= 0 AND difficulty <= 100),
    trend_score   NUMERIC(4,2) DEFAULT 0.0 CHECK (trend_score >= 0 AND trend_score <= 100),
    category      TEXT        NOT NULL,
    collected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_keywords_category     ON keywords(category);
CREATE INDEX idx_keywords_trend_score  ON keywords(trend_score DESC);
CREATE INDEX idx_keywords_search_volume ON keywords(search_volume DESC);
CREATE INDEX idx_keywords_keyword_trgm ON keywords USING GIN(keyword gin_trgm_ops);

CREATE TRIGGER trg_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. asp_links テーブル
--    ASPプログラム管理・ITPタグ管理
-- ============================================================
CREATE TABLE IF NOT EXISTS asp_links (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    asp_name      TEXT        NOT NULL,           -- 'afb', 'a8', 'accesstrade', 'valuecommerce'
    program_name  TEXT        NOT NULL,
    url           TEXT        NOT NULL,
    reward_amount INTEGER     DEFAULT 0 CHECK (reward_amount >= 0), -- 報酬額(円)
    category      TEXT        NOT NULL,
    itp_tag       TEXT,                           -- ITP対応タグHTML
    is_active     BOOLEAN     DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(asp_name, program_name)
);

CREATE INDEX idx_asp_links_category  ON asp_links(category);
CREATE INDEX idx_asp_links_asp_name  ON asp_links(asp_name);
CREATE INDEX idx_asp_links_is_active ON asp_links(is_active);

CREATE TRIGGER trg_asp_links_updated_at
    BEFORE UPDATE ON asp_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. analytics テーブル
--    日次PV・UXシグナル・コンバージョン集計
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id    UUID        NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    date          DATE        NOT NULL,
    pv            INTEGER     DEFAULT 0 CHECK (pv >= 0),
    ux_signals    JSONB       DEFAULT '{}'::jsonb,
    -- ux_signals 例: {"scroll_depth": 75, "time_on_page": 120, "bounce_rate": 0.45}
    ctr           NUMERIC(5,4) DEFAULT 0.0 CHECK (ctr >= 0 AND ctr <= 1),
    conversions   INTEGER     DEFAULT 0 CHECK (conversions >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(article_id, date)
);

CREATE INDEX idx_analytics_article_id ON analytics(article_id);
CREATE INDEX idx_analytics_date       ON analytics(date DESC);
CREATE INDEX idx_analytics_article_date ON analytics(article_id, date DESC);

-- ============================================================
-- 5. compliance_logs テーブル
--    薬機法・景表法チェック結果ログ
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_logs (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id    UUID        NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    check_type    TEXT        NOT NULL,           -- 'yakuji_ho', 'keihyo_ho', 'ymyl', 'stealth_marketing'
    result        TEXT        NOT NULL,           -- 'passed', 'warning', 'failed'
    violations    JSONB       DEFAULT '[]'::jsonb,
    -- violations 例: [{"text": "確実に...", "rule": "薬機法66条", "suggestion": "期待できる"}]
    checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_logs_article_id  ON compliance_logs(article_id);
CREATE INDEX idx_compliance_logs_result      ON compliance_logs(result);
CREATE INDEX idx_compliance_logs_check_type  ON compliance_logs(check_type);
CREATE INDEX idx_compliance_logs_checked_at  ON compliance_logs(checked_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE articles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords         ENABLE ROW LEVEL SECURITY;
ALTER TABLE asp_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs  ENABLE ROW LEVEL SECURITY;

-- サービスロールは全操作可
CREATE POLICY "Service role full access" ON articles
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON keywords
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON asp_links
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON analytics
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON compliance_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 匿名ロールは読み取りのみ (articles, asp_links)
CREATE POLICY "Anon read articles" ON articles
    FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read asp_links" ON asp_links
    FOR SELECT TO anon USING (is_active = true);

-- ============================================================
-- Views
-- ============================================================

-- 記事パフォーマンスサマリー
CREATE OR REPLACE VIEW v_article_performance AS
SELECT
    a.id,
    a.microcms_id,
    a.title,
    a.category,
    a.quality_score,
    a.pv_count,
    COALESCE(SUM(an.pv), 0)          AS total_pv_30d,
    COALESCE(AVG(an.ctr), 0)         AS avg_ctr_30d,
    COALESCE(SUM(an.conversions), 0) AS total_conversions_30d,
    a.updated_at
FROM articles a
LEFT JOIN analytics an
    ON an.article_id = a.id
    AND an.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY a.id;

-- 最新コンプライアンス状態
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

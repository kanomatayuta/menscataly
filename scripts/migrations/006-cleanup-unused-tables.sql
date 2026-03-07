-- ============================================================
-- Migration 006: 未使用テーブル・スキーマの削除
-- ============================================================
-- 調査結果に基づき、コードから参照されていないテーブルを削除
--
-- 削除対象:
--   1. schema_migrations — バージョン管理用だが未実装
--   2. audit_log — admin_audit_log と重複、未使用
--   3. pipeline_logs — pipeline_runs.steps_json で代替済み
--   4. article_keywords — スキーマ定義のみ、実装なし
--   5. compliance_logs — insert/selectコードなし
--   6. categories — microCMS に完全移行済み、FK参照もなし
--
-- 保持テーブル:
--   articles, asp_programs, affiliate_links, analytics_daily,
--   generation_costs, monitoring_alerts, revenue_daily,
--   pipeline_runs, batch_generation_jobs, admin_audit_log,
--   app_config, keywords, article_review_queue, heatmap_events
--
-- Usage: Supabase SQL Editor にペーストして Run
-- ============================================================

-- 1. schema_migrations
DROP TABLE IF EXISTS schema_migrations;

-- 2. audit_log (admin_audit_log と重複)
DROP TABLE IF EXISTS audit_log;

-- 3. pipeline_logs (pipeline_runs.steps_json で代替)
DROP TABLE IF EXISTS pipeline_logs;

-- 4. article_keywords (未実装)
DROP TABLE IF EXISTS article_keywords;

-- 5. compliance_logs (未実装)
DROP TABLE IF EXISTS compliance_logs;

-- 6. categories (microCMS に移行済み)
-- FK制約を先に削除
ALTER TABLE IF EXISTS articles DROP CONSTRAINT IF EXISTS articles_category_id_fkey;
ALTER TABLE IF EXISTS keywords DROP CONSTRAINT IF EXISTS keywords_category_id_fkey;
DROP TABLE IF EXISTS categories;

-- articles.category_id カラムも不要（microCMS がカテゴリ管理）
ALTER TABLE IF EXISTS articles DROP COLUMN IF EXISTS category_id;
ALTER TABLE IF EXISTS keywords DROP COLUMN IF EXISTS category_id;

-- 不要な ENUM 型の削除
DROP TYPE IF EXISTS compliance_check_type;
DROP TYPE IF EXISTS compliance_result;

-- ============================================================
-- Verify: 残存テーブル確認クエリ（実行後に確認用）
-- ============================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

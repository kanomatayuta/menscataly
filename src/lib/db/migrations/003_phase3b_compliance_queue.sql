-- ============================================================
-- Migration: 003_phase3b_compliance_queue
-- Phase 3b: コンプライアンスキュー永続化の拡張
-- article_review_queue テーブルに slug ユニーク制約を追加
-- ============================================================

-- slug にユニーク制約を追加（upsert の onConflict に必要）
-- 既存のデータとの重複がある場合はエラーになるため、
-- 先に重複排除してから実行すること
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'article_review_queue_slug_key'
  ) THEN
    ALTER TABLE article_review_queue ADD CONSTRAINT article_review_queue_slug_key UNIQUE (slug);
  END IF;
END $$;

-- review_notes カラムにコメントを追加
COMMENT ON COLUMN article_review_queue.review_notes IS 'JSON形式のレビューメモ: decision, reason, eeatScore, violationCount, runId, queueStatus, retryCount';

-- slug インデックス（ユニーク制約で自動作成されるが明示的に定義）
CREATE INDEX IF NOT EXISTS idx_article_review_queue_slug
  ON article_review_queue(slug);

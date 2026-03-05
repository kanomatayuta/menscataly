-- ============================================================
-- Heatmap Events テーブル
-- 記事ページのクリック位置・スクロール深度を記録
-- ============================================================

CREATE TABLE IF NOT EXISTS heatmap_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_slug  TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('click', 'scroll')),
  x_pct         REAL DEFAULT 0,
  y_pct         REAL DEFAULT 0,
  scroll_depth  INTEGER DEFAULT 0,
  viewport_width INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- インデックス: 記事slug + イベント種別 + 日付
CREATE INDEX IF NOT EXISTS idx_heatmap_events_slug_type
  ON heatmap_events (article_slug, event_type);

CREATE INDEX IF NOT EXISTS idx_heatmap_events_created_at
  ON heatmap_events (created_at);

-- 30日以上古いデータを自動削除するポリシー (任意: cron で DELETE)
-- DELETE FROM heatmap_events WHERE created_at < now() - INTERVAL '30 days';

-- RLS: 公開APIからの書き込みを許可 (service role で操作)
ALTER TABLE heatmap_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert from service role" ON heatmap_events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow select from service role" ON heatmap_events
  FOR SELECT TO service_role USING (true);

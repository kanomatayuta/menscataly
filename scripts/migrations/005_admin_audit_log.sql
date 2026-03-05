-- ============================================================
-- Migration 005: admin_audit_log (管理者認証監査ログ)
-- ============================================================

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

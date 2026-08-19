-- Abuse reports table — captures anonymous /report submissions so nothing gets
-- lost if the email notification fails. Read-only for admins via service role.

CREATE TABLE IF NOT EXISTS abuse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  content_url TEXT,
  content_id TEXT,
  reporter_email TEXT,
  reporter_ip TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'actioned', 'dismissed')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_abuse_reports_status_created ON abuse_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_content_id ON abuse_reports(content_id);

-- RLS: only service role can read/write. Nobody else needs to see these.
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "abuse_reports_service_only" ON abuse_reports;
CREATE POLICY "abuse_reports_service_only" ON abuse_reports
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

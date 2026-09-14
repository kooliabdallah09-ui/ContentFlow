-- Make in-flight renders resumable without a browser.
--
-- Today /api/ugc/animate deducts credits, gets a provider job id, and returns
-- it to the client. That id then lives ONLY in React state: navigate away and
-- it's gone. The ugc_content row written alongside it can't help, because
-- external_id is `ugc-<timestamp>` — it records THAT something started, not
-- WHAT to poll — and nothing ever moves the row off status='generating'.
--
-- Net effect: credits spent, provider finishes the render, result orphaned.
--
-- These columns let a background sweeper (see /api/cron/reconcile-renders)
-- finish the job that the browser walked away from, and refund the ones that
-- genuinely failed.

ALTER TABLE ugc_content
  -- Which provider holds the job, so the sweeper knows how to poll it.
  ADD COLUMN IF NOT EXISTS provider text,                    -- seedance | shotstack | vertex
  -- The provider's own task/render id. This is the field that was missing.
  ADD COLUMN IF NOT EXISTS provider_job_id text,
  -- Backoff: the sweeper skips rows until now() passes this.
  ADD COLUMN IF NOT EXISTS poll_after timestamptz,
  ADD COLUMN IF NOT EXISTS poll_attempts integer NOT NULL DEFAULT 0,
  -- Why a render ended up failed, for support and for the refund note.
  ADD COLUMN IF NOT EXISTS failure_reason text,
  -- Set once credits have been returned, so a retrying sweeper can never
  -- refund the same render twice.
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- The sweeper's query: unfinished rows that carry a pollable id and are due.
CREATE INDEX IF NOT EXISTS idx_ugc_content_pending_renders
  ON ugc_content (poll_after NULLS FIRST)
  WHERE status = 'generating' AND provider_job_id IS NOT NULL;

-- Reattaching a session on page load: "what is still running for me?"
CREATE INDEX IF NOT EXISTS idx_ugc_content_user_status
  ON ugc_content (user_id, status, created_at DESC);

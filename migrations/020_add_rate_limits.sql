-- Durable, shared rate limiting.
--
-- Every limiter in the app was a per-process Map. Vercel runs many function
-- instances and recycles them constantly, so the real ceiling was
-- (limit × live instances) and each cold start wiped the window.
--
-- That was a correctness problem on /api/preview/generate specifically. It
-- enforces "one free preview per IP per 7 days", but a 7-day window held in
-- memory almost never survives 7 days — so the rule degraded to roughly "one
-- free preview per instance", and each preview costs ~$0.18 of real vendor
-- spend against $0 of revenue. That is the one line item that can scale
-- faster than the business.
--
-- One row per (limiter, key), fixed window — same semantics as the Map it
-- replaces, just shared and durable.

CREATE TABLE IF NOT EXISTS rate_limits (
  key      text PRIMARY KEY,          -- "<limiter>:<ip or user id>"
  count    integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);

-- Expired rows are garbage; this index makes the sweep cheap.
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);

-- Atomic check-and-increment.
--
-- Two steps, but still race-free: the INSERT ... ON CONFLICT DO UPDATE takes a
-- row lock that is held until the function's transaction ends, so no other
-- instance can touch this key in between. Concurrent callers serialise instead
-- of all reading a stale count and all deciding they're under the limit —
-- the race the in-memory version could not prevent.
--
-- A denied request does NOT consume a slot, matching the in-memory limiter it
-- replaces. That also keeps release_rate_limit() meaningful: if refused calls
-- incremented too, a caller hammering the endpoint would silently cancel out
-- another caller's release.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms bigint
)
RETURNS TABLE (allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now    timestamptz := now();
  v_window interval    := make_interval(secs => (p_window_ms / 1000.0)::double precision);
  v_count  integer;
  v_reset  timestamptz;
BEGIN
  -- Land on a row for the CURRENT window and lock it. An expired window resets
  -- to zero here rather than being treated as still-counting.
  INSERT INTO rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 0, v_now + v_window)
  ON CONFLICT (key) DO UPDATE
    SET count    = CASE WHEN r.reset_at <= v_now THEN 0 ELSE r.count END,
        reset_at = CASE WHEN r.reset_at <= v_now THEN v_now + v_window ELSE r.reset_at END
  RETURNING r.count, r.reset_at INTO v_count, v_reset;

  -- v_count is the usage BEFORE this request.
  IF v_count >= p_limit THEN
    RETURN QUERY SELECT
      false,
      0,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset - v_now)))::integer);
    RETURN;
  END IF;

  UPDATE rate_limits SET count = count + 1 WHERE key = p_key
  RETURNING count INTO v_count;

  RETURN QUERY SELECT true, GREATEST(0, p_limit - v_count), 0;
END;
$$;

-- Give a slot back.
--
-- Callers that reserve up front but only actually spend later (see
-- /api/preview/generate) use this to undo the reservation when the request
-- fails before any vendor cost is incurred. Reserving first and releasing on
-- failure — rather than checking first and recording on success — is what
-- stops a burst of concurrent requests all passing the check together.
CREATE OR REPLACE FUNCTION release_rate_limit(p_key text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE rate_limits SET count = GREATEST(0, count - 1) WHERE key = p_key;
$$;

-- Server-side only. RLS on with no policies means anon/authenticated can't
-- read or forge counters from the browser; the service role bypasses RLS.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

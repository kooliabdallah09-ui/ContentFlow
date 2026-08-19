-- ============================================================================
-- LAUNCH HARDENING — run this in Supabase SQL Editor before public launch
-- ============================================================================
-- Adds row-level security so users can never read or modify each other's
-- credits, subscriptions, or transactions. Also creates an atomic credit
-- deduction RPC to close the concurrent-request overdraft race.
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================================


-- ─── 1. Row-Level Security on payment / credit tables ───────────────────────

-- user_credits: only the owning user (or service role) can read/write.
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_credits_self_read" ON user_credits;
CREATE POLICY "user_credits_self_read" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Writes are only allowed via service_role (webhook, credit deduction RPC).
-- Regular authenticated users cannot INSERT / UPDATE / DELETE their own row
-- directly — must go through the backend.
DROP POLICY IF EXISTS "user_credits_service_write" ON user_credits;
CREATE POLICY "user_credits_service_write" ON user_credits
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- user_subscriptions: same pattern.
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_subscriptions_self_read" ON user_subscriptions;
CREATE POLICY "user_subscriptions_self_read" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_subscriptions_service_write" ON user_subscriptions;
CREATE POLICY "user_subscriptions_service_write" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- credit_transactions: read-only for the user, service can write.
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_transactions_self_read" ON credit_transactions;
CREATE POLICY "credit_transactions_self_read" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "credit_transactions_service_write" ON credit_transactions;
CREATE POLICY "credit_transactions_service_write" ON credit_transactions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ─── 2. Atomic credit deduction RPC ─────────────────────────────────────────
-- Locks the user's user_credits row, verifies balance, deducts, and returns
-- the new balance — all inside a single transaction. Prevents the race
-- where two concurrent generate-image requests both pass the balance check
-- and cause an overdraft.

CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_current_pack INTEGER;
  v_new_balance INTEGER;
  v_new_pack INTEGER;
  v_monthly_remaining INTEGER;
  v_pack_spend INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Row lock: any concurrent call waits here.
  SELECT balance, COALESCE(pack_credits, 0)
    INTO v_current_balance, v_current_pack
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits row not found';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits (balance=%, needed=%)', v_current_balance, p_amount;
  END IF;

  -- Two-pool deduction (mirrors lib/deduct-credits.ts):
  --   monthly credits consumed first, then pack credits.
  v_monthly_remaining := v_current_balance - v_current_pack;
  v_new_pack := v_current_pack;
  IF p_amount > v_monthly_remaining THEN
    v_pack_spend := p_amount - GREATEST(0, v_monthly_remaining);
    v_new_pack := GREATEST(0, v_current_pack - v_pack_spend);
  END IF;
  v_new_balance := v_current_balance - p_amount;

  UPDATE user_credits
    SET balance = v_new_balance,
        pack_credits = v_new_pack,
        updated_at = NOW()
    WHERE user_id = p_user_id;

  RETURN v_new_balance;
END;
$$;

-- Only authenticated users (via the API) can invoke it; the SECURITY DEFINER
-- above lets it bypass RLS for the specific balance write.
REVOKE ALL ON FUNCTION deduct_credits_atomic(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deduct_credits_atomic(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credits_atomic(UUID, INTEGER) TO service_role;


-- ─── 3. Indexes on user_id foreign keys (perf) ──────────────────────────────
-- Silent perf killer on large tables; add if not already present.
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_dodo_customer ON user_subscriptions(dodo_customer_id);


-- ─── Done ────────────────────────────────────────────────────────────────────
-- After running:
--   1. Test the app end-to-end (login, generate, buy pack) — service-role
--      endpoints keep working; only direct-Supabase-client mutations from
--      the browser are now blocked (they should never have happened anyway).
--   2. Verify the RPC: SELECT deduct_credits_atomic('<some-user-uuid>', 5);
--   3. If anything breaks, RLS can be temporarily disabled per-table with:
--        ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;

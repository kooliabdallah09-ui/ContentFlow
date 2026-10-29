-- Replay / duplicate protection for the Dodo webhook (payment.succeeded).
-- The handler inserts the webhook-id before granting credits; a unique
-- violation means the event was already processed.
create table if not exists dodo_webhook_events (
  event_id   text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);

-- Service role only (the webhook uses the service key; RLS with no policies
-- blocks everyone else).
alter table dodo_webhook_events enable row level security;

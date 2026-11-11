-- Idempotência de webhooks Asaas (at-least-once).

create table if not exists public.asaas_webhook_events (
  id text primary key,
  event text not null,
  checkout_id text,
  payment_charge_id uuid references public.payment_charges (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists asaas_webhook_events_checkout_idx
  on public.asaas_webhook_events (checkout_id)
  where checkout_id is not null;

alter table public.asaas_webhook_events enable row level security;

-- Sem policies para authenticated/anon: só service_role (Edge Function).

notify pgrst, 'reload schema';

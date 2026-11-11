-- Fase 3 pagamento: cobranças do cliente (sinal + restante) — separado de financial_entries.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_charge_kind'
  ) then
    create type public.payment_charge_kind as enum ('sinal', 'restante');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_charge_status'
  ) then
    create type public.payment_charge_status as enum (
      'emitida',
      'paga',
      'expirada',
      'cancelada',
      'estornada'
    );
  end if;
end $$;

create table if not exists public.payment_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  kind public.payment_charge_kind not null,
  status public.payment_charge_status not null default 'emitida',
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'BRL',
  -- snapshots no momento da emissão
  real_price_snapshot numeric(12, 2) not null check (real_price_snapshot > 0),
  deposit_percent numeric(5, 2)
    check (deposit_percent is null or (deposit_percent >= 0 and deposit_percent <= 100)),
  suggested_amount numeric(12, 2)
    check (suggested_amount is null or suggested_amount >= 0),
  adjustment_justification text,
  -- Asaas (preenchido na fase de integração)
  asaas_checkout_id text,
  asaas_payment_id text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_charges_sinal_needs_percent check (
    kind <> 'sinal' or deposit_percent is not null
  ),
  constraint payment_charges_restante_justification check (
    kind <> 'restante'
    or suggested_amount is null
    or amount = suggested_amount
    or (
      adjustment_justification is not null
      and char_length(btrim(adjustment_justification)) between 3 and 2000
    )
  )
);

comment on table public.payment_charges is
  'Cobranças Asaas do cliente (sinal e restante). Distinto de financial_entries (repasse motorista).';

create index if not exists payment_charges_org_created_idx
  on public.payment_charges (organization_id, created_at desc);

create index if not exists payment_charges_reservation_idx
  on public.payment_charges (reservation_id, kind, created_at desc);

create index if not exists payment_charges_status_idx
  on public.payment_charges (organization_id, status);

create index if not exists payment_charges_asaas_checkout_idx
  on public.payment_charges (asaas_checkout_id)
  where asaas_checkout_id is not null;

create index if not exists payment_charges_asaas_payment_idx
  on public.payment_charges (asaas_payment_id)
  where asaas_payment_id is not null;

-- No máximo uma cobrança ativa (emitida|paga) por tipo em cada reserva
create unique index if not exists payment_charges_active_kind_uidx
  on public.payment_charges (reservation_id, kind)
  where status in ('emitida', 'paga');

alter table public.payment_charges enable row level security;

drop policy if exists payment_charges_staff_select on public.payment_charges;
create policy payment_charges_staff_select
  on public.payment_charges for select to authenticated
  using (private.can_operate_org(organization_id));

drop policy if exists payment_charges_staff_insert on public.payment_charges;
create policy payment_charges_staff_insert
  on public.payment_charges for insert to authenticated
  with check (private.can_operate_org(organization_id));

drop policy if exists payment_charges_staff_update on public.payment_charges;
create policy payment_charges_staff_update
  on public.payment_charges for update to authenticated
  using (private.can_operate_org(organization_id))
  with check (private.can_operate_org(organization_id));

-- Sem delete para staff: cancelamento muda status (auditoria). Service role faz o resto.

grant select, insert, update on public.payment_charges to authenticated;

-- Sinal pago (ou emitido) da reserva — base para sugerir o restante
create or replace function public.reservation_deposit_amount(p_reservation_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select c.amount
      from public.payment_charges c
      where c.reservation_id = p_reservation_id
        and c.kind = 'sinal'
        and c.status in ('paga', 'emitida')
      order by
        case c.status when 'paga' then 0 else 1 end,
        c.created_at desc
      limit 1
    ),
    0
  );
$$;

revoke all on function public.reservation_deposit_amount(uuid) from public;
grant execute on function public.reservation_deposit_amount(uuid) to authenticated;

notify pgrst, 'reload schema';

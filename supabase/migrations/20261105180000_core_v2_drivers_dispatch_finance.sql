-- Core v2: drivers, manual dispatch, finance, landing leads
-- NOTE: does not alter public reservation form behavior.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'assignment_status'
  ) then
    create type public.assignment_status as enum (
      'oferecido',
      'aceito',
      'recusado',
      'cancelado',
      'concluido'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'financial_entry_status'
  ) then
    create type public.financial_entry_status as enum (
      'previsto',
      'a_liquidar',
      'liquidado'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Org commission helper (fixed % in organizations.settings)
-- ---------------------------------------------------------------------------

create or replace function public.org_commission_percent(p_org_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    least(
      100,
      coalesce(
        nullif(
          (o.settings ->> 'platform_commission_percent'),
          ''
        )::numeric,
        20
      )
    )
  )
  from public.organizations o
  where o.id = p_org_id;
$$;

grant execute on function public.org_commission_percent(uuid) to authenticated, anon;

-- Seed default commission for existing orgs if missing
update public.organizations
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{platform_commission_percent}',
  '20',
  true
)
where coalesce(settings ->> 'platform_commission_percent', '') = '';

-- ---------------------------------------------------------------------------
-- Drivers (ficha)
-- ---------------------------------------------------------------------------

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  phone text not null,
  email text not null,
  vehicle_category_id uuid not null references public.vehicle_categories (id) on delete restrict,
  vehicle_brand text not null default '',
  vehicle_model text not null default '',
  vehicle_year int,
  vehicle_color text not null default '',
  vehicle_plate text,
  vehicle_body_type public.vehicle_body_type,
  skills text[] not null default '{}',
  availability jsonb not null default '[]'::jsonb,
  notes text,
  documents_notes text,
  profile_complete boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drivers_full_name_len check (char_length(btrim(full_name)) between 2 and 160),
  constraint drivers_phone_len check (char_length(btrim(phone)) between 8 and 40),
  constraint drivers_email_len check (char_length(btrim(email)) between 3 and 254)
);

create unique index if not exists drivers_org_email_uidx
  on public.drivers (organization_id, lower(email));

create unique index if not exists drivers_org_user_uidx
  on public.drivers (organization_id, user_id)
  where user_id is not null;

create index if not exists drivers_org_active_idx
  on public.drivers (organization_id, active, profile_complete);

create or replace function public.drivers_set_meta()
returns trigger
language plpgsql
as $$
declare
  v_complete boolean;
begin
  new.full_name := btrim(new.full_name);
  new.phone := btrim(new.phone);
  new.email := lower(btrim(new.email));
  new.vehicle_brand := btrim(coalesce(new.vehicle_brand, ''));
  new.vehicle_model := btrim(coalesce(new.vehicle_model, ''));
  new.vehicle_color := btrim(coalesce(new.vehicle_color, ''));
  if new.vehicle_plate is not null then
    new.vehicle_plate := nullif(upper(btrim(new.vehicle_plate)), '');
  end if;
  if new.notes is not null then
    new.notes := nullif(btrim(new.notes), '');
  end if;
  if new.documents_notes is not null then
    new.documents_notes := nullif(btrim(new.documents_notes), '');
  end if;

  v_complete :=
    char_length(new.full_name) >= 2
    and char_length(new.phone) >= 8
    and char_length(new.email) >= 3
    and new.vehicle_category_id is not null
    and char_length(new.vehicle_brand) >= 1
    and char_length(new.vehicle_model) >= 1
    and new.vehicle_year is not null
    and char_length(new.vehicle_color) >= 1
    and coalesce(cardinality(new.skills), 0) >= 1
    and jsonb_typeof(new.availability) = 'array'
    and jsonb_array_length(new.availability) >= 1;

  new.profile_complete := v_complete;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists drivers_set_meta on public.drivers;
create trigger drivers_set_meta
  before insert or update on public.drivers
  for each row
  execute function public.drivers_set_meta();

-- Ensure category belongs to same org
create or replace function public.drivers_same_org_category()
returns trigger
language plpgsql
as $$
declare
  cat_org uuid;
begin
  select organization_id into cat_org
  from public.vehicle_categories
  where id = new.vehicle_category_id;

  if cat_org is null or cat_org <> new.organization_id then
    raise exception 'vehicle_category_id inválido para a organização';
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_same_org_category on public.drivers;
create trigger drivers_same_org_category
  before insert or update on public.drivers
  for each row
  execute function public.drivers_same_org_category();

alter table public.drivers enable row level security;

drop policy if exists drivers_staff_select on public.drivers;
create policy drivers_staff_select
  on public.drivers for select to authenticated
  using (
    private.can_read_org(organization_id)
    or user_id = auth.uid()
  );

drop policy if exists drivers_admin_write on public.drivers;
create policy drivers_admin_write
  on public.drivers for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

grant select, insert, update, delete on public.drivers to authenticated;

-- ---------------------------------------------------------------------------
-- Job assignments (manual dispatch)
-- ---------------------------------------------------------------------------

create table if not exists public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  status public.assignment_status not null default 'oferecido',
  offered_at timestamptz not null default now(),
  offered_by uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  refuse_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_assignments_org_idx
  on public.job_assignments (organization_id, status);

create index if not exists job_assignments_driver_idx
  on public.job_assignments (driver_id, status);

create index if not exists job_assignments_reservation_idx
  on public.job_assignments (reservation_id, status);

-- Only one open offer/accept per reservation
create unique index if not exists job_assignments_one_active_per_reservation
  on public.job_assignments (reservation_id)
  where status in ('oferecido', 'aceito');

create or replace function public.job_assignments_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_assignments_touch on public.job_assignments;
create trigger job_assignments_touch
  before update on public.job_assignments
  for each row
  execute function public.job_assignments_touch();

alter table public.job_assignments enable row level security;

drop policy if exists job_assignments_staff_select on public.job_assignments;
create policy job_assignments_staff_select
  on public.job_assignments for select to authenticated
  using (
    private.can_read_org(organization_id)
    or exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.user_id = auth.uid()
    )
  );

drop policy if exists job_assignments_staff_write on public.job_assignments;
create policy job_assignments_staff_write
  on public.job_assignments for all to authenticated
  using (private.can_operate_org(organization_id))
  with check (private.can_operate_org(organization_id));

grant select, insert, update, delete on public.job_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Financial entries (admin only)
-- ---------------------------------------------------------------------------

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  assignment_id uuid references public.job_assignments (id) on delete set null,
  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  commission_percent numeric(5, 2) not null check (commission_percent >= 0 and commission_percent <= 100),
  commission_amount numeric(12, 2) not null check (commission_amount >= 0),
  driver_amount numeric(12, 2) not null check (driver_amount >= 0),
  currency text not null default 'BRL',
  status public.financial_entry_status not null default 'previsto',
  notes text,
  liquidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_entries_reservation_unique unique (reservation_id)
);

create index if not exists financial_entries_org_status_idx
  on public.financial_entries (organization_id, status);

alter table public.financial_entries enable row level security;

drop policy if exists financial_entries_admin_all on public.financial_entries;
create policy financial_entries_admin_all
  on public.financial_entries for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

grant select, insert, update, delete on public.financial_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Landing leads (client capture) — additive to reservation form
-- ---------------------------------------------------------------------------

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  message text,
  source text not null default 'landing',
  status text not null default 'novo',
  created_at timestamptz not null default now(),
  constraint leads_full_name_len check (char_length(btrim(full_name)) between 2 and 160),
  constraint leads_phone_len check (char_length(btrim(phone)) between 8 and 40),
  constraint leads_email_len check (char_length(btrim(email)) between 3 and 254)
);

create index if not exists leads_org_created_idx
  on public.leads (organization_id, created_at desc);

alter table public.leads enable row level security;

drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert
  on public.leads for insert to anon, authenticated
  with check (true);

drop policy if exists leads_staff_select on public.leads;
create policy leads_staff_select
  on public.leads for select to authenticated
  using (private.can_read_org(organization_id));

drop policy if exists leads_staff_update on public.leads;
create policy leads_staff_update
  on public.leads for update to authenticated
  using (private.can_operate_org(organization_id))
  with check (private.can_operate_org(organization_id));

grant select, insert, update on public.leads to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_driver_user(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drivers d
    where d.id = p_driver_id
      and d.user_id = auth.uid()
      and d.active = true
  );
$$;

grant execute on function private.is_driver_user(uuid) to authenticated;

create or replace function public.customer_first_name(p_full_name text)
returns text
language sql
immutable
as $$
  select split_part(btrim(coalesce(p_full_name, '')), ' ', 1);
$$;

grant execute on function public.customer_first_name(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC: assign reservation → driver (manual)
-- ---------------------------------------------------------------------------

create or replace function public.assign_reservation_to_driver(
  p_reservation_id uuid,
  p_driver_id uuid
)
returns public.job_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_driver public.drivers;
  v_row public.job_assignments;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_res.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_res.status <> 'confirmado' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found or v_driver.organization_id <> v_res.organization_id then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not v_driver.active or not v_driver.profile_complete then
    raise exception 'DRIVER_NOT_READY' using errcode = 'P0001';
  end if;

  -- Category alignment: driver category must match reservation category when set
  if v_res.vehicle_category_id is not null
     and v_driver.vehicle_category_id <> v_res.vehicle_category_id then
    raise exception 'CATEGORY_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.job_assignments a
    where a.reservation_id = v_res.id
      and a.status in ('oferecido', 'aceito')
  ) then
    raise exception 'ALREADY_ASSIGNED' using errcode = 'P0001';
  end if;

  insert into public.job_assignments (
    organization_id,
    reservation_id,
    driver_id,
    status,
    offered_by
  ) values (
    v_res.organization_id,
    v_res.id,
    v_driver.id,
    'oferecido',
    auth.uid()
  )
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'assignment.offer',
    'job_assignments',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.assign_reservation_to_driver(uuid, uuid) from public;
grant execute on function public.assign_reservation_to_driver(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: driver accept / refuse
-- ---------------------------------------------------------------------------

create or replace function public.driver_respond_assignment(
  p_assignment_id uuid,
  p_accept boolean,
  p_refuse_reason text default null
)
returns public.job_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.job_assignments;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.job_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.is_driver_user(v_row.driver_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.status <> 'oferecido' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  if p_accept then
    update public.job_assignments
    set
      status = 'aceito',
      responded_at = now(),
      refuse_reason = null
    where id = v_row.id
    returning * into v_row;
  else
    update public.job_assignments
    set
      status = 'recusado',
      responded_at = now(),
      refuse_reason = nullif(btrim(coalesce(p_refuse_reason, '')), '')
    where id = v_row.id
    returning * into v_row;
    -- Demand returns to "sem motorista" (no active assignment)
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_row.organization_id,
    auth.uid(),
    case when p_accept then 'assignment.accept' else 'assignment.refuse' end,
    'job_assignments',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.driver_respond_assignment(uuid, boolean, text) from public;
grant execute on function public.driver_respond_assignment(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: complete job + create financial entry
-- ---------------------------------------------------------------------------

create or replace function public.complete_reservation_job(
  p_reservation_id uuid
)
returns public.financial_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_asg public.job_assignments;
  v_pct numeric;
  v_gross numeric;
  v_commission numeric;
  v_driver_amt numeric;
  v_fin public.financial_entries;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_res.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_asg
  from public.job_assignments
  where reservation_id = v_res.id
    and status = 'aceito'
  order by offered_at desc
  limit 1
  for update;

  if not found then
    raise exception 'NO_ACCEPTED_ASSIGNMENT' using errcode = 'P0001';
  end if;

  v_gross := coalesce(v_res.override_price, v_res.estimated_price, 0);
  v_pct := public.org_commission_percent(v_res.organization_id);
  v_commission := round(v_gross * v_pct / 100.0, 2);
  v_driver_amt := greatest(v_gross - v_commission, 0);

  update public.job_assignments
  set status = 'concluido', responded_at = coalesce(responded_at, now())
  where id = v_asg.id;

  update public.reservations
  set status = 'concluido', updated_at = now()
  where id = v_res.id;

  insert into public.financial_entries (
    organization_id,
    reservation_id,
    driver_id,
    assignment_id,
    gross_amount,
    commission_percent,
    commission_amount,
    driver_amount,
    currency,
    status
  ) values (
    v_res.organization_id,
    v_res.id,
    v_asg.driver_id,
    v_asg.id,
    v_gross,
    v_pct,
    v_commission,
    v_driver_amt,
    coalesce(v_res.currency, 'BRL'),
    'a_liquidar'
  )
  on conflict (reservation_id) do update
  set
    driver_id = excluded.driver_id,
    assignment_id = excluded.assignment_id,
    gross_amount = excluded.gross_amount,
    commission_percent = excluded.commission_percent,
    commission_amount = excluded.commission_amount,
    driver_amount = excluded.driver_amount,
    status = 'a_liquidar',
    updated_at = now()
  returning * into v_fin;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'reservation.complete_job',
    'financial_entries',
    v_fin.id::text,
    to_jsonb(v_fin)
  );

  return v_fin;
end;
$$;

revoke all on function public.complete_reservation_job(uuid) from public;
grant execute on function public.complete_reservation_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: liquidate financial entry
-- ---------------------------------------------------------------------------

create or replace function public.liquidate_financial_entry(
  p_entry_id uuid
)
returns public.financial_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.financial_entries;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row from public.financial_entries where id = p_entry_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_admin_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.financial_entries
  set status = 'liquidado', liquidated_at = now(), updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.liquidate_financial_entry(uuid) from public;
grant execute on function public.liquidate_financial_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: driver-facing job detail (masked customer first name only)
-- ---------------------------------------------------------------------------

create or replace function public.get_driver_job_detail(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asg public.job_assignments;
  v_res public.reservations;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_asg from public.job_assignments where id = p_assignment_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.is_driver_user(v_asg.driver_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = v_asg.reservation_id;

  return jsonb_build_object(
    'assignment_id', v_asg.id,
    'status', v_asg.status,
    'offered_at', v_asg.offered_at,
    'responded_at', v_asg.responded_at,
    'refuse_reason', v_asg.refuse_reason,
    'service', jsonb_build_object(
      'reservation_id', v_res.id,
      'customer_first_name', public.customer_first_name(v_res.customer_name),
      'origin_address', v_res.origin_address,
      'destination_address', v_res.destination_address,
      'stops', coalesce(v_res.stops, '{}'::text[]),
      'service_type', v_res.service_type,
      'airport', v_res.airport,
      'slot_start', v_res.slot_start,
      'slot_end', v_res.slot_end,
      'hours_requested', v_res.hours_requested,
      'estimated_km', v_res.estimated_km,
      'notes', v_res.notes
    )
  );
end;
$$;

revoke all on function public.get_driver_job_detail(uuid) from public;
grant execute on function public.get_driver_job_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: claim driver seat by matching email (after signup/login)
-- ---------------------------------------------------------------------------

create or replace function public.claim_my_driver_profile(
  p_organization_id uuid
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_row public.drivers;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is null then
    raise exception 'NO_EMAIL' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.drivers
  where organization_id = p_organization_id
    and lower(email) = v_email
  for update;

  if not found then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_row.user_id is not null and v_row.user_id <> auth.uid() then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.drivers
  set user_id = auth.uid()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.claim_my_driver_profile(uuid) from public;
grant execute on function public.claim_my_driver_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update org commission percent (admin)
-- ---------------------------------------------------------------------------

create or replace function public.set_org_commission_percent(
  p_organization_id uuid,
  p_percent numeric
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.organizations;
  v_pct numeric;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.can_admin_org(p_organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_pct := greatest(0, least(100, coalesce(p_percent, 0)));

  update public.organizations
  set
    settings = jsonb_set(
      coalesce(settings, '{}'::jsonb),
      '{platform_commission_percent}',
      to_jsonb(v_pct),
      true
    ),
    updated_at = now()
  where id = p_organization_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_org_commission_percent(uuid, numeric) from public;
grant execute on function public.set_org_commission_percent(uuid, numeric) to authenticated;

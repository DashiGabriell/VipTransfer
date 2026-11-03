-- JMD Transfer platform — multi-tenant foundation (v1)
-- Roles: platform (dev, platform_owner) + org (owner, admin, operador, leitura)

create extension if not exists pgcrypto;

create type public.org_role as enum ('owner', 'admin', 'operador', 'leitura');
create type public.platform_role as enum ('dev', 'platform_owner');
create type public.reservation_status as enum (
  'hold',
  'hold_expirado',
  'confirmado',
  'cancelado',
  'concluido'
);
create type public.service_type as enum (
  'aeroporto',
  'corporativo',
  'horas_a_disposicao',
  'viagem'
);
create type public.airport_code as enum ('GRU', 'CGH', 'VCP');

-- ---------------------------------------------------------------------------
-- Organizations & identity
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_slug_unique unique (slug)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  preferred_locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_org_idx on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- Fleet & freight
-- ---------------------------------------------------------------------------

create table public.vehicle_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name_i18n jsonb not null default '{"pt":"","en":""}'::jsonb,
  description_i18n jsonb not null default '{"pt":"","en":""}'::jsonb,
  is_armored boolean not null default false,
  passenger_capacity int,
  luggage_capacity int,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicle_categories_org_idx on public.vehicle_categories (organization_id);

create table public.freight_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_category_id uuid references public.vehicle_categories (id) on delete cascade,
  service_type public.service_type,
  price_per_km numeric(12, 2) not null default 0 check (price_per_km >= 0),
  minimum_fare numeric(12, 2) not null default 0 check (minimum_fare >= 0),
  price_per_hour numeric(12, 2) check (price_per_hour is null or price_per_hour >= 0),
  currency text not null default 'BRL',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index freight_rules_org_idx on public.freight_rules (organization_id);

create table public.airport_fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  airport public.airport_code not null,
  flat_fee numeric(12, 2) not null default 0 check (flat_fee >= 0),
  currency text not null default 'BRL',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint airport_fees_unique unique (organization_id, airport)
);

-- ---------------------------------------------------------------------------
-- Availability / capacity
-- ---------------------------------------------------------------------------

create table public.capacity_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  slot_minutes int not null default 30 check (slot_minutes > 0),
  default_capacity int not null default 1 check (default_capacity > 0),
  hold_minutes int not null default 60 check (hold_minutes > 0),
  timezone text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null day_of_week + specific_date = one-off; day_of_week 0-6 = weekly pattern
  day_of_week smallint check (day_of_week is null or (day_of_week between 0 and 6)),
  specific_date date,
  start_time time not null,
  end_time time not null,
  is_blackout boolean not null default false,
  capacity_override int check (capacity_override is null or capacity_override > 0),
  created_at timestamptz not null default now(),
  constraint availability_windows_time check (end_time > start_time),
  constraint availability_windows_scope check (
    (specific_date is not null and day_of_week is null)
    or (specific_date is null and day_of_week is not null)
  )
);

create index availability_windows_org_idx on public.availability_windows (organization_id);

-- ---------------------------------------------------------------------------
-- Reservations (leads + holds)
-- ---------------------------------------------------------------------------

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status public.reservation_status not null default 'hold',
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  origin_address text not null,
  origin_lat double precision,
  origin_lng double precision,
  destination_address text not null,
  destination_lat double precision,
  destination_lng double precision,
  service_type public.service_type not null,
  vehicle_category_id uuid references public.vehicle_categories (id) on delete set null,
  airport public.airport_code,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  hours_requested numeric(6, 2),
  estimated_km numeric(12, 2),
  estimated_price numeric(12, 2),
  override_km numeric(12, 2),
  override_price numeric(12, 2),
  currency text not null default 'BRL',
  hold_expires_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  notes text,
  source text not null default 'web',
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_slot check (slot_end > slot_start)
);

create index reservations_org_status_idx on public.reservations (organization_id, status);
create index reservations_org_slot_idx on public.reservations (organization_id, slot_start, slot_end);
create index reservations_hold_expires_idx on public.reservations (hold_expires_at)
  where status = 'hold';

-- ---------------------------------------------------------------------------
-- Audit (append-only)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  impersonator_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (security definer in private schema)
-- ---------------------------------------------------------------------------

create schema if not exists private;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

create or replace function private.has_org_role(
  p_org_id uuid,
  p_roles public.org_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.is_platform_admin()
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = p_org_id
        and m.user_id = auth.uid()
        and m.role = any (p_roles)
    );
$$;

create or replace function private.can_read_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_org_role(
    p_org_id,
    array['owner', 'admin', 'operador', 'leitura']::public.org_role[]
  );
$$;

create or replace function private.can_operate_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_org_role(
    p_org_id,
    array['owner', 'admin', 'operador']::public.org_role[]
  );
$$;

create or replace function private.can_admin_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_org_role(
    p_org_id,
    array['owner', 'admin']::public.org_role[]
  );
$$;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
grant usage on schema private to postgres, service_role;

-- Keep helpers callable from RLS policies
grant execute on function private.is_platform_admin() to authenticated, anon;
grant execute on function private.has_org_role(uuid, public.org_role[]) to authenticated, anon;
grant execute on function private.can_read_org(uuid) to authenticated, anon;
grant execute on function private.can_operate_org(uuid) to authenticated, anon;
grant execute on function private.can_admin_org(uuid) to authenticated, anon;

-- Profile bootstrap on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Slot capacity: active holds + confirmed consume capacity
create or replace function public.reservation_occupies_capacity(p_status public.reservation_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('hold', 'confirmado');
$$;

create or replace function public.count_slot_occupancy(
  p_org_id uuid,
  p_slot_start timestamptz,
  p_slot_end timestamptz,
  p_exclude_id uuid default null
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.reservations r
  where r.organization_id = p_org_id
    and public.reservation_occupies_capacity(r.status)
    and r.slot_start < p_slot_end
    and r.slot_end > p_slot_start
    and (p_exclude_id is null or r.id <> p_exclude_id);
$$;

grant execute on function public.count_slot_occupancy(uuid, timestamptz, timestamptz, uuid) to authenticated, anon, service_role;

-- Expire holds (called by cron / edge function)
create or replace function public.expire_reservation_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  with expired as (
    update public.reservations
    set
      status = 'hold_expirado',
      updated_at = now()
    where status = 'hold'
      and hold_expires_at is not null
      and hold_expires_at <= now()
    returning id
  )
  select count(*)::int into updated_count from expired;
  return updated_count;
end;
$$;

revoke all on function public.expire_reservation_holds() from public;
grant execute on function public.expire_reservation_holds() to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organization_members enable row level security;
alter table public.vehicle_categories enable row level security;
alter table public.freight_rules enable row level security;
alter table public.airport_fees enable row level security;
alter table public.capacity_settings enable row level security;
alter table public.availability_windows enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_select_self_or_platform
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_platform_admin());

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- platform_admins: only platform can read; writes via service role / SQL
create policy platform_admins_select
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid() or private.is_platform_admin());

-- organizations
create policy organizations_select_member_or_platform
  on public.organizations for select to authenticated
  using (private.can_read_org(id) or private.is_platform_admin());

create policy organizations_select_public_by_slug
  on public.organizations for select to anon, authenticated
  using (true);

create policy organizations_insert_platform
  on public.organizations for insert to authenticated
  with check (private.is_platform_admin());

create policy organizations_update_owner_or_platform
  on public.organizations for update to authenticated
  using (
    private.is_platform_admin()
    or private.has_org_role(id, array['owner']::public.org_role[])
  )
  with check (
    private.is_platform_admin()
    or private.has_org_role(id, array['owner']::public.org_role[])
  );

-- organization_members
create policy members_select
  on public.organization_members for select to authenticated
  using (private.can_read_org(organization_id) or user_id = auth.uid());

create policy members_insert_owner_or_platform
  on public.organization_members for insert to authenticated
  with check (
    private.is_platform_admin()
    or private.has_org_role(organization_id, array['owner']::public.org_role[])
  );

create policy members_update_owner_or_platform
  on public.organization_members for update to authenticated
  using (
    private.is_platform_admin()
    or private.has_org_role(organization_id, array['owner']::public.org_role[])
  )
  with check (
    private.is_platform_admin()
    or private.has_org_role(organization_id, array['owner']::public.org_role[])
  );

create policy members_delete_owner_or_platform
  on public.organization_members for delete to authenticated
  using (
    private.is_platform_admin()
    or private.has_org_role(organization_id, array['owner']::public.org_role[])
  );

-- Public read for booking UI (active catalog)
create policy vehicle_categories_public_select
  on public.vehicle_categories for select to anon, authenticated
  using (active = true or private.can_read_org(organization_id));

create policy vehicle_categories_admin_write
  on public.vehicle_categories for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

create policy freight_rules_public_select
  on public.freight_rules for select to anon, authenticated
  using (active = true or private.can_read_org(organization_id));

create policy freight_rules_admin_write
  on public.freight_rules for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

create policy airport_fees_public_select
  on public.airport_fees for select to anon, authenticated
  using (active = true or private.can_read_org(organization_id));

create policy airport_fees_admin_write
  on public.airport_fees for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

create policy capacity_settings_public_select
  on public.capacity_settings for select to anon, authenticated
  using (true);

create policy capacity_settings_admin_write
  on public.capacity_settings for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

create policy availability_windows_public_select
  on public.availability_windows for select to anon, authenticated
  using (true);

create policy availability_windows_admin_write
  on public.availability_windows for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

-- Reservations: public can insert (create hold); staff read/update
create policy reservations_public_insert
  on public.reservations for insert to anon, authenticated
  with check (status = 'hold');

create policy reservations_staff_select
  on public.reservations for select to authenticated
  using (private.can_read_org(organization_id));

create policy reservations_staff_update
  on public.reservations for update to authenticated
  using (private.can_operate_org(organization_id))
  with check (private.can_operate_org(organization_id));

-- Audit: insert via authenticated staff / service; select owner+platform+dev
create policy audit_logs_select
  on public.audit_logs for select to authenticated
  using (
    private.is_platform_admin()
    or (
      organization_id is not null
      and private.has_org_role(organization_id, array['owner']::public.org_role[])
    )
  );

create policy audit_logs_insert
  on public.audit_logs for insert to authenticated
  with check (
    actor_id = auth.uid()
    or private.is_platform_admin()
  );

-- Prevent updates/deletes on audit via RLS (no policies = denied for those cmds for non-owner roles)
-- Explicit deny for update/delete by omitting policies.

-- ---------------------------------------------------------------------------
-- Seed: JMD organization
-- ---------------------------------------------------------------------------

insert into public.organizations (slug, name, settings)
values (
  'jmd',
  'JMD Transfer',
  jsonb_build_object(
    'timezone', 'America/Sao_Paulo',
    'locales', jsonb_build_array('pt-BR', 'en'),
    'defaultLocale', 'pt-BR',
    'whatsapp', '5511999999999',
    'contactEmail', 'contato@jmdtransfer.com.br',
    'brand', jsonb_build_object(
      'primary', '#20324D',
      'primaryDark', '#18263B',
      'backgroundLight', '#F3EFE8'
    )
  )
);

insert into public.capacity_settings (organization_id)
select id from public.organizations where slug = 'jmd';

insert into public.airport_fees (organization_id, airport, flat_fee)
select o.id, a.airport, 0
from public.organizations o
cross join (values ('GRU'::public.airport_code), ('CGH'), ('VCP')) as a(airport)
where o.slug = 'jmd';

-- Platform console: status de org, settings, impersonation, RPCs cross-tenant

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'org_status'
  ) then
    create type public.org_status as enum ('active', 'paused');
  end if;
end $$;

alter table public.organizations
  add column if not exists status public.org_status not null default 'active';

create index if not exists organizations_status_idx
  on public.organizations (status);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select_staff on public.platform_settings;
create policy platform_settings_select_staff
  on public.platform_settings for select to authenticated
  using (private.is_platform_admin());

-- writes only via RPC

insert into public.platform_settings (key, value)
values
  (
    'flags',
    jsonb_build_object(
      'public_maintenance', false,
      'block_new_reservations', false,
      'banner_message', ''
    )
  )
on conflict (key) do nothing;

create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  impersonator_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  target_membership_id uuid references public.organization_members (id) on delete set null,
  reason text not null,
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint impersonation_reason_len check (char_length(btrim(reason)) between 3 and 500),
  constraint impersonation_not_self check (impersonator_id <> target_user_id)
);

create index if not exists impersonation_sessions_active_idx
  on public.impersonation_sessions (impersonator_id, expires_at)
  where ended_at is null;

alter table public.impersonation_sessions enable row level security;

drop policy if exists impersonation_sessions_select_own on public.impersonation_sessions;
create policy impersonation_sessions_select_own
  on public.impersonation_sessions for select to authenticated
  using (
    impersonator_id = auth.uid()
    or private.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_platform_admin();
$$;

create or replace function private.is_platform_dev()
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
      and pa.role = 'dev'
  );
$$;

create or replace function private.is_platform_owner_role()
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
      and pa.role = 'platform_owner'
  );
$$;

create or replace function private.current_impersonation()
returns public.impersonation_sessions
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.impersonation_sessions s
  where s.impersonator_id = auth.uid()
    and s.ended_at is null
    and s.expires_at > now()
  order by s.created_at desc
  limit 1;
$$;

create or replace function private.audit_impersonator_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select (private.current_impersonation()).impersonator_id;
$$;

grant execute on function private.is_platform_staff() to authenticated, anon;
grant execute on function private.is_platform_dev() to authenticated, anon;
grant execute on function private.is_platform_owner_role() to authenticated, anon;
grant execute on function private.current_impersonation() to authenticated;
grant execute on function private.audit_impersonator_id() to authenticated;

create or replace function private.assert_platform_staff()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not private.is_platform_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.assert_org_accepts_holds(p_organization_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status public.org_status;
  v_flags jsonb;
begin
  select o.status into v_status
  from public.organizations o
  where o.id = p_organization_id;

  if not found then
    raise exception 'ORG_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status = 'paused' then
    raise exception 'ORG_PAUSED' using errcode = 'P0001';
  end if;

  select ps.value into v_flags
  from public.platform_settings ps
  where ps.key = 'flags';

  if coalesce((v_flags ->> 'block_new_reservations')::boolean, false)
     or coalesce((v_flags ->> 'public_maintenance')::boolean, false)
  then
    raise exception 'MAINTENANCE' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.audit_logs_fill_impersonator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.impersonation_sessions;
begin
  if NEW.impersonator_id is null and auth.uid() is not null then
    v_session := private.current_impersonation();
    if v_session.id is not null then
      NEW.impersonator_id := v_session.impersonator_id;
      if NEW.actor_id is null or NEW.actor_id = v_session.impersonator_id then
        NEW.actor_id := v_session.target_user_id;
      end if;
      if NEW.organization_id is null then
        NEW.organization_id := v_session.organization_id;
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists audit_logs_fill_impersonator_trg on public.audit_logs;
create trigger audit_logs_fill_impersonator_trg
  before insert on public.audit_logs
  for each row
  execute function public.audit_logs_fill_impersonator();

create or replace function public.reservations_guard_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'hold' then
    perform private.assert_org_accepts_holds(NEW.organization_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists reservations_guard_hold_trg on public.reservations;
create trigger reservations_guard_hold_trg
  before insert on public.reservations
  for each row
  execute function public.reservations_guard_hold();

-- ---------------------------------------------------------------------------
-- Seed helpers for new orgs
-- ---------------------------------------------------------------------------

create or replace function private.seed_organization_defaults(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.capacity_settings (organization_id, slot_minutes, default_capacity, hold_minutes)
  values (p_org_id, 60, 1, 720)
  on conflict (organization_id) do nothing;

  insert into public.airport_fees (organization_id, airport, flat_fee)
  values
    (p_org_id, 'GRU', 0),
    (p_org_id, 'CGH', 0),
    (p_org_id, 'VCP', 0)
  on conflict (organization_id, airport) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: me / overview
-- ---------------------------------------------------------------------------

create or replace function public.platform_get_my_role()
returns public.platform_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.platform_role;
begin
  if auth.uid() is null then
    return null;
  end if;
  select pa.role into v_role
  from public.platform_admins pa
  where pa.user_id = auth.uid();
  return v_role;
end;
$$;

grant execute on function public.platform_get_my_role() to authenticated;

create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform private.assert_platform_staff();

  select jsonb_build_object(
    'orgs_active', (select count(*)::int from public.organizations where status = 'active'),
    'orgs_paused', (select count(*)::int from public.organizations where status = 'paused'),
    'holds_24h', (
      select count(*)::int from public.reservations
      where status = 'hold' and created_at >= now() - interval '24 hours'
    ),
    'confirmed_24h', (
      select count(*)::int from public.reservations
      where status = 'confirmado' and coalesce(confirmed_at, created_at) >= now() - interval '24 hours'
    ),
    'confirmed_7d', (
      select count(*)::int from public.reservations
      where status = 'confirmado' and coalesce(confirmed_at, created_at) >= now() - interval '7 days'
    ),
    'drivers_active', (
      select count(*)::int from public.drivers where active = true
    ),
    'payment_errors_7d', (
      select count(*)::int from public.payment_charges
      where status in ('expirada', 'cancelada', 'estornada')
        and created_at >= now() - interval '7 days'
    ),
    'recent_audit', coalesce((
      select jsonb_agg(row_to_json(a)::jsonb order by a.created_at desc)
      from (
        select id, organization_id, actor_id, impersonator_id, action, entity_type, entity_id, created_at
        from public.audit_logs
        order by created_at desc
        limit 15
      ) a
    ), '[]'::jsonb),
    'problem_orgs', coalesce((
      select jsonb_agg(row_to_json(q)::jsonb)
      from (
        select p.*
        from (
          select
            o.id,
            o.slug,
            o.name,
            o.status,
            (
              select count(*)::int from public.reservations r
              where r.organization_id = o.id
                and r.status = 'hold'
                and r.hold_expires_at is not null
                and r.hold_expires_at < now() + interval '2 hours'
            ) as holds_expiring_soon,
            (
              select count(*)::int from public.organization_members m
              where m.organization_id = o.id and m.role = 'owner'
            ) as owners
          from public.organizations o
        ) p
        where p.holds_expiring_soon > 0 or p.owners = 0 or p.status = 'paused'
        limit 20
      ) q
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.platform_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Orgs
-- ---------------------------------------------------------------------------

create or replace function public.platform_list_organizations()
returns table (
  id uuid,
  slug text,
  name text,
  status public.org_status,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  reservations_30d bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform private.assert_platform_staff();

  return query
  select
    o.id,
    o.slug,
    o.name,
    o.status,
    o.settings,
    o.created_at,
    o.updated_at,
    (select count(*) from public.organization_members m where m.organization_id = o.id) as member_count,
    (
      select count(*) from public.reservations r
      where r.organization_id = o.id
        and r.created_at >= now() - interval '30 days'
    ) as reservations_30d
  from public.organizations o
  order by o.created_at desc;
end;
$$;

grant execute on function public.platform_list_organizations() to authenticated;

create or replace function public.platform_get_organization(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_members jsonb;
begin
  perform private.assert_platform_staff();

  select * into v_org from public.organizations where id = p_org_id;
  if not found then
    raise exception 'ORG_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at), '[]'::jsonb)
  into v_members
  from (
    select
      m.id,
      m.organization_id,
      m.user_id,
      m.role,
      m.created_at,
      p.full_name,
      u.email
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.organization_id = p_org_id
  ) x;

  return jsonb_build_object(
    'organization', row_to_json(v_org)::jsonb,
    'members', v_members,
    'capacity', (
      select row_to_json(cs)::jsonb from public.capacity_settings cs
      where cs.organization_id = p_org_id
    ),
    'airport_fees', coalesce((
      select jsonb_agg(row_to_json(af)::jsonb order by af.airport)
      from public.airport_fees af where af.organization_id = p_org_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.platform_get_organization(uuid) to authenticated;

create or replace function public.platform_upsert_organization(
  p_id uuid default null,
  p_slug text default null,
  p_name text default null,
  p_status public.org_status default null,
  p_settings jsonb default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.organizations;
  v_row public.organizations;
  v_slug text;
  v_name text;
  v_settings jsonb;
begin
  perform private.assert_platform_staff();

  if p_id is null then
    v_slug := lower(trim(coalesce(p_slug, '')));
    v_name := trim(coalesce(p_name, ''));
    if v_slug = '' or v_name = '' then
      raise exception 'INVALID_INPUT' using errcode = 'P0001';
    end if;
    if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'INVALID_SLUG' using errcode = 'P0001';
    end if;

    v_settings := coalesce(p_settings, '{}'::jsonb);

    insert into public.organizations (slug, name, settings, status)
    values (v_slug, v_name, v_settings, coalesce(p_status, 'active'))
    returning * into v_row;

    perform private.seed_organization_defaults(v_row.id);

    insert into public.audit_logs (
      organization_id, actor_id, action, entity_type, entity_id, after_data
    ) values (
      v_row.id, auth.uid(), 'platform.create_org', 'organization', v_row.id::text, to_jsonb(v_row)
    );

    return v_row;
  end if;

  select * into v_before from public.organizations where id = p_id for update;
  if not found then
    raise exception 'ORG_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.organizations
  set
    slug = coalesce(nullif(lower(trim(p_slug)), ''), slug),
    name = coalesce(nullif(trim(p_name), ''), name),
    status = coalesce(p_status, status),
    settings = case when p_settings is null then settings else p_settings end,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_row.id, auth.uid(), 'platform.update_org', 'organization', v_row.id::text,
    to_jsonb(v_before), to_jsonb(v_row)
  );

  return v_row;
end;
$$;

grant execute on function public.platform_upsert_organization(uuid, text, text, public.org_status, jsonb) to authenticated;

create or replace function public.platform_set_membership(
  p_organization_id uuid,
  p_user_id uuid default null,
  p_email text default null,
  p_role public.org_role default 'operador',
  p_remove boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_before public.organization_members;
  v_row public.organization_members;
begin
  perform private.assert_platform_staff();

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORG_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_user_id := p_user_id;
  if v_user_id is null and p_email is not null then
    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
    limit 1;
  end if;

  if v_user_id is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_before
  from public.organization_members
  where organization_id = p_organization_id and user_id = v_user_id;

  if p_remove then
    if not found then
      return jsonb_build_object('removed', false);
    end if;
    delete from public.organization_members where id = v_before.id;
    insert into public.audit_logs (
      organization_id, actor_id, action, entity_type, entity_id, before_data
    ) values (
      p_organization_id, auth.uid(), 'platform.remove_membership', 'organization_member',
      v_before.id::text, to_jsonb(v_before)
    );
    return jsonb_build_object('removed', true, 'before', to_jsonb(v_before));
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (p_organization_id, v_user_id, p_role)
  on conflict (organization_id, user_id)
  do update set role = excluded.role
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_organization_id, auth.uid(), 'platform.set_membership', 'organization_member',
    v_row.id::text, to_jsonb(v_before), to_jsonb(v_row)
  );

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.platform_set_membership(uuid, uuid, text, public.org_role, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Users / platform roles
-- ---------------------------------------------------------------------------

create or replace function public.platform_search_users(p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  perform private.assert_platform_staff();

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.email)
    from (
      select
        p.id,
        p.full_name,
        u.email,
        pa.role as platform_role,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'organization_id', m.organization_id,
            'role', m.role,
            'org_slug', o.slug,
            'org_name', o.name
          ))
          from public.organization_members m
          join public.organizations o on o.id = m.organization_id
          where m.user_id = p.id
        ), '[]'::jsonb) as memberships
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.platform_admins pa on pa.user_id = p.id
      where v_q = ''
         or lower(coalesce(u.email, '')) like '%' || v_q || '%'
         or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
      order by u.email
      limit 50
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.platform_search_users(text) to authenticated;

create or replace function public.platform_set_platform_role(
  p_user_id uuid,
  p_role public.platform_role default null,
  p_remove boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.platform_admins;
  v_my_role public.platform_role;
begin
  perform private.assert_platform_staff();

  select pa.role into v_my_role
  from public.platform_admins pa
  where pa.user_id = auth.uid();

  if p_remove then
    if v_my_role <> 'platform_owner' then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    select * into v_before from public.platform_admins where user_id = p_user_id;
    delete from public.platform_admins where user_id = p_user_id;
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, before_data
    ) values (
      auth.uid(), 'platform.remove_platform_role', 'platform_admin', p_user_id::text, to_jsonb(v_before)
    );
    return jsonb_build_object('removed', true);
  end if;

  if p_role is null then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- only platform_owner can assign platform_owner; either staff can assign/remove? assign: owner only for owner role
  if p_role = 'platform_owner' and v_my_role <> 'platform_owner' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_role = 'dev' and v_my_role not in ('platform_owner', 'dev') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- only platform_owner promotes to dev (plan: only platform_owner can promote dev)
  if p_role = 'dev' and v_my_role <> 'platform_owner' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_before from public.platform_admins where user_id = p_user_id;

  insert into public.platform_admins (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    auth.uid(), 'platform.set_platform_role', 'platform_admin', p_user_id::text,
    to_jsonb(v_before),
    jsonb_build_object('user_id', p_user_id, 'role', p_role)
  );

  return jsonb_build_object('user_id', p_user_id, 'role', p_role);
end;
$$;

grant execute on function public.platform_set_platform_role(uuid, public.platform_role, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Impersonation
-- ---------------------------------------------------------------------------

create or replace function public.platform_start_impersonation(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_reason text,
  p_duration_minutes int default 60
)
returns public.impersonation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.organization_members;
  v_target_platform public.platform_role;
  v_my_role public.platform_role;
  v_row public.impersonation_sessions;
  v_minutes int := greatest(least(coalesce(p_duration_minutes, 60), 120), 15);
begin
  perform private.assert_platform_staff();

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select pa.role into v_my_role from public.platform_admins pa where pa.user_id = auth.uid();
  select pa.role into v_target_platform from public.platform_admins pa where pa.user_id = p_target_user_id;

  if v_target_platform = 'dev' and v_my_role <> 'dev' then
    raise exception 'FORBIDDEN_IMPERSONATE_DEV' using errcode = 'P0001';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'CANNOT_IMPERSONATE_SELF' using errcode = 'P0001';
  end if;

  select * into v_membership
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_target_user_id;

  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_membership.role not in ('owner', 'admin', 'operador') then
    raise exception 'INVALID_TARGET_ROLE' using errcode = 'P0001';
  end if;

  -- end any previous active session for this impersonator
  update public.impersonation_sessions
  set ended_at = now()
  where impersonator_id = auth.uid()
    and ended_at is null;

  insert into public.impersonation_sessions (
    impersonator_id,
    target_user_id,
    organization_id,
    target_membership_id,
    reason,
    expires_at
  ) values (
    auth.uid(),
    p_target_user_id,
    p_organization_id,
    v_membership.id,
    trim(p_reason),
    now() + make_interval(mins => v_minutes)
  )
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, impersonator_id, action, entity_type, entity_id, after_data
  ) values (
    p_organization_id,
    p_target_user_id,
    auth.uid(),
    'platform.start_impersonation',
    'impersonation_session',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

grant execute on function public.platform_start_impersonation(uuid, uuid, text, int) to authenticated;

create or replace function public.platform_end_impersonation(
  p_session_id uuid default null
)
returns public.impersonation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.impersonation_sessions;
begin
  perform private.assert_platform_staff();

  if p_session_id is null then
    select * into v_row
    from public.impersonation_sessions
    where impersonator_id = auth.uid()
      and ended_at is null
    order by created_at desc
    limit 1
    for update;
  else
    select * into v_row
    from public.impersonation_sessions
    where id = p_session_id
      and impersonator_id = auth.uid()
    for update;
  end if;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_row.ended_at is not null then
    return v_row;
  end if;

  update public.impersonation_sessions
  set ended_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, impersonator_id, action, entity_type, entity_id, after_data
  ) values (
    v_row.organization_id,
    v_row.target_user_id,
    auth.uid(),
    'platform.end_impersonation',
    'impersonation_session',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

grant execute on function public.platform_end_impersonation(uuid) to authenticated;

create or replace function public.platform_get_active_impersonation()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.impersonation_sessions;
  v_org public.organizations;
  v_profile public.profiles;
  v_email text;
  v_role public.org_role;
begin
  if auth.uid() is null then
    return null;
  end if;

  v_session := private.current_impersonation();
  if v_session.id is null then
    return null;
  end if;

  select * into v_org from public.organizations where id = v_session.organization_id;
  select * into v_profile from public.profiles where id = v_session.target_user_id;
  select u.email into v_email from auth.users u where u.id = v_session.target_user_id;
  select m.role into v_role
  from public.organization_members m
  where m.id = v_session.target_membership_id;

  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'organization', jsonb_build_object(
      'id', v_org.id,
      'slug', v_org.slug,
      'name', v_org.name
    ),
    'target', jsonb_build_object(
      'id', v_profile.id,
      'full_name', v_profile.full_name,
      'email', v_email,
      'role', v_role
    )
  );
end;
$$;

grant execute on function public.platform_get_active_impersonation() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create or replace function public.platform_list_audit(
  p_organization_id uuid default null,
  p_actor_id uuid default null,
  p_impersonator_id uuid default null,
  p_action text default null,
  p_entity_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 100
)
returns setof public.audit_logs
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform private.assert_platform_staff();

  return query
  select a.*
  from public.audit_logs a
  where (p_organization_id is null or a.organization_id = p_organization_id)
    and (p_actor_id is null or a.actor_id = p_actor_id)
    and (p_impersonator_id is null or a.impersonator_id = p_impersonator_id)
    and (p_action is null or a.action ilike '%' || p_action || '%')
    and (p_entity_type is null or a.entity_type = p_entity_type)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to)
  order by a.created_at desc
  limit greatest(least(coalesce(p_limit, 100), 500), 1);
end;
$$;

grant execute on function public.platform_list_audit(uuid, uuid, uuid, text, text, timestamptz, timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Ops + settings
-- ---------------------------------------------------------------------------

create or replace function public.platform_ops_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform private.assert_platform_staff();

  return jsonb_build_object(
    'open_holds', (
      select count(*)::int from public.reservations where status = 'hold'
    ),
    'holds_past_expiry', (
      select count(*)::int from public.reservations
      where status = 'hold'
        and hold_expires_at is not null
        and hold_expires_at <= now()
    ),
    'payment_charges_open', (
      select count(*)::int from public.payment_charges where status = 'emitida'
    ),
    'payment_charges_failed_7d', (
      select count(*)::int from public.payment_charges
      where status in ('expirada', 'cancelada', 'estornada')
        and created_at >= now() - interval '7 days'
    ),
    'recent_webhooks', coalesce((
      select jsonb_agg(row_to_json(w)::jsonb order by w.processed_at desc)
      from (
        select id, event, checkout_id, payment_charge_id, processed_at
        from public.asaas_webhook_events
        order by processed_at desc
        limit 20
      ) w
    ), '[]'::jsonb),
    'is_dev', private.is_platform_dev()
  );
end;
$$;

grant execute on function public.platform_ops_snapshot() to authenticated;

create or replace function public.platform_run_expire_holds()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform private.assert_platform_staff();
  if not private.is_platform_dev() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_count := public.expire_reservation_holds();

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data
  ) values (
    auth.uid(), 'platform.run_expire_holds', 'system', 'expire_reservation_holds',
    jsonb_build_object('expired_count', v_count)
  );

  return jsonb_build_object('expired_count', v_count);
end;
$$;

grant execute on function public.platform_run_expire_holds() to authenticated;

create or replace function public.platform_get_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform private.assert_platform_staff();
  return coalesce((
    select jsonb_object_agg(ps.key, ps.value)
    from public.platform_settings ps
  ), '{}'::jsonb);
end;
$$;

grant execute on function public.platform_get_settings() to authenticated;

create or replace function public.platform_set_settings(
  p_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  perform private.assert_platform_staff();

  if p_key is null or btrim(p_key) = '' then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  select value into v_before from public.platform_settings where key = p_key;

  insert into public.platform_settings (key, value, updated_at, updated_by)
  values (p_key, coalesce(p_value, '{}'::jsonb), now(), auth.uid())
  on conflict (key) do update
  set value = excluded.value,
      updated_at = now(),
      updated_by = excluded.updated_by;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    auth.uid(), 'platform.set_settings', 'platform_settings', p_key,
    v_before, coalesce(p_value, '{}'::jsonb)
  );

  return public.platform_get_settings();
end;
$$;

grant execute on function public.platform_set_settings(text, jsonb) to authenticated;

create or replace function public.platform_public_flags()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'public_maintenance', coalesce((ps.value ->> 'public_maintenance')::boolean, false),
        'block_new_reservations', coalesce((ps.value ->> 'block_new_reservations')::boolean, false),
        'banner_message', coalesce(ps.value ->> 'banner_message', '')
      )
      from public.platform_settings ps
      where ps.key = 'flags'
    ),
    jsonb_build_object(
      'public_maintenance', false,
      'block_new_reservations', false,
      'banner_message', ''
    )
  );
$$;

grant execute on function public.platform_public_flags() to anon, authenticated;

-- Allow platform staff to read asaas webhook events for ops UI
drop policy if exists asaas_webhook_events_platform_select on public.asaas_webhook_events;
create policy asaas_webhook_events_platform_select
  on public.asaas_webhook_events for select to authenticated
  using (private.is_platform_admin());

notify pgrst, 'reload schema';

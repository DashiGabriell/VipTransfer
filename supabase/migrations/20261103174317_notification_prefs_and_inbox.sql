-- Notification preferences + in-app inbox for staff profiles

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  event_reservation_hold boolean not null default true,
  event_reservation_confirmed boolean not null default true,
  event_reservation_cancelled boolean not null default true,
  event_hold_expired boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_event_type_check check (
    event_type in (
      'reservation_hold',
      'reservation_confirmed',
      'reservation_cancelled',
      'hold_expired'
    )
  )
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select, insert, update on table public.notification_preferences to authenticated;
grant select, update on table public.notifications to authenticated;

create policy notification_preferences_select_own
  on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy notification_preferences_insert_own
  on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy notification_preferences_update_own
  on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notifications_select_own
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy notifications_update_own
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Seed prefs for existing profiles
insert into public.notification_preferences (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- Keep prefs row when profile is created
create or replace function private.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_notification_preferences on public.profiles;
create trigger profiles_ensure_notification_preferences
  after insert on public.profiles
  for each row
  execute function private.ensure_notification_preferences();

-- Fan-out helper (respects in-app channel + event toggles)
create or replace function private.notify_org_staff(
  p_organization_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_exclude_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    organization_id,
    event_type,
    title,
    body,
    payload
  )
  select
    m.user_id,
    p_organization_id,
    p_event_type,
    p_title,
    p_body,
    coalesce(p_payload, '{}'::jsonb)
  from public.organization_members m
  left join public.notification_preferences pref on pref.user_id = m.user_id
  where m.organization_id = p_organization_id
    and m.role in ('owner', 'admin', 'operador')
    and (p_exclude_user_id is null or m.user_id <> p_exclude_user_id)
    and coalesce(pref.in_app_enabled, true) = true
    and case p_event_type
      when 'reservation_hold' then coalesce(pref.event_reservation_hold, true)
      when 'reservation_confirmed' then coalesce(pref.event_reservation_confirmed, true)
      when 'reservation_cancelled' then coalesce(pref.event_reservation_cancelled, true)
      when 'hold_expired' then coalesce(pref.event_hold_expired, true)
      else false
    end;
end;
$$;

-- Patch create hold to notify staff
create or replace function public.create_reservation_with_hold(
  p_organization_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_origin_address text,
  p_destination_address text,
  p_service_type public.service_type,
  p_slot_start timestamptz,
  p_slot_end timestamptz,
  p_vehicle_category_id uuid default null,
  p_airport public.airport_code default null,
  p_hours_requested numeric default null,
  p_estimated_km numeric default null,
  p_estimated_price numeric default null,
  p_origin_lat double precision default null,
  p_origin_lng double precision default null,
  p_destination_lat double precision default null,
  p_destination_lng double precision default null,
  p_locale text default 'pt-BR',
  p_source text default 'web'
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_hold_minutes int;
  v_occupancy int;
  v_row public.reservations;
begin
  if p_slot_end <= p_slot_start then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;

  perform public.expire_reservation_holds();

  select cs.default_capacity, cs.hold_minutes
    into v_capacity, v_hold_minutes
  from public.capacity_settings cs
  where cs.organization_id = p_organization_id
  for update;

  if not found then
    v_capacity := 1;
    v_hold_minutes := 60;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || p_slot_start::text, 0)
  );

  v_occupancy := public.count_slot_occupancy(
    p_organization_id,
    p_slot_start,
    p_slot_end,
    null
  );

  if v_occupancy >= v_capacity then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.reservations (
    organization_id,
    status,
    customer_name,
    customer_phone,
    customer_email,
    origin_address,
    origin_lat,
    origin_lng,
    destination_address,
    destination_lat,
    destination_lng,
    service_type,
    vehicle_category_id,
    airport,
    slot_start,
    slot_end,
    hours_requested,
    estimated_km,
    estimated_price,
    hold_expires_at,
    locale,
    source
  ) values (
    p_organization_id,
    'hold',
    trim(p_customer_name),
    trim(p_customer_phone),
    lower(trim(p_customer_email)),
    trim(p_origin_address),
    p_origin_lat,
    p_origin_lng,
    trim(p_destination_address),
    p_destination_lat,
    p_destination_lng,
    p_service_type,
    p_vehicle_category_id,
    p_airport,
    p_slot_start,
    p_slot_end,
    p_hours_requested,
    p_estimated_km,
    p_estimated_price,
    now() + make_interval(mins => v_hold_minutes),
    coalesce(nullif(trim(p_locale), ''), 'pt-BR'),
    coalesce(nullif(trim(p_source), ''), 'web')
  )
  returning * into v_row;

  perform private.notify_org_staff(
    v_row.organization_id,
    'reservation_hold',
    'Nova reserva em hold',
    trim(p_customer_name) || ' · ' || to_char(p_slot_start at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    jsonb_build_object(
      'reservation_id', v_row.id,
      'customer_name', v_row.customer_name,
      'slot_start', v_row.slot_start,
      'status', v_row.status
    )
  );

  return v_row;
end;
$$;

create or replace function public.confirm_reservation(p_reservation_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reservations;
  v_capacity int;
  v_occupancy int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.status not in ('hold', 'hold_expirado') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  perform public.expire_reservation_holds();

  if v_row.status = 'hold_expirado' then
    select cs.default_capacity into v_capacity
    from public.capacity_settings cs
    where cs.organization_id = v_row.organization_id;

    if v_capacity is null then
      v_capacity := 1;
    end if;

    v_occupancy := public.count_slot_occupancy(
      v_row.organization_id,
      v_row.slot_start,
      v_row.slot_end,
      v_row.id
    );

    if v_occupancy >= v_capacity then
      raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  update public.reservations
  set
    status = 'confirmado',
    confirmed_at = now(),
    confirmed_by = auth.uid(),
    hold_expires_at = null,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_row.organization_id,
    auth.uid(),
    'reservation.confirm',
    'reservations',
    v_row.id::text,
    to_jsonb(v_row)
  );

  perform private.notify_org_staff(
    v_row.organization_id,
    'reservation_confirmed',
    'Reserva confirmada',
    coalesce(v_row.customer_name, 'Cliente') || ' · confirmado',
    jsonb_build_object(
      'reservation_id', v_row.id,
      'customer_name', v_row.customer_name,
      'slot_start', v_row.slot_start,
      'status', v_row.status
    ),
    auth.uid()
  );

  return v_row;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reservations;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.status in ('cancelado', 'concluido') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  update public.reservations
  set
    status = 'cancelado',
    updated_at = now(),
    hold_expires_at = null
  where id = v_row.id
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_row.organization_id,
    auth.uid(),
    'reservation.cancel',
    'reservations',
    v_row.id::text,
    to_jsonb(v_row)
  );

  perform private.notify_org_staff(
    v_row.organization_id,
    'reservation_cancelled',
    'Reserva cancelada',
    coalesce(v_row.customer_name, 'Cliente') || ' · cancelado',
    jsonb_build_object(
      'reservation_id', v_row.id,
      'customer_name', v_row.customer_name,
      'slot_start', v_row.slot_start,
      'status', v_row.status
    ),
    auth.uid()
  );

  return v_row;
end;
$$;

-- Mark helpers for client
create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notifications;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid()
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

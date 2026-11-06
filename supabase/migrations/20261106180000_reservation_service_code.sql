-- Código visual estável do serviço: JAN26-0001 (mês PT + ano 2 dígitos + seq do mês/org).

alter table public.reservations
  add column if not exists service_code text;

comment on column public.reservations.service_code is
  'Código público do serviço (ex.: JAN26-0001). Imutável após criação.';

create table if not exists public.reservation_service_code_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_key text not null,
  last_seq integer not null default 0,
  primary key (organization_id, period_key),
  constraint reservation_service_code_counters_seq_ck check (last_seq >= 0)
);

comment on table public.reservation_service_code_counters is
  'Contador mensal por organização para service_code (period_key = JAN26).';

create or replace function private.reservation_period_key(p_at timestamptz)
returns text
language sql
immutable
as $$
  select
    (array[
      'JAN','FEV','MAR','ABR','MAI','JUN',
      'JUL','AGO','SET','OUT','NOV','DEZ'
    ])[
      extract(month from timezone('America/Sao_Paulo', p_at))::int
    ]
    || to_char(timezone('America/Sao_Paulo', p_at), 'YY');
$$;

create or replace function private.next_reservation_service_code(
  p_organization_id uuid,
  p_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_seq integer;
begin
  if p_organization_id is null then
    raise exception 'ORG_REQUIRED' using errcode = 'P0001';
  end if;

  v_period := private.reservation_period_key(coalesce(p_at, now()));

  insert into public.reservation_service_code_counters (
    organization_id,
    period_key,
    last_seq
  ) values (
    p_organization_id,
    v_period,
    1
  )
  on conflict (organization_id, period_key)
  do update set last_seq = public.reservation_service_code_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_period || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

revoke all on function private.next_reservation_service_code(uuid, timestamptz) from public;
revoke all on function private.reservation_period_key(timestamptz) from public;

-- Backfill histórico (ordem de criação).
do $$
declare
  r record;
  v_code text;
begin
  for r in
    select id, organization_id, created_at
    from public.reservations
    where service_code is null or btrim(service_code) = ''
    order by created_at asc, id asc
  loop
    v_code := private.next_reservation_service_code(r.organization_id, r.created_at);
    update public.reservations
      set service_code = v_code
    where id = r.id;
  end loop;
end;
$$;

alter table public.reservations
  alter column service_code set not null;

create unique index if not exists reservations_org_service_code_uidx
  on public.reservations (organization_id, service_code);

create index if not exists reservations_service_code_idx
  on public.reservations (service_code);

-- ---------------------------------------------------------------------------
-- create_reservation_with_hold: gera service_code na criação
-- ---------------------------------------------------------------------------

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
  p_source text default 'web',
  p_stops text[] default '{}'::text[],
  p_service_notes text default null
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
  v_stops text[];
  v_destination text;
  v_service_code text;
begin
  if p_slot_end <= p_slot_start then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(s.addr order by s.ord), '{}'::text[])
    into v_stops
  from (
    select trim(x) as addr, ordinality as ord
    from unnest(coalesce(p_stops, '{}'::text[])) with ordinality as u(x, ordinality)
    where length(trim(x)) > 0
    order by ordinality
    limit 8
  ) s;

  v_destination := coalesce(nullif(trim(p_destination_address), ''), '');

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

  v_service_code := private.next_reservation_service_code(p_organization_id, now());

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
    stops,
    service_type,
    vehicle_category_id,
    airport,
    slot_start,
    slot_end,
    hours_requested,
    estimated_km,
    estimated_price,
    service_notes,
    service_code,
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
    v_destination,
    p_destination_lat,
    p_destination_lng,
    v_stops,
    p_service_type,
    p_vehicle_category_id,
    p_airport,
    p_slot_start,
    p_slot_end,
    p_hours_requested,
    p_estimated_km,
    p_estimated_price,
    nullif(trim(coalesce(p_service_notes, '')), ''),
    v_service_code,
    now() + make_interval(mins => v_hold_minutes),
    coalesce(nullif(trim(p_locale), ''), 'pt-BR'),
    coalesce(nullif(trim(p_source), ''), 'web')
  )
  returning * into v_row;

  perform private.notify_org_staff(
    v_row.organization_id,
    'reservation_hold',
    'Nova reserva ' || v_row.service_code,
    trim(p_customer_name) || ' · ' || to_char(p_slot_start at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    jsonb_build_object(
      'reservation_id', v_row.id,
      'service_code', v_row.service_code,
      'customer_name', v_row.customer_name,
      'slot_start', v_row.slot_start,
      'status', v_row.status,
      'service_type', v_row.service_type,
      'stops_count', coalesce(cardinality(v_stops), 0)
    )
  );

  return v_row;
end;
$$;

revoke all on function public.create_reservation_with_hold(
  uuid, text, text, text, text, text, public.service_type, timestamptz, timestamptz,
  uuid, public.airport_code, numeric, numeric, numeric,
  double precision, double precision, double precision, double precision,
  text, text, text[], text
) from public;

grant execute on function public.create_reservation_with_hold(
  uuid, text, text, text, text, text, public.service_type, timestamptz, timestamptz,
  uuid, public.airport_code, numeric, numeric, numeric,
  double precision, double precision, double precision, double precision,
  text, text, text[], text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Detalhe do job do motorista inclui service_code
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
      'service_code', v_res.service_code,
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
      'notes', coalesce(v_res.service_notes, v_res.notes)
    )
  );
end;
$$;

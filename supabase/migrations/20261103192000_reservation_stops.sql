-- Optional intermediate stops on a transfer reservation.
alter table public.reservations
  add column if not exists stops text[] not null default '{}'::text[];

comment on column public.reservations.stops is
  'Ordered intermediate stop addresses between origin and destination.';

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
  p_stops text[] default '{}'::text[]
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
begin
  if p_slot_end <= p_slot_start then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;

  -- Normalize: trim, drop blanks, cap at 8 stops.
  select coalesce(array_agg(s.addr order by s.ord), '{}'::text[])
    into v_stops
  from (
    select trim(x) as addr, ordinality as ord
    from unnest(coalesce(p_stops, '{}'::text[])) with ordinality as u(x, ordinality)
    where length(trim(x)) > 0
    order by ordinality
    limit 8
  ) s;

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
    stops,
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
    v_stops,
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
      'status', v_row.status,
      'stops_count', coalesce(cardinality(v_stops), 0)
    )
  );

  return v_row;
end;
$$;

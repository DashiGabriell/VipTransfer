-- Atomic reservation create with 60-min hold + capacity claim

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

  -- Free expired holds before measuring capacity
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

  -- Serialize claims for the same org + slot window
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

  return v_row;
end;
$$;

revoke all on function public.create_reservation_with_hold(
  uuid, text, text, text, text, text, public.service_type, timestamptz, timestamptz,
  uuid, public.airport_code, numeric, numeric, numeric,
  double precision, double precision, double precision, double precision, text, text
) from public;

grant execute on function public.create_reservation_with_hold(
  uuid, text, text, text, text, text, public.service_type, timestamptz, timestamptz,
  uuid, public.airport_code, numeric, numeric, numeric,
  double precision, double precision, double precision, double precision, text, text
) to anon, authenticated, service_role;

-- Prefer RPC for public creates (keep insert policy as fallback for staff tooling)
comment on function public.create_reservation_with_hold is
  'Creates a reservation in hold status if slot capacity allows; expires stale holds first.';

-- Default freight seed for jmd (admin can edit later)
insert into public.freight_rules (
  organization_id,
  vehicle_category_id,
  service_type,
  price_per_km,
  minimum_fare,
  price_per_hour,
  active
)
select
  o.id,
  null,
  null,
  8.00,
  120.00,
  180.00,
  true
from public.organizations o
where o.slug = 'jmd'
  and not exists (
    select 1 from public.freight_rules fr where fr.organization_id = o.id
  );

update public.airport_fees
set flat_fee = 40.00, updated_at = now()
where organization_id = (select id from public.organizations where slug = 'jmd')
  and flat_fee = 0;

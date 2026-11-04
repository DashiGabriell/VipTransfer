-- New commercial service types + optional notes.
-- Public quote no longer shows price (negotiated on WhatsApp).

alter table public.reservations
  add column if not exists service_notes text;

comment on column public.reservations.service_notes is
  'Detalhes do serviço (ex.: concierge). Preço combinado no WhatsApp.';

-- Drop RPC overloads that depend on the old enum before swapping it.
drop function if exists public.create_reservation_with_hold(
  uuid, text, text, text, text, text, public.service_type, timestamptz, timestamptz,
  uuid, public.airport_code, numeric, numeric, numeric,
  double precision, double precision, double precision, double precision,
  text, text
);
drop function if exists public.create_reservation_with_hold(
  uuid, text, text, text, text, text, public.service_type, timestamptz, timestamptz,
  uuid, public.airport_code, numeric, numeric, numeric,
  double precision, double precision, double precision, double precision,
  text, text, text[]
);

create type public.service_type_v2 as enum (
  'ponto_a_b',
  'a_disposicao',
  'concierge'
);

alter table public.reservations
  alter column service_type type public.service_type_v2
  using (
    case service_type::text
      when 'horas_a_disposicao' then 'a_disposicao'::public.service_type_v2
      when 'a_disposicao' then 'a_disposicao'::public.service_type_v2
      when 'concierge' then 'concierge'::public.service_type_v2
      when 'ponto_a_b' then 'ponto_a_b'::public.service_type_v2
      else 'ponto_a_b'::public.service_type_v2
    end
  );

alter table public.freight_rules
  alter column service_type type public.service_type_v2
  using (
    case
      when service_type is null then null
      when service_type::text = 'horas_a_disposicao' then 'a_disposicao'::public.service_type_v2
      when service_type::text = 'a_disposicao' then 'a_disposicao'::public.service_type_v2
      when service_type::text = 'concierge' then 'concierge'::public.service_type_v2
      when service_type::text = 'ponto_a_b' then 'ponto_a_b'::public.service_type_v2
      else 'ponto_a_b'::public.service_type_v2
    end
  );

drop type public.service_type;
alter type public.service_type_v2 rename to service_type;

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

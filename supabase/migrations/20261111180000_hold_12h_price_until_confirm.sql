-- Fase 1 pagamento: hold de 12 horas; preço real editável só em hold / hold_expirado.

-- ---------------------------------------------------------------------------
-- capacity_settings: 12 horas = 720 minutos
-- ---------------------------------------------------------------------------

alter table public.capacity_settings
  alter column hold_minutes set default 720;

update public.capacity_settings
set hold_minutes = 720
where hold_minutes = 60;

-- ---------------------------------------------------------------------------
-- set_reservation_override_price: permite hold_expirado; trava após confirmação
-- ---------------------------------------------------------------------------

create or replace function public.set_reservation_override_price(
  p_reservation_id uuid,
  p_override_price numeric
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_before jsonb;
  v_fin public.financial_entries;
  v_has_fin boolean := false;
  v_pct numeric;
  v_gross numeric;
  v_commission numeric;
  v_driver_amt numeric;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_override_price is null or p_override_price <= 0 then
    raise exception 'PRICE_INVALID' using errcode = 'P0001';
  end if;

  if p_override_price > 9999999.99 then
    raise exception 'PRICE_TOO_HIGH' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_res.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- Preço real só antes da confirmação (hold ou hold expirado).
  if v_res.status not in ('hold', 'hold_expirado') then
    raise exception 'RESERVATION_CLOSED' using errcode = 'P0001';
  end if;

  select * into v_fin
  from public.financial_entries
  where reservation_id = v_res.id
  for update;

  v_has_fin := found;

  if v_has_fin and v_fin.status = 'liquidado' then
    raise exception 'ALREADY_LIQUIDATED' using errcode = 'P0001';
  end if;

  v_before := to_jsonb(v_res);

  update public.reservations
  set
    override_price = round(p_override_price, 2),
    updated_at = now()
  where id = v_res.id
  returning * into v_res;

  if v_has_fin and v_fin.status in ('previsto', 'a_liquidar') then
    v_gross := v_res.override_price;
    v_pct := public.org_commission_percent(v_res.organization_id);
    v_commission := round(v_gross * v_pct / 100.0, 2);
    v_driver_amt := greatest(v_gross - v_commission, 0);

    update public.financial_entries
    set
      gross_amount = v_gross,
      commission_percent = v_pct,
      commission_amount = v_commission,
      driver_amount = v_driver_amt,
      updated_at = now()
    where id = v_fin.id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'reservation.set_override_price',
    'reservations',
    v_res.id::text,
    v_before,
    to_jsonb(v_res)
  );

  return v_res;
end;
$$;

revoke all on function public.set_reservation_override_price(uuid, numeric) from public;
grant execute on function public.set_reservation_override_price(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- create_reservation_with_hold: fallback de hold = 12h se não houver settings
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
    v_hold_minutes := 720;
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

notify pgrst, 'reload schema';

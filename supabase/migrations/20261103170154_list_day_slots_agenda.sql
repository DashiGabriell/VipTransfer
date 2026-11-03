-- Visual day agenda: list capacity slots for a calendar day (org timezone)

create or replace function public.list_day_slots(
  p_organization_id uuid,
  p_day date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  capacity integer,
  occupied integer,
  available integer,
  is_past boolean,
  is_blackout boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_minutes int := 30;
  v_capacity int := 1;
  v_tz text := 'America/Sao_Paulo';
  v_dow int;
begin
  if p_organization_id is null or p_day is null then
    raise exception 'INVALID_ARGS' using errcode = 'P0001';
  end if;

  perform public.expire_reservation_holds();

  select cs.slot_minutes, cs.default_capacity, cs.timezone
    into v_slot_minutes, v_capacity, v_tz
  from public.capacity_settings cs
  where cs.organization_id = p_organization_id;

  if v_slot_minutes is null then
    v_slot_minutes := 30;
    v_capacity := 1;
    v_tz := 'America/Sao_Paulo';
  end if;

  v_dow := extract(dow from p_day)::int;

  return query
  with configured as (
    select
      aw.start_time,
      aw.end_time,
      aw.is_blackout,
      coalesce(aw.capacity_override, v_capacity)::int as cap
    from public.availability_windows aw
    where aw.organization_id = p_organization_id
      and (
        aw.specific_date = p_day
        or (aw.specific_date is null and aw.day_of_week = v_dow)
      )
  ),
  open_windows as (
    select c.start_time, c.end_time, c.cap
    from configured c
    where c.is_blackout = false
    union all
    select time '06:00', time '22:00', v_capacity
    where not exists (select 1 from configured c2 where c2.is_blackout = false)
  ),
  blackouts as (
    select c.start_time, c.end_time
    from configured c
    where c.is_blackout = true
  ),
  raw_slots as (
    select
      gs as s_start,
      gs + make_interval(mins => v_slot_minutes) as s_end,
      ow.cap as slot_cap
    from open_windows ow
    cross join lateral generate_series(
      ((p_day + ow.start_time)::timestamp) at time zone v_tz,
      (
        ((p_day + ow.end_time)::timestamp) at time zone v_tz
        - make_interval(mins => v_slot_minutes)
      ),
      make_interval(mins => v_slot_minutes)
    ) as gs
    where ow.end_time > ow.start_time
      and ((p_day + ow.end_time)::timestamp) at time zone v_tz
        > ((p_day + ow.start_time)::timestamp) at time zone v_tz
          + make_interval(mins => v_slot_minutes)
  ),
  enriched as (
    select
      rs.s_start,
      rs.s_end,
      rs.slot_cap,
      public.count_slot_occupancy(
        p_organization_id,
        rs.s_start,
        rs.s_end,
        null
      ) as occ,
      exists (
        select 1
        from blackouts b
        where
          ((p_day + b.start_time)::timestamp) at time zone v_tz < rs.s_end
          and ((p_day + b.end_time)::timestamp) at time zone v_tz > rs.s_start
      ) as blocked,
      (rs.s_start <= now()) as past
    from raw_slots rs
  )
  select
    e.s_start,
    e.s_end,
    e.slot_cap,
    e.occ,
    case
      when e.blocked or e.past then 0
      else greatest(e.slot_cap - e.occ, 0)
    end,
    e.past,
    e.blocked
  from enriched e
  order by e.s_start;
end;
$$;

revoke all on function public.list_day_slots(uuid, date) from public;
grant execute on function public.list_day_slots(uuid, date) to anon, authenticated, service_role;

comment on function public.list_day_slots(uuid, date) is
  'Returns 30-min (configurable) agenda slots for a day with capacity/occupancy.';

-- Seed weekly windows Mon–Sat 06:00–22:00 for jmd when empty
insert into public.availability_windows (
  organization_id,
  day_of_week,
  specific_date,
  start_time,
  end_time,
  is_blackout,
  capacity_override
)
select
  o.id,
  d.dow,
  null,
  time '06:00',
  time '22:00',
  false,
  null
from public.organizations o
cross join (values (1), (2), (3), (4), (5), (6)) as d(dow)
where o.slug = 'jmd'
  and not exists (
    select 1
    from public.availability_windows aw
    where aw.organization_id = o.id
  );

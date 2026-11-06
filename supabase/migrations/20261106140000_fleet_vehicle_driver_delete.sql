-- Link fleet vehicles to drivers; safe delete when no trip history.

alter table public.fleet_vehicles
  add column if not exists driver_id uuid references public.drivers (id) on delete set null;

create index if not exists fleet_vehicles_driver_idx
  on public.fleet_vehicles (organization_id, driver_id)
  where driver_id is not null;

-- True when the vehicle (or its linked driver) already has operational history.
create or replace function public.fleet_vehicle_has_trip_history(p_vehicle_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid;
  v_org uuid;
begin
  select driver_id, organization_id into v_driver, v_org
  from public.fleet_vehicles
  where id = p_vehicle_id;

  if not found then
    return false;
  end if;

  if v_driver is null then
    return false;
  end if;

  return exists (
    select 1
    from public.job_assignments ja
    where ja.organization_id = v_org
      and ja.driver_id = v_driver
      and ja.status in ('aceito', 'concluido')
  );
end;
$$;

revoke all on function public.fleet_vehicle_has_trip_history(uuid) from public;
grant execute on function public.fleet_vehicle_has_trip_history(uuid) to authenticated;

create or replace function public.delete_fleet_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id into v_org
  from public.fleet_vehicles
  where id = p_vehicle_id;

  if not found then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  if not private.can_admin_org(v_org) then
    raise exception 'FORBIDDEN';
  end if;

  if public.fleet_vehicle_has_trip_history(p_vehicle_id) then
    raise exception 'VEHICLE_HAS_HISTORY';
  end if;

  delete from public.fleet_vehicles where id = p_vehicle_id;
end;
$$;

revoke all on function public.delete_fleet_vehicle(uuid) from public;
grant execute on function public.delete_fleet_vehicle(uuid) to authenticated;

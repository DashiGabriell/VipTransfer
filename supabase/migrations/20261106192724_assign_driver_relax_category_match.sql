-- Permitir enviar demanda a qualquer motorista ativo/completo da org,
-- mesmo se a categoria do veículo não bater com a da reserva.
-- A operação decide; a UI prioriza quem combina.

create or replace function public.assign_reservation_to_driver(
  p_reservation_id uuid,
  p_driver_id uuid
)
returns public.job_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_driver public.drivers;
  v_row public.job_assignments;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_res.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_res.status <> 'confirmado' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found or v_driver.organization_id <> v_res.organization_id then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not v_driver.active or not v_driver.profile_complete then
    raise exception 'DRIVER_NOT_READY' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.job_assignments a
    where a.reservation_id = v_res.id
      and a.status in ('oferecido', 'aceito')
  ) then
    raise exception 'ALREADY_ASSIGNED' using errcode = 'P0001';
  end if;

  insert into public.job_assignments (
    organization_id,
    reservation_id,
    driver_id,
    status,
    offered_by
  ) values (
    v_res.organization_id,
    v_res.id,
    v_driver.id,
    'oferecido',
    auth.uid()
  )
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'assignment.offer',
    'job_assignments',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

comment on function public.assign_reservation_to_driver(uuid, uuid) is
  'Offers a confirmed reservation to a ready driver in the same org. Category match is advisory only (UI).';

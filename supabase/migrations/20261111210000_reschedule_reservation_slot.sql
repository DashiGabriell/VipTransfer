-- Admin: remarcar data/horário da reserva com checagem de capacidade.
-- Mantém a duração original; exclui a própria reserva da ocupação.

create or replace function public.reschedule_reservation_slot(
  p_reservation_id uuid,
  p_slot_start timestamptz
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reservations;
  v_capacity int;
  v_hold_minutes int;
  v_occupancy int;
  v_duration interval;
  v_new_start timestamptz;
  v_new_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_slot_start is null then
    raise exception 'SLOT_REQUIRED' using errcode = 'P0001';
  end if;

  -- Normaliza para o minuto (evita ruído de segundos do datetime-local)
  v_new_start := date_trunc('minute', p_slot_start);

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

  if v_row.status not in ('hold', 'hold_expirado', 'confirmado') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  if v_new_start < now() - interval '5 minutes' then
    raise exception 'SLOT_IN_PAST' using errcode = 'P0001';
  end if;

  v_duration := v_row.slot_end - v_row.slot_start;
  if v_duration <= interval '0' then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;

  v_new_end := v_new_start + v_duration;

  -- Libera holds expirados antes de medir capacidade
  perform public.expire_reservation_holds();

  select cs.default_capacity, cs.hold_minutes
    into v_capacity, v_hold_minutes
  from public.capacity_settings cs
  where cs.organization_id = v_row.organization_id
  for update;

  if not found then
    v_capacity := 1;
    v_hold_minutes := 720;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_row.organization_id::text || v_new_start::text, 0)
  );

  v_occupancy := public.count_slot_occupancy(
    v_row.organization_id,
    v_new_start,
    v_new_end,
    v_row.id
  );

  if v_occupancy >= v_capacity then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Sem mudança efetiva
  if v_row.slot_start = v_new_start and v_row.slot_end = v_new_end then
    return v_row;
  end if;

  update public.reservations
  set
    slot_start = v_new_start,
    slot_end = v_new_end,
    hold_expires_at = case
      when status = 'hold' then now() + make_interval(mins => v_hold_minutes)
      else hold_expires_at
    end,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.reschedule_reservation_slot(uuid, timestamptz) is
  'Staff: altera slot_start da reserva (hold/hold_expirado/confirmado), preserva duração e valida capacidade.';

revoke all on function public.reschedule_reservation_slot(uuid, timestamptz) from public;
grant execute on function public.reschedule_reservation_slot(uuid, timestamptz) to authenticated;

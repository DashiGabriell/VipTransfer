-- Fase 6: confirmação depende do sinal quando o fluxo comercial está ativo.

create or replace function public.reservation_deposit_gate(p_reservation_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_has_emitida boolean;
  v_has_paga boolean;
begin
  select * into v_res from public.reservations where id = p_reservation_id;
  if not found then
    return 'NOT_FOUND';
  end if;

  select
    exists (
      select 1 from public.payment_charges c
      where c.reservation_id = p_reservation_id
        and c.kind = 'sinal'
        and c.status = 'emitida'
    ),
    exists (
      select 1 from public.payment_charges c
      where c.reservation_id = p_reservation_id
        and c.kind = 'sinal'
        and c.status = 'paga'
    )
  into v_has_emitida, v_has_paga;

  if v_has_emitida then
    return 'DEPOSIT_PENDING';
  end if;

  -- Preço real definido ⇒ fluxo comercial: exige sinal pago.
  if v_res.override_price is not null and v_res.override_price > 0 and not v_has_paga then
    return 'DEPOSIT_REQUIRED';
  end if;

  return 'OK';
end;
$$;

revoke all on function public.reservation_deposit_gate(uuid) from public;
grant execute on function public.reservation_deposit_gate(uuid) to authenticated;

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
  v_gate text;
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

  v_gate := public.reservation_deposit_gate(p_reservation_id);
  if v_gate = 'DEPOSIT_PENDING' then
    raise exception 'DEPOSIT_PENDING' using errcode = 'P0001';
  end if;
  if v_gate = 'DEPOSIT_REQUIRED' then
    raise exception 'DEPOSIT_REQUIRED' using errcode = 'P0001';
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

  perform private.upsert_customer_from_reservation(
    v_row.organization_id,
    v_row.customer_name,
    v_row.customer_phone,
    v_row.customer_email
  );

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

revoke all on function public.confirm_reservation(uuid) from public;
grant execute on function public.confirm_reservation(uuid) to authenticated;

notify pgrst, 'reload schema';

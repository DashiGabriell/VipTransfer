-- Persist customer in org CRM when a reservation is confirmed.

create or replace function private.upsert_customer_from_reservation(
  p_organization_id uuid,
  p_full_name text,
  p_phone text,
  p_email text
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone_digits text;
  v_existing_id uuid;
  v_row public.customers;
begin
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if char_length(btrim(coalesce(p_full_name, ''))) < 2
     or char_length(v_phone_digits) < 8
     or char_length(btrim(coalesce(p_email, ''))) < 3 then
    return null;
  end if;

  select c.id into v_existing_id
  from public.customers c
  where c.organization_id = p_organization_id
    and regexp_replace(c.phone, '\D', '', 'g') = v_phone_digits
  order by c.active desc, c.updated_at desc
  limit 1;

  if v_existing_id is not null then
    update public.customers
    set
      full_name = p_full_name,
      phone = p_phone,
      email = p_email,
      active = true
    where id = v_existing_id
    returning * into v_row;
  else
    insert into public.customers (
      organization_id,
      full_name,
      phone,
      email,
      active
    ) values (
      p_organization_id,
      p_full_name,
      p_phone,
      p_email,
      true
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function private.upsert_customer_from_reservation(uuid, text, text, text) from public;
grant execute on function private.upsert_customer_from_reservation(uuid, text, text, text) to postgres, service_role;

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

  -- Mini CRM: save/refresh customer only after confirmation
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

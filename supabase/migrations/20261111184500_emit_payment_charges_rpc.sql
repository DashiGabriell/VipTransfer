-- Fase 4: emitir cobrança de sinal / restante (stub Asaas — checkout_url nulo até integração).

create or replace function public.emit_deposit_charge(p_reservation_id uuid)
returns public.payment_charges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_pct numeric;
  v_amount numeric;
  v_row public.payment_charges;
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

  if v_res.status not in ('hold', 'hold_expirado') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  if v_res.override_price is null or v_res.override_price <= 0 then
    raise exception 'PRICE_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.payment_charges c
    where c.reservation_id = v_res.id
      and c.kind = 'sinal'
      and c.status in ('emitida', 'paga')
  ) then
    raise exception 'DEPOSIT_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  select coalesce(
    (
      select fr.deposit_percent
      from public.freight_rules fr
      where fr.organization_id = v_res.organization_id
        and fr.active
        and fr.vehicle_category_id is null
        and fr.service_type = v_res.service_type
      order by fr.updated_at desc
      limit 1
    ),
    (
      select fr.deposit_percent
      from public.freight_rules fr
      where fr.organization_id = v_res.organization_id
        and fr.active
        and fr.vehicle_category_id is null
        and fr.service_type is null
      order by fr.updated_at desc
      limit 1
    ),
    30
  ) into v_pct;

  v_pct := greatest(0, least(100, coalesce(v_pct, 30)));
  if v_pct <= 0 then
    raise exception 'DEPOSIT_PERCENT_ZERO' using errcode = 'P0001';
  end if;

  v_amount := round(v_res.override_price * v_pct / 100.0, 2);
  if v_amount <= 0 then
    raise exception 'DEPOSIT_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  insert into public.payment_charges (
    organization_id,
    reservation_id,
    kind,
    status,
    amount,
    currency,
    real_price_snapshot,
    deposit_percent,
    suggested_amount,
    expires_at,
    created_by
  ) values (
    v_res.organization_id,
    v_res.id,
    'sinal',
    'emitida',
    v_amount,
    coalesce(nullif(v_res.currency, ''), 'BRL'),
    v_res.override_price,
    v_pct,
    v_amount,
    now() + interval '12 hours',
    auth.uid()
  )
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'payment.emit_deposit',
    'payment_charges',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.emit_deposit_charge(uuid) from public;
grant execute on function public.emit_deposit_charge(uuid) to authenticated;

create or replace function public.emit_remaining_charge(
  p_reservation_id uuid,
  p_amount numeric,
  p_justification text default null
)
returns public.payment_charges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_deposit numeric;
  v_suggested numeric;
  v_amount numeric;
  v_just text;
  v_row public.payment_charges;
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

  if v_res.status not in ('confirmado', 'concluido') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  if v_res.override_price is null or v_res.override_price <= 0 then
    raise exception 'PRICE_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payment_charges c
    where c.reservation_id = v_res.id
      and c.kind = 'sinal'
      and c.status = 'paga'
  ) then
    raise exception 'DEPOSIT_NOT_PAID' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.payment_charges c
    where c.reservation_id = v_res.id
      and c.kind = 'restante'
      and c.status in ('emitida', 'paga')
  ) then
    raise exception 'REMAINING_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  v_deposit := public.reservation_deposit_amount(v_res.id);
  v_suggested := greatest(round(v_res.override_price - v_deposit, 2), 0);
  if v_suggested <= 0 then
    raise exception 'REMAINING_ZERO' using errcode = 'P0001';
  end if;

  v_amount := round(coalesce(p_amount, v_suggested), 2);
  if v_amount <= 0 then
    raise exception 'AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  v_just := nullif(btrim(coalesce(p_justification, '')), '');
  if v_amount <> v_suggested then
    if v_just is null or char_length(v_just) < 3 then
      raise exception 'JUSTIFICATION_REQUIRED' using errcode = 'P0001';
    end if;
    if char_length(v_just) > 2000 then
      raise exception 'JUSTIFICATION_TOO_LONG' using errcode = 'P0001';
    end if;
  end if;

  insert into public.payment_charges (
    organization_id,
    reservation_id,
    kind,
    status,
    amount,
    currency,
    real_price_snapshot,
    suggested_amount,
    adjustment_justification,
    expires_at,
    created_by
  ) values (
    v_res.organization_id,
    v_res.id,
    'restante',
    'emitida',
    v_amount,
    coalesce(nullif(v_res.currency, ''), 'BRL'),
    v_res.override_price,
    v_suggested,
    v_just,
    now() + interval '12 hours',
    auth.uid()
  )
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'payment.emit_remaining',
    'payment_charges',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.emit_remaining_charge(uuid, numeric, text) from public;
grant execute on function public.emit_remaining_charge(uuid, numeric, text) to authenticated;

-- Stub operacional: marcar pago sem Asaas (até webhook).
create or replace function public.mark_payment_charge_paid(p_charge_id uuid)
returns public.payment_charges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_charges;
  v_before jsonb;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row from public.payment_charges where id = p_charge_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_operate_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.status <> 'emitida' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  v_before := to_jsonb(v_row);

  update public.payment_charges
  set
    status = 'paga',
    paid_at = now(),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_row.organization_id,
    auth.uid(),
    'payment.mark_paid_stub',
    'payment_charges',
    v_row.id::text,
    v_before,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.mark_payment_charge_paid(uuid) from public;
grant execute on function public.mark_payment_charge_paid(uuid) to authenticated;

notify pgrst, 'reload schema';

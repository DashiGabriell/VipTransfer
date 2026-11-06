-- Preço real negociado (override_price) obrigatório para concluir serviço.
-- Recalcula lançamento financeiro aberto quando o preço muda.

create or replace function public.complete_reservation_job(
  p_reservation_id uuid
)
returns public.financial_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_asg public.job_assignments;
  v_pct numeric;
  v_gross numeric;
  v_commission numeric;
  v_driver_amt numeric;
  v_fin public.financial_entries;
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

  if v_res.override_price is null or v_res.override_price <= 0 then
    raise exception 'PRICE_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_asg
  from public.job_assignments
  where reservation_id = v_res.id
    and status = 'aceito'
  order by offered_at desc
  limit 1
  for update;

  if not found then
    raise exception 'NO_ACCEPTED_ASSIGNMENT' using errcode = 'P0001';
  end if;

  v_gross := v_res.override_price;
  v_pct := public.org_commission_percent(v_res.organization_id);
  v_commission := round(v_gross * v_pct / 100.0, 2);
  v_driver_amt := greatest(v_gross - v_commission, 0);

  update public.job_assignments
  set status = 'concluido', responded_at = coalesce(responded_at, now())
  where id = v_asg.id;

  update public.reservations
  set status = 'concluido', updated_at = now()
  where id = v_res.id;

  insert into public.financial_entries (
    organization_id,
    reservation_id,
    driver_id,
    assignment_id,
    gross_amount,
    commission_percent,
    commission_amount,
    driver_amount,
    currency,
    status
  ) values (
    v_res.organization_id,
    v_res.id,
    v_asg.driver_id,
    v_asg.id,
    v_gross,
    v_pct,
    v_commission,
    v_driver_amt,
    coalesce(v_res.currency, 'BRL'),
    'a_liquidar'
  )
  on conflict (reservation_id) do update
  set
    driver_id = excluded.driver_id,
    assignment_id = excluded.assignment_id,
    gross_amount = excluded.gross_amount,
    commission_percent = excluded.commission_percent,
    commission_amount = excluded.commission_amount,
    driver_amount = excluded.driver_amount,
    status = 'a_liquidar',
    updated_at = now()
  returning * into v_fin;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_res.organization_id,
    auth.uid(),
    'reservation.complete_job',
    'financial_entries',
    v_fin.id::text,
    to_jsonb(v_fin)
  );

  return v_fin;
end;
$$;

revoke all on function public.complete_reservation_job(uuid) from public;
grant execute on function public.complete_reservation_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: set real negotiated price on reservation
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

  if v_res.status in ('cancelado', 'hold_expirado') then
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

-- Override manual da comissão por lançamento (mantém o % padrão da org para novos jobs).
-- Só permite alterar enquanto o lançamento não estiver liquidado.

create or replace function public.set_financial_entry_commission_percent(
  p_entry_id uuid,
  p_percent numeric
)
returns public.financial_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.financial_entries;
  v_pct numeric;
  v_commission numeric;
  v_driver numeric;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'PERCENT_INVALID' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.financial_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_admin_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.status = 'liquidado' then
    raise exception 'ALREADY_LIQUIDATED' using errcode = 'P0001';
  end if;

  v_pct := round(p_percent::numeric, 2);
  v_commission := round(v_row.gross_amount * v_pct / 100.0, 2);
  v_driver := greatest(v_row.gross_amount - v_commission, 0);

  update public.financial_entries
  set
    commission_percent = v_pct,
    commission_amount = v_commission,
    driver_amount = v_driver,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.set_financial_entry_commission_percent(uuid, numeric) is
  'Admin: ajusta o % de comissão de um lançamento não liquidado e recalcula valores.';

revoke all on function public.set_financial_entry_commission_percent(uuid, numeric) from public;
grant execute on function public.set_financial_entry_commission_percent(uuid, numeric) to authenticated;

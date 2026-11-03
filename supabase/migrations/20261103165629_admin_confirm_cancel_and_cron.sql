-- Admin confirm/cancel + first-owner bootstrap + hold expiry cron

create or replace function public.claim_org_owner(p_slug text)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_member public.organization_members;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_org
  from public.organizations
  where slug = lower(trim(p_slug));

  if not found then
    raise exception 'ORG_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.organization_members m where m.organization_id = v_org.id
  ) then
    raise exception 'ORG_HAS_MEMBERS' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, full_name)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'owner'))
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner')
  returning * into v_member;

  return v_member;
end;
$$;

revoke all on function public.claim_org_owner(text) from public;
grant execute on function public.claim_org_owner(text) to authenticated;

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

  return v_row;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reservations;
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

  if v_row.status in ('cancelado', 'concluido') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  update public.reservations
  set
    status = 'cancelado',
    updated_at = now(),
    hold_expires_at = null
  where id = v_row.id
  returning * into v_row;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    v_row.organization_id,
    auth.uid(),
    'reservation.cancel',
    'reservations',
    v_row.id::text,
    to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function public.confirm_reservation(uuid) from public;
revoke all on function public.cancel_reservation(uuid) from public;
grant execute on function public.confirm_reservation(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;

-- Expire holds every 5 minutes (Supabase pg_cron)
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'expire-reservation-holds';
exception
  when undefined_table then null;
  when others then null;
end $$;

select cron.schedule(
  'expire-reservation-holds',
  '*/5 * * * *',
  $$select public.expire_reservation_holds();$$
);

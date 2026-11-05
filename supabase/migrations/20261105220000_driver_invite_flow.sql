-- Admin invite → same drivers table + Auth account (set password via e-mail).

alter table public.drivers
  add column if not exists invite_status text not null default 'none',
  add column if not exists invited_at timestamptz;

alter table public.drivers
  drop constraint if exists drivers_invite_status_check;

alter table public.drivers
  add constraint drivers_invite_status_check
  check (invite_status in ('none', 'pending', 'accepted'));

-- Backfill from existing links
update public.drivers
set invite_status = 'accepted'
where user_id is not null
  and invite_status = 'none';

-- Self-signup / claim always mark accepted when linked
create or replace function public.claim_my_driver_profile(
  p_organization_id uuid
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_row public.drivers;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is null then
    raise exception 'NO_EMAIL' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.drivers
  where organization_id = p_organization_id
    and lower(email) = v_email
  for update;

  if not found then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_row.user_id is not null and v_row.user_id <> auth.uid() then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.drivers
  set
    user_id = auth.uid(),
    invite_status = 'accepted',
    invited_at = coalesce(invited_at, now())
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.ensure_driver_profile_for_signup(
  p_organization_id uuid
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_row public.drivers;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if private.can_read_org(p_organization_id) then
    select d.* into v_row
    from public.drivers d
    where d.organization_id = p_organization_id
      and d.user_id = v_uid
    limit 1;
    return v_row;
  end if;

  select lower(u.email),
         coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           split_part(u.email, '@', 1)
         )
    into v_email, v_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_uid;

  if v_email is null then
    raise exception 'NO_EMAIL' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.drivers
  where organization_id = p_organization_id
    and user_id = v_uid
  for update;

  if found then
    if v_row.invite_status is distinct from 'accepted' then
      update public.drivers
      set invite_status = 'accepted'
      where id = v_row.id
      returning * into v_row;
    end if;
    return v_row;
  end if;

  select * into v_row
  from public.drivers
  where organization_id = p_organization_id
    and lower(email) = v_email
  for update;

  if found then
    update public.drivers
    set
      user_id = v_uid,
      invite_status = 'accepted',
      invited_at = coalesce(invited_at, now()),
      full_name = case
        when char_length(btrim(full_name)) >= 2 then full_name
        else v_name
      end
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  insert into public.drivers (
    organization_id,
    user_id,
    full_name,
    phone,
    email,
    vehicle_category_id,
    vehicle_brand,
    vehicle_model,
    vehicle_year,
    vehicle_color,
    skills,
    availability,
    active,
    invite_status,
    invited_at
  ) values (
    p_organization_id,
    v_uid,
    v_name,
    '(11) 00000-0000',
    v_email,
    null,
    '',
    '',
    null,
    '',
    '{}'::text[],
    '[]'::jsonb,
    true,
    'accepted',
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_driver_profile_for_signup(uuid) from public;
grant execute on function public.ensure_driver_profile_for_signup(uuid) to authenticated;

-- Admin-only: load driver for invite edge function (validates membership).
create or replace function public.get_driver_for_invite(
  p_driver_id uuid
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.drivers;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.drivers
  where id = p_driver_id;

  if not found then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_admin_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.get_driver_for_invite(uuid) from public;
grant execute on function public.get_driver_for_invite(uuid) to authenticated;

-- Mark invite pending + optional auth user link (called by edge with user JWT after Auth invite).
create or replace function public.mark_driver_invite_pending(
  p_driver_id uuid,
  p_user_id uuid default null
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.drivers;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.drivers
  where id = p_driver_id
  for update;

  if not found then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_admin_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.invite_status = 'accepted' and v_row.user_id is not null then
    return v_row;
  end if;

  if p_user_id is not null
     and v_row.user_id is not null
     and v_row.user_id <> p_user_id then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  if p_user_id is not null then
    insert into public.profiles (id, full_name)
    values (p_user_id, v_row.full_name)
    on conflict (id) do nothing;
  end if;

  update public.drivers
  set
    user_id = coalesce(p_user_id, user_id),
    invite_status = case
      when invite_status = 'accepted' then 'accepted'
      else 'pending'
    end,
    invited_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.mark_driver_invite_pending(uuid, uuid) from public;
grant execute on function public.mark_driver_invite_pending(uuid, uuid) to authenticated;

create or replace function public.accept_my_driver_invite(
  p_organization_id uuid
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.drivers;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  select * into v_row
  from public.drivers
  where organization_id = p_organization_id
    and (
      user_id = v_uid
      or lower(email) = v_email
    )
  for update;

  if not found then
    raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_row.user_id is not null and v_row.user_id <> v_uid then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.drivers
  set
    user_id = v_uid,
    invite_status = 'accepted',
    invited_at = coalesce(invited_at, now())
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.accept_my_driver_invite(uuid) from public;
grant execute on function public.accept_my_driver_invite(uuid) to authenticated;

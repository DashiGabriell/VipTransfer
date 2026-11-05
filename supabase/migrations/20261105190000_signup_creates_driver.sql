-- Signup via login page → automatic driver profile.
-- Does NOT alter existing organization_members / owners.

alter table public.drivers
  alter column vehicle_category_id drop not null;

create or replace function public.drivers_same_org_category()
returns trigger
language plpgsql
as $$
declare
  cat_org uuid;
begin
  if new.vehicle_category_id is null then
    return new;
  end if;

  select organization_id into cat_org
  from public.vehicle_categories
  where id = new.vehicle_category_id;

  if cat_org is null or cat_org <> new.organization_id then
    raise exception 'vehicle_category_id inválido para a organização';
  end if;
  return new;
end;
$$;

-- Restore previously overwritten driver row as Gabriel Farias (unlinked staff-side record),
-- keeping the test driver account separate.
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
  vehicle_plate,
  vehicle_body_type,
  skills,
  availability,
  active
)
select
  o.id,
  null,
  'Gabriel Farias',
  '(11) 97866-5791',
  'gabriel@gmail.com',
  'd4aeeb62-5f2c-4ba5-b35b-6a70e2ede5b1'::uuid,
  'Toyota',
  'Corolla',
  2022,
  'Preto',
  null,
  'sedan',
  array['executivo']::text[],
  '[{"day_of_week":1,"start_time":"08:00","end_time":"18:00"}]'::jsonb,
  true
from public.organizations o
where o.slug = 'jmd'
  and not exists (
    select 1
    from public.drivers d
    where d.organization_id = o.id
      and lower(d.email) = 'gabriel@gmail.com'
  );

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

  -- Existing staff (owner/admin/operador/leitura) keep their roles; no driver forced.
  if private.can_read_org(p_organization_id) then
    select d.* into v_row
    from public.drivers d
    where d.organization_id = p_organization_id
      and d.user_id = v_uid
    limit 1;
    return v_row; -- may be null
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
    active
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
    true
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_driver_profile_for_signup(uuid) from public;
grant execute on function public.ensure_driver_profile_for_signup(uuid) to authenticated;

-- Flag de plataforma: exibir/ocultar "Criar conta" (signup público)

create or replace function private.is_public_signup_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (ps.value ->> 'public_signup_enabled')::boolean
      from public.platform_settings ps
      where ps.key = 'flags'
    ),
    true
  );
$$;

grant execute on function private.is_public_signup_enabled() to authenticated, anon;

-- Garante a chave no JSON de flags (default: ligado, comportamento atual)
update public.platform_settings
set
  value = coalesce(value, '{}'::jsonb)
    || jsonb_build_object(
      'public_signup_enabled',
      coalesce((value ->> 'public_signup_enabled')::boolean, true)
    ),
  updated_at = now()
where key = 'flags';

insert into public.platform_settings (key, value)
values (
  'flags',
  jsonb_build_object(
    'public_maintenance', false,
    'block_new_reservations', false,
    'banner_message', '',
    'public_signup_enabled', true
  )
)
on conflict (key) do nothing;

create or replace function public.platform_public_flags()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'public_maintenance', coalesce((ps.value ->> 'public_maintenance')::boolean, false),
        'block_new_reservations', coalesce((ps.value ->> 'block_new_reservations')::boolean, false),
        'banner_message', coalesce(ps.value ->> 'banner_message', ''),
        'public_signup_enabled', coalesce((ps.value ->> 'public_signup_enabled')::boolean, true)
      )
      from public.platform_settings ps
      where ps.key = 'flags'
    ),
    jsonb_build_object(
      'public_maintenance', false,
      'block_new_reservations', false,
      'banner_message', '',
      'public_signup_enabled', true
    )
  );
$$;

grant execute on function public.platform_public_flags() to anon, authenticated;

-- Bloqueia apenas criação automática de motorista novo; convites/link continuam
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

  if not private.is_public_signup_enabled() then
    raise exception 'SIGNUP_DISABLED' using errcode = 'P0001';
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

-- Validação ao salvar flags (merge seguro + tipos)
create or replace function public.platform_set_settings(
  p_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_value jsonb := coalesce(p_value, '{}'::jsonb);
  v_merged jsonb;
begin
  perform private.assert_platform_staff();

  if p_key is null or btrim(p_key) = '' then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  select value into v_before from public.platform_settings where key = p_key;

  if p_key = 'flags' then
    v_merged := coalesce(v_before, '{}'::jsonb) || v_value;
    v_merged := jsonb_build_object(
      'public_maintenance', coalesce((v_merged ->> 'public_maintenance')::boolean, false),
      'block_new_reservations', coalesce((v_merged ->> 'block_new_reservations')::boolean, false),
      'banner_message', coalesce(v_merged ->> 'banner_message', ''),
      'public_signup_enabled', coalesce((v_merged ->> 'public_signup_enabled')::boolean, true)
    );
    v_value := v_merged;
  end if;

  insert into public.platform_settings (key, value, updated_at, updated_by)
  values (p_key, v_value, now(), auth.uid())
  on conflict (key) do update
  set value = excluded.value,
      updated_at = now(),
      updated_by = excluded.updated_by;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    auth.uid(), 'platform.set_settings', 'platform_settings', p_key,
    v_before, v_value
  );

  return public.platform_get_settings();
end;
$$;

grant execute on function public.platform_set_settings(text, jsonb) to authenticated;

notify pgrst, 'reload schema';

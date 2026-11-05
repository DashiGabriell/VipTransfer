-- Driver self-service profile: vehicle photos (max 4) + update own row.

alter table public.drivers
  add column if not exists vehicle_photo_urls text[] not null default '{}'::text[];

alter table public.drivers
  drop constraint if exists drivers_vehicle_photo_urls_len;

alter table public.drivers
  add constraint drivers_vehicle_photo_urls_len
  check (cardinality(vehicle_photo_urls) <= 4);

-- Self-service updates go through security definer RPC (scoped fields only).

create or replace function public.update_my_driver_profile(
  p_organization_id uuid,
  p_full_name text,
  p_phone text,
  p_vehicle_category_id uuid,
  p_vehicle_brand text,
  p_vehicle_model text,
  p_vehicle_year int,
  p_vehicle_color text,
  p_vehicle_plate text,
  p_vehicle_body_type public.vehicle_body_type,
  p_skills text[],
  p_availability jsonb,
  p_vehicle_photo_urls text[]
)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.drivers;
  v_photos text[] := coalesce(p_vehicle_photo_urls, '{}'::text[]);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if cardinality(v_photos) > 4 then
    raise exception 'TOO_MANY_PHOTOS';
  end if;

  select * into v_row
  from public.drivers
  where organization_id = p_organization_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'DRIVER_NOT_FOUND';
  end if;

  update public.drivers
  set
    full_name = p_full_name,
    phone = p_phone,
    vehicle_category_id = p_vehicle_category_id,
    vehicle_brand = coalesce(p_vehicle_brand, ''),
    vehicle_model = coalesce(p_vehicle_model, ''),
    vehicle_year = p_vehicle_year,
    vehicle_color = coalesce(p_vehicle_color, ''),
    vehicle_plate = p_vehicle_plate,
    vehicle_body_type = p_vehicle_body_type,
    skills = coalesce(p_skills, '{}'::text[]),
    availability = coalesce(p_availability, '[]'::jsonb),
    vehicle_photo_urls = v_photos
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_my_driver_profile(
  uuid, text, text, uuid, text, text, int, text, text, public.vehicle_body_type, text[], jsonb, text[]
) from public;
grant execute on function public.update_my_driver_profile(
  uuid, text, text, uuid, text, text, int, text, text, public.vehicle_body_type, text[], jsonb, text[]
) to authenticated;

-- Storage: driver vehicle photos (public read; linked driver write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-vehicle-photos',
  'driver-vehicle-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists driver_vehicle_photos_public_read on storage.objects;
create policy driver_vehicle_photos_public_read
  on storage.objects for select
  using (bucket_id = 'driver-vehicle-photos');

drop policy if exists driver_vehicle_photos_self_insert on storage.objects;
create policy driver_vehicle_photos_self_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver-vehicle-photos'
    and exists (
      select 1
      from public.drivers d
      where d.user_id = auth.uid()
        and d.organization_id::text = (storage.foldername(name))[1]
        and d.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists driver_vehicle_photos_self_update on storage.objects;
create policy driver_vehicle_photos_self_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'driver-vehicle-photos'
    and exists (
      select 1
      from public.drivers d
      where d.user_id = auth.uid()
        and d.organization_id::text = (storage.foldername(name))[1]
        and d.id::text = (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'driver-vehicle-photos'
    and exists (
      select 1
      from public.drivers d
      where d.user_id = auth.uid()
        and d.organization_id::text = (storage.foldername(name))[1]
        and d.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists driver_vehicle_photos_self_delete on storage.objects;
create policy driver_vehicle_photos_self_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'driver-vehicle-photos'
    and exists (
      select 1
      from public.drivers d
      where d.user_id = auth.uid()
        and d.organization_id::text = (storage.foldername(name))[1]
        and d.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists driver_vehicle_photos_admin_all on storage.objects;
create policy driver_vehicle_photos_admin_all
  on storage.objects for all to authenticated
  using (
    bucket_id = 'driver-vehicle-photos'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'driver-vehicle-photos'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

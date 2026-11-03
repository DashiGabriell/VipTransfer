-- Standard category codes + physical fleet vehicles + photo storage

alter table public.vehicle_categories
  add column if not exists code text;

-- Backfill codes for existing rows (stable custom_* per id)
update public.vehicle_categories
set code = 'custom_' || replace(id::text, '-', '')
where code is null or btrim(code) = '';

alter table public.vehicle_categories
  alter column code set not null;

create unique index if not exists vehicle_categories_org_code_uidx
  on public.vehicle_categories (organization_id, code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_categories_code_format'
  ) then
    alter table public.vehicle_categories
      add constraint vehicle_categories_code_format
      check (code ~ '^[a-z][a-z0-9_]{1,62}$');
  end if;
end $$;

create type public.vehicle_body_type as enum (
  'sedan',
  'suv',
  'hatch',
  'wagon',
  'van',
  'minivan',
  'pickup',
  'coupe',
  'outro'
);

create table public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_category_id uuid not null references public.vehicle_categories (id) on delete restrict,
  brand text not null,
  model text not null,
  year int not null check (year >= 1980 and year <= 2100),
  color text not null,
  body_type public.vehicle_body_type not null default 'sedan',
  photo_path text,
  photo_url text,
  plate text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_vehicles_brand_len check (char_length(btrim(brand)) between 1 and 80),
  constraint fleet_vehicles_model_len check (char_length(btrim(model)) between 1 and 80),
  constraint fleet_vehicles_color_len check (char_length(btrim(color)) between 1 and 60)
);

create index fleet_vehicles_org_idx on public.fleet_vehicles (organization_id);
create index fleet_vehicles_category_idx on public.fleet_vehicles (vehicle_category_id);
create index fleet_vehicles_active_idx on public.fleet_vehicles (organization_id, active);

alter table public.fleet_vehicles enable row level security;

create policy fleet_vehicles_public_select
  on public.fleet_vehicles for select to anon, authenticated
  using (active = true or private.can_read_org(organization_id));

create policy fleet_vehicles_admin_write
  on public.fleet_vehicles for all to authenticated
  using (private.can_admin_org(organization_id))
  with check (private.can_admin_org(organization_id));

-- Ensure category belongs to same organization
create or replace function public.fleet_vehicles_same_org()
returns trigger
language plpgsql
as $$
declare
  cat_org uuid;
begin
  select organization_id into cat_org
  from public.vehicle_categories
  where id = new.vehicle_category_id;

  if cat_org is null then
    raise exception 'vehicle_category_id inválido';
  end if;

  if cat_org <> new.organization_id then
    raise exception 'categoria deve pertencer à mesma organização';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fleet_vehicles_same_org_trg on public.fleet_vehicles;
create trigger fleet_vehicles_same_org_trg
  before insert or update on public.fleet_vehicles
  for each row execute function public.fleet_vehicles_same_org();

-- Storage bucket for vehicle photos (public read, admin write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fleet-photos',
  'fleet-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fleet_photos_public_read on storage.objects;
create policy fleet_photos_public_read
  on storage.objects for select
  using (bucket_id = 'fleet-photos');

drop policy if exists fleet_photos_admin_insert on storage.objects;
create policy fleet_photos_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fleet-photos'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists fleet_photos_admin_update on storage.objects;
create policy fleet_photos_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fleet-photos'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'fleet-photos'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists fleet_photos_admin_delete on storage.objects;
create policy fleet_photos_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fleet-photos'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

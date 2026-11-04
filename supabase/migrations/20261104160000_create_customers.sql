-- Mini CRM: customers per organization

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_full_name_len check (char_length(btrim(full_name)) between 2 and 160),
  constraint customers_phone_len check (char_length(btrim(phone)) between 8 and 40),
  constraint customers_email_len check (char_length(btrim(email)) between 3 and 254),
  constraint customers_notes_len check (notes is null or char_length(notes) <= 2000)
);

create index customers_org_idx on public.customers (organization_id);
create index customers_org_active_idx on public.customers (organization_id, active);
create index customers_org_name_idx on public.customers (organization_id, lower(full_name));

-- One active customer per phone digits within an org
create unique index customers_org_phone_digits_uidx
  on public.customers (organization_id, (regexp_replace(phone, '\D', '', 'g')))
  where active = true;

create or replace function public.customers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.full_name := btrim(new.full_name);
  new.phone := btrim(new.phone);
  new.email := lower(btrim(new.email));
  if new.notes is not null then
    new.notes := nullif(btrim(new.notes), '');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger customers_set_updated_at
  before insert or update on public.customers
  for each row
  execute function public.customers_set_updated_at();

alter table public.customers enable row level security;

create policy customers_staff_select
  on public.customers for select to authenticated
  using (private.can_read_org(organization_id));

create policy customers_staff_insert
  on public.customers for insert to authenticated
  with check (private.can_operate_org(organization_id));

create policy customers_staff_update
  on public.customers for update to authenticated
  using (private.can_operate_org(organization_id))
  with check (private.can_operate_org(organization_id));

create policy customers_staff_delete
  on public.customers for delete to authenticated
  using (private.can_admin_org(organization_id));

grant select, insert, update, delete on public.customers to authenticated;

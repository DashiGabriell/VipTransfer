-- Settlement proofs: client → platform + platform → driver (PDF or image).

alter table public.financial_entries
  add column if not exists client_to_platform_proof_url text,
  add column if not exists platform_to_driver_proof_url text;

comment on column public.financial_entries.client_to_platform_proof_url is
  'Comprovante de pagamento do cliente para a plataforma (PDF/imagem).';
comment on column public.financial_entries.platform_to_driver_proof_url is
  'Comprovante de pagamento da plataforma para o motorista (PDF/imagem).';

-- Storage: settlement proofs (admin write; public read for stored URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'settlement-proofs',
  'settlement-proofs',
  true,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists settlement_proofs_public_read on storage.objects;
create policy settlement_proofs_public_read
  on storage.objects for select
  using (bucket_id = 'settlement-proofs');

drop policy if exists settlement_proofs_admin_insert on storage.objects;
create policy settlement_proofs_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'settlement-proofs'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists settlement_proofs_admin_update on storage.objects;
create policy settlement_proofs_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'settlement-proofs'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'settlement-proofs'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists settlement_proofs_admin_delete on storage.objects;
create policy settlement_proofs_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'settlement-proofs'
    and private.can_admin_org((storage.foldername(name))[1]::uuid)
  );

-- RPC: liquidate requires both proof URLs
create or replace function public.liquidate_financial_entry(
  p_entry_id uuid,
  p_client_to_platform_proof_url text,
  p_platform_to_driver_proof_url text
)
returns public.financial_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.financial_entries;
  v_client text := nullif(btrim(p_client_to_platform_proof_url), '');
  v_driver text := nullif(btrim(p_platform_to_driver_proof_url), '');
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_client is null or v_driver is null then
    raise exception 'PROOFS_REQUIRED' using errcode = 'P0001';
  end if;

  if char_length(v_client) > 2000 or char_length(v_driver) > 2000 then
    raise exception 'PROOF_URL_TOO_LONG' using errcode = 'P0001';
  end if;

  if position('settlement-proofs/' in v_client) = 0
     or position('settlement-proofs/' in v_driver) = 0 then
    raise exception 'PROOF_URL_INVALID' using errcode = 'P0001';
  end if;

  select * into v_row from public.financial_entries where id = p_entry_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not private.can_admin_org(v_row.organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_row.status = 'liquidado' then
    raise exception 'ALREADY_LIQUIDATED' using errcode = 'P0001';
  end if;

  update public.financial_entries
  set
    status = 'liquidado',
    liquidated_at = now(),
    client_to_platform_proof_url = v_client,
    platform_to_driver_proof_url = v_driver,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.liquidate_financial_entry(uuid) from public;
revoke all on function public.liquidate_financial_entry(uuid, text, text) from public;
drop function if exists public.liquidate_financial_entry(uuid);

grant execute on function public.liquidate_financial_entry(uuid, text, text) to authenticated;

-- Notificações in-app para confirmação / falha de pagamento (Asaas + marcação manual).

alter table public.notification_preferences
  add column if not exists event_payment_paid boolean not null default true,
  add column if not exists event_payment_failed boolean not null default true;

comment on column public.notification_preferences.event_payment_paid is
  'Receber alerta quando cobrança for paga.';
comment on column public.notification_preferences.event_payment_failed is
  'Receber alerta quando cobrança expirar, for cancelada ou estornada.';

alter table public.notifications
  drop constraint if exists notifications_event_type_check;

alter table public.notifications
  add constraint notifications_event_type_check check (
    event_type in (
      'reservation_hold',
      'reservation_confirmed',
      'reservation_cancelled',
      'hold_expired',
      'payment_paid',
      'payment_failed'
    )
  );

create or replace function private.notify_org_staff(
  p_organization_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_exclude_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    organization_id,
    event_type,
    title,
    body,
    payload
  )
  select
    m.user_id,
    p_organization_id,
    p_event_type,
    p_title,
    p_body,
    coalesce(p_payload, '{}'::jsonb)
  from public.organization_members m
  left join public.notification_preferences pref on pref.user_id = m.user_id
  where m.organization_id = p_organization_id
    and m.role in ('owner', 'admin', 'operador')
    and (p_exclude_user_id is null or m.user_id <> p_exclude_user_id)
    and coalesce(pref.in_app_enabled, true) = true
    and case p_event_type
      when 'reservation_hold' then coalesce(pref.event_reservation_hold, true)
      when 'reservation_confirmed' then coalesce(pref.event_reservation_confirmed, true)
      when 'reservation_cancelled' then coalesce(pref.event_reservation_cancelled, true)
      when 'hold_expired' then coalesce(pref.event_hold_expired, true)
      when 'payment_paid' then coalesce(pref.event_payment_paid, true)
      when 'payment_failed' then coalesce(pref.event_payment_failed, true)
      else false
    end;
end;
$$;

create or replace function private.notify_payment_charge_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
  v_kind text;
  v_amount text;
  v_code text;
  v_event text;
  v_title text;
  v_body text;
  v_status_label text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'emitida' then
    return new;
  end if;

  select * into v_res from public.reservations where id = new.reservation_id;

  v_kind := case new.kind
    when 'sinal' then 'sinal'
    when 'restante' then 'restante'
    else new.kind::text
  end;

  v_amount := trim(to_char(new.amount, 'FM999999990.00'));
  v_code := coalesce(nullif(v_res.service_code, ''), left(new.reservation_id::text, 8));

  if new.status = 'paga' then
    v_event := 'payment_paid';
    v_title := 'Pagamento confirmado · ' || v_code;
    v_body := 'Cobrança de ' || v_kind || ' (R$ ' || v_amount || ') paga'
      || case when v_res.customer_name is not null
           then ' — ' || v_res.customer_name
           else ''
         end || '.';
  elsif new.status in ('expirada', 'cancelada', 'estornada') then
    v_event := 'payment_failed';
    v_status_label := case new.status
      when 'expirada' then 'expirou'
      when 'cancelada' then 'foi cancelada'
      when 'estornada' then 'foi estornada'
      else new.status::text
    end;
    v_title := 'Falha no pagamento · ' || v_code;
    v_body := 'Cobrança de ' || v_kind || ' (R$ ' || v_amount || ') ' || v_status_label
      || case when v_res.customer_name is not null
           then ' — ' || v_res.customer_name
           else ''
         end || '.';
  else
    return new;
  end if;

  perform private.notify_org_staff(
    new.organization_id,
    v_event,
    v_title,
    v_body,
    jsonb_build_object(
      'payment_charge_id', new.id,
      'reservation_id', new.reservation_id,
      'service_code', v_res.service_code,
      'kind', new.kind,
      'status', new.status,
      'amount', new.amount,
      'currency', new.currency,
      'asaas_checkout_id', new.asaas_checkout_id,
      'customer_name', v_res.customer_name
    ),
    auth.uid() -- webhook (service role) = null → notifica todos; marcação manual exclui o ator
  );

  return new;
end;
$$;

drop trigger if exists payment_charges_notify_status on public.payment_charges;
create trigger payment_charges_notify_status
  after update of status on public.payment_charges
  for each row
  execute function private.notify_payment_charge_status_change();

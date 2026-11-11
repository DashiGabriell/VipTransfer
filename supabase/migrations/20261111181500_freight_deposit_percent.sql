-- Fase 2 pagamento: percentual de sinal (depósito) por tipo de serviço.

alter table public.freight_rules
  add column if not exists deposit_percent numeric(5, 2) not null default 30
    check (deposit_percent >= 0 and deposit_percent <= 100);

comment on column public.freight_rules.deposit_percent is
  'Percentual do preço real cobrado como sinal (0–100).';

notify pgrst, 'reload schema';

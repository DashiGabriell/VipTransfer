-- WhatsApp oficial JMD (substitui placeholder)
update public.organizations
set
  settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{whatsapp}',
    '"5511949247258"'::jsonb,
    true
  ),
  updated_at = now()
where slug = 'jmd';

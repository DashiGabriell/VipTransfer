# JMD Transfer Platform

Plataforma multi-tenant de transfer executivo (v1). Spec confirmada em [`docs/v1-spec.md`](docs/v1-spec.md).

## Estrutura

| Caminho | Papel |
|---------|--------|
| `web/` | App Vite + React + TypeScript + Tailwind |
| `supabase/` | Migrations, config local |
| `index2.html` | Referência visual da landing |
| `docs/v1-spec.md` | Contrato de produto v1 |

## Desenvolvimento

```bash
cd web
cp .env.example .env   # preencher Supabase quando tiver projeto
npm install
npm run dev
```

Tenant local: `http://localhost:5173` (slug default `jmd`) ou `http://jmd.localhost:5173`.

## Supabase

```bash
npx supabase start          # Docker local
npx supabase db reset       # aplica migrations + seed JMD
```

Migration inicial: multi-tenant, roles/RLS, frete, capacidade, reservas/hold, audit, seed `jmd`.

## Admin

1. `npm run dev` → `/admin`  
2. Criar conta / login  
3. Se a org ainda não tem membros: **Tornar-me owner de jmd**  
4. Abas: Reservas (confirmar/cancelar) · Frota · Frete  

Cron `expire-reservation-holds` roda a cada 5 min no Postgres (`pg_cron`).

## Agenda visual

- Público: grade de slots no formulário de reserva (`list_day_slots`)  
- Admin: aba **Agenda** com ocupação e atalhos confirmar/cancelar  
- Janelas seed JMD: seg–sáb 06:00–22:00 (America/Sao_Paulo)

## Próximas entregas

1. OpenRouteService (km/autocomplete)  
2. Webhook n8n + personificação `dev`  
3. Deploy Vercel + domínio `jmd.`

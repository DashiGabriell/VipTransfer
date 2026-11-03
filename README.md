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

## Próximas entregas

1. Ligar form → insert `reservations` + claim de capacidade  
2. OpenRouteService (km/autocomplete)  
3. Cron `expire_reservation_holds`  
4. Admin: leads, agenda, frete, frota  
5. Webhook n8n + personificação `dev`

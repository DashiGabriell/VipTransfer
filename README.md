# JMD Transfer Platform

Plataforma multi-tenant de transfer executivo (v1). Spec confirmada em [`docs/v1-spec.md`](docs/v1-spec.md).

## Estrutura

| Caminho | Papel |
|---------|--------|
| `web/` | App Vite + React + TypeScript + Tailwind + i18n |
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

Idioma do site (PT-BR / EN) via toggle com bandeiras SVG; preferência em `localStorage` (`jmd.lang`) e no perfil staff.

## Supabase

```bash
npx supabase start          # Docker local
npx supabase db reset       # aplica migrations + seed JMD
npx supabase db push --remote --yes   # aplica migrations no projeto linkado
```

Migrations cobrem: multi-tenant, roles/RLS, frete, capacidade, reservas/hold, agenda (`list_day_slots`), audit, seed `jmd`, preferências e inbox de notificações.

## Admin

Rotas autenticadas (sidebar com `NavLink`):

| Rota | Conteúdo |
|------|----------|
| `/admin` | Redireciona para `/admin/reservas` |
| `/admin/reservas` | Lista, filtros, confirmar/cancelar |
| `/admin/agenda` | Grade visual + disponibilidade / blackouts |
| `/admin/frota` | Categorias de veículo |
| `/admin/frete` | Regras de frete e taxas de aeroporto |
| `/admin/perfil` | Nome, idioma, preferências e caixa de notificações |

Fluxo:

1. `npm run dev` → `/login` (ou `/admin…`, que exige sessão)  
2. Criar conta / entrar  
3. Se a org ainda não tem membros: **Tornar-me owner de jmd**  
4. Header: toggle PT/EN (SVG) + menu colapsável  

Cron `expire-reservation-holds` roda a cada 5 min no Postgres (`pg_cron`).

### Notificações (perfil)

- Canais: e-mail (webhook/n8n), painel, WhatsApp (quando configurado)  
- Eventos: hold, confirmada, cancelada, hold expirado  
- Inbox in-app: marcar lida / todas lidas  
- Fan-out automático para `owner` / `admin` / `operador` ao criar hold, confirmar ou cancelar  

## Agenda visual

- Público: grade de slots no formulário de reserva (`list_day_slots`)  
- Admin: `/admin/agenda` com ocupação, confirmar/cancelar e janelas de indisponibilidade  
- Janelas seed JMD: seg–sáb 06:00–22:00 (America/Sao_Paulo)

## Próximas entregas

1. OpenRouteService (km/autocomplete)  
2. Webhook n8n + personificação `dev`  
3. Deploy Vercel + domínio `jmd.`

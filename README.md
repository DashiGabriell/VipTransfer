# JMD Transfer Platform

Plataforma multi-tenant de transfer executivo (v1). Spec confirmada em [`docs/v1-spec.md`](docs/v1-spec.md).

## Estrutura

| Caminho | Papel |
|---------|--------|
| `web/` | App Vite + React + TypeScript + Tailwind + i18n + PWA |
| `supabase/` | Migrations, config local |
| `n8n/` | Workflow importável: `reservation.created` → Gmail |
| `Estilo-*.html` / `logos/` | Propostas de design system (soltas) |
| `index2.html` | Referência visual da landing |
| `docs/v1-spec.md` | Contrato de produto v1 |

## Marca (assets)

| Arquivo | Uso |
|---------|-----|
| `web/public/logo-1.png` | Logo na landing, login e sidebar admin |
| `web/public/favicon.ico` | Favicon do app |
| `web/public/icons/pwa-*.png` | Ícones PWA (`npm run pwa:icons` para regenerar) |

## Desenvolvimento

```bash
cd web
cp .env.example .env   # preencher Supabase + webhook n8n
npm install
npm run dev
```

Tenant local: `http://localhost:5173` (slug default `jmd`) ou `http://jmd.localhost:5173`.

Idioma do site (PT-BR / EN) via toggle com bandeiras SVG; preferência em `localStorage` (`jmd.lang`) e no perfil staff.

Variáveis: [`web/.env.example`](web/.env.example) — inclui `VITE_N8N_WEBHOOK_URL`.

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
| `/admin/frota` | Categorias e veículos |
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

## n8n → Gmail

Acordo v1: a app só dispara webhook; o n8n envia o e-mail.

1. Importar [`n8n/jmd-reservation-created-gmail.json`](n8n/jmd-reservation-created-gmail.json)  
2. Conectar credencial Gmail OAuth2  
3. Destinatário do alerta: `dashicorporate@gmail.com` (nó Gmail)  
4. Ativar e copiar a URL de produção do Webhook para `VITE_N8N_WEBHOOK_URL`  

Payload: `{ "event": "reservation.created", "reservation": { … } }`.

## Agenda visual

- Público: grade de slots no formulário de reserva (`list_day_slots`)  
- Admin: `/admin/agenda` com ocupação, confirmar/cancelar e janelas de indisponibilidade  
- Janelas seed JMD: seg–sáb 06:00–22:00 (America/Sao_Paulo)

## PWA

O app em `web/` está preparado como Progressive Web App (instalável):

- Manifest + Service Worker via `vite-plugin-pwa`
- Ícones em `web/public/icons/` (`npm run pwa:icons` para regenerar)
- Helpers:
  - `web/src/lib/geolocation.ts` — permissão + posição / watch
  - `web/src/lib/notifications.ts` — permissão, notificação local e stub de Web Push (VAPID)
  - `web/src/lib/pwa.ts` — registro do SW e estado de atualização

Para testar instalação: `cd web && npm run build && npm run preview` (HTTPS/localhost).

## Deploy (Vercel)

**Root Directory no projeto Vercel:** `web` (não a raiz do monorepo).

`vercel.json` na raiz do repo (comandos relativos a `web/`):

| Campo | Valor |
|-------|--------|
| Install | `npm install` |
| Build | `npm run build` |
| Output | `dist` |
| SPA | rewrite para `index.html` (rotas `/admin/*`, `/login`, etc.) |

### Checklist

1. Import do repositório · **Root Directory = `web`**.  
2. Env (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEFAULT_TENANT_SLUG`, opcional `VITE_N8N_WEBHOOK_URL`.  
3. Supabase Auth → Site URL / Redirect URLs com o domínio Vercel.  
4. Deploy. Domínio customizado / subdomínio de tenant fica para o passo seguinte.

## Próximas entregas

1. Personificação `dev`  
2. Domínio customizado / tenant por host (`jmd.`)  
3. Autocomplete de endereço na cotação

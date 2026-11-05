<div align="center">

<img src="web/public/logo-1.png" alt="JMD Transfer" width="120" />

# JMD Transfer

**Mobilidade executiva em São Paulo**<br>
pontualidade · segurança · discrição

[Spec v1](docs/v1-spec.md) · [Produto](PRODUCT.md) · App em `web/`

</div>

---

Plataforma **multi-tenant** de transfer executivo: cotação e reserva no site, operação no painel admin, Postgres/RLS no Supabase e alertas via n8n → Gmail.

> Não é app de mobilidade genérico. É operação local de transfer premium — aeroportos GRU · CGH · VCP, corporativo e VIP.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | Vite · React · TypeScript · Tailwind · i18n · PWA |
| Dados | Supabase Auth · Postgres · RLS · `pg_cron` |
| Automação | n8n (`reservation.created` → Gmail) |
| Deploy | Vercel (`Root Directory` = `web`) |

---

## Estrutura do repositório

```
jmdtransfer/
├── web/                 # aplicação (landing + admin + PWA)
├── supabase/            # migrations, seed jmd, config
├── n8n/                 # workflow Gmail importável
├── docs/v1-spec.md      # contrato de produto
└── PRODUCT.md           # posicionamento e fatos de marca
```

| Asset | Uso |
|-------|-----|
| `web/public/logo-1.png` | Landing, login, sidebar |
| `web/public/favicon.ico` | Favicon |
| `web/public/icons/pwa-*.png` | Ícones PWA (`npm run pwa:icons`) |

---

## Desenvolvimento

```bash
cd web
cp .env.example .env   # Supabase + webhook n8n
npm install
npm run dev
```

| | |
|--|--|
| App local | http://localhost:5173 |
| Tenant default | slug `jmd` (`VITE_DEFAULT_TENANT_SLUG`) |
| Host de tenant | http://jmd.localhost:5173 |
| Idioma | PT-BR / EN — bandeiras SVG; preferência em `jmd.lang` |

Variáveis: [`web/.env.example`](web/.env.example).

---

## Supabase

```bash
npx supabase start
npx supabase db reset                 # migrations + seed JMD
npx supabase db push --remote --yes   # remoto linkado
```

Migrations cobrem: orgs multi-tenant, roles/RLS, frete e taxas de aeroporto, capacidade, reservas/hold, agenda (`list_day_slots`), frota, notificações, audit e seed da org **`jmd`**.

Cron `expire-reservation-holds` a cada **5 min** (`pg_cron`).

---

## Painel admin

Rotas autenticadas:

| Rota | Função |
|------|--------|
| `/admin` | → `/admin/reservas` |
| `/admin/reservas` | Holds, confirmar / cancelar, ver trajeto |
| `/admin/agenda` | Grade, ocupação, disponibilidade / blackouts |
| `/admin/frota` | Categorias padrão + veículos (criar / editar) |
| `/admin/frete` | R$/km, mínimo, R$/hora, taxas GRU · CGH · VCP |
| `/admin/perfil` | Perfil, idioma, preferências e inbox |

**Primeiro acesso**

1. `npm run dev` → `/login`
2. Criar conta e entrar
3. Se a org ainda não tem membros: **Tornar-me owner de jmd**
4. Operar com toggle de idioma e menu lateral

### Notificações

- Canais: e-mail (n8n), painel, WhatsApp (quando configurado)
- Eventos: hold · confirmada · cancelada · hold expirado
- Fan-out para `owner` / `admin` / `operador`

---

## Serviços e preço

| Serviço | Uso |
|---------|-----|
| **Ponto A → B** | Origem, destino, paradas; aeroporto opcional |
| **À disposição** | Por tempo (horas); destino opcional |
| **Concierge** | Por tarefa (descrição livre) |

O **cliente não vê preço** no site nem no WhatsApp — o valor fecha com o motorista.  
`/admin/frete` é só referência interna. Paradas entram no **Ver trajeto** (origem → paradas → destino).

---

## n8n → Gmail

A app só dispara o webhook; o n8n envia o e-mail (nó Gmail).

### Reserva criada (alerta admin)

1. Importar [`n8n/jmd-reservation-created-gmail.json`](n8n/jmd-reservation-created-gmail.json)
2. Credencial **Gmail OAuth2**
3. Destinatário: `dashicorporate@gmail.com`
4. Ativar e copiar a URL do Webhook → `VITE_N8N_WEBHOOK_URL`

```json
{ "event": "reservation.created", "reservation": { "…" } }
```

### Convite de motorista

1. Importar [`n8n/jmd-driver-invite-gmail.json`](n8n/jmd-driver-invite-gmail.json)
2. Reutilizar a mesma credencial **Gmail OAuth2**
3. Ativar → URL do Webhook (ex.: `…/webhook/jmd-driver-invite`)
4. Secret da Edge Function:

```bash
npx supabase secrets set N8N_DRIVER_INVITE_WEBHOOK_URL=https://SEU-N8N/webhook/jmd-driver-invite
```

A Edge `invite-driver` gera o link Auth (`generateLink`, sem e-mail do Supabase) e posta:

```json
{
  "event": "driver.invite",
  "invited_by": "admin@…",
  "driver": { "id": "…", "full_name": "…", "email": "…", "phone": "…" },
  "invite": { "mode": "invite|recovery", "action_link": "https://…", "redirect_to": "…" }
}
```

O Gmail envia para o **e-mail do motorista** com o botão de ativar acesso / definir senha.

---

## Agenda

- **Público** — slots no formulário (`list_day_slots`)
- **Admin** — `/admin/agenda` com ocupação e blackouts
- **Seed JMD** — seg–sáb 06:00–22:00 (`America/Sao_Paulo`)

---

## PWA

Instalável via `vite-plugin-pwa`:

- Manifest + Service Worker
- Ícones em `web/public/icons/`
- Helpers: `geolocation.ts` · `notifications.ts` · `pwa.ts`

```bash
cd web && npm run build && npm run preview
```

---

## Deploy (Vercel)

> **Root Directory** do projeto = `web`<br>
> Rewrite SPA em [`web/vercel.json`](web/vercel.json) — sem isso, `/admin/*` e `/login` retornam 404 da plataforma.

| | |
|--|--|
| Install | `npm install` |
| Build | `npm run build` |
| Output | `dist` |

**Checklist**

1. Import do repo · Root Directory = `web`
2. Env (Production + Preview):<br>
   `VITE_SUPABASE_URL` · `VITE_SUPABASE_PUBLISHABLE_KEY` · `VITE_DEFAULT_TENANT_SLUG` · opcional `VITE_N8N_WEBHOOK_URL`
3. Supabase Auth → Site URL / Redirect URLs com o domínio Vercel
4. Deploy

Hostname apex / `*.vercel.app` resolve o tenant default (`jmd`) — o nome do projeto Vercel **não** é o slug da org.

---

## Contato (produto)

| | |
|--|--|
| E-mail | `contato@jmdtransfer.com.br` |
| WhatsApp | `+55 11 94924-7258` |

---

## Próximas entregas

1. Personificação `dev`
2. Domínio customizado / tenant por host (`jmd.…`)
3. Autocomplete de endereço na cotação

---

<div align="center">

<sub>JMD Transfer · São Paulo</sub>

</div>

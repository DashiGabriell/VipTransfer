# Resumo.md — Inventário completo da plataforma JMD Transfer / VipTransfer

Documento de referência **comercial e técnica** da plataforma.  
**Objetivo:** servir de parâmetro para **precificação de venda** (licença, cessão, white-label, spin-off ou operação), descrevendo **tudo o que existe no produto hoje** — superfícies, fluxos, pagamentos, SEO, console de plataforma, legal e stack.

> Atualizado em **12/11/2026**. Fonte da verdade: código em `web/`, `supabase/`, `n8n/`, `docs/` e este arquivo.

---

## 0. Como usar este documento na precificação

Ao precificar (venda total, licença SaaS, white-label, ou “setup + operação”), considerar este inventário como **ativo entregue**:

| Dimensão de valor | O que este produto já inclui |
|-------------------|------------------------------|
| Aquisição | Landing indexável no Google, PWA, leads, cotação com hold, WhatsApp |
| Conversão / caixa | Preço real, sinal + restante via Asaas, gate de confirmação, liquidação |
| Operação | Admin 9 áreas, agenda, frota, frete, despacho, clientes, motoristas |
| Entrega | App motorista (ofertas/aceitas/perfil), convites, fotos, trajeto |
| Escala | Multi-tenant + console `/dashitecnology` (orgs, roles, audit, flags) |
| Governança | RLS, audit, impersonation, Termos/LGPD, SEO/noindex de áreas privadas |
| Marca | Identidade editorial, bilingue PT/EN, domínio público `www.jmdtransfer.com` |

**Não inventar no valuation:** marketplace aberto, app nativo iOS/Android, conta de cliente final, Google Maps pago, toll/noite automáticos.

---

## 1. Em uma frase

**JMD Transfer** é uma plataforma multi-tenant de **transfer executivo premium** em São Paulo: o cliente solicita no site (sem ver preço), a operação confirma e cobra (sinal/restante via Asaas), despacha no admin, o motorista aceita no app, e cada serviço tem código público rastreável (`JAN26-0001`) — com financeiro, frota, agenda, SEO e console root da plataforma.

---

## 2. Identidade e posicionamento

| Item | Detalhe |
|------|---------|
| **Nome de marca** | JMD Transfer / JMD TRANSFER |
| **Repo / projeto** | VipTransfer (GitHub) · Supabase project `bicjcqtzctljsygougsh` |
| **Tagline** | Mobilidade executiva com segurança e discrição |
| **Mercado** | São Paulo capital, Grande SP e aeroportos **GRU · CGH · VCP** |
| **Público** | Executivos, empresas e clientes VIP |
| **O que NÃO é** | App genérico de mobilidade, limusine de festa, marketplace aberto |
| **Modelo comercial** | Sem preço no site; fechamento operacional; comissão da plataforma; repasse ao motorista; cobrança cliente via Asaas |
| **Contato** | `contato@jmdtransfer.com.br` · WhatsApp `+55 11 94924-7258` |
| **Site público** | `https://www.jmdtransfer.com` |
| **Tenant seed** | slug `jmd`, nome “JMD Transfer” |
| **Console plataforma** | `/dashitecnology` (Dashi Technology — `dev` / `platform_owner`) |

---

## 3. Superfícies de produto (mapa completo)

```text
┌──────────────────────────┐
│ Site público (/)         │  SEO, cotação, hold, WhatsApp, leads, PWA
│ /termos · /privacidade   │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ /login                   │  Staff / motorista (signup toggleável)
│ /aceitar-convite         │
└────────────┬─────────────┘
       ┌─────┴──────┐
       ▼            ▼
┌─────────────┐  ┌──────────────────┐
│ /admin/*    │  │ /motorista/*     │
│ Operação    │  │ App do motorista │
└──────┬──────┘  └──────────────────┘
       │
┌──────▼───────────────────┐
│ /dashitecnology/*        │  Console multi-tenant (root)
└──────────────────────────┘
```

| Rota | Superfície | Quem |
|------|------------|------|
| `/` | Landing + reserva + leads + FleetParade | Público |
| `/termos` | Termos de Uso (pagamento, inadimplemento, protesto) | Público |
| `/privacidade` | Política LGPD | Público |
| `/login` | Login + Criar conta (flag de plataforma) | Contas Auth |
| `/aceitar-convite` | Ativação de convite de motorista | Convidado |
| `/admin/*` | Painel operacional (9 abas) | `owner` / `admin` / `operador` / `leitura` (+ platform staff) |
| `/motorista/ofertas` · `/aceitas` · `/perfil` | App motorista | Motorista vinculado |
| `/dashitecnology` · `/orgs` · `/users` · `/audit` · `/ops` · `/settings` | Console Dashi | `dev` / `platform_owner` |

Catch-all `*` → `/`.

---

## 4. Arquitetura técnica

### 4.1 Repositório

```text
jmdtransfer/
├── web/                 # App Vite (landing + admin + motorista + platform + PWA)
├── supabase/            # Migrations + Edge Functions (invite, Asaas checkout/webhook)
├── n8n/                 # Workflows Gmail (reserva criada, convite motorista)
├── docs/                # Spec v1 (legado), fluxo Asaas, credenciais Asaas
├── PRODUCT.md
├── README.md
├── Resumo.md            # Este documento
└── vercel.json          # Espelho; canônico em web/vercel.json
```

### 4.2 Stack

| Camada | Tecnologia |
|--------|------------|
| UI | React 19 · Vite 8 · TypeScript · Tailwind CSS 4 |
| Rotas | react-router-dom 7 |
| i18n | i18next · react-i18next (`pt-BR` / `en`) |
| Backend | Supabase Auth · Postgres · RLS · Storage · `pg_cron` · Edge Functions |
| Distância | Photon (geocode) + OSRM (rota) — sem API key |
| Pagamentos | Asaas Checkout + webhook (Edge Functions) |
| Automação | n8n opcional (reserva criada; convite motorista) |
| Deploy | Vercel (Root Directory `web`, output `dist`, SPA rewrite) |
| PWA | `vite-plugin-pwa` · Workbox · install prompt |
| Tipografia | Libre Baskerville (display) + Public Sans |
| Lint | oxlint |

### 4.3 Multi-tenant

- Cada negócio = `organizations` (`slug`, `name`, `settings`, `status` active/paused).
- Tabelas de negócio com `organization_id` + **RLS**.
- Resolução de tenant: subdomínio (`jmd.…`) ou apex/preview → `VITE_DEFAULT_TENANT_SLUG` (`jmd`).
- Settings: WhatsApp, e-mail, `%` comissão da plataforma, etc.

### 4.4 Variáveis de ambiente (web)

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública |
| `VITE_DEFAULT_TENANT_SLUG` | Fallback de tenant |
| `VITE_N8N_WEBHOOK_URL` | Webhook reserva criada (opcional) |
| `VITE_PUBLIC_SITE_URL` | Origem pública (`https://www.jmdtransfer.com`) |

Secrets Asaas **somente** no Supabase Edge (`ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`, `SITE_URL`) — nunca no Vite.

---

## 5. SEO e indexação no Google — **implementado**

| Peça | Detalhe |
|------|---------|
| Domínio canônico | `https://www.jmdtransfer.com` |
| `robots.txt` | Allow `/`, `/termos`, `/privacidade`; Disallow `/login`, `/admin`, `/motorista`, `/dashitecnology`, `/aceitar-convite` |
| `sitemap.xml` | Home + Termos + Privacidade (`lastmod` 2026-11-12) |
| Meta dinâmica | `DocumentMeta` — title, description, canonical, Open Graph, Twitter |
| JSON-LD | LocalBusiness na landing |
| noindex | Áreas privadas (login/admin/motorista/platform/convite) |
| Favicon | Multi-size (incl. correção para resultados Google) |
| Intent | Site público indexável; painéis operacionais fora do índice |

Isso é **ativo de aquisição orgânica** já entregue no produto.

---

## 6. Fluxo comercial completo (cliente → caixa)

```text
1. Cliente preenche cotação no site (aceita Termos + Privacidade)
2. Sistema cria reservation status = hold (12 h) + service_code
3. Abre WhatsApp com resumo (código, sem preço)
4. Staff vê hold (admin + notificação Realtime)
5. Staff define preço real (override_price)
6. Staff emite cobrança do SINAL (Asaas) → cliente paga
7. Staff confirma reserva (gate: sinal pago quando há preço real)
8. Staff despacha motorista → app + WhatsApp opcional
9. Motorista aceita / recusa
10. Após serviço: staff pode emitir RESTANTE (Asaas)
11. Staff conclui job → financial_entry (comissão + repasse)
12. Financeiro liquida com comprovantes (cliente→plataforma e plataforma→motorista)
```

### 6.1 Código público (`service_code`)

- Formato **`MMMYY-NNNN`** (ex.: `NOV26-0009`).
- Meses PT: JAN…DEZ · fuso `America/Sao_Paulo`.
- Imutável; único por org; contador `reservation_service_code_counters`.
- Presente em admin, motorista, WhatsApp, notificações, financeiro.

---

## 7. Tipos de serviço

| Código | Nome (PT) | Comportamento |
|--------|-----------|---------------|
| `ponto_a_b` | Ponto A a ponto B | Origem + destino + até 8 paradas; aeroporto opcional; km Photon/OSRM |
| `a_disposicao` | À disposição | Por horas; destino opcional |
| `concierge` | Concierge | Sob medida; notas obrigatórias |

**Preço ao cliente:** nunca no site. Tabelas de frete = referência interna; valor negociado = `override_price`.

---

## 8. Site público (Landing)

Arquivo: `web/src/pages/LandingPage.tsx`.

### 8.1 Seções

1. **Nav** — Serviços, Frota, Atuação, Contato, idioma, Install PWA, CTA (sem link Admin — removido da LP pública).
2. **Hero** — Marca + formulário de reserva.
3. **Serviços** — A→B, à disposição, concierge (imagens locais).
4. **Frota** — FleetParade (carrossel infinito: SUV, Sedan, Van, blindados).
5. **Atuação** — SP / Grande SP / GRU / CGH / VCP.
6. **Contato** — `LeadCaptureForm` → tabela `leads`.
7. **Rodapé** — Termos, Privacidade, WhatsApp FAB.
8. **Banner de plataforma** — manutenção / bloqueio de reservas / mensagem (flags).

### 8.2 Formulário de reserva

- Validação completa (nome, telefone BR, e-mail, endereços, serviço, veículo, slot).
- **Aceite obrigatório** Termos + Privacidade.
- Agenda `SlotAgenda` + `list_day_slots`.
- Distância Photon (`lang=en`) + OSRM; cache; aeroportos por alias.
- RPC `create_reservation_with_hold` → hold + código.
- WhatsApp pré-preenchido **sem preço**.
- Webhook n8n opcional.
- Variante admin: criar reserva pelo painel (sem checkbox legal na UI).

### 8.3 PWA

- Manifest “JMD Transfer”, standalone, tema `#0e1624`.
- Install na landing e no admin; oculto em standalone.
- Permissões device no perfil admin.

---

## 9. Agenda, capacidade e hold

| Conceito | Valor |
|----------|-------|
| Slot | **60 minutos** |
| Hold | **12 horas** (`hold_minutes` = 720) |
| TZ | `America/Sao_Paulo` |
| Janela seed | Seg–sáb 06:00–22:00 |
| Expiração | Cron a cada **5 min** → `hold_expirado` |
| Capacidade | Por bucket (`default_capacity`) |
| Blackouts | `availability_windows` |

**Status:** `hold` · `hold_expirado` · `confirmado` · `cancelado` · `concluido`.

**Reagendamento:** RPC `reschedule_reservation_slot`.

---

## 10. Autenticação e papéis

### 10.1 Organização (`OrgRole`)

| Role | Poder |
|------|-------|
| `owner` | Controle total da org |
| `admin` | Frota, frete, motoristas, financeiro, blackouts + operação |
| `operador` | Reservas, agenda, clientes |
| `leitura` | Visualização |

UI: `canOperate` = owner\|admin\|operador · `canAdmin` = owner\|admin.

### 10.2 Plataforma (`platform_admins`)

| Role | Poder |
|------|-------|
| `dev` | Console completo + ações técnicas (ex.: expire holds) |
| `platform_owner` | Governança de negócio; promoção de papéis |

### 10.3 Entrada

1. Login / signup (`/login`) — signup **ligado/desligado** por flag `public_signup_enabled`.
2. Contas novas tendem a perfil motorista (`ensure_driver_profile_for_signup`) — bloqueado no servidor se signup desligado.
3. Admin sem membership operável → `/motorista` (exceto platform staff).
4. Convite motorista: Edge `invite-driver` → n8n e-mail → `/aceitar-convite`.
5. **Cliente final da landing não tem conta** (v1).

---

## 11. Painel admin (`/admin`) — 9 áreas

| Aba | Rota | Função |
|-----|------|--------|
| Reservas | `/admin/reservas` | Lista/filtros, hold attention/Realtime, criar reserva, detalhe, confirmar/cancelar, preço real, **painel Asaas**, despacho, trajeto |
| Agenda | `/admin/agenda` | Grade do dia, ocupação, disponibilidade/blackouts |
| Frota | `/admin/frota` | Categorias + veículos CRUD/foto/vínculo motorista |
| Transfer | `/admin/frete` | R$/km, mínimo, R$/hora, taxas aeroporto, **% sinal por tipo de serviço** |
| Clientes | `/admin/clientes` (+ `/:id`) | CRM operacional |
| Motoristas | `/admin/motoristas` (+ `/:id`) | CRUD, skills, disponibilidade, convite, fotos |
| Financeiro | `/admin/financeiro` | Comissão, extrato, ajuste, liquidação + proofs, relatório HTML/PDF |
| Notificações | `/admin/notificacoes` | Inbox dedicada + sino Realtime |
| Perfil | `/admin/perfil` | Nome, idioma, prefs, PWA/device |

### 11.1 Despacho

1. Preço real → 2. Motorista → 3. `assign_reservation_to_driver` (`oferecido`) → 4. WhatsApp motorista (sem nome cliente / sem preço) → 5. `complete_reservation_job`.

### 11.2 Gate de confirmação

Com preço real definido: confirmação exige **sinal pago** (`reservation_deposit_gate`). Stub “marcar pago” disponível para sandbox/ops.

---

## 12. Pagamentos Asaas — **implementado**

| Peça | Detalhe |
|------|---------|
| Modelo | `payment_charges` — `sinal` \| `restante` |
| Status | `emitida` · `paga` · `expirada` · `cancelada` · `estornada` |
| RPCs | `emit_deposit_charge`, `emit_remaining_charge`, `mark_payment_charge_paid`, `reservation_deposit_amount`, `reservation_deposit_gate` |
| Edge | `create-asaas-checkout`, `asaas-webhook` |
| Idempotência | `asaas_webhook_events` |
| UI | `ReservationPaymentPanel` — emitir, WhatsApp com link, stub pago, justificativa se restante ≠ sugerido |
| Stub | Sem Asaas configurado: checkout stub; staff pode marcar pago |
| Separação | Cobrança cliente (Asaas) ≠ `financial_entries` (comissão/repasse) |
| Docs | `docs/fluxo-pagamento-asaas.md`, `docs/asaas-credenciais.md` |
| Notificações | Mudança de status de cobrança → inbox |

**Ativo comercial:** pipeline de caixa online já no produto (não apenas roadmap).

---

## 13. App do motorista (`/motorista`)

| Área | Capacidade |
|------|------------|
| Shell | Layout persistente; Ofertas ↔ Aceitas sem remount/refetch total |
| Ofertas | Assignments `oferecido`; aceitar/recusar |
| Aceitas | `aceito` / `concluido`; detalhe + trajeto |
| Perfil | Dados, veículo, skills, disponibilidade, até **4 fotos** (Storage) |
| Convite | Status `none` · `pending` · `accepted` |
| Skills | executivo, aeroporto, blindado, idiomas, eventos, longa_distancia |

Assignment: `oferecido` · `aceito` · `recusado` · `cancelado` · `concluido`.

---

## 14. Financeiro (repasse)

```text
commission_amount = round(gross * percent / 100)
driver_amount     = gross - commission
```

| Status lançamento | Significado |
|-------------------|-------------|
| `previsto` | Previsto |
| `a_liquidar` | Pronto para liquidar |
| `liquidado` | Com comprovantes |

- Liquidação: proofs cliente→plataforma e plataforma→motorista (`settlement-proofs`).
- Relatório HTML/PDF; períodos 7/30/90/custom.
- Comissão ajustável na org (`platform_commission_percent`).

---

## 15. Console de plataforma `/dashitecnology` — **implementado**

| Página | Capacidade |
|--------|------------|
| Overview | Métricas 24h/7d, holds, drivers, erros pagamento, orgs em atenção, audit recente |
| Orgs | Lista/criar/pausar; detalhe settings; memberships; **personificação** |
| Users | Busca; memberships; promover/remover `dev` / `platform_owner` |
| Audit | Filtros + before/after + export CSV |
| Ops | Holds, cobranças, webhooks Asaas; `expire_holds` (dev) |
| Settings | Flags: manutenção, bloquear reservas, banner, **toggle Criar conta** |

### 15.1 Personificação

- Motivo obrigatório + duração (30/60/120 min).
- Banner sticky no admin e no console.
- `impersonation_sessions` + `audit_logs.impersonator_id`.

### 15.2 Feature flags (`platform_settings`)

| Flag | Efeito |
|------|--------|
| `public_maintenance` | Banner / bloqueio operacional |
| `block_new_reservations` | Bloqueia novos holds |
| `banner_message` | Mensagem na landing |
| `public_signup_enabled` | Exibe/esconde “Criar conta” + bloqueia auto-cadastro motorista |

Org `paused` também bloqueia holds públicos.

---

## 16. Legal — **implementado e atualizado**

| Documento | Conteúdo relevante à venda |
|-----------|----------------------------|
| **Termos de Uso** | Hold; preço alinhado na confirmação; **sinal + restante**; obrigação de pagar; atraso → cobrança formal (boleto/PIX); persistindo → **medidas cabíveis incluindo protesto em cartório quando legalmente aplicável** |
| **Privacidade** | Controladora; dados; finalidades; bases; compartilhamento; retenção; **direitos LGPD** |
| Aceite | Checkbox obrigatório no formulário público |

Ativo jurídico/comercial: aviso prévio de cobrança do saldo e caminho de recuperação documentado.

---

## 17. Modelo de dados (entidades runtime)

`organizations` (+ status) · `profiles` · `organization_members` · `platform_admins` · `platform_settings` · `impersonation_sessions` · `vehicle_categories` · `fleet_vehicles` · `freight_rules` (+ deposit %) · `airport_fees` · `capacity_settings` · `availability_windows` · `reservations` (+ stops, override_price, service_code) · `reservation_service_code_counters` · `customers` · `drivers` · `job_assignments` · `financial_entries` (+ settlement proofs) · `payment_charges` · `asaas_webhook_events` · `leads` · `notifications` · `notification_preferences` · `audit_logs`

**Storage:** `fleet-photos` · `driver-vehicle-photos` · `settlement-proofs`.

---

## 18. Integrações

| Integração | Status |
|------------|--------|
| Supabase (Auth/DB/RLS/Storage/Cron/Edge) | Produção |
| WhatsApp `wa.me` | Cliente + motorista + links de cobrança |
| Asaas Checkout + Webhook | **Implementado** |
| Photon + OSRM | Geocode/rota (sem key; sem SLA contratado) |
| n8n | Reserva criada · convite motorista |
| Vercel | Hosting SPA |
| Google (SEO) | robots + sitemap + meta + indexação pública |

---

## 19. RPCs e Edge (mapa de valor)

| Capacidade | Artefato |
|------------|----------|
| Hold + código | `create_reservation_with_hold` |
| Expirar holds | `expire_reservation_holds` (+ cron / platform ops) |
| Confirmar / cancelar | `confirm_reservation`, `cancel_reservation` |
| Agenda | `list_day_slots` |
| Preço real | `set_reservation_override_price` |
| Reagendar | `reschedule_reservation_slot` |
| Despacho / resposta | `assign_reservation_to_driver`, `driver_respond_assignment` |
| Conclusão | `complete_reservation_job` |
| Pagamentos | `emit_deposit_charge`, `emit_remaining_charge`, `mark_payment_charge_paid`, gate |
| Financeiro | `set_org_commission_percent`, `liquidate_financial_entry` |
| Plataforma | `platform_*` (overview, orgs, users, audit, ops, settings, impersonation) |
| Edge | `invite-driver`, `create-asaas-checkout`, `asaas-webhook` |

---

## 20. Segurança e compliance (relevantes à venda)

1. Isolamento multi-tenant por **RLS** + RPCs security definer.  
2. Cliente final **sem conta** (v1); holds via RPC validado.  
3. Preço/comissão **não vazam** no WhatsApp de cliente/motorista no despacho.  
4. Segredos Asaas **só no Edge**; webhook autenticado por token.  
5. Confirmação condicionada a sinal pago (quando há preço real).  
6. Impersonation com motivo, TTL, banner e audit.  
7. Audit append-oriented.  
8. Flags de manutenção / bloqueio / pause de org no servidor.  
9. Signup público desligável (UI + server).  
10. **noindex** de áreas privadas.  
11. LGPD + Termos com cláusula de inadimplemento/protesto.  
12. Storage com policies por papel.  
13. Stub “marcar pago” — governar em produção.  
14. Dependência Photon/OSRM sem SLA comercial.

---

## 21. Internacionalização e UX

- **PT-BR** e **EN** em landing, legal, admin, motorista e platform.
- Preferência `jmd.lang`.
- Visual editorial: papel creme `#f2ebe0`, navy `#152033`, bronze `#b08d57`.
- Fontes: Libre Baskerville + Public Sans.
- Layouts: `jmd-landing.css`, `admin-layout.css`, `driver-app.css`, `platform-layout.css`, `login.css`.

---

## 22. Pronto vs. evolução (fronteira clara)

### Pronto no runtime (incluir no preço)

- Landing bilingue + SEO/Google (robots, sitemap, meta, JSON-LD)  
- Reserva com hold 12h + WhatsApp + leads + FleetParade  
- Termos (sinal/restante/protesto) + Privacidade LGPD + aceite obrigatório  
- Admin completo (9 abas) + criar reserva + hold attention  
- **Asaas sinal/restante + webhook + painel**  
- Despacho + app motorista + convites + fotos  
- Financeiro + proofs + relatório  
- PWA + Realtime notificações  
- Multi-tenant + **console `/dashitecnology`** (orgs, users, audit, ops, flags, impersonation, toggle Criar conta)  
- Photon/OSRM + n8n hooks  

### Fora do runtime / não precificar como entregue

- Marketplace aberto de motoristas  
- App nativo store  
- Conta de cliente final  
- Google Maps / ORS (spec antiga)  
- Integração Hairline product (só estética CSS)  
- Push VAPID operacional fechado (env opcional)  
- Spec v1 desatualizada (slots 30 min / hold 60 / pagamento out of scope)  

---

## 23. Como rodar (referência)

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

```bash
npx supabase db push --remote --yes
```

Deploy Vercel: Root Directory `web`, build `npm run build`, output `dist`.

---

## 24. Glossário comercial

| Termo | Significado |
|-------|-------------|
| Hold | Slot temporário até confirm/expiração |
| service_code | ID público `JAN26-0001` |
| override_price | Preço real negociado |
| Sinal / Restante | Cobranças Asaas do cliente |
| Assignment | Oferta motorista ↔ reserva |
| Transfer (aba) | Precificação interna + % sinal |
| Dashi / `/dashitecnology` | Console multi-tenant da plataforma |
| Tenant / org | Conta operacional isolada (ex.: `jmd`) |

---

## 25. Conclusão para valuation

A plataforma **já é um produto operacional completo**, não um protótipo de landing:

1. **Aquisição** — site indexável + PWA + hold + WhatsApp + leads  
2. **Caixa** — Asaas (sinal/restante) + gate de confirmação + financeiro/liquidação  
3. **Operação** — admin 9 áreas + despacho + frota + agenda  
4. **Entrega** — app motorista + convites  
5. **Escala / white-label** — multi-tenant + console root + flags  
6. **Governança** — RLS, audit, impersonation, legal (LGPD + cláusula de cobrança/protesto)  

Quem precificar a venda (qualquer modalidade) deve usar **este inventário como checklist do que está incluso**, e tratar a seção 22 como fronteira explícita do que ainda não está shipped.

# Resumo.md — JMD Transfer / VipTransfer

Documento de referência completa da plataforma. Objetivo: quem ler este arquivo deve entender **o que é o produto**, **para quem é**, **como funciona ponta a ponta**, **o que cada superfície faz**, **como os dados se relacionam** e **o que está implementado versus o que ainda é roadmap**.

---

## 1. Em uma frase

**JMD Transfer** é uma plataforma multi-tenant de **transfer executivo premium** em São Paulo: o cliente solicita no site (sem ver preço), a operação confirma e despacha no painel admin, o motorista aceita no app, e o valor é combinado no WhatsApp — com rastreio financeiro, frota, agenda e código público de cada serviço (`JAN26-0001`).

---

## 2. Identidade e posicionamento

| Item | Detalhe |
|------|---------|
| **Nome de marca** | JMD Transfer / JMD TRANSFER |
| **Nome do repositório / projeto** | VipTransfer (GitHub / Supabase) |
| **Tagline** | Mobilidade executiva com segurança e discrição; pontualidade · segurança · discrição |
| **Mercado** | São Paulo capital, Grande SP e aeroportos **GRU · CGH · VCP** |
| **Público** | Executivos, empresas e clientes VIP |
| **O que NÃO é** | App de mobilidade genérico, limusine de festa, marketplace aberto de motoristas |
| **Modelo comercial implícito** | Cliente não vê preço no site; fechamento no WhatsApp; comissão da plataforma sobre o bruto; repasse ao motorista; liquidação com comprovantes |
| **Contato publicado** | `contato@jmdtransfer.com.br` · WhatsApp `+55 11 94924-7258` |
| **Tenant seed** | Organização slug `jmd`, nome “JMD Transfer” |

Documentos de produto relacionados: `PRODUCT.md`, `docs/v1-spec.md`, `README.md`.

---

## 3. Visão geral das superfícies

A mesma aplicação (`web/`) entrega **três mundos**:

```text
┌─────────────────────┐
│  Site público (/)   │  Cotação, hold, WhatsApp, leads, PWA install
└──────────┬──────────┘
           │ cria reserva (hold)
           ▼
┌─────────────────────┐
│  Admin (/admin/*)   │  Confirma, agenda, frota, frete, motoristas,
│                     │  clientes, despacho, financeiro, perfil
└──────────┬──────────┘
           │ oferece demanda
           ▼
┌─────────────────────┐
│ Motorista (/motorista/*) │ Ofertas, aceitas, perfil/veículo
└─────────────────────┘
```

| Rota | Superfície | Quem acessa |
|------|------------|-------------|
| `/` | Landing + formulário de reserva + captura de lead | Público |
| `/login` | Autenticação staff / motorista | Contas Supabase Auth |
| `/aceitar-convite` | Ativação de convite de motorista | Convidado por e-mail |
| `/admin/*` | Painel operacional | Membership `owner` / `admin` / `operador` / `leitura` |
| `/motorista/ofertas` | Demandas oferecidas | Motorista vinculado |
| `/motorista/aceitas` | Corridas aceitas / concluídas | Motorista vinculado |
| `/motorista/perfil` | Dados pessoais, veículo, fotos, disponibilidade | Motorista vinculado |

---

## 4. Arquitetura técnica

### 4.1 Repositório

```text
jmdtransfer/
├── web/                 # App Vite (landing + admin + motorista + PWA)
├── supabase/            # Migrations, seed, Edge Function invite-driver
├── n8n/                 # Workflows Gmail importáveis
├── docs/                # Spec v1, fluxo Asaas (roadmap)
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
| Automação | n8n opcional (`reservation.created` → Gmail; convite motorista) |
| Deploy | Vercel (`Root Directory` = `web`, output `dist`) |
| PWA | `vite-plugin-pwa` · Workbox · install prompt |
| Lint | oxlint |

### 4.3 Multi-tenant

- Cada negócio é uma **organization** (`slug`, `name`, `settings`).
- Tabelas de negócio carregam `organization_id` e são protegidas por **RLS**.
- Resolução do tenant no front (`web/src/lib/tenant.ts` + `TenantContext`):
  - subdomínio (`jmd.localhost`, `jmd.…`) → slug do host;
  - apex / preview Vercel → `VITE_DEFAULT_TENANT_SLUG` (tipicamente `jmd`).
- Settings da org incluem, entre outros: WhatsApp, e-mail de contato, `%` de comissão da plataforma.

### 4.4 Variáveis de ambiente (web)

Ver `web/.env.example`:

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon) |
| `VITE_DEFAULT_TENANT_SLUG` | Fallback de tenant |
| `VITE_N8N_WEBHOOK_URL` | Opcional — webhook de reserva criada |
| `VITE_PUBLIC_SITE_URL` | Origem pública (links WhatsApp / PWA) |

---

## 5. Fluxo comercial completo (cliente → operação → motorista → caixa)

```text
1. Cliente preenche cotação no site
2. Sistema cria reservation status = hold (ex.: 60 min)
3. Abre WhatsApp com texto pré-preenchido (código JAN26-0001, sem preço)
4. Staff vê hold no admin / notificação
5. Staff confirma → status confirmado (+ upsert de customer)
6. Staff define preço real (override_price) e despacha motorista
7. Motorista recebe oferta (app + WhatsApp opcional)
8. Motorista aceita ou recusa
9. Após a corrida, staff conclui job → financial_entry
10. Financeiro liquida com comprovantes (cliente→plataforma e plataforma→motorista)
```

### 5.1 Código público do serviço (`service_code`)

- Formato: **`MMMYY-NNNN`** — três letras do mês em português + ano com 2 dígitos + sequência mensal da organização.
- Exemplos: `JAN26-0001`, `FEV26-0012`, `NOV26-0048`.
- Meses: `JAN FEV MAR ABR MAI JUN JUL AGO SET OUT NOV DEZ`.
- Fuso usado na geração: `America/Sao_Paulo`.
- Imutável após criação; único por `(organization_id, service_code)`.
- Contador em `reservation_service_code_counters`.
- Aparece em: admin (lista/cards/detalhe/financeiro), app motorista, WhatsApp (cliente e despacho), feedback pós-reserva, notificações internas.

---

## 6. Tipos de serviço

Definidos em `web/src/types/database.ts` e no enum Postgres `service_type`:

| Código | Nome (PT) | Comportamento |
|--------|-----------|---------------|
| `ponto_a_b` | Ponto A a ponto B | Origem + destino + até 8 paradas; aeroporto opcional; distância via Photon/OSRM |
| `a_disposicao` | À disposição (por tempo) | Horas reservadas; destino opcional; distância se houver waypoints |
| `concierge` | Concierge (por serviço) | Demanda sob medida (compras, recados, acompanhamentos); notas obrigatórias; sem fórmula pública de preço |

**Preço ao cliente:** nunca exibido no site. Tabelas de frete no admin são **referência interna** da operação; o valor negociado entra como `override_price` no despacho/conclusão.

---

## 7. Site público (Landing)

Arquivo principal: `web/src/pages/LandingPage.tsx`.

### 7.1 Seções

1. **Nav** — Serviços, Frota, Atuação, Contato, Admin (`/login`), idioma, botão **Baixar app** (PWA), CTA cotação.
2. **Hero (`#inicio`)** — Marca, headline editorial, lead, Install PWA, **formulário de reserva** embutido.
3. **Serviços (`#servicos`)** — Três formatos (A→B, à disposição, concierge) com imagens locais em `web/public/`.
4. **Frota (`#frota`)** — Apresentação SUV/Sedan + CTA.
5. **Atuação (`#atuacao`)** — SP / Grande SP / GRU / CGH / VCP.
6. **Contato (`#contato`)** — Formulário **Fale com a JMD** (`LeadCaptureForm`) — último bloco antes do rodapé.
7. **Rodapé** — Contato, serviços, WhatsApp FAB / dock mobile.

### 7.2 Formulário de reserva (`ReservationForm`)

- Valida nome, telefone BR, e-mail, endereços, tipo de serviço, veículo/categoria, slot da agenda.
- Agenda: componente `SlotAgenda` + RPC `list_day_slots`.
- Distância: `web/src/services/distance.ts` (Photon `lang=en` — `lang=pt` retorna 400; OSRM para km).
- Submit chama RPC `create_reservation_with_hold` → gera `service_code` + hold.
- Abre `wa.me` com resumo (`domain/whatsapp.ts`).
- Dispara webhook n8n opcional (`notifyReservationWebhook`).

### 7.3 Captação de leads

- Independente da reserva.
- Persiste em `leads` (nome, telefone, e-mail, mensagem, source).

### 7.4 PWA

- Manifest “JMD Transfer”, `display: standalone`, tema escuro `#0e1624`.
- Botão de instalação na landing e no perfil admin; **oculto** quando já está em modo standalone.
- Permissões de localização e notificação no perfil admin (`DevicePermissionsCard`).

---

## 8. Agenda, capacidade e hold

| Conceito | Valor atual no código |
|----------|------------------------|
| Duração do slot | **60 minutos** |
| Hold padrão | **60 minutos** (`capacity_settings.hold_minutes`) |
| Timezone seed JMD | `America/Sao_Paulo` |
| Janela típica | Seg–sáb 06:00–22:00 (seed) |
| Expiração de holds | Cron `expire-reservation-holds` a cada **5 min** → status `hold_expirado` |
| Capacidade | Por bucket de slot (`default_capacity`) |
| Blackouts / janelas | `availability_windows` (admin agenda) |

Status de reserva:

| Status | Significado |
|--------|-------------|
| `hold` | Horário reservado temporariamente |
| `hold_expirado` | Hold venceu sem confirmação |
| `confirmado` | Operação confirmou |
| `cancelado` | Cancelada |
| `concluido` | Job finalizado (gera lançamento financeiro) |

---

## 9. Autenticação e papéis

### 9.1 Papéis de organização (`OrgRole`)

| Role | Poder típico |
|------|----------------|
| `owner` | Controle total da org |
| `admin` | Frota, frete, motoristas, financeiro, blackouts (+ operação) |
| `operador` | Reservas, agenda, clientes (sem config sensível) |
| `leitura` | Visualização |

Helpers de UI (`services/admin.ts`):

- `canOperate` → owner | admin | operador  
- `canAdmin` → owner | admin  

### 9.2 Papéis de plataforma

- `dev` / `platform_owner` — previstos no modelo (administração cross-tenant); uso operacional diário é por membership da org.

### 9.3 Fluxos de entrada

1. **Login / signup** (`LoginPage` + `AuthContext`) — e-mail/senha Supabase.
2. Contas novas pelo formulário público de auth tendem a virar **perfil de motorista** (`ensureDriverProfileForSignup`), não owner automático.
3. **Admin** (`AdminPage`): se o usuário não tem membership operável, redireciona para `/motorista`.
4. **Convite de motorista**:
   - Admin convida → Edge Function `invite-driver` gera link Auth;
   - n8n pode enviar e-mail com `action_link`;
   - `/aceitar-convite` define senha + `acceptMyDriverInvite` → `/motorista`.
5. **Cliente final da landing não tem conta** (v1).

---

## 10. Painel admin (`/admin`)

Shell: sidebar + conteúdo; nav em `components/admin/adminNav.tsx`.

| Aba | Rota | Quem | Função |
|-----|------|------|--------|
| Reservas | `/admin/reservas` | canOperate | Lista/filtros, confirmar/cancelar, detalhe, trajeto, despacho |
| Agenda | `/admin/agenda` | canOperate (+ disponibilidade se canAdmin) | Grade do dia, ocupação, blackouts |
| Frota | `/admin/frota` | canAdmin | Categorias padrão + veículos CRUD/foto/vínculo motorista |
| Transfer (Frete) | `/admin/frete` | canAdmin | R$/km, mínimo, R$/hora, taxas aeroporto |
| Clientes | `/admin/clientes` | canOperate | Cadastro/consulta; detalhe `/admin/clientes/:id` |
| Motoristas | `/admin/motoristas` | canAdmin | CRUD, skills, disponibilidade, convite, fotos; detalhe `/:id` |
| Financeiro | `/admin/financeiro` | canAdmin | Comissão, extrato, liquidação, relatório |
| Perfil | `/admin/perfil` | autenticado no admin | Nome, idioma, prefs de notificação, inbox, PWA/device |

### 10.1 Reservas e despacho

- Confirmar: RPC `confirm_reservation` (também faz upsert de `customers`).
- Cancelar: RPC `cancel_reservation`.
- Detalhe: `ReservationDetailModal` (código, cliente, trajeto, serviço, ações).
- Trajeto: `RouteNavPicker` / `ViewRouteButton` (abre apps de navegação).
- Despacho (`DispatchControls`):
  1. definir preço real (`override_price`);
  2. escolher motorista;
  3. `assign_reservation_to_driver` → assignment `oferecido`;
  4. opcionalmente abrir WhatsApp do motorista (sem nome do cliente, sem preço);
  5. ao final, `complete_reservation_job`.

### 10.2 Frota

- Categorias padrão tipicamente: SUV executivo, sedan luxo, van, blindados etc.
- Veículos: marca/modelo/ano/cor/carroceria/placa/foto; vínculo opcional a motorista.
- Domínio: `web/src/domain/fleet.ts`.

### 10.3 Frete / Transfer (interno)

- Regras por categoria e/ou tipo de serviço.
- Taxas flat por aeroporto GRU/CGH/VCP.
- Usado como referência operacional — **não** como cotação pública.

### 10.4 Notificações (perfil)

Canais: e-mail (via n8n), in-app, WhatsApp (quando configurado).  
Eventos: hold, confirmada, cancelada, hold expirado.  
Inbox in-app no perfil do staff.

---

## 11. App do motorista (`/motorista`)

Layout persistente (`DriverLayout`) com bottom nav: Ofertas · Aceitas · Perfil.

### 11.1 Dados no shell

- Carrega perfil do motorista, assignments e detalhes de job **uma vez** no layout.
- Troca Ofertas ↔ Aceitas **não remonta** a página nem refaz o fetch completo (shell compartilhado).
- Refresh manual/atualização fica em segundo plano sem “piscar” loading.

### 11.2 Ofertas / Aceitas

- Filtra assignments por status (`oferecido` vs `aceito`/`concluido`).
- Mostra `service_code`, horário, tipo, rota, cliente (primeiro nome), km, ações.
- Aceitar / recusar via `driver_respond_assignment`.
- Ver trajeto com picker de navegação.

### 11.3 Perfil

- Dados pessoais, categoria, veículo, skills, disponibilidade semanal, até 4 fotos.
- Self-service com upload no Storage Supabase.

### 11.4 Ciclo do assignment

| Status | Significado |
|--------|-------------|
| `oferecido` | Despachado; aguarda resposta |
| `aceito` | Motorista confirmou |
| `recusado` | Motorista recusou (motivo opcional) |
| `cancelado` | Cancelado pela operação |
| `concluido` | Corrida finalizada no fluxo financeiro |

Skills padrão: `executivo`, `aeroporto`, `blindado`, `idiomas`, `eventos`, `longa_distancia`.

---

## 12. Financeiro

### 12.1 Comissão

- Percentual em `organizations.settings.platform_commission_percent`.
- Ajustável no painel (`set_org_commission_percent` / leitura via helper).

### 12.2 Ao concluir o job

Com `override_price` (bruto):

```text
commission_amount = round(gross * percent / 100)
driver_amount     = gross - commission
```

Cria `financial_entries` (status tipicamente `previsto` / `a_liquidar`).

### 12.3 Status do lançamento

| Status | Significado |
|--------|-------------|
| `previsto` | Previsto |
| `a_liquidar` | Pronto para liquidar |
| `liquidado` | Liquidado com provas |

### 12.4 Liquidação

- Upload de comprovantes:
  - cliente → plataforma;
  - plataforma → motorista.
- RPC `liquidate_financial_entry` + Storage (`settlement-proofs`).

### 12.5 Relatório

- Exportação HTML (Blob URL / download se pop-up bloqueado) + impressão / salvar PDF.
- Inclui código do serviço, cliente, valores e status.
- Períodos: 7d / 30d / 90d / custom.

### 12.6 Pagamento online (roadmap)

- Asaas (sinal + restante, webhook, hold estendido) está documentado em `docs/fluxo-pagamento-asaas.md` — **ainda não implementado no runtime**.

---

## 13. Modelo de dados (entidades)

Tipos TypeScript canônicos: `web/src/types/database.ts`.

| Entidade | Papel |
|-----------|-------|
| `organizations` | Tenant (slug, settings) |
| `profiles` / `organization_members` | Staff da org |
| `platform_admins` | Admins globais |
| `reservations` | Solicitação/serviço (código, status, trajeto, hold, preços) |
| `reservation_service_code_counters` | Sequência mensal do código |
| `customers` | CRM operacional (upsert no confirm) |
| `drivers` | Motoristas (Auth opcional, veículo, skills, invite) |
| `vehicle_categories` | Categorias da frota |
| `fleet_vehicles` | Veículos da org |
| `freight_rules` | Preço interno km/hora/mínimo |
| `airport_fees` | Taxas GRU/CGH/VCP |
| `capacity_settings` | Slot, hold, capacidade, TZ |
| `availability_windows` | Disponibilidade / blackouts |
| `job_assignments` | Despacho motorista ↔ reserva |
| `financial_entries` | Extrato + proofs |
| `leads` | Contatos do formulário “Fale com a JMD” |
| `notifications` + prefs | Inbox e preferências staff |
| `audit_logs` | Auditoria append-only |

---

## 14. Integrações

| Integração | Função | Onde |
|------------|--------|------|
| **Supabase** | Auth, DB, RLS, Storage, Cron, Edge | Todo o backend |
| **WhatsApp (`wa.me`)** | Handoff cliente e alerta de demanda ao motorista | `web/src/domain/whatsapp.ts` |
| **Photon** | Geocoding | `https://photon.komoot.io/api/` |
| **OSRM** | Distância de direção | `router.project-osrm.org` |
| **n8n** | E-mail (reserva criada, convite motorista) | `VITE_N8N_WEBHOOK_URL` + Edge secret |
| **Vercel** | Hosting SPA + rewrites | `web/vercel.json` |
| **Asaas** | Pagamento online | Apenas docs (roadmap) |

---

## 15. Internacionalização

- Idiomas: **Português (Brasil)** e **English**.
- Preferência persistida (`jmd.lang`).
- Toggle com bandeiras na landing e no admin/motorista.
- Conteúdo editável bilingue em categorias (`name_i18n` / `description_i18n`).
- Arquivos: `web/src/i18n/locales/pt-BR.json`, `en.json`.

---

## 16. Segurança e isolamento (visão prática)

- Cliente anônimo pode **criar hold** via RPC security definer (com validações de slot/capacidade).
- Staff autentica; RLS limita dados à(s) organização(ões) do membership.
- Motorista só vê assignments e detalhes das próprias demandas (`get_driver_job_detail` valida vínculo).
- Preço estimado interno e comissão **não** vão para o WhatsApp do cliente/motorista no despacho.
- Comprovantes e fotos ficam em buckets Storage com políticas próprias.

---

## 17. RPCs e peças de backend (mapa conceitual)

| Capacidade | Função / artefato principal |
|------------|-----------------------------|
| Criar hold + código | `create_reservation_with_hold` |
| Expirar holds | `expire_reservation_holds` (+ cron) |
| Confirmar / cancelar | `confirm_reservation`, `cancel_reservation` |
| Agenda do dia | `list_day_slots` |
| Despachar | `assign_reservation_to_driver` |
| Resposta motorista | `driver_respond_assignment` |
| Detalhe da demanda | `get_driver_job_detail` |
| Preço real | `set_reservation_override_price` |
| Concluir job | `complete_reservation_job` |
| Comissão org | `set_org_commission_percent` / leitura settings |
| Liquidar | `liquidate_financial_entry` |
| Convite | Edge `invite-driver` + `acceptMyDriverInvite` |
| Gerar código | `private.next_reservation_service_code` |

Migrations vivem em `supabase/migrations/` (fundação multi-tenant, core v2 motoristas/financeiro, frota, stops, service types, settlement proofs, service_code, slot 60 min, etc.).

---

## 18. Domínios de front relevantes

| Módulo | Responsabilidade |
|--------|------------------|
| `domain/whatsapp.ts` | Textos e URLs WhatsApp (cliente e motorista) |
| `domain/freight.ts` | Cálculo/referência interna de frete |
| `domain/fleet.ts` | Marcas, modelos, cores, carrocerias |
| `domain/drivers.ts` | Skills e disponibilidade |
| `domain/customerFields.ts` | Validação nome/telefone BR |
| `domain/serviceCode.ts` | Helpers do código público |
| `services/reservations.ts` | Criação de hold + webhook |
| `services/distance.ts` | Geocode + rota |
| `services/admin.ts` | Operações do painel |
| `services/coreV2.ts` | Motoristas, assignments, financeiro, leads |

---

## 19. Experiência visual (resumo)

- Linguagem editorial “dossiê”: papel creme (`#f2ebe0`), tinta navy (`#152033`), bronze (`#b08d57`).
- Tipografia: Bodoni Moda (display) + Public Sans.
- Admin e motorista seguem o mesmo DNA de marca, com layouts próprios (`admin-layout.css`, `driver-app.css`, `jmd-landing.css`).
- Código do serviço aparece como badge monoespaçado (`.service-code`) para identificação rápida.

---

## 20. O que está pronto vs. o que é evolução

### Pronto (runtime)

- Landing bilingue + reserva com hold + WhatsApp  
- Leads  
- Admin completo (reservas, agenda, frota, frete, clientes, motoristas, financeiro, perfil)  
- App motorista (ofertas/aceitas/perfil)  
- Despacho + WhatsApp motorista  
- Código `JAN26-0001`  
- Distância Photon/OSRM  
- PWA instalável  
- Notificações in-app + prefs  
- Relatório financeiro exportável  
- Multi-tenant por slug/host  

### Roadmap / docs (não shipped no app)

- Checkout Asaas (sinal + restante, hold alongado) — `docs/fluxo-pagamento-asaas.md`  
- Autocomplete avançado de endereço (além do geocode atual)  
- Personificação / ferramentas `dev` cross-tenant no dia a dia  
- Spec antiga citava slots de 30 min e OpenRouteService — **código atual** usa 60 min e Photon+OSRM  

---

## 21. Como rodar (referência rápida)

```bash
cd web
cp .env.example .env   # preencher Supabase (+ n8n opcional)
npm install
npm run dev            # http://localhost:5173
```

Supabase:

```bash
npx supabase db push --remote --yes   # aplicar migrations no projeto linkado
```

Deploy Vercel: Root Directory `web`, build `npm run build`, output `dist`, rewrites SPA em `vercel.json`.

---

## 22. Glossário rápido

| Termo | Significado |
|-------|-------------|
| **Hold** | Reserva temporária de slot até confirmação ou expiração |
| **service_code** | ID visual público do serviço (`JAN26-0001`) |
| **override_price** | Preço real negociado (obrigatório para concluir) |
| **Assignment** | Oferta/vínculo de uma reserva a um motorista |
| **Tenant / org** | Conta operacional isolada (ex.: `jmd`) |
| **Transfer (aba Frete)** | Precificação interna; UI renomeada de “Frete” para “Transfer” |
| **Concierge** | Serviço por tarefa, não por trajeto fixo |
| **À disposição** | Motorista/veículo por bloco de horas |

---

## 23. Conclusão

A JMD Transfer é uma **plataforma operacional de transfer executivo**, não um marketplace genérico. O valor está na combinação de:

1. **Entrada comercial limpa** (site + hold + WhatsApp sem preço),  
2. **Operação completa** (agenda, frota, clientes, despacho, financeiro),  
3. **App do motorista**,  
4. **Identidade rastreável** de cada serviço (`service_code`),  
5. **Isolamento multi-tenant** com Supabase/RLS.

Quem examinar este documento e o código em `web/` + `supabase/` tem o mapa completo do produto como ele existe hoje — e a fronteira clara do que ainda é roadmap (pagamento online Asaas e melhorias adjacentes).

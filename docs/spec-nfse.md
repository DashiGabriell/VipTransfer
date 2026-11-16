# Spec — NFS-e (notas fiscais de serviço)

Spec de produto e implementação para emissão de **NFS-e reais** pela **JMD** ao **cliente** (PF ou PJ), com uso principal em **reembolso corporativo**. Consolida as decisões alinhadas na sessão de elucidação.

**Provedor de emissão:** Asaas (API de Notas Fiscais / NFS-e).  
**Quem emite:** organização JMD (prestadora).  
**Tomador:** cliente do serviço (CPF ou CNPJ).  
**Público da UI (v1):** staff admin/operador no painel; cliente não emite.

---

## 1. Problem statement

Em alguns casos o colaborador precisa de **documento fiscal válido** do transfer para solicitar reembolso na empresa. Comprovantes internos de liquidação (cliente→plataforma / plataforma→motorista) **não bastam**. A plataforma precisa orquestrar a emissão de **NFS-e de fato**, guardar PDF/XML e disponibilizar download/histórico no Financeiro.

## 2. Decisões confirmadas

| # | Decisão | Escolha |
|---|---------|---------|
| A | Cardinalidade | **1 serviço → 1 NFS-e** |
| B | Valor | **Bruto do cliente** (`financial_entries.gross_amount`) — não comissão nem repasse do motorista |
| C | Gatilho | **Sob demanda** (não automática obrigatória) |
| D | Dados do tomador | Modal de **conferência/completar** antes de emitir |
| E | Processamento | **Assíncrono** (agendada → processando → autorizada \| erro) |
| F | Pagamento | Cobre **Asaas e fora do Asaas** desde o dia 1 |
| G | Momentos de UI | Fim da **liquidação** (opcional) + ferramenta no **Financeiro** |

## 3. Princípios

1. NFS-e é ato **fiscal**, distinto da liquidação financeira interna.
2. Liquidação **não depende** da nota; a nota **não substitui** os comprovantes de liquidação.
3. A plataforma **não inventa** PDF: agenda emissão no Asaas, acompanha webhook da prefeitura e persiste resultado.
4. Um único fluxo de produto: muda só a origem (`asaas` vs `external`); nota avulsa quando não há cobrança Asaas.
5. Sem config fiscal da org e sem tomador válido → emissão bloqueada.

## 4. Escopo v1

### Inclui

- Campos fiscais do tomador na reserva
- Config NFS-e por organização (gate + serviço municipal padrão)
- Tabela `service_invoices` + RLS multi-tenant
- Modal único de conferência + emissão
- Edge Function: customer Asaas + `POST /v3/invoices` (vinculada a payment **ou** avulsa)
- Webhooks Asaas de nota (`INVOICE_*`) → status, número, PDF/XML, erro
- UI Financeiro: emitir, badges de status, download, “emitir agora?” pós-liquidação
- Audit das ações de emissão/reintento
- i18n PT-BR + EN

### Fora de escopo (v1)

- Emissão automática em massa / obrigatória ao liquidar
- Nota no valor da comissão ou do repasse ao motorista
- Múltiplas notas por serviço / parcelamento fiscal complexo
- Cancelamento completo na UI (pode ficar v1.1; v1 trata `authorized` + `error` + reemitir)
- Portal do cliente para self-service de download (admin baixa / envio manual ou e-mail do provedor)
- Provedor fiscal alternativo ao Asaas

## 5. Modelo de dados

### 5.1 Tomador na reserva

Estender `reservations` (colunas explícitas preferíveis a um blob opaco):

| Campo | Tipo / notas |
|-------|----------------|
| `customer_doc_type` | `cpf` \| `cnpj` (nullable até preenchido) |
| `customer_doc_number` | text, somente dígitos |
| `customer_legal_name` | text — nome/razão (pode diferir de `customer_name`) |
| `customer_address_street` | text |
| `customer_address_number` | text |
| `customer_address_complement` | text nullable |
| `customer_address_district` | text |
| `customer_address_city` | text |
| `customer_address_state` | text (UF) |
| `customer_address_postal_code` | text (CEP) |
| `customer_municipal_inscription` | text nullable (PJ, se município exigir) |

Hoje a reserva só tem `customer_name`, `customer_phone`, `customer_email` — insuficientes para NFS-e.

### 5.2 Config fiscal da org

Em `organizations.settings` (JSON) **ou** tabela `org_fiscal_settings`. Mínimo:

```json
{
  "nfse": {
    "enabled": false,
    "municipal_service_id": null,
    "municipal_service_code": null,
    "service_description_template": "Transfer executivo — {{service_code}}",
    "asaas_fiscal_ready": false
  }
}
```

A conta Asaas da org precisa ter `fiscalInfo` configurado (município, inscrição, credenciais). O app só dispara emissão se `enabled` e prontidão fiscal OK.

### 5.3 Tabela `service_invoices`

| Campo | Notas |
|-------|--------|
| `id` | uuid PK |
| `organization_id` | FK, RLS |
| `reservation_id` | serviço |
| `financial_entry_id` | v1: exigir entry **liquidado** |
| `amount` | snapshot do bruto no disparo |
| `currency` | default `BRL` |
| `status` | ver §6 |
| `tomador_snapshot` | jsonb — cópia imutável usada na emissão |
| `payment_origin` | `asaas` \| `external` |
| `asaas_payment_id` | nullable |
| `asaas_customer_id` | nullable |
| `asaas_invoice_id` | id da NFS-e no Asaas |
| `number` | pós-autorização |
| `validation_code` | pós-autorização |
| `pdf_url` | pós-autorização |
| `xml_url` | pós-autorização |
| `error_code` / `error_message` | falhas |
| `requested_by` / `requested_at` | audit |
| `authorized_at` / `canceled_at` | ciclo de vida |
| `created_at` / `updated_at` | |

**Constraint de negócio:** no máximo uma nota ativa em `scheduled` \| `processing` \| `authorized` por `reservation_id`.

## 6. Máquina de estados

```text
(sem registro)
    → scheduled → processing → authorized
                     ↘ error → (corrige tomador) → scheduled

authorized → cancel_requested → canceled   // v1.1 opcional
```

| Status | UI |
|--------|-----|
| *(ausente)* | Elegível se liquidado + org OK + sem nota ativa |
| `scheduled` | “NF agendada” |
| `processing` | “NF em processamento” |
| `authorized` | Download PDF/XML |
| `error` | Motivo + “Corrigir e reemitir” |
| `canceled` | Histórico; libera nova emissão |

Transições de autorização/erro/cancelamento vêm dos **webhooks** Asaas (`INVOICE_CREATED`, `INVOICE_SYNCHRONIZED`, `INVOICE_AUTHORIZED`, `INVOICE_ERROR`, etc.), não de polling na UI. Idempotência por `event.id` / `asaas_invoice_id` (mesmo padrão de `asaas_webhook_events`).

## 7. Regras de elegibilidade e valor

Emitir somente se **todas** forem verdadeiras:

1. `financial_entries.status = liquidado`
2. Org com NFS-e habilitada e fiscal Asaas pronto
3. Não existe nota ativa (`scheduled` \| `processing` \| `authorized`) para a reserva
4. Tomador validado no modal (persistir na reserva + gravar `tomador_snapshot`)

**Valor:** sempre `financial_entries.gross_amount` no clique de emitir.

**Origem do pagamento:**

- Se existir `payment_charges` pago com `asaas_payment_id` relevante → `payment_origin = asaas` (preferir restante/total conforme regra operacional)
- Caso contrário → `payment_origin = external` e NFS-e **avulsa** (`customer` no Asaas, sem `payment`)

## 8. UX

### 8.1 Pós-liquidação

Após liquidar com sucesso: pergunta **“Emitir nota fiscal agora?”** (Sim / Depois).  
Sim abre o modal de emissão. Liquidação já concluída independentemente.

### 8.2 Modal de emissão (único)

Reutilizado no pós-liquidação e no Financeiro:

1. Resumo: `service_code`, cliente, valor bruto  
2. Origem do pagamento (somente leitura: Asaas / Externo)  
3. Formulário do tomador (pré-preenchido, editável)  
4. Validação local (documento, CEP, obrigatórios)  
5. CTA **Emitir NFS-e**  
6. Sucesso de agendamento → fecha; lista mostra `scheduled`/`processing`  
7. Erro de validação/API → mensagem no modal  

### 8.3 Extrato Financeiro

Na linha liquidada:

- Sem nota → **Emitir NF**
- `scheduled` / `processing` → badge correspondente
- `authorized` → **Baixar PDF** / **XML**
- `error` → badge + **Corrigir e reemitir**

### 8.4 Config da org

Bloco “Notas fiscais”: toggle, serviço municipal padrão, template de descrição, status da integração Asaas fiscal.

## 9. Fluxo backend

```text
Admin confirma modal
  → upsert dados fiscais em reservations
  → insert service_invoices (status scheduled, snapshots)
  → Edge Function:
       ensure Asaas customer (PF/PJ)
       POST /v3/invoices
         - com payment se payment_origin=asaas
         - com customer (avulsa) se external
  → Webhook Asaas atualiza status, number, pdf_url, xml_url, erros
  → audit_log
```

Referência Asaas: [Notas Fiscais](https://docs.asaas.com/docs/notas-fiscais) — `fiscalInfo`, serviços municipais, agendar invoice, webhooks `INVOICE_*`.

## 10. Relação com o que já existe

| Peça atual | Relação com NFS-e |
|------------|-------------------|
| `financial_entries` + liquidação + proofs | Pré-requisito de elegibilidade; proofs permanecem |
| `payment_charges` + Asaas Checkout | Opcional para vincular; ausência → nota avulsa |
| `asaas_webhook_events` | Estender ou espelhar para eventos de invoice |
| `organizations.settings` | Gate + defaults fiscais |
| `reservations` customer_* | Base de contato; fiscal é extensão |

## 11. Tickets sugeridos (ordem)

1. **Schema** — tomador na reserva + `service_invoices` + RLS + índices  
2. **Config org** — settings NFS-e + gate na UI  
3. **Emissão** — modal tomador + Edge Function Asaas (avulsa e vinculada)  
4. **Webhook NF** — estados + PDF/XML + erros idempotentes  
5. **Financeiro** — badges, emitir, download, CTA pós-liquidação  
6. **i18n + audit**

## 12. Critérios de aceite (v1)

- [ ] Org configurada emite NFS-e real (sandbox e/ou prod) para **PF e PJ**
- [ ] Funciona com pagamento **Asaas** e **externo** (nota avulsa)
- [ ] Liquidação permanece igual; NF é sob demanda
- [ ] Admin vê status, erro acionável e reintento após correção de dados
- [ ] Download PDF/XML só com status `authorized`
- [ ] No máximo **uma** NF autorizada/ativa por serviço
- [ ] Valor da nota = bruto do cliente no disparo
- [ ] Ações relevantes em `audit_logs`

## 13. Riscos e notas

- Exigências **variam por município**; config Asaas `municipalOptions` é obrigatória por conta.
- Dados incompletos do tomador são a principal fonte de `INVOICE_ERROR` — por isso o modal de conferência é gate, não opcional.
- Emissão é assíncrona: UI nunca deve assumir “autorizada” só pelo `201` do agendamento.
- Reforma tributária (IBS/CBS) pode exigir campos extras no Asaas depois; v1 não antecipa além do que a API já exige hoje.

## 14. Próximo passo de implementação

Começar pelo ticket 1 (schema + RLS), em paralelo rascunhar a config fiscal da org seed `jmd` no Asaas sandbox para validar município/serviço antes da UI completa.

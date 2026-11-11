# Fluxo de pagamento — Asaas (JMD Transfer)

Documento de decisão comercial e operacional. Consolida o que foi alinhado para fechar o gap de pagamento entre a negociação no WhatsApp e a cobrança na plataforma.

**Provedor:** Asaas (Checkout / link de pagamento).  
**Canal de envio do link:** WhatsApp do cliente cadastrado na reserva.  
**Público:** cliente **não** tem conta na plataforma; quem opera é staff da organização.

---

## 1. Princípios

1. O site **não** mostra preço final ao cliente. O valor fecha no WhatsApp.
2. A plataforma registra o **preço real** (valor negociado) e dispara cobranças via Asaas.
3. Há **duas cobranças** por serviço: **sinal** e **restante**.
4. O financeiro interno (comissão / repasse ao motorista) é outro caixa. A cobrança do cliente (Asaas) e o lançamento `financial_entries` se encontram no valor bruto acordado/ajustado, mas não se misturam no mesmo instrumento.
5. Chave de API do Asaas fica **somente no servidor** (Edge Function + secret). O painel pede “cobrar” e recebe a URL.

---

## 2. Jornada completa

```text
Cliente                WhatsApp              Painel (Reservas)              Asaas
  |                       |                         |                         |
  |-- formulário -------->|                         |                         |
  |   reserva em hold     |                         |                         |
  |                       |-- combina horário ----->|                         |
  |                       |   e valor               |                         |
  |                       |                         |-- grava preço real      |
  |                       |                         |-- Emite cobrança SINAL ->|
  |                       |                         |<-- link ----------------- |
  |                       |<-- envia link sinal ----|                         |
  |-- paga o sinal ------------------------------------------->|              |
  |                       |                         |<-- webhook: sinal pago -|
  |                       |                         |-- confirma reserva      |
  |                       |                         |-- despacho / serviço    |
  |                       |                         |-- (opcional) ajusta     |
  |                       |                         |    restante + justificativa
  |                       |                         |-- Emite cobrança RESTANTE
  |                       |                         |<-- link ----------------- |
  |                       |<-- envia link restante -|                         |
  |-- paga o restante --------------------------------------->|               |
  |                       |                         |<-- webhook: restante pago
  |                       |                         |-- conclui / liquida     |
```

### Passo a passo

1. **Solicitação** — Cliente preenche o formulário na landing. Cria-se a reserva em `hold` e abre-se o WhatsApp com o resumo (sem preço final).
2. **Negociação** — No WhatsApp fecham-se horário, detalhes e valor. A plataforma **não** lê a conversa; a operação traz o resultado de volta.
3. **Preço real** — No **Detalhe da reserva** (`/admin/reservas`), a operação grava o **preço real** (`override_price`). Esse é o valor de referência de todas as cobranças.
4. **Cobrança do sinal** — Botão **Enviar cobrança do sinal**. O sistema calcula `percentual_configurado × preço_real`, cria o Checkout no Asaas e abre o WhatsApp do cliente com o link.
5. **Confirmação** — Com o sinal pago (webhook), a reserva pode ser **confirmada** e o despacho segue.
6. **Serviço** — Transfer / horas / concierge ocorre normalmente.
7. **Cobrança do restante** — Após o serviço (liquidação / conclusão), no mesmo Detalhe da reserva: valor sugerido = `preço_real − sinal_cobrado`. Pode ser alterado (desconto ou adicional) **com justificativa obrigatória**. Botão **Enviar cobrança do restante** → Asaas → WhatsApp.
8. **Encerramento** — Webhook do restante pago; fluxo financeiro interno (comissão / liquidação) usa a base acordada.

---

## 3. Hold e editabilidade do preço

### Hold

- Duração do hold: **12 horas** (não mais 60 minutos).
- Objetivo: dar tempo para negociar no WhatsApp, gravar o preço real e cobrar o sinal sem perder o horário no meio da conversa.
- Ao expirar o hold, o horário volta para a agenda (`hold_expirado`), salvo regras futuras de extensão enquanto houver cobrança de sinal emitida.

### Preço real

- Editável enquanto a reserva **não** estiver **confirmada**.
- **Expirar o hold não trava o preço.** Reserva em `hold` ou `hold_expirado` ainda permite editar o preço real.
- Após **confirmação do serviço**, o preço real **deixa de ser editável** (valor travado para a operação daquela reserva).

### Sequência esperada

1. Combinar no WhatsApp  
2. Salvar preço real  
3. Emitir / pagar sinal  
4. Confirmar reserva  

---

## 4. Configuração do percentual de sinal

- **Onde:** página **Transfer** (regras comerciais / frete por tipo de serviço).
- **O quê:** percentual de sinal **por tipo de serviço** (ex.: ponto A → B = 30%, à disposição = X%, concierge = Y%).
- **Base do cálculo:** sempre o **preço real** da reserva no momento da emissão do link.
- Exemplo: preço real R$ 1.000,00 · sinal 30% → Checkout de **R$ 300,00**.

O restante **não** tem percentual fixo na Transfer: é o que sobra do preço real (ou o valor ajustado na liquidação).

---

## 5. Cobrança 1 — Sinal

| Item | Decisão |
|------|---------|
| Momento | Depois do preço real gravado; antes (ou como pré-requisito) da confirmação |
| Onde na UI | **Detalhe da reserva** (`/admin/reservas`) |
| Valor | `percentual da Transfer (serviço) × preço real` |
| Instrumento | Checkout Asaas (link único) |
| Entrega | Deep link WhatsApp para o telefone do cliente da reserva |
| Quem dispara | Staff com permissão de operar/admin (não o motorista no app do cliente; operação no painel) |

Estados sugeridos da cobrança de sinal: `sem_cobranca` → `emitida` → `paga` | `expirada` | `cancelada` | `estornada`.

---

## 6. Cobrança 2 — Restante

| Item | Decisão |
|------|---------|
| Momento | **Depois do serviço**, na liquidação / conclusão (já se sabe se houve desconto ou adicional) |
| Onde na UI | Mesmo **Detalhe da reserva** — não criar aba nova |
| Valor sugerido | `preço real − valor do sinal (cobrado/emitido)` |
| Ajuste | Permitido (desconto ou adicional) |
| Justificativa | **Obrigatória** sempre que o valor do restante for diferente do sugerido |
| Instrumento | Novo Checkout Asaas (link único) |
| Entrega | WhatsApp do cliente cadastrado na reserva |

### Motivos típicos de ajuste

- Desconto comercial  
- Adicional (espera, pedágio, parada extra, alteração de roteiro, etc.)  

O texto da justificativa fica registrado na reserva / na cobrança para auditoria.

---

## 7. Onde cada coisa vive no sistema

| Recurso | Tela / local |
|---------|----------------|
| Percentual de sinal por serviço | Página **Transfer** |
| Preço real | **Detalhe da reserva** |
| Botão enviar cobrança do sinal | **Detalhe da reserva** |
| Confirmar reserva (após sinal) | **Detalhe da reserva** / ações já existentes |
| Despacho do motorista | Controles de despacho (já existentes) |
| Valor do restante + justificativa | **Detalhe da reserva** (fase pós-serviço) |
| Botão enviar cobrança do restante | **Detalhe da reserva** |
| Comissão / liquidação motorista | Painel **Financeiro** (`financial_entries`) — separado do Checkout |

---

## 8. Relação com confirmação e despacho

- Enquanto houver cobrança de **sinal** emitida e ainda não paga, a **confirmação** da reserva deve depender do sinal **pago** (webhook Asaas).
- Sem cobrança de sinal emitida, a operação atual de confirmar “por fora” pode ser preservada só se a política comercial permitir; o fluxo alvo assume **sinal → confirma → despacha**.
- Despacho e app do motorista **não** cobram o cliente; só a operação no painel dispara os links.

---

## 9. Asaas — regras técnicas de produto

- Preferir **Checkout** de uso único por cobrança (sinal e restante = dois checkouts distintos).
- PIX e cartão na página do Asaas; dados sensíveis não passam pela JMD.
- Confirmação de pagamento via **webhook** (não confiar em “cliente fechou a aba”).
- Webhook **idempotente**.
- CPF pode ser coletado no Checkout; não é obrigatório no formulário público da landing.
- Taxa do Asaas: nesta versão, fica com a JMD (sem split automático para o motorista).

---

## 10. Base financeira (motorista)

- Conclusão do job / lançamento financeiro usa o **preço real** (e, se a política evoluir, o total efetivamente cobrado = sinal + restante ajustado).
- Nesta decisão: o preço real continua a âncora; ajustes do restante com justificativa devem refletir no total cobrado do cliente e, quando aplicável, no bruto do repasse.
- Sinal e restante são cobranças do **cliente**; `financial_entries` continua sendo o repasse **organização ↔ motorista**.

---

## 11. Fora de escopo nesta decisão

- Conta do cliente final na plataforma  
- Split automático Asaas para o motorista  
- Sinal e restante em mais de duas parcelas  
- Boleto com vencimento longo / faturamento B2B recorrente (pode coexistir depois)  
- Leitura automática da conversa do WhatsApp  

---

## 12. Ordem sugerida de implementação

1. Hold de **12 horas** + regra de editabilidade do preço (só trava após confirmação).  
2. Percentual de sinal na página **Transfer** (por tipo de serviço).  
3. Emissão da cobrança de **sinal** (Asaas + WhatsApp) no Detalhe da reserva.  
4. Webhook do sinal + gate de confirmação.  
5. UI do **restante** (valor sugerido, edição, justificativa obrigatória, link WhatsApp).  
6. Webhook do restante + amarração com conclusão / financeiro.  
7. Cancelar / expirar / estornar (operações de suporte).

---

## 13. Glossário rápido

| Termo | Significado |
|-------|-------------|
| Preço real | Valor negociado gravado na reserva (`override_price`) |
| Sinal | Percentual do preço real, configurado na Transfer, cobrado no início |
| Restante | Segunda cobrança após o serviço; padrão = preço real − sinal; ajustável com justificativa |
| Checkout | Link de pagamento único Asaas |
| Hold | Reserva provisória do horário (12 h) |

---

*Decisões alinhadas em sessão de produto (nov/2026). Implementação deve seguir este documento; mudanças de regra exigem atualização desta página.*

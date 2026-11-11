# Credenciais Asaas (última etapa)

Não coloque API keys no front (`VITE_*` / `web/.env`). Tudo vai em **Supabase Edge Secrets**.

## Secrets (já aplicados no projeto)

| Secret | Valor esperado |
|--------|----------------|
| `ASAAS_API_KEY` | Chave **sandbox** (`$aact_hmlg_…`) |
| `ASAAS_ENV` | `sandbox` |
| `ASAAS_WEBHOOK_TOKEN` | Token aleatório (≥32 chars), **não** é URL |
| `SITE_URL` | `https://www.jmdtransfer.com` |

### PowerShell (importante)

No PowerShell, `$aact_…` é expandido como variável. Use **aspas simples** ou `--env-file`:

```powershell
npx supabase secrets set --yes "ASAAS_API_KEY=$aact_hmlg_COLE_A_CHAVE_AQUI"
# ↑ ERRADO no PowerShell: o $aact_… some

# Certo:
npx supabase secrets set --yes 'ASAAS_API_KEY=$aact_hmlg_COLE_A_CHAVE_AQUI'
npx supabase secrets set --yes "ASAAS_ENV=sandbox"
npx supabase secrets set --yes "SITE_URL=https://www.jmdtransfer.com"
```

Ou:

```powershell
npx supabase secrets set --yes ASAAS_ENV=sandbox
# arquivo .asaas.secrets (não versionar) com:
# ASAAS_API_KEY=$aact_hmlg_...
npx supabase secrets set --yes --env-file .asaas.secrets
```

Opcional:

```powershell
npx supabase secrets set --yes 'ASAAS_API_URL=https://api-sandbox.asaas.com'
npx supabase secrets set --yes 'ASAAS_CHECKOUT_URL=https://sandbox.asaas.com'
```

Produção: chave `$aact_prod_…` + `ASAAS_ENV=production` (o código também detecta o prefixo da chave).

## Webhook no painel Asaas

- **URL:** `https://bicjcqtzctljsygougsh.supabase.co/functions/v1/asaas-webhook`
- **authToken:** o mesmo valor de `ASAAS_WEBHOOK_TOKEN` (secret no Supabase)
- **Eventos:** `CHECKOUT_PAID`, `CHECKOUT_EXPIRED`, `CHECKOUT_CANCELED`

## Checklist rápido

1. Conta Asaas sandbox
2. Secrets setados no Supabase com aspas simples no PowerShell
3. Webhook cadastrado com o token correto
4. Emitir sinal numa reserva de teste → link no WhatsApp
5. Pagar PIX sandbox → status `paga` → confirmar reserva

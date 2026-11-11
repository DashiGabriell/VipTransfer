/** Cliente mínimo Asaas Checkout (sandbox ou produção via env / prefixo da chave). */

export type AsaasCheckoutCreateInput = {
  amount: number
  itemName: string
  itemDescription: string
  minutesToExpire: number
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  successUrl?: string | null
  cancelUrl?: string | null
  expiredUrl?: string | null
  externalReference: string
}

export type AsaasCheckoutCreated = {
  id: string
  checkoutUrl: string
}

function resolveAsaasEnv(apiKey: string): "sandbox" | "production" {
  if (apiKey.startsWith("$aact_prod")) return "production"
  if (apiKey.startsWith("$aact_hmlg")) return "sandbox"
  const env = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase()
  return env === "production" ? "production" : "sandbox"
}

function asaasApiBase(apiKey: string): string {
  const raw = Deno.env.get("ASAAS_API_URL")?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return resolveAsaasEnv(apiKey) === "production"
    ? "https://api.asaas.com"
    : "https://api-sandbox.asaas.com"
}

function asaasCheckoutPageBase(apiKey: string): string {
  const raw = Deno.env.get("ASAAS_CHECKOUT_URL")?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return resolveAsaasEnv(apiKey) === "production"
    ? "https://asaas.com"
    : "https://sandbox.asaas.com"
}

export function requireAsaasApiKey(): string {
  const key = Deno.env.get("ASAAS_API_KEY")?.trim()
  if (!key) {
    throw new Error("ASAAS_NOT_CONFIGURED")
  }
  return key
}

/** Metadados seguros da chave (sem vazar o secret). */
export function asaasApiKeyMeta(key: string): string {
  const prefix = key.startsWith("$aact_hmlg")
    ? "$aact_hmlg"
    : key.startsWith("$aact_prod")
    ? "$aact_prod"
    : key.startsWith("$aact_")
    ? "$aact_?"
    : key.length === 0
    ? "empty"
    : "unknown"
  return `${prefix};len=${key.length};env=${resolveAsaasEnv(key)}`
}

export function buildCheckoutUrl(apiKey: string, checkoutId: string): string {
  return `${asaasCheckoutPageBase(apiKey)}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`
}

/**
 * Payload alinhado ao exemplo oficial Asaas (PIX + cartão, DETACHED).
 * Sem customerData — o Checkout coleta CPF/dados no Asaas.
 */
export async function createAsaasCheckout(
  input: AsaasCheckoutCreateInput,
): Promise<AsaasCheckoutCreated> {
  const apiKey = requireAsaasApiKey()
  console.log("asaas key meta", asaasApiKeyMeta(apiKey))

  const siteFallback = asaasCheckoutPageBase(apiKey)
  const successUrl = input.successUrl || `${siteFallback}/`
  const cancelUrl = input.cancelUrl || `${siteFallback}/`
  const expiredUrl = input.expiredUrl || cancelUrl

  const name = input.itemName
    .replace(/[^\w\s\-./]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30) || "JMD Transfer"
  const description = input.itemDescription
    .replace(/[^\w\s\-./%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150) || name

  const body = {
    billingTypes: ["PIX", "CREDIT_CARD"],
    chargeTypes: ["DETACHED"],
    minutesToExpire: Math.min(1440, Math.max(10, input.minutesToExpire || 60)),
    externalReference: input.externalReference.slice(0, 200),
    callback: {
      successUrl,
      cancelUrl,
      expiredUrl,
    },
    items: [
      {
        name,
        description,
        quantity: 1,
        value: Number(input.amount.toFixed(2)),
      },
    ],
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    accept: "application/json",
    "User-Agent": "JMD-Transfer/1.0",
    access_token: apiKey,
    Authorization: `Bearer ${apiKey}`,
  }

  const url = `${asaasApiBase(apiKey)}/v3/checkouts`
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const raw = await res.text()

  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const detail =
      typeof parsed.errors === "object"
        ? JSON.stringify(parsed.errors)
        : raw.slice(0, 400) || `HTTP_${res.status}`
    if (res.status === 401 || /invalid_access_token/i.test(detail)) {
      throw new Error(
        `ASAAS_INVALID_API_KEY:${asaasApiKeyMeta(apiKey)}:${detail.slice(0, 160)}`,
      )
    }
    throw new Error(`ASAAS_CHECKOUT_FAILED:${res.status}:${detail}`)
  }

  const id = typeof parsed.id === "string" ? parsed.id : ""
  if (!id) throw new Error("ASAAS_CHECKOUT_NO_ID")

  return { id, checkoutUrl: buildCheckoutUrl(apiKey, id) }
}

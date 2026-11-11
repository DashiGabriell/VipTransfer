import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { createAsaasCheckout } from "../_shared/asaas.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

type Body = {
  charge_id?: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function siteOrigin(): string | null {
  const site = Deno.env.get("SITE_URL")?.trim()
  if (!site) return null
  try {
    return new URL(site).origin
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, { error: "MISSING_SUPABASE_ENV" })
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "NOT_AUTHENTICATED" })
    }

    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return json(400, { error: "INVALID_JSON" })
    }

    const chargeId = body.charge_id?.trim()
    if (!chargeId) return json(400, { error: "CHARGE_ID_REQUIRED" })

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json(401, { error: "NOT_AUTHENTICATED" })

    // Staff só lê a cobrança se tiver RLS (can_operate_org).
    const { data: charge, error: chargeErr } = await userClient
      .from("payment_charges")
      .select(
        "*, reservation:reservations(id, service_code, customer_name, customer_email, customer_phone, service_type)",
      )
      .eq("id", chargeId)
      .maybeSingle()

    if (chargeErr) return json(400, { error: chargeErr.message })
    if (!charge) return json(404, { error: "NOT_FOUND" })
    if (charge.status !== "emitida") {
      return json(409, { error: "INVALID_STATUS" })
    }

    if (charge.checkout_url && charge.asaas_checkout_id) {
      return json(200, {
        charge,
        reused: true,
        checkout_url: charge.checkout_url,
      })
    }

    const reservation = charge.reservation as {
      id: string
      service_code: string | null
      customer_name: string
      customer_email: string
      customer_phone: string
      service_type: string
    } | null

    if (!reservation) return json(400, { error: "RESERVATION_MISSING" })

    const kindLabel = charge.kind === "sinal" ? "Sinal" : "Restante"
    const code = (reservation.service_code ?? "").trim().toUpperCase()
    const itemName = code
      ? `JMD ${code} · ${kindLabel}`
      : `JMD Transfer · ${kindLabel}`
    const itemDescription = [
      kindLabel,
      code ? `código ${code}` : null,
      charge.deposit_percent != null
        ? `sinal ${charge.deposit_percent}%`
        : null,
    ]
      .filter(Boolean)
      .join(" · ")

    const origin = siteOrigin()
    // Asaas rejeita callback localhost / URL inválida — só usa SITE_URL se for https público.
    const publicOrigin =
      origin &&
        !/localhost|127\.0\.0\.1/i.test(origin) &&
        origin.startsWith("https://")
        ? origin
        : null
    const minutes = charge.expires_at
      ? Math.max(
        10,
        Math.round(
          (new Date(charge.expires_at).getTime() - Date.now()) / 60_000,
        ),
      )
      : 720

    let created
    try {
      created = await createAsaasCheckout({
        amount: Number(charge.amount),
        itemName,
        itemDescription,
        minutesToExpire: minutes,
        customerName: reservation.customer_name,
        customerEmail: reservation.customer_email,
        customerPhone: reservation.customer_phone,
        externalReference: charge.id,
        successUrl: publicOrigin ? `${publicOrigin}/pagamento/sucesso` : null,
        cancelUrl: publicOrigin ? `${publicOrigin}/pagamento/cancelado` : null,
        expiredUrl: publicOrigin ? `${publicOrigin}/pagamento/expirado` : null,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "ASAAS_NOT_CONFIGURED") {
        return json(503, { error: "ASAAS_NOT_CONFIGURED" })
      }
      console.error("create-asaas-checkout failed", msg)
      return json(502, { error: msg })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: updated, error: updErr } = await admin
      .from("payment_charges")
      .update({
        asaas_checkout_id: created.id,
        checkout_url: created.checkoutUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", charge.id)
      .eq("status", "emitida")
      .select("*")
      .single()

    if (updErr) return json(500, { error: updErr.message })

    return json(200, {
      charge: updated,
      reused: false,
      checkout_url: created.checkoutUrl,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json(500, { error: msg })
  }
})

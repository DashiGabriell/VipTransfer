import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

type CheckoutPayload = {
  id?: string
  event?: string
  checkout?: {
    id?: string
    status?: string
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mapEventToStatus(
  event: string,
): "paga" | "expirada" | "cancelada" | null {
  switch (event) {
    case "CHECKOUT_PAID":
      return "paga"
    case "CHECKOUT_EXPIRED":
      return "expirada"
    case "CHECKOUT_CANCELED":
      return "cancelada"
    default:
      return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok")
  }
  if (req.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" })
  }

  try {
    const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN")?.trim()
    if (expected) {
      const got = req.headers.get("asaas-access-token")?.trim() ?? ""
      if (!got || got !== expected) {
        return json(401, { error: "INVALID_WEBHOOK_TOKEN" })
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "MISSING_SUPABASE_ENV" })
    }

    let payload: CheckoutPayload
    try {
      payload = (await req.json()) as CheckoutPayload
    } catch {
      return json(400, { error: "INVALID_JSON" })
    }

    const eventId = typeof payload.id === "string" ? payload.id : ""
    const event = typeof payload.event === "string" ? payload.event : ""
    const checkoutId =
      typeof payload.checkout?.id === "string" ? payload.checkout.id : ""

    if (!eventId || !event) {
      return json(400, { error: "INVALID_PAYLOAD" })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Idempotência: evento já processado → 200
    const { data: existing } = await admin
      .from("asaas_webhook_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle()

    if (existing) {
      return json(200, { ok: true, duplicate: true })
    }

    const nextStatus = mapEventToStatus(event)
    let chargeId: string | null = null

    if (nextStatus && checkoutId) {
      const { data: charge } = await admin
        .from("payment_charges")
        .select("id, status")
        .eq("asaas_checkout_id", checkoutId)
        .maybeSingle()

      if (charge) {
        chargeId = charge.id as string
        // Só avança a partir de emitida (não reabre paga → expirada etc.)
        if (charge.status === "emitida") {
          const patch: Record<string, unknown> = {
            status: nextStatus,
            updated_at: new Date().toISOString(),
          }
          if (nextStatus === "paga") {
            patch.paid_at = new Date().toISOString()
          }
          if (nextStatus === "cancelada" || nextStatus === "expirada") {
            patch.cancelled_at = new Date().toISOString()
          }
          await admin
            .from("payment_charges")
            .update(patch)
            .eq("id", charge.id)
            .eq("status", "emitida")
        }
      }
    }

    await admin.from("asaas_webhook_events").insert({
      id: eventId,
      event,
      checkout_id: checkoutId || null,
      payment_charge_id: chargeId,
      payload: payload as unknown as Record<string, unknown>,
    })

    return json(200, { ok: true, event, status: nextStatus })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json(500, { error: msg })
  }
})

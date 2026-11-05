import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  driver_id?: string;
  redirect_to?: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAllowedRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".vercel.app")) return true;
    if (
      host.includes("jmd") ||
      host.includes("jmdtrasnfer") ||
      host.includes("viptransfer")
    ) {
      return true;
    }
    const site = Deno.env.get("SITE_URL");
    if (site) {
      try {
        return new URL(site).hostname.toLowerCase() === host;
      } catch {
        /* ignore */
      }
    }
    return false;
  } catch {
    return false;
  }
}

function resolveN8nWebhookUrl(): string | null {
  const dedicated = Deno.env.get("N8N_DRIVER_INVITE_WEBHOOK_URL")?.trim();
  if (dedicated) return dedicated;

  // Fallback: same host as reservation webhook, different path.
  const reservation = Deno.env.get("N8N_WEBHOOK_URL")?.trim();
  if (reservation) {
    try {
      const u = new URL(reservation);
      u.pathname = u.pathname.replace(
        /jmd-reservation-created\/?$/,
        "jmd-driver-invite",
      );
      if (!u.pathname.includes("jmd-driver-invite")) {
        u.pathname = "/webhook/jmd-driver-invite";
      }
      return u.toString();
    } catch {
      /* ignore */
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, { error: "MISSING_SUPABASE_ENV" });
    }

    const n8nUrl = resolveN8nWebhookUrl();
    if (!n8nUrl) {
      return json(500, { error: "MISSING_N8N_DRIVER_INVITE_WEBHOOK_URL" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "NOT_AUTHENTICATED" });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json(400, { error: "INVALID_JSON" });
    }

    const driverId = body.driver_id?.trim();
    const redirectTo = body.redirect_to?.trim();
    if (!driverId) return json(400, { error: "DRIVER_ID_REQUIRED" });
    if (!redirectTo || !isAllowedRedirect(redirectTo)) {
      return json(400, { error: "INVALID_REDIRECT" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json(401, { error: "NOT_AUTHENTICATED" });
    }

    const { data: driver, error: driverError } = await userClient.rpc(
      "get_driver_for_invite",
      { p_driver_id: driverId },
    );
    if (driverError) {
      return json(403, { error: driverError.message || "FORBIDDEN" });
    }
    if (!driver?.email) {
      return json(404, { error: "DRIVER_NOT_FOUND" });
    }

    if (driver.invite_status === "accepted" && driver.user_id) {
      return json(200, {
        ok: true,
        already_accepted: true,
        driver,
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = String(driver.email).trim().toLowerCase();
    let authUserId: string | null = driver.user_id ?? null;
    let mode: "invite" | "recovery" = "invite";
    let actionLink: string | null = null;

    // Gera link sem disparar e-mail do Supabase — o n8n/Gmail envia.
    const inviteLink = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: {
          full_name: driver.full_name,
          driver_id: driver.id,
          organization_id: driver.organization_id,
          role: "driver",
        },
      },
    });

    if (inviteLink.error) {
      const msg = inviteLink.error.message || "";
      const already =
        /already|registered|exists/i.test(msg) ||
        inviteLink.error.status === 422;

      if (!already) {
        return json(400, { error: msg || "INVITE_LINK_FAILED" });
      }

      mode = "recovery";
      const recoveryLink = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (recoveryLink.error || !recoveryLink.data.properties?.action_link) {
        return json(400, {
          error: recoveryLink.error?.message || "RECOVERY_LINK_FAILED",
        });
      }
      actionLink = recoveryLink.data.properties.action_link;
      authUserId = recoveryLink.data.user?.id ?? authUserId;
    } else {
      actionLink = inviteLink.data.properties?.action_link ?? null;
      authUserId = inviteLink.data.user?.id ?? authUserId;
      if (!actionLink) {
        return json(400, { error: "INVITE_LINK_MISSING" });
      }
    }

    const { data: updated, error: markError } = await userClient.rpc(
      "mark_driver_invite_pending",
      {
        p_driver_id: driverId,
        p_user_id: authUserId,
      },
    );
    if (markError) {
      return json(400, { error: markError.message || "MARK_FAILED" });
    }

    const webhookPayload = {
      event: "driver.invite",
      invited_by: user.email ?? "admin",
      driver: {
        id: updated?.id ?? driver.id,
        organization_id: updated?.organization_id ?? driver.organization_id,
        full_name: updated?.full_name ?? driver.full_name,
        email: updated?.email ?? email,
        phone: updated?.phone ?? driver.phone,
        invite_status: updated?.invite_status ?? "pending",
      },
      invite: {
        mode,
        action_link: actionLink,
        redirect_to: redirectTo,
      },
    };

    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    if (!n8nRes.ok) {
      const detail = await n8nRes.text().catch(() => "");
      return json(502, {
        error: "N8N_WEBHOOK_FAILED",
        status: n8nRes.status,
        detail: detail.slice(0, 400),
        // Convite Auth já marcado pending; admin pode reenviar.
        driver: updated,
      });
    }

    return json(200, {
      ok: true,
      mode,
      driver: updated,
      emailed_via: "n8n",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNEXPECTED";
    return json(500, { error: message });
  }
});

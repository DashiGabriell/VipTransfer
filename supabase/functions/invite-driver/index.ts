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
    // Local + production hosts for this product
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host.includes("jmd") || host.includes("viptransfer")) return true;
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

    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: driver.full_name,
        driver_id: driver.id,
        organization_id: driver.organization_id,
        role: "driver",
      },
    });

    if (inviteResult.error) {
      const msg = inviteResult.error.message || "";
      const already =
        /already|registered|exists/i.test(msg) ||
        inviteResult.error.status === 422;

      if (!already) {
        return json(400, { error: msg || "INVITE_FAILED" });
      }

      // Conta já existe: reenvia link de recuperação para definir/redefinir senha.
      mode = "recovery";
      const { error: recoveryError } = await admin.auth.resetPasswordForEmail(
        email,
        { redirectTo },
      );
      if (recoveryError) {
        return json(400, {
          error: recoveryError.message || "RECOVERY_FAILED",
        });
      }

      if (!authUserId) {
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        authUserId = linkData.user?.id ?? null;
      }
    } else {
      authUserId = inviteResult.data.user?.id ?? authUserId;
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

    return json(200, {
      ok: true,
      mode,
      driver: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNEXPECTED";
    return json(500, { error: message });
  }
});

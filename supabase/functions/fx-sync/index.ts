import { adminClient, getCaller, UnauthorizedError } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { QUOTES, refreshFxRates } from "../_shared/fx.ts";

// The provider publishes new rates once a day, so a short cooldown loses nothing.
const COOLDOWN_MS = 5 * 60 * 1000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const { user, sessionId } = await getCaller(req);
    if (!sessionId) {
      return json(400, { error: "missing_session" });
    }

    const admin = adminClient();
    const now = new Date();

    const { data: verified, error: verifiedError } = await admin
      .from("verified_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (verifiedError) {
      console.error("verified_sessions lookup failed", verifiedError.message);
      return json(500, { error: "server_error" });
    }
    if (!verified) {
      return json(403, { error: "not_allowed" });
    }

    const { data: member, error: memberError } = await admin
      .from("household_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) {
      console.error("household_members lookup failed", memberError.message);
      return json(500, { error: "server_error" });
    }
    if (!member || member.role !== "primary") {
      return json(403, { error: "not_allowed" });
    }

    const { data: latest, error: latestError } = await admin
      .from("fx_rates")
      .select("fetched_at")
      .eq("base", "CAD")
      .in("quote", [...QUOTES])
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) {
      console.error("fx_rates lookup failed", latestError.message);
      return json(500, { error: "server_error" });
    }
    if (latest && now.getTime() - Date.parse(latest.fetched_at) < COOLDOWN_MS) {
      return json(200, { ok: true, skipped: true, fetched_at: latest.fetched_at });
    }

    const result = await refreshFxRates();
    if (!result.ok) {
      return json(result.status, { error: result.error });
    }
    return json(200, { ok: true, skipped: false, rates: result.rates });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json(401, { error: "unauthorized" });
    }
    console.error("fx-sync failed", error instanceof Error ? error.message : "unknown error");
    return json(500, { error: "server_error" });
  }
});

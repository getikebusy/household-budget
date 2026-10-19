import { adminClient, getCaller, UnauthorizedError } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

function json(status: number, body: unknown = {}): Response {
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
    const { sessionId } = await getCaller(req);
    if (!sessionId) {
      return json(400, { error: "missing_session" });
    }

    const { error } = await adminClient().from("verified_sessions").delete().eq("session_id", sessionId);
    if (error) {
      console.error("failed to delete verified session", error.message);
      return json(500, { error: "server_error" });
    }

    return json(200, {});
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json(401, { error: "unauthorized" });
    }
    console.error("end-session failed", error instanceof Error ? error.message : "unknown error");
    return json(500, { error: "server_error" });
  }
});

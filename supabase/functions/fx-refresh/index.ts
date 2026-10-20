import { refreshFxRates } from "../_shared/fx.ts";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
    return json(500, { error: "server_error" });
  }

  const authorization = req.headers.get("Authorization");
  if (authorization !== `Bearer ${serviceRoleKey}`) {
    return json(401, { error: "unauthorized" });
  }

  const result = await refreshFxRates();
  if (!result.ok) {
    return json(result.status, { error: result.error });
  }

  return json(200, { ok: true, rates: result.rates });
});

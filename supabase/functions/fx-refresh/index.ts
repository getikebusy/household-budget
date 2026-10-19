import { adminClient } from "../_shared/auth.ts";

const DEFAULT_FX_URL = "https://open.er-api.com/v6/latest/CAD";
const MIN_RATE = 100;
const MAX_RATE = 10000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_RATE && value <= MAX_RATE;
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

  const apiUrl = Deno.env.get("FX_API_URL")?.trim() || DEFAULT_FX_URL;
  let source = "fx";
  try {
    source = new URL(apiUrl).host || source;
  } catch {
    console.error("FX_API_URL is not a valid URL");
    return json(502, { error: "bad_rate" });
  }

  let rate: unknown;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("FX provider returned", response.status);
      return json(502, { error: "bad_rate" });
    }
    const payload = (await response.json()) as { rates?: { NGN?: unknown } };
    rate = payload.rates?.NGN;
  } catch (error) {
    console.error("FX fetch failed", error instanceof Error ? error.message : "unknown error");
    return json(502, { error: "bad_rate" });
  }

  if (!isValidRate(rate)) {
    console.error("CAD→NGN rate rejected", rate);
    return json(502, { error: "bad_rate" });
  }

  const { data, error } = await adminClient()
    .from("fx_rates")
    .insert({ base: "CAD", quote: "NGN", rate, source })
    .select("id, rate, fetched_at")
    .single();

  if (error) {
    console.error("fx_rates insert failed", error.message);
    return json(500, { error: "server_error" });
  }

  return json(200, { ok: true, id: data.id, rate: data.rate, fetched_at: data.fetched_at });
});

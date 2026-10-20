import { adminClient } from "../_shared/auth.ts";

const DEFAULT_FX_URL = "https://open.er-api.com/v6/latest/CAD";
const QUOTES = ["NGN", "USD", "GBP"] as const;
const BOUNDS: Record<(typeof QUOTES)[number], readonly [number, number]> = {
  NGN: [100, 10000],
  USD: [0.4, 1.5],
  GBP: [0.3, 1.2],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidRate(quote: (typeof QUOTES)[number], value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  const [min, max] = BOUNDS[quote];
  return value >= min && value <= max;
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

  let rates: Partial<Record<(typeof QUOTES)[number], unknown>> = {};
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("FX provider returned", response.status);
      return json(502, { error: "bad_rate" });
    }
    const payload = (await response.json()) as { rates?: Partial<Record<(typeof QUOTES)[number], unknown>> };
    rates = payload.rates ?? {};
  } catch (error) {
    console.error("FX fetch failed", error instanceof Error ? error.message : "unknown error");
    return json(502, { error: "bad_rate" });
  }

  const rows = QUOTES.flatMap((quote) => {
    const rate = rates[quote];
    if (!isValidRate(quote, rate)) {
      console.error(`CAD→${quote} rate rejected`);
      return [];
    }
    return [{ base: "CAD", quote, rate, source }];
  });

  if (rows.length === 0) {
    return json(502, { error: "bad_rate" });
  }

  const { data, error } = await adminClient()
    .from("fx_rates")
    .insert(rows)
    .select("id, quote, rate, fetched_at");

  if (error) {
    console.error("fx_rates insert failed", error.message);
    return json(500, { error: "server_error" });
  }

  return json(200, { ok: true, rates: data });
});

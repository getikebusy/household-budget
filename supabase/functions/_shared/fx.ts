import { adminClient } from "./auth.ts";

const DEFAULT_FX_URL = "https://open.er-api.com/v6/latest/CAD";
export const QUOTES = ["NGN", "USD", "GBP"] as const;
type Quote = (typeof QUOTES)[number];
const BOUNDS: Record<Quote, readonly [number, number]> = {
  NGN: [100, 10000],
  USD: [0.4, 1.5],
  GBP: [0.3, 1.2],
};

export type StoredRate = { id: string; quote: string; rate: number; fetched_at: string };

export type RefreshResult =
  | { ok: true; rates: StoredRate[] }
  | { ok: false; status: number; error: "bad_rate" | "server_error" };

function isValidRate(quote: Quote, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  const [min, max] = BOUNDS[quote];
  return value >= min && value <= max;
}

// Fetches CAD rates from the provider and stores every quote that passes the sanity bounds.
export async function refreshFxRates(): Promise<RefreshResult> {
  const apiUrl = Deno.env.get("FX_API_URL")?.trim() || DEFAULT_FX_URL;
  let source = "fx";
  try {
    source = new URL(apiUrl).host || source;
  } catch {
    console.error("FX_API_URL is not a valid URL");
    return { ok: false, status: 502, error: "bad_rate" };
  }

  let rates: Partial<Record<Quote, unknown>> = {};
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("FX provider returned", response.status);
      return { ok: false, status: 502, error: "bad_rate" };
    }
    const payload = (await response.json()) as { rates?: Partial<Record<Quote, unknown>> };
    rates = payload.rates ?? {};
  } catch (error) {
    console.error("FX fetch failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, status: 502, error: "bad_rate" };
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
    return { ok: false, status: 502, error: "bad_rate" };
  }

  const { data, error } = await adminClient()
    .from("fx_rates")
    .insert(rows)
    .select("id, quote, rate, fetched_at");

  if (error) {
    console.error("fx_rates insert failed", error.message);
    return { ok: false, status: 500, error: "server_error" };
  }

  return { ok: true, rates: (data ?? []) as StoredRate[] };
}

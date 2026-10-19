import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export type Caller = {
  user: User;
  sessionId: string | undefined;
  email: string | undefined;
  accessToken: string;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new UnauthorizedError();
  }

  const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
}

export function adminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getCaller(req: Request): Promise<Caller> {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    throw new UnauthorizedError();
  }

  const accessToken = header.slice("bearer ".length).trim();
  if (!accessToken) {
    throw new UnauthorizedError();
  }

  const { data, error } = await adminClient().auth.getUser(accessToken);
  if (error || !data.user) {
    throw new UnauthorizedError();
  }

  const claims = decodeJwtPayload(accessToken);
  const sessionId = typeof claims.session_id === "string" ? claims.session_id : undefined;
  const email =
    (typeof claims.email === "string" ? claims.email : undefined) ?? data.user.email ?? undefined;

  return { user: data.user, sessionId, email, accessToken };
}

import { adminClient, getCaller, UnauthorizedError } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const len = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < len; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid" });
    }

    const code = typeof body === "object" && body !== null && "code" in body
      ? (body as { code: unknown }).code
      : undefined;
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return json(400, { error: "invalid" });
    }

    const pepper = Deno.env.get("OTP_PEPPER");
    if (!pepper) {
      console.error("OTP_PEPPER is not set");
      return json(500, { error: "server_error" });
    }

    const admin = adminClient();
    const nowIso = new Date().toISOString();

    const { data: otp, error: otpError } = await admin
      .from("login_otps")
      .select("id, code_hash, expires_at, attempts")
      .eq("session_id", sessionId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpError) {
      console.error("login_otps lookup failed", otpError.message);
      return json(500, { error: "server_error" });
    }
    if (!otp || otp.expires_at < nowIso) {
      return json(400, { error: "expired" });
    }
    if (otp.attempts >= 5) {
      const { error: consumeError } = await admin
        .from("login_otps")
        .update({ consumed_at: nowIso })
        .eq("id", otp.id);
      if (consumeError) {
        console.error("failed to consume exhausted code", consumeError.message);
      }
      return json(429, { error: "too_many_attempts" });
    }

    const expected = await sha256Hex(`${code}:${sessionId}:${pepper}`);
    if (!timingSafeEqual(expected, otp.code_hash)) {
      const attempts = otp.attempts + 1;
      const { error: bumpError } = await admin
        .from("login_otps")
        .update({ attempts })
        .eq("id", otp.id);
      if (bumpError) {
        console.error("failed to increment attempts", bumpError.message);
        return json(500, { error: "server_error" });
      }
      return json(400, { error: "invalid", attemptsLeft: Math.max(0, 5 - attempts) });
    }

    const { error: consumeError } = await admin
      .from("login_otps")
      .update({ consumed_at: nowIso })
      .eq("id", otp.id);
    if (consumeError) {
      console.error("failed to consume matched code", consumeError.message);
      return json(500, { error: "server_error" });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: upsertError } = await admin.from("verified_sessions").upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        verified_at: nowIso,
        expires_at: expiresAt,
      },
      { onConflict: "session_id" },
    );
    if (upsertError) {
      console.error("failed to upsert verified session", upsertError.message);
      return json(500, { error: "server_error" });
    }

    return json(200, { verified: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json(401, { error: "unauthorized" });
    }
    console.error(
      "verify-login-otp failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return json(500, { error: "server_error" });
  }
});

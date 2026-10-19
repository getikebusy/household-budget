import { adminClient, getCaller, UnauthorizedError } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { loginCodeEmail } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/zeptomail.ts";

const EXPIRES_IN_SECONDS = 600;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => (b % 10).toString()).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const { user, sessionId, email } = await getCaller(req);
    if (!sessionId) {
      return json(400, { error: "missing_session" });
    }
    if (!email) {
      return json(400, { error: "missing_email" });
    }

    const pepper = Deno.env.get("OTP_PEPPER");
    if (!pepper) {
      console.error("OTP_PEPPER is not set");
      return json(500, { error: "server_error" });
    }

    const admin = adminClient();
    const now = Date.now();

    const { data: recentForSession, error: recentError } = await admin
      .from("login_otps")
      .select("created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentError) {
      console.error("login_otps recent lookup failed", recentError.message);
      return json(500, { error: "server_error" });
    }
    if (recentForSession?.created_at) {
      const elapsedSeconds = Math.floor((now - Date.parse(recentForSession.created_at)) / 1000);
      if (elapsedSeconds < 60) {
        return json(429, { error: "wait", retryAfterSeconds: 60 - elapsedSeconds });
      }
    }

    const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();
    const { count: recentUserCount, error: countError } = await admin
      .from("login_otps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", fifteenMinutesAgo);
    if (countError) {
      console.error("login_otps rate-limit count failed", countError.message);
      return json(500, { error: "server_error" });
    }
    if ((recentUserCount ?? 0) >= 5) {
      return json(429, { error: "too_many" });
    }

    const { data: verified, error: verifiedError } = await admin
      .from("verified_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .gt("expires_at", new Date(now).toISOString())
      .maybeSingle();
    if (verifiedError) {
      console.error("verified_sessions lookup failed", verifiedError.message);
      return json(500, { error: "server_error" });
    }
    if (verified) {
      return json(200, { alreadyVerified: true });
    }

    const code = generateCode();
    const codeHash = await sha256Hex(`${code}:${sessionId}:${pepper}`);
    const expiresAt = new Date(now + EXPIRES_IN_SECONDS * 1000).toISOString();

    const { error: consumeError } = await admin
      .from("login_otps")
      .update({ consumed_at: new Date(now).toISOString() })
      .eq("session_id", sessionId)
      .is("consumed_at", null);
    if (consumeError) {
      console.error("failed to consume previous codes", consumeError.message);
      return json(500, { error: "server_error" });
    }

    const { error: insertError } = await admin.from("login_otps").insert({
      user_id: user.id,
      session_id: sessionId,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });
    if (insertError) {
      console.error("failed to store login code hash", insertError.message);
      return json(500, { error: "server_error" });
    }

    const { data: member } = await admin
      .from("household_members")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { subject, html } = loginCodeEmail(code, member?.display_name ?? undefined);
    await sendEmail({ to: email, toName: member?.display_name ?? undefined, subject, html });

    return json(200, { sent: true, expiresInSeconds: EXPIRES_IN_SECONDS });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json(401, { error: "unauthorized" });
    }
    console.error("send-login-otp failed", error instanceof Error ? error.message : "unknown error");
    return json(500, { error: "server_error" });
  }
});

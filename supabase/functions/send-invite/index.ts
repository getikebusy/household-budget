import { adminClient, getCaller, UnauthorizedError } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { inviteEmail } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/zeptomail.ts";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

    let body: { email?: unknown };
    try {
      body = (await req.json()) as { email?: unknown };
    } catch {
      return json(400, { error: "invalid_email" });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isEmail(email)) {
      return json(400, { error: "invalid_email" });
    }

    const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");
    if (!appUrl) {
      console.error("APP_URL is not set");
      return json(500, { error: "server_error" });
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
      .select("household_id, role, display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) {
      console.error("household_members lookup failed", memberError.message);
      return json(500, { error: "server_error" });
    }
    if (!member || member.role !== "primary") {
      return json(403, { error: "not_allowed" });
    }

    const { count, error: countError } = await admin
      .from("household_members")
      .select("user_id", { count: "exact", head: true })
      .eq("household_id", member.household_id);
    if (countError) {
      console.error("household member count failed", countError.message);
      return json(500, { error: "server_error" });
    }
    if ((count ?? 0) !== 1) {
      return json(403, { error: "not_allowed" });
    }

    const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: expireError } = await admin
      .from("invites")
      .update({ expires_at: now.toISOString() })
      .eq("household_id", member.household_id)
      .is("accepted_at", null);
    if (expireError) {
      console.error("failed to invalidate old invites", expireError.message);
      return json(500, { error: "server_error" });
    }

    const { error: insertError } = await admin.from("invites").insert({
      household_id: member.household_id,
      email,
      token_hash: tokenHash,
      invited_by: user.id,
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("failed to store invite", insertError.message);
      return json(500, { error: "server_error" });
    }

    const link = `${appUrl}/invite/${token}`;
    const { subject, html } = inviteEmail(member.display_name, link);
    await sendEmail({ to: email, subject, html });

    return json(200, { sent: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json(401, { error: "unauthorized" });
    }
    console.error("send-invite failed", error instanceof Error ? error.message : "unknown error");
    return json(500, { error: "server_error" });
  }
});

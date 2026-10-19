// Sends one email through the ZeptoMail API.
// Docs: Zoho ZeptoMail "Email sending API" (POST /v1.1/email).
type SendEmailArgs = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
};

const DEFAULT_API_URL = "https://api.zeptomail.com/v1.1/email";

function authHeader(): string {
  const token = Deno.env.get("ZEPTOMAIL_TOKEN");
  if (!token) throw new Error("ZEPTOMAIL_TOKEN is not set");
  // The dashboard sometimes shows the token with its prefix already attached.
  return token.startsWith("Zoho-enczapikey") ? token : `Zoho-enczapikey ${token}`;
}

export async function sendEmail({ to, toName, subject, html }: SendEmailArgs): Promise<void> {
  const from = Deno.env.get("ZEPTOMAIL_FROM");
  if (!from) throw new Error("ZEPTOMAIL_FROM is not set");

  const body: Record<string, unknown> = {
    from: { address: from, name: Deno.env.get("ZEPTOMAIL_FROM_NAME") ?? "Household Budget" },
    to: [{ email_address: { address: to, name: toName ?? to } }],
    subject,
    htmlbody: html,
  };
  const bounce = Deno.env.get("ZEPTOMAIL_BOUNCE_ADDRESS");
  if (bounce) body.bounce_address = bounce;

  const res = await fetch(Deno.env.get("ZEPTOMAIL_API_URL") ?? DEFAULT_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Don't log the message body: it may contain a sign-in code.
    throw new Error(`ZeptoMail error ${res.status}: ${await res.text()}`);
  }
}

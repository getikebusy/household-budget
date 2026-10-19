export type EmailContent = {
  subject: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(inner: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F3F5F2;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:32px;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#13211C;line-height:1.5;">
    ${inner}
  </div>
</body>
</html>`;
}

export function loginCodeEmail(code: string, displayName?: string): EmailContent {
  const greeting = displayName
    ? `<p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(displayName)},</p>`
    : "";

  return {
    subject: "Your Household Budget sign-in code",
    html: layout(`
      ${greeting}
      <p style="margin:0 0 16px;font-size:16px;">Your Household Budget sign-in code is:</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1D6A50;text-align:center;">${escapeHtml(code)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#5B6B64;">This code expires in 10 minutes.</p>
      <p style="margin:0;font-size:15px;color:#5B6B64;">If this wasn't you, change your password.</p>
    `),
  };
}

export function inviteEmail(inviterName: string, link: string): EmailContent {
  const safeName = escapeHtml(inviterName);
  const safeLink = escapeHtml(link);

  return {
    subject: `${inviterName.replace(/[\r\n]+/g, " ").trim()} invited you to Household Budget`,
    html: layout(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${safeName}</strong> invited you to Household Budget.</p>
      <p style="margin:0 0 24px;font-size:15px;color:#5B6B64;">Join the household to share a budget.</p>
      <p style="margin:0 0 24px;text-align:center;">
        <a href="${safeLink}" style="display:inline-block;background:#1D6A50;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:12px;">Accept invite</a>
      </p>
      <p style="margin:0;font-size:15px;color:#5B6B64;">This link expires in 7 days.</p>
    `),
  };
}

import { adminClient } from "../_shared/auth.ts";
import { statementReminderEmail } from "../_shared/emails.ts";
import { sendEmail } from "../_shared/zeptomail.ts";

const REGINA_OFFSET_MS = 6 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type AccountRow = {
  id: string;
  user_id: string;
  household_id: string;
  name: string;
  credit_limit: number | string;
  current_balance: number | string;
  statement_day: number | null;
};

type SettingsRow = {
  household_id: string;
  statement_alert_days: number;
  util_ceiling: number | string;
  util_ideal: number | string;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function reginaToday(now: Date) {
  const shifted = new Date(now.getTime() - REGINA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isoDate(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = String(day).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function nextStatementDate(statementDay: number, now: Date) {
  const today = reginaToday(now);
  const clamped = Math.min(statementDay, daysInMonth(today.year, today.month));
  if (clamped >= today.day) {
    return isoDate(today.year, today.month, clamped);
  }
  const next = new Date(Date.UTC(today.year, today.month + 1, 1));
  const year = next.getUTCFullYear();
  const month = next.getUTCMonth();
  return isoDate(year, month, Math.min(statementDay, daysInMonth(year, month)));
}

function daysUntil(statementDate: string, now: Date) {
  const today = reginaToday(now);
  const [year, month, day] = statementDate.split("-").map(Number);
  const statement = Date.UTC(year, month - 1, day);
  const start = Date.UTC(today.year, today.month, today.day);
  return Math.round((statement - start) / 86400000);
}

function formatStatementDate(statementDate: string) {
  const [year, month, day] = statementDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function cad(amount: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
}

function wholeDollars(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function percent(fraction: number) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function payDown(balance: number, target: number, limit: number) {
  const gap = Math.round((balance - target * limit) * 100) / 100;
  return Math.max(0, Math.ceil(gap - 1e-9));
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
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json(401, { error: "unauthorized" });
  }

  const admin = adminClient();
  const now = new Date();

  const { data: accounts, error: accountsError } = await admin
    .from("credit_accounts")
    .select("id, user_id, household_id, name, credit_limit, current_balance, statement_day")
    .is("closed_on", null)
    .not("statement_day", "is", null);

  if (accountsError) {
    console.error("credit_accounts lookup failed", accountsError.message);
    return json(500, { error: "server_error" });
  }

  const rows = (accounts ?? []) as AccountRow[];
  const householdIds = [...new Set(rows.map((row) => row.household_id))];
  const settingsByHousehold = new Map<string, SettingsRow>();

  if (householdIds.length > 0) {
    const { data: settings, error: settingsError } = await admin
      .from("household_settings")
      .select("household_id, statement_alert_days, util_ceiling, util_ideal")
      .in("household_id", householdIds);
    if (settingsError) {
      console.error("household_settings lookup failed", settingsError.message);
      return json(500, { error: "server_error" });
    }
    for (const row of (settings ?? []) as SettingsRow[]) {
      settingsByHousehold.set(row.household_id, row);
    }
  }

  const emails = new Map<string, { email: string; name?: string }>();
  let sent = 0;
  let skipped = 0;

  for (const account of rows) {
    const settings = settingsByHousehold.get(account.household_id);
    const limit = Number(account.credit_limit);
    const balance = Number(account.current_balance);
    const statementDay = account.statement_day;
    if (!settings || statementDay == null || !Number.isFinite(limit) || limit <= 0 || !Number.isFinite(balance)) {
      skipped += 1;
      continue;
    }

    const ceiling = Number(settings.util_ceiling);
    const ideal = Number(settings.util_ideal);
    const utilisation = balance / limit;
    if (!Number.isFinite(ceiling) || utilisation <= ceiling) {
      skipped += 1;
      continue;
    }

    const statementDate = nextStatementDate(statementDay, now);
    const days = daysUntil(statementDate, now);
    if (days > settings.statement_alert_days) {
      skipped += 1;
      continue;
    }

    const { error: claimError } = await admin.from("reminder_log").insert({
      credit_account_id: account.id,
      statement_date: statementDate,
    });
    if (claimError) {
      if (claimError.code !== "23505") {
        console.error("reminder_log insert failed", account.id, claimError.message);
      }
      skipped += 1;
      continue;
    }

    let owner = emails.get(account.user_id);
    if (!owner) {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(account.user_id);
      if (userError || !userData.user.email) {
        console.error("owner email missing", account.id, userError?.message ?? "no email");
        await admin
          .from("reminder_log")
          .delete()
          .eq("credit_account_id", account.id)
          .eq("statement_date", statementDate);
        skipped += 1;
        continue;
      }
      const { data: member } = await admin
        .from("household_members")
        .select("display_name")
        .eq("user_id", account.user_id)
        .maybeSingle();
      owner = {
        email: userData.user.email,
        name: typeof member?.display_name === "string" ? member.display_name : undefined,
      };
      emails.set(account.user_id, owner);
    }

    const when = formatStatementDate(statementDate);
    const { subject, html } = statementReminderEmail({
      cardName: account.name,
      statementDate: when,
      balance: cad(balance),
      limit: cad(limit),
      utilisation: percent(utilisation),
      payToCeiling: wholeDollars(payDown(balance, ceiling, limit)),
      ceiling: percent(ceiling),
      payToIdeal: wholeDollars(payDown(balance, ideal, limit)),
      ideal: percent(ideal),
    });

    try {
      await sendEmail({ to: owner.email, toName: owner.name, subject, html });
    } catch (error) {
      console.error("reminder email failed", account.id, error instanceof Error ? error.message : "unknown error");
      await admin
        .from("reminder_log")
        .delete()
        .eq("credit_account_id", account.id)
        .eq("statement_date", statementDate);
      skipped += 1;
      continue;
    }
    sent += 1;
  }

  return json(200, { ok: true, sent, skipped });
});

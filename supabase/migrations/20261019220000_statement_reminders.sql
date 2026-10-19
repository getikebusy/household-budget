-- One reminder per credit account per statement date. No client policies:
-- the service role bypasses RLS, and everyone else is denied.

create table public.reminder_log (
  credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  statement_date    date not null,
  sent_at           timestamptz not null default now(),
  unique (credit_account_id, statement_date)
);

alter table public.reminder_log enable row level security;

-- 08:00 America/Regina is 14:00 UTC. Regina does not observe daylight saving.
-- Uses the same Vault secrets as fx-refresh-daily:
--   project_url, service_role_key
--   Dashboard → Database → Vault

select cron.schedule(
  'statement-reminders-daily',
  '0 14 * * *',
  $cmd$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
      order by created_at desc
      limit 1
    ) || '/functions/v1/statement-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'service_role_key'
        order by created_at desc
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cmd$
);

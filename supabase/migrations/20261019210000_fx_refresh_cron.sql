-- Daily jobs: refresh CAD→NGN, then delete expired login codes.
-- America/Regina is UTC−6 all year (no daylight saving), so 06:00 Regina is 12:00 UTC.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Vault secrets are read when the job runs. Create them in the dashboard before relying on the refresh:
--   Dashboard → Database → Vault → Add new secret
--   Name: project_url
--     Value: https://<project-ref>.supabase.co
--     No trailing slash. This is the project API URL, not the database URL.
--   Name: service_role_key
--     Value: the service_role key from Dashboard → Project Settings → API Keys
--     The edge function compares the Authorization header to "Bearer " plus this value.
-- The same rows can be created from the SQL editor:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url', 'Edge function base URL');
--   select vault.create_secret('<service-role-key>', 'service_role_key', 'Service role key for cron');

select cron.schedule(
  'fx-refresh-daily',
  '0 12 * * *',
  $cmd$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
      order by created_at desc
      limit 1
    ) || '/functions/v1/fx-refresh',
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
    timeout_milliseconds := 10000
  );
  $cmd$
);

select cron.schedule(
  'cleanup-auth-codes-daily',
  '30 12 * * *',
  $cmd$
  select public.cleanup_auth_codes();
  $cmd$
);

# Deploying to budget-prod

`scripts/deploy-prod.sh` pushes database migrations and Edge Functions to the production Supabase project, then links the CLI back to budget-dev. There is no reset script for production. Do not run `supabase db reset` against budget-prod.

## Before the first deploy

1. Create the budget-prod project in the Supabase dashboard and put its project ref in `.env.local` as `SUPABASE_PROD_PROJECT_REF`.
2. Apply the dashboard settings in the checklist below. Migrations do not copy Authentication, SMTP, or Vault secrets.
3. Create `supabase/functions/.env.production` on your machine. It is gitignored. Copy the keys from Appendix D of `docs/BUILD_GUIDE.md`. `APP_URL` is the live site origin, with no trailing slash, for example `https://budget.example.com`.
4. Upload those secrets once while the CLI is linked to budget-prod:

   ```bash
   npx supabase link --project-ref "$SUPABASE_PROD_PROJECT_REF"
   npx supabase secrets set --env-file supabase/functions/.env.production
   npx supabase link --project-ref "$SUPABASE_DEV_PROJECT_REF"
   ```

   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase. Do not put the service role key in the app or in git.

## What the script does

From the repo root:

```bash
bash scripts/deploy-prod.sh
```

1. Confirms the CLI is linked to budget-dev, then runs `npm run check` (typecheck, Jest, and the privacy tests against budget-dev). Any failure stops the script before production is touched.
2. Prints `SUPABASE_PROD_PROJECT_REF` and waits until you type `deploy prod`.
3. Links the CLI to that project and runs `npx supabase db push`.
4. Deploys every function directory in `supabase/functions` except `_shared`: `send-login-otp`, `verify-login-otp`, `end-session`, `send-invite`, `fx-refresh`, and `statement-reminders`.
5. Reminds you to set `supabase/functions/.env.production` if you have not already.
6. Links the CLI back to `SUPABASE_DEV_PROJECT_REF`, including when a later step fails.

Day-to-day deploys reuse the secrets already stored on the project. Change `APP_URL` with another `secrets set` when the live domain changes.

## Dashboard settings that must match production

Set these on budget-prod. They are not in the migrations.

**Authentication → Sign In / Providers → Email**

- Email provider on.
- Confirm email off. The app's own login code is the proof of inbox ownership.
- Minimum password length 10.

**Authentication → Emails → SMTP**

- Custom SMTP on, using the ZeptoMail Mail Agent host, port, username, and password.
- Sender email is the verified from-address. Sender name is `Household Budget`.

**Authentication → Emails → Templates → Reset password**

Use the same body as `supabase/templates/recovery.html`, so the message contains the 6-digit `{{ .Token }}` and not a reset link:

```html
<h2>Reset your password</h2>
<p>Your code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>It expires soon. If you didn't ask for this, you can ignore this email.</p>
```

**Authentication → URL configuration**

- Site URL is the live web origin, for example `https://budget.example.com`.
- Redirect URLs include that origin and the app scheme, so password recovery and invite return paths are allowed:
  - `https://budget.example.com/**`
  - `householdbudget://**`

Invite links in email use `APP_URL` (`https://budget.example.com/invite/<token>`). The installed app also opens `householdbudget://invite/<token>`.

**Database → Vault**

Cron reads these secrets when the scheduled jobs run. Create them under Database → Vault (or with `vault.create_secret`):

| Name | Value |
|---|---|
| `project_url` | `https://<prod-project-ref>.supabase.co`, no trailing slash |
| `service_role_key` | The production service role key |

`fx-refresh-daily` runs at 12:00 UTC (06:00 America/Regina). `statement-reminders-daily` runs at 14:00 UTC (08:00 America/Regina). `cleanup-auth-codes-daily` runs at 12:30 UTC. The jobs are created by migrations; they send nothing until these two secrets exist.

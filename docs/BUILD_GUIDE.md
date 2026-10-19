description: Household Budget project rules
alwaysApply: true
---
# Product
Two-person household budget tracker (a primary user and a partner) for newcomers in Canada.
Base currency CAD; NGN entries are converted to CAD. Custom 55/25/20 rule:
Needs & Personal (ceiling 55%), Investment (target 25%), Emergency (target 20%).
Full spec: docs/BUILD_GUIDE.md.

# Stack
- Expo (latest SDK), Expo Router, TypeScript strict, React Native Web.
- Supabase: Postgres + RLS, Auth (email+password), Edge Functions (Deno), Supabase Cron.
- ZeptoMail for all email: API via supabase/functions/_shared/zeptomail.ts; SMTP for Supabase Auth emails.
- TanStack Query for server state, Zustand only for local UI state, react-hook-form + zod for forms, react-native-svg for charts.

# Rules
- Never put secrets in the app. Only EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY may be used client-side.
- Every privacy or permission rule is enforced in Postgres (RLS or SECURITY DEFINER functions), never only in the UI.
- Read summaries through the RPCs get_month_summary and get_feed. Do not re-implement budget maths in the client.
- Never edit an applied migration. Add a new migration, then regenerate src/types/database.ts.
- There is no local Supabase (no Docker). Apply migrations with `npm run db:push`, regenerate types with `npm run db:types`, run database tests with `npm run db:test`, and deploy Edge Functions with `supabase functions deploy <name>`. All of these target budget-dev. Never link to or change budget-prod unless a task explicitly says so.
- Money: numeric in the database; format with Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).
- UI copy uses British English (utilisation, colour, cheque).
- Styling uses tokens from src/theme/tokens.ts. No hard-coded colours in components.
- Accessibility: touch targets at least 44px, accessibilityLabel on icon-only buttons, text contrast at least 4.5:1.
- One component per file. Screens in app/, components in src/components, data hooks in src/data.
- Before saying a task is done, run `npx tsc --noEmit` and fix all errors.
# Platform priority
- Build and test for web first. Verify every task in the browser with `npx expo start --web`; don't use Expo Go or simulators unless I ask.
- Keep code cross-platform so mobile works later: no direct window/document/localStorage calls outside src/lib, and use React Native components (View, Text, Pressable), not HTML tags.

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
# Household Budget App: Build Guide for Cursor

A step-by-step guide for building the household budget app (mobile and web) from one codebase, using Cursor as your AI pair programmer.

**What you will end up with**
- An iOS, Android and web app built with Expo (React Native and React Native Web).
- Sign-in with email and password, followed by a 6-digit code sent to your email through ZeptoMail.
- A Supabase (Postgres) database where every privacy rule is enforced on the server.
- These modules: Overview dashboard, Budget, Transactions, Credit, Settings, household invites, exchange-rate refresh, statement reminders and an optional Google Sheets export.

The rules match your Google Sheet: the custom 55/25/20 split (Needs & Personal / Investment / Emergency), CAD as the base currency with NGN converted to CAD, a primary user (Odogwu) and a partner (Wifey), and joint costs split 50/50 by default.

---

## Contents

0. [How to use this guide](#0-how-to-use-this-guide)
1. [What you are building](#1-what-you-are-building)
2. [Architecture](#2-architecture)
3. [Before you start](#3-before-you-start)
4. [Phase 1: Project setup](#phase-1-project-setup)
5. [Phase 2: Database](#phase-2-database)
6. [Phase 3: Authentication with email OTP (ZeptoMail)](#phase-3-authentication-with-email-otp-zeptomail)
7. [Phase 4: Household onboarding and invites](#phase-4-household-onboarding-and-invites)
8. [Phase 5: App shell, navigation and UI kit](#phase-5-app-shell-navigation-and-ui-kit)
9. [Phase 6: Settings module](#phase-6-settings-module)
10. [Phase 7: Transactions module](#phase-7-transactions-module)
11. [Phase 8: Budget module](#phase-8-budget-module)
12. [Phase 9: Overview dashboard](#phase-9-overview-dashboard)
13. [Phase 10: Credit module](#phase-10-credit-module)
14. [Phase 11: Background jobs](#phase-11-background-jobs)
15. [Phase 12: Google Sheets export (optional)](#phase-12-google-sheets-export-optional)
16. [Phase 13: Testing and security review](#phase-13-testing-and-security-review)
17. [Phase 14: Deployment](#phase-14-deployment)
18. [Appendix A: Database schema SQL](#appendix-a-database-schema-sql)
19. [Appendix B: Server functions SQL](#appendix-b-server-functions-sql)
20. [Appendix C: ZeptoMail helper code](#appendix-c-zeptomail-helper-code)
21. [Appendix D: Environment variables and secrets](#appendix-d-environment-variables-and-secrets)
22. [Appendix E: Default data](#appendix-e-default-data)
23. [Appendix F: Fix-it prompts](#appendix-f-fix-it-prompts)
24. [Appendix G: Definition of done](#appendix-g-definition-of-done)

---

## 0. How to use this guide

Every task follows the same format:

| Part | What it means |
|---|---|
| **Goal** | What the task delivers |
| **You do** | Manual steps outside Cursor (accounts, dashboards, DNS), if any |
| **Cursor prompt** | Copy the whole block into Cursor's Agent chat |
| **Expect** | Files and behaviour you should see when Cursor finishes |
| **Check** | How to confirm it works. Don't start the next task until these pass |

**Working rules for Cursor**
1. **Use Agent mode** so Cursor can create files and run terminal commands. Review each diff before accepting it.
2. **Start a new chat for each phase.** Long chats lose context. Every prompt names the files Cursor needs with `@`, so a fresh chat is fine.
3. **Keep this guide in the repo** as `docs/BUILD_GUIDE.md` (Task 1.2), so prompts can point Cursor at the exact appendix with `@docs/BUILD_GUIDE.md`.
4. **Commit after every task that passes its Check:** `git add -A && git commit -m "Task 3.3: send-login-otp"`. Then a bad change is easy to undo with `git reset --hard`.
5. **When something breaks,** use the templates in [Appendix F](#appendix-f-fix-it-prompts) rather than vague prompts like "it doesn't work".
6. **Never paste secrets into a prompt.** Put them in `.env` files and Supabase secrets ([Appendix D](#appendix-d-environment-variables-and-secrets)).
7. **Build for the web first.** Run the app with `npm run web` (or `npx expo start --web`) and test every task in the browser. The same code later runs on iOS and Android, so Cursor must keep it cross-platform; the rules file in Task 1.2 says how.
8. **Ignore `npm audit` warnings and never run `npm audit fix --force`.** It upgrades packages past the versions Expo supports and usually breaks the project.
9. **There is no local database (no Docker).** You build and test against a cloud Supabase project called **budget-dev**, and keep a second project, **budget-prod**, for real use. Every database push, reset and function deploy goes to whichever project the CLI is linked to, so check before you run one: `npx supabase projects list` marks the linked project. The helper scripts from Task 1.4 refuse to reset anything that isn't budget-dev.

---

## 1. What you are building

### People and privacy rules

| Rule | How it's enforced |
|---|---|
| One household has two members: a **primary** (sets it up) and a **partner** (joins by email invite) | `household_members` table, one primary per household |
| Each person sees **their own view** and the **Household view**, never the other person's personal view | RLS on `transactions`; masked data through `get_feed` and `get_month_summary` |
| In the Household view, the partner's personal entries show the amount and category, with the description replaced by "Wifey's private entry" | `get_feed` function |
| Take-home pay is private. The other person only sees it inside Household totals | `member_private` table, readable only by its owner |
| Credit accounts and scores are private to each person | RLS: `user_id = auth.uid()` |
| Household settings (joint share, rent, 55/25/20 targets, FX override, credit targets, categories, accounts) can be changed **only by the primary** | RLS plus `is_primary()` checks |
| Nobody sees any data until they have passed the email code step for the current session | `session_verified()` in every RLS policy |

> **Known limitation:** the Household view shows combined income. Because each person knows their own income, they can work out the other's by subtraction. If that matters to you, hide budgeted income in the Household view and show only the 55/25/20 percentages.

### Screens

| Screen | Mobile | Web (wider than 900px) |
|---|---|---|
| Sign up, Sign in, Verify code, Forgot password | Full-screen forms | Centred card |
| Create household / Accept invite | Full-screen forms | Centred card |
| Overview | Home tab | Sidebar "Overview", two-column layout |
| Budget | Budget tab, collapsible bucket groups | Table with collapsible bucket headers |
| Add transaction | Full-screen modal from the centre "+" tab button | Slide-in panel from the right |
| Transactions list | Reached from Overview "See all" | Reached from Overview "See all" |
| Credit | Credit tab | Two-column layout |
| Settings | Settings tab (sections stacked) | Grid of cards |

### Design tokens (from the prototype)

| Token | Value | Use |
|---|---|---|
| `ink` | `#13211C` | Main text, dark hero card |
| `bg` | `#F3F5F2` | App background |
| `surface` | `#FFFFFF` | Cards |
| `accent` | `#1D6A50` | Primary buttons, Needs & Personal bucket |
| `investment` | `#2F5D9E` | Investment bucket |
| `emergency` | `#B0731A` | Emergency bucket |
| `muted` | `#5B6B64` | Secondary text |
| `border` | `#DCE3DE` | Input borders |
| `divider` | `#EEF2EF` | Row dividers |
| `danger` | `#B3261E` | Over budget |
| `okBg` / `okText` | `#E3EFE9` / `#134836` | "Within limit", "On target" chips |
| `badBg` / `badText` | `#FBE4E2` / `#8C1D18` | "Over limit", "Below target" chips |
| `warnBg` / `warnText` | `#FDF4E7` / `#5A2C06` | Statement-date alert |
| Font | Plus Jakarta Sans (400–800) | Everywhere, tabular numbers for money |
| Radius | 12 (inputs), 18–22 (cards) | |

---

## 2. Architecture

### Stack

| Layer | Choice | Why |
|---|---|---|
| App | Expo (latest SDK), Expo Router, TypeScript (strict) | One codebase for iOS, Android and web; file-based routes |
| Web | React Native Web (built into Expo) | Same components on the web |
| Server state | TanStack Query | Caching, refetching and loading states |
| Forms | react-hook-form + zod | Validation shared with business rules |
| Charts | react-native-svg | Works on all three platforms |
| Database | Supabase Postgres with Row Level Security | Privacy rules enforced on the server |
| Auth | Supabase Auth (email + password) plus a custom email OTP step | Matches your password + code requirement |
| Server code | Supabase Edge Functions (Deno) | OTP, invites, FX refresh, reminders, export |
| Email | ZeptoMail (API from Edge Functions; SMTP for Supabase Auth emails) | All email goes through one provider |
| Scheduling | Supabase Cron | Daily FX refresh and statement reminders |
| Hosting | Static web host (Vercel or Netlify); EAS Build for app stores | |

### How the pieces connect

```
 ┌──────────────── Expo app (iOS / Android / Web) ────────────────┐
 │  Expo Router screens → TanStack Query hooks → supabase-js      │
 └───────────────┬───────────────────────────────┬───────────────┘
                 │ SQL via RLS + RPCs            │ HTTPS (user JWT)
                 ▼                               ▼
     ┌──────────────────────┐        ┌──────────────────────────┐
     │ Supabase Postgres    │◄──────►│ Edge Functions (Deno)    │
     │ tables, RLS, RPCs    │        │ send-login-otp           │
     │ session_verified()   │        │ verify-login-otp         │
     └──────────────────────┘        │ end-session, send-invite │
                ▲                    │ fx-refresh, reminders    │
                │ Supabase Cron      └────────────┬─────────────┘
                └─────────────────────────────────┘│
                                                   ▼
                                       ZeptoMail API (email)
```

### Sign-in flow (password, then email code)

```
1. User enters email + password  → supabase.auth.signInWithPassword()
   Supabase returns a session. Its JWT carries a session_id.
2. App calls Edge Function send-login-otp
   → creates a 6-digit code, stores only a hash in login_otps (expires in 10 min)
   → emails the code through ZeptoMail
3. User enters the code → Edge Function verify-login-otp
   → checks hash, expiry and attempts (max 5)
   → inserts session_id into verified_sessions (valid 30 days or until sign-out)
4. Every RLS policy calls session_verified(), which looks up the current JWT's session_id.
   Without step 3, the database returns nothing, whatever the app does.
5. Sign out → Edge Function end-session deletes the verified_sessions row, then supabase.auth.signOut().
```

Supabase's own "Confirm email" step is switched off. The login code proves the person owns the email before any data is visible, so a separate confirmation link isn't needed, and it avoids deep-link problems on mobile. Password reset uses Supabase's recovery email (sent through ZeptoMail SMTP) containing a 6-digit code.

### Folder structure Cursor will create

```
household-budget/
├─ app/                          # Expo Router routes
│  ├─ _layout.tsx                # Providers + auth/household routing guard
│  ├─ (auth)/sign-in.tsx, sign-up.tsx, verify.tsx, forgot-password.tsx
│  ├─ (onboarding)/create-household.tsx
│  ├─ invite/[token].tsx         # Accept invite
│  └─ (app)/_layout.tsx          # Tabs on phones, sidebar on web
│     ├─ index.tsx               # Overview
│     ├─ budget.tsx
│     ├─ transactions/index.tsx, new.tsx, [id].tsx
│     ├─ credit.tsx
│     └─ settings.tsx
├─ src/
│  ├─ lib/supabase.ts, money.ts, dates.ts
│  ├─ theme/tokens.ts
│  ├─ components/                # UI kit
│  ├─ data/                      # TanStack Query hooks
│  └─ types/database.ts          # Generated by Supabase CLI
├─ supabase/
│  ├─ migrations/
│  ├─ functions/_shared/, send-login-otp/, verify-login-otp/, end-session/,
│  │            send-invite/, fx-refresh/, statement-reminders/, sheets-export/
│  └─ tests/                     # SQL privacy tests (npm run db:test)
└─ docs/BUILD_GUIDE.md           # This file
```

---

## 3. Before you start

Complete these once. None of them involve Cursor.

| # | Item | Notes |
|---|---|---|
| 1 | **Node.js 24 (LTS)** via nvm, and **Git** with your personal name and email | `node -v` prints `v24.x.x`; `git --version` works |
| 2 | **Cursor** installed and signed in | Use Agent mode |
| 3 | **Supabase account** | The free plan allows two active projects, which is all you need |
| 4 | **Two Supabase projects:** `budget-dev` and `budget-prod` | Same region for both, the closest to you (Canada if offered). For each, save the database password and the **project ref** (the ID in the project's dashboard URL). Free projects pause after about a week without use; resume them from the dashboard |
| 5 | **Supabase CLI** and **psql** | The CLI is installed inside the project in Task 1.4 (`npx supabase`); psql comes from Postgres.app |
| 6 | **Expo account** | For EAS builds later (`npm i -g eas-cli`) |
| 7 | **A domain you control** | ZeptoMail only sends from a verified domain |
| 8 | **ZeptoMail account** | See below |
| 9 | **GitHub repo** (private) | For backups and deployment |

**Mac setup in Terminal (items 1 and 5)**

These steps work on Intel and Apple Silicon Macs and don't need Homebrew. Homebrew stopped supporting Intel Macs in September 2026; on an Intel Mac it builds everything from source, which is slow and can fail. Open Terminal (Cmd + Space, type "Terminal", press Return) and run these one at a time.

1. **Git.** macOS includes Apple's Git. Check it:
   ```bash
   git --version
   ```
   If macOS offers to install the "command line developer tools", accept, then run the check again.
2. **nvm (Node Version Manager).** It downloads ready-made Node versions. Check whether you already have it:
   ```bash
   command -v nvm
   ```
   If that prints nothing, install it with the command from the nvm GitHub page (github.com/nvm-sh/nvm, "Installing and Updating"), then close and reopen Terminal.
3. **Node.js 24 (LTS)** as your default. Avoid odd-numbered versions such as 25: they never get long-term support and Expo warns about them.
   ```bash
   nvm install 24
   nvm alias default 24
   nvm use 24
   node -v
   ```
   `node -v` should print `v24.x.x`. If you had another Node before, you can remove it, for example `nvm uninstall 25.5.0`.
4. **Your Git identity.** Git stamps every commit with these, so use your personal details, not an old work identity:
   ```bash
   git config --global user.name "Ikechukwu Dimgba"
   git config --global user.email "your-personal@email.com"
   git config --global user.name
   ```
   Use the email on your personal GitHub account. If Cursor or Keychain Access remembers a work GitHub login, sign out of it or delete it (search Keychain Access for `github.com`).
5. **psql** (runs the database tests against budget-dev). Install **Postgres.app** from postgresapp.com (drag it into Applications and open it once), then add its tools to your path:
   ```bash
   sudo mkdir -p /etc/paths.d
   echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
   ```
   Close and reopen Terminal, then check with `psql --version`. You don't need to run a local database in Postgres.app; only its `psql` tool is used.
6. **EAS CLI** for app builds later:
   ```bash
   npm install -g eas-cli
   ```

The Supabase CLI isn't installed globally. Task 1.4 adds it to the project, and you run it as `npx supabase …`. Every Supabase command in this guide is written that way.

If a command says "command not found" straight after installing, close Terminal (and Cursor), open a new window and try again. After changing Node versions, quit and reopen Cursor so its terminal uses the new version.

**ZeptoMail setup**
1. Sign up at ZeptoMail and **add your domain**. Add the SPF and DKIM DNS records it shows, then wait until the domain shows as verified.
2. **Create a Mail Agent** (for example "household-budget").
3. Open the Mail Agent's **SMTP/API** page and note:
   - the **Send Mail token** (API key),
   - the **API host**. Use the one shown in your dashboard; for most accounts the endpoint is `https://api.zeptomail.com/v1.1/email`, while accounts hosted in another region show a different domain,
   - the **SMTP host, port, username and password** (needed in Task 3.1).
4. Choose your **from address**, for example `no-reply@yourdomain.com`, on the verified domain.

---

## Phase 1: Project setup

### Task 1.1: Create the Expo app

**Goal:** an empty Expo Router + TypeScript app that runs in the browser.

**You do:** create an empty folder `household-budget` and open it in Cursor. In Cursor's terminal, check that `node -v` prints `v24.x.x` before you start; Expo warns if it doesn't.

**Cursor prompt**
```text
Create a new Expo app in the current folder using the official "default" Expo Router template with TypeScript (use `npx create-expo-app@latest . --template default`).
Then:
1. Remove the template's demo screens and components, leaving a single app/index.tsx that shows the text "Household Budget".
2. Enable TypeScript strict mode in tsconfig.json.
3. In app.json set: name "Household Budget", slug "household-budget", scheme "householdbudget", web.output "single", web.bundler "metro".
4. Add a .gitignore suitable for Expo (include .env, .env.local, supabase/.temp, dist).
5. Initialise git and make the first commit.
Run `npx expo start --web` briefly to confirm it compiles, then stop it.
Tell me the command to run it in the browser.
```

**Expect:** Expo project files (`app/`, `app.json`, `package.json`, `tsconfig.json`), one screen, a first git commit.

**Check**
- [ ] `npm run web` opens `http://localhost:8081` showing "Household Budget".
- [ ] `git log --format="%h %an <%ae> %s"` shows your personal name and email on every commit. If an old work identity appears, fix it with `git rebase -r --root --exec "git commit --amend --no-edit --reset-author"` (safe before anything is pushed).
- [ ] `git remote -v` prints nothing, or only your personal GitHub repo.
- [ ] (Later, when you move to mobile) `npx expo start`, then scan the QR code with Expo Go.

---

### Task 1.2: Add the guide and Cursor project rules

**Goal:** Cursor always knows the product rules, stack and conventions.

**You do**
1. Create a `docs` folder and save **this file** as `docs/BUILD_GUIDE.md`.
2. Create `.cursor/rules/project.mdc` with exactly this content:

```markdown
---
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
- There is no local Supabase (no Docker). Apply migrations with `npm run db:push`, regenerate types with `npm run db:types`, run database tests with `npm run db:test`, and deploy Edge Functions with `npx supabase functions deploy <name>`. All of these target budget-dev. Never link to or change budget-prod unless a task explicitly says so.
- Money: numeric in the database; format with Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).
- UI copy uses British English (utilisation, colour, cheque).
- Styling uses tokens from src/theme/tokens.ts. No hard-coded colours in components.
- Accessibility: touch targets at least 44px, accessibilityLabel on icon-only buttons, text contrast at least 4.5:1.
- One component per file. Screens in app/, components in src/components, data hooks in src/data.
- Before saying a task is done, run `npx tsc --noEmit` and fix all errors.
- Run the Supabase CLI as `npx supabase …` (it is a project dev dependency, not installed globally).
- Never run `npm audit fix --force`.

# Platform priority
- Build and test for web first. Verify every task in the browser with `npx expo start --web`; don't use Expo Go or simulators unless I ask.
- Keep code cross-platform so mobile works later: no direct window/document/localStorage calls outside src/lib, and use React Native components (View, Text, Pressable), not HTML tags.
```

3. Commit: `git add -A && git commit -m "Task 1.2: guide and rules"`.

**Expect:** no code changes.

**Check**
- [ ] In a new Cursor chat, ask "What is our base currency and what are the 55/25/20 buckets?". It answers from the rules file.
- [ ] Ask "Which platform do we build for first?". It answers web.

---

### Task 1.3: Core dependencies, theme and fonts

**Goal:** libraries installed, design tokens and font loaded.

**Cursor prompt**
```text
Read @docs/BUILD_GUIDE.md section "Design tokens (from the prototype)" and "Stack".
1. Install with `npx expo install`: @supabase/supabase-js, @react-native-async-storage/async-storage, react-native-url-polyfill, @tanstack/react-query, zustand, react-hook-form, zod, @hookform/resolvers, react-native-svg, expo-font, @expo-google-fonts/plus-jakarta-sans, expo-linking, expo-web-browser.
2. Create src/theme/tokens.ts exporting colors (every token in the table), radius, spacing (4, 8, 12, 16, 20, 24, 32), and typography (font family names for weights 400, 500, 600, 700, 800; sizes 12, 13, 14, 15, 17, 20, 26, 34, 44).
3. In app/_layout.tsx load Plus Jakarta Sans with useFonts, keep the splash screen until fonts load, and wrap the app in a QueryClientProvider.
4. Create src/lib/money.ts with formatCAD(n), formatCADWhole(n), formatNGN(n), formatPercent(fraction, dp = 1). Add unit tests with Jest (install jest-expo) for these.
5. Update app/index.tsx to show "Household Budget" in Plus Jakarta Sans 800 on the bg colour.
Run the tests and `npx tsc --noEmit`.
```

**Expect:** `src/theme/tokens.ts`, `src/lib/money.ts`, test file, providers in `app/_layout.tsx`.

**Check**
- [ ] `npx jest` passes; `formatCAD(1350)` returns `$1,350.00`.
- [ ] The home text uses the new font in the browser.

---

### Task 1.4: Supabase project wiring

**Goal:** the repo linked to **budget-dev**, with environment variables and safe helper scripts in place.

**You do:** in the **budget-dev** dashboard, copy:
- the **Project URL** and **anon (publishable) key** (Project Settings → API);
- the **project ref** (the ID in the dashboard URL);
- the **Session pooler** connection string (Connect button → Connection string → Session pooler), with your database password filled in. Use the session pooler, not "Direct connection", because the direct one may not work on home networks without IPv6.

**Cursor prompt**
```text
Set up Supabase in this repo:
0. Install the Supabase CLI as a dev dependency: `npm install supabase --save-dev`. Use it as `npx supabase …` everywhere, including in scripts.
1. Run `npx supabase init` (keep defaults).
2. Create .env.example with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (empty values) and tell me to copy it to .env.local and fill it in.
3. Create supabase/functions/.env.example listing the Edge Function secrets from @docs/BUILD_GUIDE.md Appendix D (empty values).
4. Create src/lib/supabase.ts: createClient using the two EXPO_PUBLIC_ variables, with auth storage = AsyncStorage on iOS/Android and the default (localStorage) on web, autoRefreshToken true, persistSession true, detectSessionInUrl false. Import 'react-native-url-polyfill/auto' first. Use the generated Database type from src/types/database.ts (create a placeholder type for now).
5. Add AppState listeners so token auto-refresh starts when the app is active and stops in the background (the pattern from Supabase's Expo guide).
6. Add SUPABASE_DEV_PROJECT_REF and SUPABASE_DEV_DB_URL (no EXPO_PUBLIC_ prefix, so they never reach the app) to .env.example.
7. There is no local Supabase and no Docker. Create these scripts in scripts/ (bash, `set -euo pipefail`, each loads .env.local):
   - scripts/assert-dev.sh: reads the linked project ref from supabase/.temp/project-ref and exits with a clear error unless it equals SUPABASE_DEV_PROJECT_REF.
   - scripts/db-push.sh: runs assert-dev.sh, then `npx supabase db push`.
   - scripts/db-reset-dev.sh: runs assert-dev.sh, asks me to type "reset dev" to confirm, then `npx supabase db reset --linked`.
   - scripts/db-types.sh: `npx supabase gen types typescript --project-id "$SUPABASE_DEV_PROJECT_REF" --schema public > src/types/database.ts`.
   - scripts/db-test.sh: runs every file in supabase/tests/*.sql with `psql "$SUPABASE_DEV_DB_URL" -v ON_ERROR_STOP=1 -f <file>`.
   Make them executable and add npm scripts: "db:push", "db:reset:dev", "db:types", "db:test" that call them.
Do not run npx supabase link; I will do that.
```

**You do after Cursor finishes**
1. `cp .env.example .env.local` and fill in the budget-dev URL, anon key, project ref and session pooler connection string.
2. `npx supabase login`, then `npx supabase link --project-ref <budget-dev-ref>` (enter the database password when asked).

**Expect:** `supabase/` folder, `src/lib/supabase.ts`, env examples, five scripts in `scripts/`, npm scripts.

**Check**
- [ ] `npx supabase projects list` marks **budget-dev** as linked.
- [ ] `bash scripts/assert-dev.sh` exits without an error.
- [ ] `psql "<your session pooler string>" -c "select 1"` prints 1.
- [ ] `npx tsc --noEmit` passes.

---

## Phase 2: Database

### Task 2.1: Schema migration

**Goal:** all tables, helper functions and RLS policies.

**Cursor prompt**
```text
Create a new Supabase migration named "schema" (`npx supabase migration new schema`) and paste into it, exactly and in full, the SQL from @docs/BUILD_GUIDE.md "Appendix A: Database schema SQL". Do not change, reorder or "improve" anything.
Then run `npm run db:push` to apply it to budget-dev, and show me the output.
```

**Expect:** `supabase/migrations/<timestamp>_schema.sql`. The push finishes without errors.

**Check**
- [ ] In the budget-dev dashboard → Table Editor you see 14 tables including `households`, `transactions`, `login_otps`, `verified_sessions`.
- [ ] Every table shows "RLS enabled".

---

### Task 2.2: Server functions migration

**Goal:** onboarding, summary and feed functions.

**Cursor prompt**
```text
Create a new migration named "functions" and paste into it, exactly and in full, the SQL from @docs/BUILD_GUIDE.md "Appendix B: Server functions SQL". Do not change anything.
Run `npm run db:push`, then `npm run db:types` to regenerate src/types/database.ts. Run `npx tsc --noEmit`.
```

**Expect:** second migration; `src/types/database.ts` now includes `get_month_summary`, `get_feed`, `create_household`, `accept_invite`, `ensure_budget_month`, `update_my_profile`, `set_joint_share`, `set_partner_display_name`, `is_session_verified`.

**Check**
- [ ] The push succeeds; the types file lists the functions above.

---

### Task 2.3: Database privacy tests

**Goal:** automated proof that the privacy rules hold. Rerun these after any database change.

**Cursor prompt**
```text
Write a plain SQL test script supabase/tests/privacy_test.sql that runs against budget-dev with `npm run db:test` (psql) and leaves no data behind.
Structure: `begin;` at the top and `rollback;` at the end, so nothing is saved. Each assertion is a DO block that raises an exception starting "FAIL:" with a clear message when the check fails. The last statement before rollback is `select 'ALL PRIVACY TESTS PASSED';`.
Set up: two users in auth.users (primary P, partner W) with fixed UUIDs and emails, a verified_sessions row for each, and impersonate a user with `set local role authenticated` plus set_config('request.jwt.claims', '{"sub":..., "session_id":..., "email":...}', true); switch back with `reset role` when inserting test fixtures as the owner.
If inserting into auth.users is refused, stop and tell me: I'll create two test users in the budget-dev dashboard (Authentication → Add user) and put their IDs and emails in .env.local as TEST_PRIMARY_ID, TEST_PRIMARY_EMAIL, TEST_PARTNER_ID and TEST_PARTNER_EMAIL; then pass them to psql with -v and use them instead of inserting users. Each run must clean up after itself (rollback), so those users stay without a household.
Scenario: P calls create_household('Odogwu', 4000, 1350). Insert an invite for W's email with token_hash = encode(digest('tok','sha256'),'hex'). W calls accept_invite('tok','Wifey',4000).
W inserts a personal expense "Secret gift" 100 CAD (Miscellaneous). P inserts a joint expense "October rent" 1350 CAD (Rent).
Assert:
1. P selecting from transactions sees only the joint row.
2. P's get_feed(current_date,'household') returns the partner row with description "Wifey's private entry".
3. P's get_feed(current_date,'me') returns only "October rent" with view_amount_cad 675.00.
4. get_month_summary(current_date,'me') for P: buckets.needs.planned = 2195.00, buckets.investment.planned = 1000.00, buckets.emergency.planned = 800.00, budgeted_income = 4000.
5. Household view: buckets.needs.planned = 4390.00.
6. P sees exactly one row in member_private (their own); W likewise.
7. W cannot update household_settings (0 rows affected) and calling set_joint_share raises an error.
8. After P calls set_joint_share(0.6), Rent planned in P's 'me' summary is 810.00.
9. With a session_id that is not in verified_sessions, selecting from categories returns 0 rows.
10. W cannot select P's credit_accounts.
Run `npm run db:test` and make all tests pass without changing the migrations. If a test fails because the test is wrong, fix the test; if the schema is wrong, stop and tell me.
```

**Expect:** `supabase/tests/privacy_test.sql`; `npm run db:test` ends with "ALL PRIVACY TESTS PASSED".

**Check**
- [ ] All tests pass. These numbers match your sheet: Needs & Personal $2,195 per person.
- [ ] Table Editor in budget-dev shows no leftover test households or users (the script rolls back).

---

## Phase 3: Authentication with email OTP (ZeptoMail)

### Task 3.1: Supabase Auth settings and ZeptoMail SMTP

**Goal:** Supabase's own emails (password reset) go through ZeptoMail; sign-up doesn't need a confirmation link.

**You do (Supabase dashboard, in both budget-dev and budget-prod)**
1. **Authentication → Sign In / Providers → Email:** enable Email; turn **Confirm email** off; set minimum password length to 10.
2. **Authentication → Emails → SMTP Settings:** enable custom SMTP and enter the host, port, username and password from your ZeptoMail Mail Agent's SMTP page; sender email = your from address; sender name = "Household Budget".
3. **Authentication → Emails → Templates → Reset Password:** replace the body with:
   ```html
   <h2>Reset your password</h2>
   <p>Your code is:</p>
   <p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
   <p>It expires soon. If you didn't ask for this, you can ignore this email.</p>
   ```
4. **Authentication → URL Configuration:** set Site URL to your future web address (use `http://localhost:8081` for now).

There is no local email catcher, so during development every email (sign-in codes, invites, password resets) is really sent through ZeptoMail. Test with your own inboxes. ZeptoMail charges per email sent, but development volumes are tiny.

**Check**
- [ ] Use "Send test email" if your dashboard offers it, or trigger a password reset from the Supabase dashboard's Users page, and confirm the email arrives from your domain.

---

### Task 3.2: ZeptoMail helper for Edge Functions

**Goal:** one tested function for sending email, used by every Edge Function.

**Cursor prompt**
```text
Create supabase/functions/_shared/zeptomail.ts using the reference code in @docs/BUILD_GUIDE.md "Appendix C: ZeptoMail helper code" exactly.
Also create supabase/functions/_shared/emails.ts exporting two functions that return { subject, html } for:
1. loginCodeEmail(code: string, displayName?: string): subject "Your Household Budget sign-in code"; big 6-digit code; "expires in 10 minutes"; "If this wasn't you, change your password."
2. inviteEmail(inviterName: string, link: string): subject "<inviterName> invited you to Household Budget"; a button linking to the link; "This link expires in 7 days."
Use simple inline-styled HTML (max-width 480px, Plus Jakarta Sans with Arial fallback, accent #1D6A50). Escape any user-provided text.
Create supabase/functions/_shared/cors.ts with standard CORS headers for browser calls (allow Authorization, apikey, content-type, x-client-info) and an OPTIONS handler.
Create supabase/functions/_shared/auth.ts with getCaller(req): validates the Authorization bearer token with a supabase client (auth.getUser()), decodes the JWT payload to read session_id and email, and returns { user, sessionId, email, accessToken } or throws a 401 error. Also export adminClient() that uses SUPABASE_SERVICE_ROLE_KEY.
```

**Expect:** four files in `supabase/functions/_shared/`.

**Check**
- [ ] `deno check supabase/functions/_shared/*.ts` passes (or Cursor reports no type errors).

---

### Task 3.3: Edge Function `send-login-otp`

**Goal:** after a password sign-in, email a 6-digit code.

**Cursor prompt**
```text
Create the Supabase Edge Function supabase/functions/send-login-otp/index.ts. Use the helpers in supabase/functions/_shared (@supabase/functions/_shared).
Behaviour:
- Handle CORS. Accept POST only.
- getCaller(req) → user, sessionId, email. If sessionId is missing return 400.
- Rate limits using the login_otps table (service role client):
  - If a code was created for this session less than 60 seconds ago, return 429 { error: "wait", retryAfterSeconds }.
  - If more than 5 codes were created for this user in the last 15 minutes, return 429 { error: "too_many" }.
- If verified_sessions already has this sessionId and it hasn't expired, return 200 { alreadyVerified: true }.
- Generate a 6-digit code with crypto.getRandomValues (allow leading zeros).
- Store code_hash = hex SHA-256 of `${code}:${sessionId}:${OTP_PEPPER}`, expires_at = now + 10 minutes, attempts 0.
- Mark any older unconsumed codes for this session as consumed.
- Look up display_name from household_members if present.
- Send loginCodeEmail via sendEmail to the user's email.
- Return 200 { sent: true, expiresInSeconds: 600 }. Never return the code.
- Log errors without logging the code.
Add [functions.send-login-otp] to supabase/config.toml with verify_jwt = true.
Run scripts/assert-dev.sh, then deploy it to budget-dev with `npx supabase functions deploy send-login-otp`.
```

**You do:** create `supabase/functions/.env` with the values from Appendix D (use a long random `OTP_PEPPER`, for example the output of `openssl rand -hex 32`; `APP_URL` = `http://localhost:8081`). Upload them to budget-dev with `npx supabase secrets set --env-file supabase/functions/.env`. Never commit this file.

**Expect:** the function file and config entries.

**Check**
- [ ] The budget-dev dashboard → Edge Functions lists `send-login-otp` as deployed.
- [ ] `npx supabase secrets list` shows the secret names (values are hidden).
- [ ] `curl -i -X POST https://<budget-dev-ref>.supabase.co/functions/v1/send-login-otp` returns 401 (no token).

---

### Task 3.4: Edge Functions `verify-login-otp` and `end-session`

**Goal:** confirm the code and mark the session as verified; clean up on sign-out.

**Cursor prompt**
```text
Create two Edge Functions using the shared helpers.

1) supabase/functions/verify-login-otp/index.ts
- POST { code: string }. Validate it is exactly 6 digits.
- getCaller(req) → user, sessionId.
- Load the newest login_otps row for this sessionId where consumed_at is null.
- If none, or expires_at < now: return 400 { error: "expired" }.
- If attempts >= 5: mark consumed, return 429 { error: "too_many_attempts" }.
- Compute the hash the same way as send-login-otp and compare using a constant-time comparison.
- On mismatch: increment attempts, return 400 { error: "invalid", attemptsLeft }.
- On match: set consumed_at = now; upsert verified_sessions (session_id, user_id, verified_at = now, expires_at = now + 30 days); return 200 { verified: true }.

2) supabase/functions/end-session/index.ts
- POST. getCaller(req) → sessionId. Delete the verified_sessions row for this sessionId. Return 200.

Register both in supabase/config.toml with verify_jwt = true.
Also add a small SQL migration "otp_cleanup" that creates a function public.cleanup_auth_codes() (security definer, service role only) deleting login_otps older than 1 day and verified_sessions past expires_at.
Apply it with `npm run db:push`, then deploy both functions to budget-dev with `npx supabase functions deploy verify-login-otp` and `npx supabase functions deploy end-session`.
```

**Expect:** two functions, config entries, one migration.

**Check**
- [ ] Deleting a `verified_sessions` row in the budget-dev Table Editor makes the app lose access to data immediately (you'll test this in Task 3.6).

---

### Task 3.5: Auth screens and routing guard

**Goal:** sign up, sign in, code entry, forgot password, sign out; routing that always sends the user to the right place.

**Cursor prompt**
```text
Build the auth flow with Expo Router. Read @docs/BUILD_GUIDE.md "Sign-in flow (password, then email code)" and "Design tokens".

Create src/data/auth.ts with:
- useSession(): current Supabase session (listen to onAuthStateChange).
- useSessionVerified(): calls rpc('is_session_verified'), refetches when the session changes.
- sendLoginCode(), verifyLoginCode(code), signOut() (calls end-session, then supabase.auth.signOut(), then clears the TanStack Query cache).

Screens (centred card max-width 420 on web, full screen on phones, all using tokens and 44px+ targets):
1. app/(auth)/sign-up.tsx: email, password, confirm password (zod: valid email, password ≥ 10 chars with a letter and a number, must match). supabase.auth.signUp. Then call sendLoginCode() and go to /verify.
2. app/(auth)/sign-in.tsx: email + password → signInWithPassword → sendLoginCode() → /verify. Links to sign up and forgot password. Show friendly errors ("Email or password is incorrect").
3. app/(auth)/verify.tsx: "We've emailed a 6-digit code to <email>". Six-box code input (single hidden TextInput for paste support, numeric keyboard, auto-submit on 6 digits, textContentType "oneTimeCode" and autoComplete "one-time-code"). Resend button with a 60-second countdown. Shows attemptsLeft and expired states. "Use a different account" signs out.
4. app/(auth)/forgot-password.tsx: step 1 email → supabase.auth.resetPasswordForEmail(email); step 2 code + new password → supabase.auth.verifyOtp({ email, token, type: 'recovery' }) → supabase.auth.updateUser({ password }) → signOut → back to sign in with a success message.

Routing guard in app/_layout.tsx (use Expo Router's redirect pattern; avoid flicker with a loading screen):
- No session → (auth)/sign-in.
- Session but not verified → /verify.
- Verified but no household (rpc returns nothing for household_members of me) → (onboarding)/create-household, unless the URL is /invite/[token].
- Otherwise → (app).
Add a temporary signed-in placeholder screen at app/(app)/index.tsx with a Sign out button.
```

**Expect:** the four screens, `src/data/auth.ts`, a guard in `app/_layout.tsx`.

**Check**
- [ ] You can sign up, receive the code in your real inbox (sent through ZeptoMail), enter it, and land on the placeholder.
- [ ] Refreshing the web page keeps you signed in and verified.

---

### Task 3.6: End-to-end auth test

**Goal:** prove the security rules work, not just the screens.

**You do:** run through this list on web and on a phone.

- [ ] Wrong password shows a friendly error; no email is sent.
- [ ] Wrong code three times shows attempts left; the sixth attempt is refused.
- [ ] A code older than 10 minutes is refused.
- [ ] "Resend" is disabled for 60 seconds.
- [ ] Signing in on a second device asks for a new code on that device.
- [ ] Deleting your `verified_sessions` row in the budget-dev Table Editor and refreshing sends you back to /verify.
- [ ] Forgot password: code arrives, new password works, the old one doesn't.
- [ ] Sign out, then press Back in the browser: no data is visible.

Everything so far runs on budget-dev. Production setup comes in Phase 14.

---

## Phase 4: Household onboarding and invites

### Task 4.1: Create household (primary)

**Goal:** the first user sets up the household and becomes primary.

**Cursor prompt**
```text
Create app/(onboarding)/create-household.tsx.
Form (react-hook-form + zod): display name (required, ≤ 30 chars, default "Odogwu" placeholder only), monthly take-home pay in CAD (number ≥ 0), total monthly rent in CAD (number ≥ 0), household name (optional, default "Our household").
On submit call rpc('create_household', { p_display_name, p_take_home_cad, p_rent_total_cad, p_household_name }), invalidate queries, and route to (app).
Explain on the screen, in one line each: "You'll be the primary account and manage household settings." and "Your take-home pay is private to you."
Create src/data/household.ts with useMyMembership() (my household_members row joined with household name) and useMembers() (both members: display_name, role, joint_share).
```

**Expect:** onboarding screen and household hooks.

**Check**
- [ ] After submitting, the budget-dev Table Editor shows a household, one primary member, 15 categories, 5 accounts, settings with your rent, and 13 budget lines for this month.

---

### Task 4.2: Invite the partner

**Goal:** the primary emails an invite; the partner signs up and joins.

**Cursor prompt**
```text
1) Edge Function supabase/functions/send-invite/index.ts:
- POST { email }. getCaller(req). Using the service role client, confirm the caller is a primary member (household_members.role = 'primary') and the household has only one member.
- Generate a random 32-byte token (base64url). Store token_hash = hex SHA-256 of the token in invites with expires_at = now + 7 days. Invalidate older unaccepted invites for the same household by setting expires_at = now.
- Build the link `${APP_URL}/invite/${token}` and send inviteEmail(inviterDisplayName, link) via ZeptoMail.
- Return 200 { sent: true }. Never return the token.
Register it in supabase/config.toml with verify_jwt = true and deploy it to budget-dev (`npx supabase functions deploy send-invite`).

2) app/invite/[token].tsx (works on web and as a deep link householdbudget://invite/<token>):
- If not signed in: save the token in AsyncStorage/localStorage and show "Create an account or sign in with the email this invite was sent to", with buttons to sign up / sign in. After verification, the guard returns here if a pending token exists.
- If signed in and verified: form with display name and monthly take-home pay → rpc('accept_invite', { p_token, p_display_name, p_take_home_cad }) → clear the saved token → route to (app).
- Show clear errors for "invite invalid or expired", "invite was sent to a different email", "household is full".
3) In the routing guard, if a pending invite token exists and the user has no household, route to /invite/<token> instead of create-household.
```

**Expect:** `send-invite` function, invite screen, guard update.

**Check**
- [ ] The primary sends an invite (temporarily call it from a dev button; Settings will get the real button in Phase 6).
- [ ] The email arrives; the partner signs up from the link, enters the code, accepts, and lands in the app as partner with joint share 50%.
- [ ] Opening the same link again shows "invalid or expired".

---

## Phase 5: App shell, navigation and UI kit

### Task 5.1: Responsive navigation

**Goal:** bottom tabs on phones, a sidebar on wide web screens.

**Cursor prompt**
```text
Build app/(app)/_layout.tsx with responsive navigation (use useWindowDimensions; breakpoint 900px):
- Narrow (phones, small browsers): bottom tab bar, height 84, white with a top border. Tabs: Overview (index), Budget, a centre circular "+" button (56px, accent background, raised 18px above the bar, accessibilityLabel "Add transaction") that opens transactions/new as a modal, Credit, Settings. Active tab uses the accent colour; inactive uses muted.
- Wide (≥ 900px): a 240px left sidebar (white, right border) with the app name, a full-width "New transaction" accent button, nav items (Overview, Budget, Credit, Settings) each 44px high with an icon, active item on okBg, and a footer chip showing my display name and role ("Primary account" / "Partner account"). Content area scrolls, max-width 1160, padding 28/32.
- On wide screens, transactions/new opens as a right-hand slide-in panel (width 440, full height, dimmed backdrop that closes it) instead of a modal.
Draw icons with react-native-svg using simple stroked paths (home, list, credit card, sliders). No icon fonts.
Keep a simple placeholder in each screen for now showing its title.
```

**Expect:** layout file, five placeholder screens, an icon component set.

**Check**
- [ ] Phone: five-item tab bar with a raised "+".
- [ ] Browser wider than 900px: sidebar; narrowing the window switches to tabs.
- [ ] "+" opens a modal on phone and a side panel on web.

---

### Task 5.2: UI kit

**Goal:** shared components so every screen looks consistent.

**Cursor prompt**
```text
Create these components in src/components, each in its own file, using only theme tokens, with accessibility labels and 44px+ touch targets:
- Card (surface, radius 20, padding 20)
- SectionTitle (13px, 800, uppercase, muted, letter-spacing)
- SegmentedControl ({ options: {value,label}[], value, onChange }) – grey track, white selected pill with shadow
- Chip ({ tone: 'ok' | 'bad' | 'warn' | 'neutral', label })
- ProgressBar ({ value 0–1+, color, height = 6 }) – turns danger when value > 1
- MoneyText ({ value, size, weight, whole? }) – tabular numbers, CAD format, "−" for negatives
- TextField and MoneyField (label above, 44px, border token, error text below, prefix "$" or "₦")
- PrimaryButton and SecondaryButton (loading and disabled states)
- Avatar ({ name, tone: 'primary' | 'partner' | 'joint' }) – initial letter in a circle
- CollapsibleSection ({ title, right, defaultOpen, children }) – header row with a chevron that rotates 180° when open; accessibilityState expanded
- EmptyState ({ title, body, action })
- LockedNotice ({ text }) – lock icon on a grey band
Add a dev-only screen app/(app)/dev-kit.tsx showing every component.
```

**Expect:** about 14 component files and a demo screen.

**Check**
- [ ] The dev kit screen looks right on web and phone; the chevron rotates when tapped.

---

### Task 5.3: Data hooks

**Goal:** one place for every server call.

**Cursor prompt**
```text
Create TanStack Query hooks in src/data (typed with src/types/database.ts):
- useMonth() store (Zustand) holding the selected month as 'YYYY-MM-01', default current month; helpers next/previous.
- useView() store holding 'me' | 'household', default 'household'.
- useMonthSummary(month, view) → rpc('get_month_summary'); before the first call for a month, call rpc('ensure_budget_month', { p_month }).
- useFeed(month, view, limit) → rpc('get_feed').
- useSettings() → household_settings row; useUpdateSettings() (primary only; surfaces RLS errors as "Only the primary account can change this").
- useCategories(), useAccounts().
- useBudgetLines(month) → my budget_lines joined with category; useUpdateBudgetLine().
- useCreateTransaction(), useUpdateTransaction(), useDeleteTransaction() (invalidate summary and feed on success).
- useMyPrivate() → my member_private row; useUpdateProfile() → rpc('update_my_profile').
- useSetJointShare(), useSetPartnerName().
- useLatestFxRate() → newest fx_rates row; effectiveRate(settings, latest) = settings.fx_override_ngn_per_cad ?? latest.rate.
- useCreditAccounts(), useCreditLogs() and their mutations.
Also create src/lib/budget.ts with pure functions + Jest tests: bucketStatus(bucket, plannedShare, target) → 'Within limit' | 'Over limit' | 'On target' | 'Below target' (needs is a ceiling, the others are floors); toCad(amount, currency, rate).
```

**Expect:** files in `src/data`, `src/lib/budget.ts` with tests.

**Check**
- [ ] `npx jest` and `npx tsc --noEmit` pass.

---

## Phase 6: Settings module

### Task 6.1: Settings screen

**Goal:** every setting from the sheet's Settings tab, with primary-only locks.

**Cursor prompt**
```text
Build app/(app)/settings.tsx. On phones the sections stack; on web they are Cards in a wrapping grid (min card width 340, Categories card spans wider). Sections:
1. Your profile: Avatar, name, role chip; display name and monthly take-home (MoneyField) → useUpdateProfile. Helper text: "Private to you. <partner> only sees it inside Household totals."
2. Household members: primary and partner rows (name, role, "joined by invite"). Primary only: partner display name field (useSetPartnerName), "Invite partner" (calls send-invite with an email field) when there's no partner, "Resend invite".
3. Joint costs: slider 0–100 in steps of 5 for the primary's share (labels "<primary> 50%" / "<partner> 50%") → useSetJointShare; total monthly rent MoneyField; line "<primary> pays $675.00 · <partner> pays $675.00".
4. Budget rule: three percentage fields (Needs & Personal ceiling, Investment floor, Emergency floor) with a chip "Totals 100%" (red if not 100). Save disabled unless total = 100.
5. Exchange rate: live rate (latest fx_rates, with "updated <time ago>"), manual override field, "Rate used".
6. Credit targets: utilisation ceiling %, ideal utilisation %, statement alert days, max hard inquiries per 12 months.
7. Categories: list with kind; a bucket pill per category that cycles Needs & Personal → Investment → Emergency (primary only); "Add category" (name, kind, bucket, default split %) and "Archive" (primary only).
8. Accounts: name, type, currency; "Add account" (primary only).
9. Sign out button.
For the partner, show LockedNotice at the top ("Household settings are managed by <primary>.") and render sections 3–8 read-only (disabled inputs, no add buttons). Percentages are stored as fractions (0.55) and shown as whole numbers (55).
Save changes per section with a "Save" button that appears only when the section is dirty; show a toast on success.
```

**Expect:** a full Settings screen.

**Check**
- [ ] As primary, changing the joint share to 60% makes your planned Rent $810 (check with the Budget screen after Phase 8, or by calling the RPC from the budget-dev SQL Editor).
- [ ] As partner, every household field is disabled. The privacy test from Task 2.3 already proves the database blocks partner updates; rerun `npm run db:test` to confirm.

---

## Phase 7: Transactions module

### Task 7.1: Add and edit transaction

**Goal:** fast entry with CAD/NGN, personal/joint and category.

**Cursor prompt**
```text
Build app/(app)/transactions/new.tsx and app/(app)/transactions/[id].tsx (edit) sharing one TransactionForm component:
- SegmentedControl Expense / Income (Transfer hidden behind "More" for later).
- Large amount input (inputmode decimal) with a currency toggle CAD / NGN. When NGN, show "≈ $X.XX at ₦<rate> per CAD" using effectiveRate.
- Description (optional, ≤ 80 chars).
- "Whose is it?": two large buttons, "<my name>" (scope personal) and "Joint" (scope joint). Below: for Joint "Split 50/50: <primary> $X, <partner> $Y" using current joint shares; for personal "Counts only toward your budget. <partner> sees the amount and category, not the description."
- Category chips (expense categories or income categories depending on type), wrapping.
- Account picker (optional).
- Date (default today).
- Save button label "Save $X.XX · <Joint | my name>", disabled until amount > 0.
On save insert into transactions with created_by = my user id, household_id, amount, currency, fx_ngn_per_cad (for NGN), amount_cad rounded to 2 dp. Close the modal/panel and show a toast.
Edit screen: only for my own entries (RLS already blocks others); includes Delete with confirmation.
```

**Expect:** add/edit screens and a shared form.

**Check**
- [ ] ₦50,000 at 940.29 saves as `amount_cad` 53.18.
- [ ] A joint $100 grocery entry shows $50 in your "me" view and $100 in Household.

---

### Task 7.2: Transactions list

**Goal:** a full list with filters.

**Cursor prompt**
```text
Build app/(app)/transactions/index.tsx using get_feed with p_limit 100 for the selected month and view:
- Header: month switcher (‹ October 2026 ›) and the me/Household SegmentedControl.
- Filter chips: All, Expenses, Income, Joint, Mine.
- Rows: Avatar (joint = dark "J"), description (masked text comes from the server), category · date, amount (income in green with "+"), and a sub-label: "Joint · split 50/50" in Household view, "Your 50% of $1,350" in me view.
- Tapping my own row opens edit; partner rows aren't tappable.
- On web, show it as a table with columns Date, Description, Category, Whose, Amount.
- Empty state: "Nothing logged for this view yet." with an Add button.
```

**Check**
- [ ] The partner's personal entry shows as "Wifey's private entry" in your Household view and doesn't appear in your "me" view.

---

## Phase 8: Budget module

### Task 8.1: Budget screen

**Goal:** planned versus spent per category, grouped by the three buckets with collapsible chevrons.

**Cursor prompt**
```text
Build app/(app)/budget.tsx from useMonthSummary(month, view):
- Header: month switcher and me/Household SegmentedControl.
- Stat tiles: Budgeted income, Allocated (sum of planned), Spent so far, Unallocated (income − allocated; red if negative).
- Three CollapsibleSections in this order: Needs & Personal (accent), Investment (investment colour), Emergency (emergency colour). Header shows coloured dot, name, "n categories", "$total · xx.x% of income", and the status Chip from bucketStatus(). All open by default; remember open/closed per bucket in AsyncStorage/localStorage.
- Phone rows: category name, "$spent / $planned", ProgressBar (bucket colour, danger when over).
- Web (≥ 900px): a table with columns Category | Planned | Spent | Left | Progress (bar + % used), horizontally scrollable if narrow.
- In "me" view, tapping a category opens an edit sheet for MY budget line: either "% of my take-home" (stored as split_pct) or "Fixed amount" (fixed_amount_cad). Rent is not editable here (it comes from household rent × joint share); show "Set by household rent" instead.
- Footer note in me view: "Your budget lines are yours; your partner keeps their own."
```

**Expect:** Budget screen for both layouts.

**Check**
- [ ] Your me view shows Needs & Personal $2,195 (54.9%), Investment $1,000 (25.0%), Emergency $800 (20.0%), Unallocated $5.
- [ ] Household view shows $4,390 / $2,000 / $1,600.
- [ ] Collapsing a bucket survives an app restart.

---

## Phase 9: Overview dashboard

### Task 9.1: Overview screen

**Goal:** the home screen from the prototype.

**Cursor prompt**
```text
Build app/(app)/index.tsx (Overview) using useMonthSummary and useFeed:
- Header: "October 2026" eyebrow; title "Our money" in Household view or "Hi, <name>" in me view; me/Household SegmentedControl.
- Hero card (ink background, white text, radius 22): "Left to spend this month" (planned − spent, large), a progress bar (mint #7FD1A8 on #2C3D36), and stats Budgeted income / Planned / Spent.
- "Your 55 / 25 / 20" card (labels come from settings targets): one row per bucket on phones; three cards side by side on web; each with dot, name, status Chip, planned amount, ProgressBar of spent/planned, "$spent spent" and "xx.x% · max 55%" or "aim 25%".
- Recent transactions (5 on phone, 6 on web) with "See all".
- Web right column (stacks below on phones): "Your credit" snapshot (scores or "No score yet", utilisation %, next statement alert, "Open credit"), always labelled Private; "Joint costs" card (total rent, each person's share and amount, "Logged as Joint this month"); and, if enabled, a "Synced with Google Sheets" card.
- Pull-to-refresh on phones.
- Loading skeletons and an error state with Retry.
```

**Check**
- [ ] With only October rent logged as Joint: Household "Left to spend" is $6,640 and your me view is $3,320.
- [ ] Switching view updates every number without a full reload.

---

## Phase 10: Credit module

### Task 10.1: Credit screen

**Goal:** private credit tracking for each person, with the sheet's health checks.

**Cursor prompt**
```text
Build app/(app)/credit.tsx (always the signed-in person's own data; no view switch):
- LockedNotice-style band: "<name>, this is private to you. Credit files are individual in Canada."
- Scores card (ink): latest Equifax and TransUnion from credit_score_logs or "No score yet"; text "Scores range from 300 to 900. Check Borrowell (Equifax) and Credit Karma (TransUnion) once a month."; button "Log this month's scores" → sheet with Equifax, TransUnion, payments due, paid on time, hard inquiries, notes (upsert on user_id + month).
- Utilisation card: overall utilisation = sum(balance) / sum(limit) over cards and lines (exclude loans); big %, bar 0–50% with markers at ideal and ceiling from settings, Chip Ideal / Within ceiling / Above ceiling; alert band "Statement closes <date>, in N days" for the soonest statement date (next occurrence of statement_day).
- Accounts list: name, type, "$balance / $limit", autopay, opened date; tap to edit; "Add a card" form (name, type, limit, balance, statement day, due day, opened on, autopay).
- Health checks: on-time payment rate (sum paid_on_time / sum payments_due, 100% target), hard inquiries in last 12 months vs max, age of oldest open account in months, accounts needing attention (utilisation above ceiling or statement within alert days).
- Empty state when no accounts: "No cards yet" with the newcomer/secured card tip and an "Add a card" button.
- Put the calculations in src/lib/credit.ts as pure functions with Jest tests (next statement date across month ends, utilisation, health status).
- Web: two columns (scores + utilisation | accounts + checks).
```

**Check**
- [ ] A $1,000 card with a $350 balance shows 35% "Above ceiling" and an attention count of 1.
- [ ] The partner can't see your cards (sign in as the partner to confirm).

---

## Phase 11: Background jobs

### Task 11.1: Exchange-rate refresh

**Goal:** a fresh CAD→NGN rate every day.

**Cursor prompt**
```text
Create Edge Function supabase/functions/fx-refresh/index.ts:
- Only callable with the service role key (check the Authorization header equals `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`); register with verify_jwt = false and do this check yourself.
- Fetch CAD→NGN from FX_API_URL (default https://open.er-api.com/v6/latest/CAD; read rates.NGN). Validate it's a positive number between 100 and 10000; otherwise log and return 502 without writing.
- Insert into fx_rates (base 'CAD', quote 'NGN', rate, source).
Create a migration that schedules it daily at 06:00 America/Regina (12:00 UTC) with Supabase Cron (pg_cron + pg_net net.http_post), reading the project URL and service role key from Supabase Vault secrets named project_url and service_role_key. Include comments explaining how to create those Vault secrets in the dashboard.
Also schedule public.cleanup_auth_codes() daily.
Apply the migration with `npm run db:push` and deploy the function to budget-dev.
```

**You do:** check the FX provider's terms (some free tiers need attribution); add the Vault secrets in the dashboard.

**Check**
- [ ] Running the function manually inserts a row; Settings shows the live rate.

---

### Task 11.2: Statement reminders

**Goal:** an email before a card statement closes while utilisation is above the ceiling, matching the sheet's alert.

**Cursor prompt**
```text
Create Edge Function supabase/functions/statement-reminders/index.ts (service-role only, like fx-refresh):
- For every open credit account with a statement_day, compute the next statement date in America/Regina time.
- If days until statement ≤ household_settings.statement_alert_days AND balance / limit > util_ceiling, email the owner via ZeptoMail: subject "Pay down <card> before <date>", body showing balance, limit, utilisation %, the amount to pay to get under the ceiling ((balance − ceiling × limit), rounded up to the dollar) and to reach the ideal level.
- Send at most one reminder per account per statement cycle: add a migration with table reminder_log (credit_account_id, statement_date, sent_at, unique(credit_account_id, statement_date)), RLS enabled with no client policies.
Schedule it daily at 08:00 America/Regina (14:00 UTC) with Supabase Cron. Apply with `npm run db:push` and deploy the function to budget-dev.
```

**Check**
- [ ] With a test card at 35% and a statement in 2 days, running the function sends one email; running it again sends nothing.

---

## Phase 12: Google Sheets export (optional)

Keep your existing sheet updated as a read-only export.

**You do**
1. In Google Cloud, create a project, enable the **Google Sheets API**, create a **service account** and download its JSON key.
2. Share your Google Sheet with the service account's email as Editor.
3. Store the key: `npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat key.json)"` and `SHEETS_SPREADSHEET_ID=<id from the sheet URL>`.

**Cursor prompt**
```text
Create Edge Function supabase/functions/sheets-export/index.ts (service-role only):
- Get a Google OAuth access token from GOOGLE_SERVICE_ACCOUNT_JSON (JWT bearer flow, scope https://www.googleapis.com/auth/spreadsheets) using Web Crypto to sign RS256.
- For each household, write the current month to a tab named "App export": household-level category rows (Category, Bucket, Planned, Spent) from the same SQL as get_month_summary in 'household' view (run it via a service-role SQL helper function that takes household_id), plus joint transactions. Never export personal descriptions or individual incomes.
- Use spreadsheets.values.batchUpdate with valueInputOption RAW; clear the range first.
Schedule it nightly with Supabase Cron. Add a Settings toggle (primary only) stored in a new household_settings column sheets_export_enabled boolean default false (new migration).
```

**Check**
- [ ] After running it, the "App export" tab in your sheet shows this month's totals.

---

## Phase 13: Testing and security review

### Task 13.1: Automated checks

**Cursor prompt**
```text
1. Extend supabase/tests/privacy_test.sql (run with `npm run db:test`) so it also covers: every table has RLS enabled (query pg_tables/pg_class), login_otps and verified_sessions are unreadable by the authenticated role, anon can't execute any public function.
2. Add Jest tests for src/lib (money, budget, credit) to reach full branch coverage of those files.
3. Add an npm script "check" that runs `npx tsc --noEmit`, `npx jest`, and `npm run db:test`.
Run it and fix failures.
```

### Task 13.2: Security review

**Cursor prompt**
```text
Act as a security reviewer. Review @supabase/migrations @supabase/functions @src/lib/supabase.ts and the auth screens. Check specifically:
- Any table or function readable without session_verified().
- Any path where the partner can read the primary's personal transactions, income, budget lines or credit data (or the reverse).
- Any place a secret (service role key, ZeptoMail token, OTP pepper, Google key) could reach the client bundle or logs.
- OTP: brute force limits, expiry, constant-time compare, codes never logged or returned, codes bound to session_id.
- Invite tokens: hashed at rest, single use, expiry, email must match.
- Edge Functions: CORS, method checks, input validation, service-role-only functions really check the key.
List findings by severity with file and line, then propose fixes. Don't change code until I approve.
```

**Check**
- [ ] `npm run check` passes.
- [ ] Fix every High finding before deploying.

### Manual QA (both users, web and phone)
- [ ] Sign up primary → create household → invite partner → partner joins.
- [ ] Each logs a personal and a joint expense; the views and masking behave as described in section 1.
- [ ] Partner can't change household settings; primary can.
- [ ] NGN entry converts correctly; changing the FX override changes new entries only.
- [ ] Budget totals match the Google Sheet for the same inputs.

---

## Phase 14: Deployment

### Task 14.1: Production backend

**Cursor prompt**
```text
Write docs/DEPLOY.md and a script scripts/deploy-prod.sh that deploys to budget-prod and always leaves the CLI linked back to budget-dev:
1. Runs `npm run check` against budget-dev first and stops if anything fails.
2. Reads SUPABASE_PROD_PROJECT_REF from .env.local, shows it, and asks me to type "deploy prod" to continue.
3. `npx supabase link --project-ref "$SUPABASE_PROD_PROJECT_REF"`, then `npx supabase db push`.
4. `npx supabase functions deploy` for every function in supabase/functions (excluding _shared).
5. Reminds me to set production secrets once with `npx supabase secrets set --env-file supabase/functions/.env.production` (never committed; APP_URL is the live domain).
6. Relinks to budget-dev (`npx supabase link --project-ref "$SUPABASE_DEV_PROJECT_REF"`) even if an earlier step failed (use a trap).
Add SUPABASE_PROD_PROJECT_REF to .env.example. There is no reset script for production.
Also list the dashboard settings that must match production (Auth email settings, SMTP, templates, Site URL, redirect URLs including householdbudget:// and the web domain, Vault secrets for Cron).
```

### Task 14.2: Web app

**Cursor prompt**
```text
Prepare the web build for static hosting:
1. Add npm script "build:web": "npx expo export --platform web" (output in dist/).
2. Add vercel.json (or netlify.toml – ask me which host) with SPA rewrites so /invite/<token> and other routes serve index.html.
3. Use EXPO_PUBLIC_ variables from the hosting provider's environment settings.
4. Add basic security headers (Content-Security-Policy allowing the Supabase URL, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin).
Then tell me the exact steps to connect the GitHub repo to the host and set the environment variables.
```

**Check**
- [ ] The deployed site loads, sign-in with code works, an invite link opens the invite screen directly.
- [ ] Update Supabase Site URL and `APP_URL` secret to the live domain.

### Task 14.3: Mobile apps

**Cursor prompt**
```text
Set up EAS for this project:
1. Run `eas build:configure`; create eas.json with development, preview (internal distribution) and production profiles.
2. Set the iOS bundleIdentifier and Android package in app.json (ask me for my reverse-domain, e.g. com.yourdomain.householdbudget), plus an adaptive icon and splash using the ink and accent colours.
3. Configure associated domains / Android intent filters so https://<my-domain>/invite/* opens the app (universal links), with the scheme householdbudget:// as a fallback.
4. Tell me the commands to make a preview build for my phone and, later, to submit to the App Store and Google Play.
```

**Check**
- [ ] The preview build installs on your phone, signs in with a code, and opens invite links.

---

## Appendix A: Database schema SQL

Tested on PostgreSQL 16 with Supabase's `auth` schema. Paste it unchanged in Task 2.1.

```sql
-- ============================================================
-- Household Budget: reference schema (Supabase / Postgres)
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- Types ----------
create type public.member_role   as enum ('primary', 'partner');
create type public.budget_bucket as enum ('needs', 'investment', 'emergency');
create type public.category_kind as enum ('fixed', 'variable', 'income');
create type public.txn_type      as enum ('expense', 'income', 'transfer');
create type public.txn_scope     as enum ('personal', 'joint');
create type public.currency_code as enum ('CAD', 'NGN');
create type public.account_type  as enum ('bank', 'credit', 'cash');
create type public.credit_type   as enum ('card', 'line', 'loan');

-- ---------- Household and people ----------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Our household',
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.member_role not null,
  display_name text not null,
  joint_share  numeric(5,4) not null check (joint_share between 0 and 1),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);
create unique index one_primary_per_household
  on public.household_members (household_id) where role = 'primary';

-- Income is private to its owner. Never expose this table to the other member.
create table public.member_private (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  take_home_cad numeric(12,2) not null default 0 check (take_home_cad >= 0),
  updated_at    timestamptz not null default now()
);

create table public.household_settings (
  household_id            uuid primary key references public.households(id) on delete cascade,
  rent_total_cad          numeric(12,2) not null default 0 check (rent_total_cad >= 0),
  target_needs            numeric(5,4) not null default 0.55,
  target_investment       numeric(5,4) not null default 0.25,
  target_emergency        numeric(5,4) not null default 0.20,
  fx_override_ngn_per_cad numeric(14,4) check (fx_override_ngn_per_cad > 0),
  util_ceiling            numeric(5,4) not null default 0.30,
  util_ideal              numeric(5,4) not null default 0.10,
  statement_alert_days    int not null default 3 check (statement_alert_days between 0 and 31),
  max_hard_inquiries      int not null default 2 check (max_hard_inquiries >= 0),
  updated_at              timestamptz not null default now()
);

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email        text not null,
  token_hash   text not null unique,
  invited_by   uuid not null references auth.users(id),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- Reference data ----------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  kind          public.category_kind not null,
  bucket        public.budget_bucket,
  default_split numeric(5,4) check (default_split between 0 and 1),
  is_rent       boolean not null default false,
  sort_order    int not null default 0,
  archived      boolean not null default false,
  unique (household_id, name),
  check ((kind = 'income' and bucket is null) or (kind <> 'income' and bucket is not null))
);

create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null, -- null = shared account
  name          text not null,
  type          public.account_type not null,
  currency      public.currency_code not null default 'CAD',
  archived      boolean not null default false
);

-- ---------- Budget ----------
create table public.budget_lines (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  month            date not null check (extract(day from month) = 1),
  category_id      uuid not null references public.categories(id) on delete cascade,
  split_pct        numeric(5,4) check (split_pct between 0 and 1),
  fixed_amount_cad numeric(12,2) check (fixed_amount_cad >= 0),
  unique (user_id, month, category_id)
);

-- ---------- Transactions ----------
create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  created_by     uuid not null references auth.users(id),
  scope          public.txn_scope not null,
  occurred_on    date not null,
  month          date generated always as (occurred_on - (extract(day from occurred_on)::int - 1)) stored,
  description    text not null default '',
  category_id    uuid not null references public.categories(id),
  account_id     uuid references public.accounts(id),
  type           public.txn_type not null,
  amount         numeric(14,2) not null check (amount > 0),
  currency       public.currency_code not null default 'CAD',
  fx_ngn_per_cad numeric(14,4),
  amount_cad     numeric(14,2) not null check (amount_cad >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (currency = 'CAD' or fx_ngn_per_cad is not null)
);
create index transactions_household_month on public.transactions (household_id, month);
create index transactions_creator_month   on public.transactions (created_by, month);

-- ---------- Credit (always private to the owner) ----------
create table public.credit_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid not null references public.households(id) on delete cascade,
  name            text not null,
  type            public.credit_type not null,
  credit_limit    numeric(12,2) not null default 0 check (credit_limit >= 0),
  current_balance numeric(12,2) not null default 0,
  statement_day   int check (statement_day between 1 and 31),
  due_day         int check (due_day between 1 and 31),
  opened_on       date,
  autopay         boolean not null default false,
  closed_on       date
);

create table public.credit_score_logs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  month                    date not null check (extract(day from month) = 1),
  equifax                  int check (equifax between 300 and 900),
  transunion               int check (transunion between 300 and 900),
  utilisation_at_statement numeric(5,4),
  payments_due             int not null default 0,
  paid_on_time             int not null default 0,
  hard_inquiries           int not null default 0,
  notes                    text,
  unique (user_id, month)
);

-- ---------- Exchange rates ----------
create table public.fx_rates (
  id         bigserial primary key,
  base       text not null default 'CAD',
  quote      text not null default 'NGN',
  rate       numeric(14,4) not null check (rate > 0),
  source     text not null,
  fetched_at timestamptz not null default now()
);

-- ---------- Login OTP (service role only) ----------
create table public.login_otps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  uuid not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index login_otps_session on public.login_otps (session_id, created_at desc);

create table public.verified_sessions (
  session_id  uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ============================================================
-- Helper functions (used by RLS)
-- ============================================================
create or replace function public.session_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.verified_sessions v
    where v.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and v.user_id = auth.uid()
      and v.expires_at > now()
  );
$$;

create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

create or replace function public.is_primary()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where user_id = auth.uid() and role = 'primary'
  );
$$;

-- ============================================================
-- Row level security
-- ============================================================
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.member_private     enable row level security;
alter table public.household_settings enable row level security;
alter table public.invites            enable row level security;
alter table public.categories         enable row level security;
alter table public.accounts           enable row level security;
alter table public.budget_lines       enable row level security;
alter table public.transactions       enable row level security;
alter table public.credit_accounts    enable row level security;
alter table public.credit_score_logs  enable row level security;
alter table public.fx_rates           enable row level security;
alter table public.login_otps         enable row level security; -- no policies: service role only
alter table public.verified_sessions  enable row level security; -- no policies: service role only

create policy households_read on public.households for select
  using (public.session_verified() and id = public.my_household_id());

create policy members_read on public.household_members for select
  using (public.session_verified() and household_id = public.my_household_id());

create policy private_own on public.member_private for all
  using (public.session_verified() and user_id = auth.uid())
  with check (public.session_verified() and user_id = auth.uid() and household_id = public.my_household_id());

create policy settings_read on public.household_settings for select
  using (public.session_verified() and household_id = public.my_household_id());
create policy settings_primary_write on public.household_settings for update
  using (public.session_verified() and public.is_primary() and household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

create policy invites_primary_read on public.invites for select
  using (public.session_verified() and public.is_primary() and household_id = public.my_household_id());

create policy categories_read on public.categories for select
  using (public.session_verified() and household_id = public.my_household_id());
create policy categories_primary_insert on public.categories for insert
  with check (public.session_verified() and public.is_primary() and household_id = public.my_household_id());
create policy categories_primary_update on public.categories for update
  using (public.session_verified() and public.is_primary() and household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

create policy accounts_read on public.accounts for select
  using (public.session_verified() and household_id = public.my_household_id());
create policy accounts_primary_insert on public.accounts for insert
  with check (public.session_verified() and public.is_primary() and household_id = public.my_household_id());
create policy accounts_primary_update on public.accounts for update
  using (public.session_verified() and public.is_primary() and household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

create policy budget_own on public.budget_lines for all
  using (public.session_verified() and user_id = auth.uid())
  with check (public.session_verified() and user_id = auth.uid() and household_id = public.my_household_id());

-- You can read your own entries and joint entries. The partner's personal
-- entries are only reachable through the masked RPCs (get_feed, get_month_summary).
create policy txn_read on public.transactions for select
  using (public.session_verified() and household_id = public.my_household_id()
         and (scope = 'joint' or created_by = auth.uid()));
create policy txn_insert on public.transactions for insert
  with check (public.session_verified() and household_id = public.my_household_id() and created_by = auth.uid());
create policy txn_update on public.transactions for update
  using (public.session_verified() and created_by = auth.uid())
  with check (household_id = public.my_household_id() and created_by = auth.uid());
create policy txn_delete on public.transactions for delete
  using (public.session_verified() and created_by = auth.uid());

create policy credit_accounts_own on public.credit_accounts for all
  using (public.session_verified() and user_id = auth.uid())
  with check (public.session_verified() and user_id = auth.uid() and household_id = public.my_household_id());

create policy credit_logs_own on public.credit_score_logs for all
  using (public.session_verified() and user_id = auth.uid())
  with check (public.session_verified() and user_id = auth.uid());

create policy fx_read on public.fx_rates for select
  using (public.session_verified());
```

---

## Appendix B: Server functions SQL

Tested against Appendix A: privacy rules, masking, joint splits and the 55/25/20 totals (Needs & Personal $2,195, Investment $1,000, Emergency $800 per person; rent $675 at 50/50 and $810 at 60/40). Paste it unchanged in Task 2.2.

```sql
-- ============================================================
-- Household Budget: server functions (RPCs)
-- ============================================================

-- Seeds categories, accounts and settings for a new household.
create or replace function public.seed_household_defaults(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.household_settings (household_id, rent_total_cad) values (p_household, 0)
  on conflict (household_id) do nothing;

  insert into public.categories (household_id, name, kind, bucket, default_split, is_rent, sort_order) values
    (p_household, 'Rent',             'fixed',    'needs',      null,  true,  1),
    (p_household, 'Groceries',        'variable', 'needs',      0.12,  false, 2),
    (p_household, 'Transport',        'variable', 'needs',      0.03,  false, 3),
    (p_household, 'Utilities',        'fixed',    'needs',      0.03,  false, 4),
    (p_household, 'Phone & Internet', 'fixed',    'needs',      0.03,  false, 5),
    (p_household, 'Insurance',        'fixed',    'needs',      0.01,  false, 6),
    (p_household, 'Eating Out',       'variable', 'needs',      0.03,  false, 7),
    (p_household, 'Subscriptions',    'fixed',    'needs',      0.01,  false, 8),
    (p_household, 'Debt Payment',     'fixed',    'needs',      0.03,  false, 9),
    (p_household, 'Black Tax',        'variable', 'needs',      0.03,  false, 10),
    (p_household, 'Miscellaneous',    'variable', 'needs',      0.06,  false, 11),
    (p_household, 'Investment',       'variable', 'investment', 0.25,  false, 12),
    (p_household, 'Emergency Funds',  'variable', 'emergency',  0.20,  false, 13),
    (p_household, 'Salary',           'income',   null,         null,  false, 20),
    (p_household, 'Freelance Income', 'income',   null,         null,  false, 21)
  on conflict (household_id, name) do nothing;

  insert into public.accounts (household_id, name, type, currency) values
    (p_household, 'Chequing',      'bank',   'CAD'),
    (p_household, 'Savings',       'bank',   'CAD'),
    (p_household, 'Credit Card 1', 'credit', 'CAD'),
    (p_household, 'Cash',          'cash',   'CAD'),
    (p_household, 'Naira Account', 'bank',   'NGN');
end $$;

-- Creates this month's budget lines for one person from the category defaults,
-- or copies the previous month if that exists. Safe to call repeatedly.
create or replace function public.ensure_budget_month(p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hid   uuid := public.my_household_id();
  v_month date := date_trunc('month', p_month)::date;
  v_prev  date := (date_trunc('month', p_month) - interval '1 month')::date;
begin
  if not public.session_verified() or v_hid is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.budget_lines where user_id = auth.uid() and month = v_month) then
    return;
  end if;
  if exists (select 1 from public.budget_lines where user_id = auth.uid() and month = v_prev) then
    insert into public.budget_lines (household_id, user_id, month, category_id, split_pct, fixed_amount_cad)
    select household_id, user_id, v_month, category_id, split_pct, fixed_amount_cad
    from public.budget_lines where user_id = auth.uid() and month = v_prev;
  else
    insert into public.budget_lines (household_id, user_id, month, category_id, split_pct)
    select v_hid, auth.uid(), v_month, c.id, c.default_split
    from public.categories c
    where c.household_id = v_hid and c.kind <> 'income' and not c.archived;
  end if;
end $$;

-- Called once by the person who sets up the household (becomes primary).
create or replace function public.create_household(
  p_display_name text, p_take_home_cad numeric, p_rent_total_cad numeric default 0,
  p_household_name text default 'Our household')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_hid uuid;
begin
  if not public.session_verified() then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.my_household_id() is not null then raise exception 'already in a household'; end if;

  insert into public.households (name, created_by) values (p_household_name, auth.uid()) returning id into v_hid;
  insert into public.household_members (household_id, user_id, role, display_name, joint_share)
    values (v_hid, auth.uid(), 'primary', p_display_name, 0.5);
  insert into public.member_private (user_id, household_id, take_home_cad) values (auth.uid(), v_hid, p_take_home_cad);
  perform public.seed_household_defaults(v_hid);
  update public.household_settings set rent_total_cad = p_rent_total_cad where household_id = v_hid;
  perform public.ensure_budget_month(current_date);
  return v_hid;
end $$;

-- Called by the invited partner after signing in. The raw token comes from the invite link.
create or replace function public.accept_invite(p_token text, p_display_name text, p_take_home_cad numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv     public.invites;
  v_primary numeric;
begin
  if not public.session_verified() then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.my_household_id() is not null then raise exception 'already in a household'; end if;

  select * into v_inv from public.invites
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and expires_at > now()
  for update;
  if v_inv.id is null then raise exception 'invite invalid or expired'; end if;
  if lower(v_inv.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'invite was sent to a different email';
  end if;
  if (select count(*) from public.household_members where household_id = v_inv.household_id) >= 2 then
    raise exception 'household is full';
  end if;

  select joint_share into v_primary from public.household_members
  where household_id = v_inv.household_id and role = 'primary';

  insert into public.household_members (household_id, user_id, role, display_name, joint_share)
    values (v_inv.household_id, auth.uid(), 'partner', p_display_name, 1 - v_primary);
  insert into public.member_private (user_id, household_id, take_home_cad)
    values (auth.uid(), v_inv.household_id, p_take_home_cad);
  update public.invites set accepted_at = now() where id = v_inv.id;
  perform public.ensure_budget_month(current_date);
  return v_inv.household_id;
end $$;

create or replace function public.update_my_profile(p_display_name text, p_take_home_cad numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.session_verified() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.household_members set display_name = p_display_name where user_id = auth.uid();
  update public.member_private set take_home_cad = p_take_home_cad, updated_at = now() where user_id = auth.uid();
end $$;

-- Primary only: set the primary's share of joint costs (partner gets the rest).
create or replace function public.set_joint_share(p_primary_share numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_hid uuid := public.my_household_id();
begin
  if not (public.session_verified() and public.is_primary()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_primary_share < 0 or p_primary_share > 1 then raise exception 'share must be between 0 and 1'; end if;
  update public.household_members
     set joint_share = case when role = 'primary' then p_primary_share else 1 - p_primary_share end
   where household_id = v_hid;
end $$;

-- Primary only: rename the partner.
create or replace function public.set_partner_display_name(p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.session_verified() and public.is_primary()) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.household_members set display_name = p_display_name
   where household_id = public.my_household_id() and role = 'partner';
end $$;

-- Budget vs actual for one month. p_view: 'me' or 'household'.
-- Never returns a member's individual income, only the total for the view.
create or replace function public.get_month_summary(p_month date, p_view text default 'household')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hid      uuid := public.my_household_id();
  v_month    date := date_trunc('month', p_month)::date;
  v_people   uuid[];
  v_share    numeric;
  v_income   numeric;
  v_earned   numeric;
  v_settings public.household_settings;
  v_result   jsonb;
begin
  if not public.session_verified() or v_hid is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_view not in ('me', 'household') then raise exception 'view must be me or household'; end if;

  if p_view = 'me' then
    v_people := array[auth.uid()];
  else
    select array_agg(user_id) into v_people from public.household_members where household_id = v_hid;
  end if;

  select coalesce(sum(joint_share), 0) into v_share
    from public.household_members where household_id = v_hid and user_id = any(v_people);
  select coalesce(sum(take_home_cad), 0) into v_income
    from public.member_private where household_id = v_hid and user_id = any(v_people);
  select * into v_settings from public.household_settings where household_id = v_hid;

  select coalesce(sum(amount_cad), 0) into v_earned
    from public.transactions
   where household_id = v_hid and month = v_month and type = 'income'
     and (created_by = any(v_people) or scope = 'joint');

  with planned_cte as (
    select b.category_id,
           sum(case
                 when c.is_rent then v_settings.rent_total_cad * m.joint_share
                 when b.fixed_amount_cad is not null then b.fixed_amount_cad
                 else coalesce(b.split_pct, 0) * coalesce(mp.take_home_cad, 0)
               end) as planned
      from public.budget_lines b
      join public.categories c on c.id = b.category_id
      join public.household_members m on m.user_id = b.user_id and m.household_id = v_hid
      left join public.member_private mp on mp.user_id = b.user_id
     where b.household_id = v_hid and b.month = v_month and b.user_id = any(v_people)
     group by b.category_id
  ),
  spent_cte as (
    select t.category_id,
           sum(case when t.scope = 'joint' then t.amount_cad * v_share else t.amount_cad end) as spent
      from public.transactions t
     where t.household_id = v_hid and t.month = v_month and t.type = 'expense'
       and (t.scope = 'joint' or t.created_by = any(v_people))
     group by t.category_id
  ),
  cat_rows as (
    select c.id, c.name, c.bucket, c.sort_order,
           round(coalesce(p.planned, 0), 2) as planned,
           round(coalesce(s.spent, 0), 2)   as spent
      from public.categories c
      left join planned_cte p on p.category_id = c.id
      left join spent_cte   s on s.category_id = c.id
     where c.household_id = v_hid and c.kind <> 'income' and not c.archived
  )
  select jsonb_build_object(
    'month', v_month,
    'view', p_view,
    'budgeted_income', round(v_income, 2),
    'actual_income', round(v_earned, 2),
    'targets', jsonb_build_object(
      'needs', v_settings.target_needs,
      'investment', v_settings.target_investment,
      'emergency', v_settings.target_emergency),
    'categories', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order) from cat_rows r), '[]'::jsonb),
    'buckets', coalesce((
      select jsonb_object_agg(bucket, jsonb_build_object('planned', planned, 'spent', spent))
        from (select bucket, sum(planned) as planned, sum(spent) as spent from cat_rows group by bucket) x
    ), '{}'::jsonb)
  ) into v_result;

  return v_result;
end $$;

-- Recent transactions for the feed. Masks the description of the partner's personal entries.
create or replace function public.get_feed(p_month date, p_view text default 'household', p_limit int default 20)
returns table (
  id uuid, occurred_on date, description text, category_name text,
  type public.txn_type, scope public.txn_scope, is_mine boolean, owner_name text,
  amount_cad numeric, view_amount_cad numeric)
language sql stable security definer set search_path = public as $$
  select t.id, t.occurred_on,
         case when t.scope = 'personal' and t.created_by <> auth.uid()
              then m.display_name || '''s private entry' else t.description end,
         c.name, t.type, t.scope, t.created_by = auth.uid(), m.display_name, t.amount_cad,
         case when p_view = 'me' and t.scope = 'joint'
              then round(t.amount_cad * me.joint_share, 2) else t.amount_cad end
    from public.transactions t
    join public.categories c         on c.id = t.category_id
    join public.household_members m  on m.user_id = t.created_by and m.household_id = t.household_id
    join public.household_members me on me.user_id = auth.uid() and me.household_id = t.household_id
   where public.session_verified()
     and t.household_id = public.my_household_id()
     and t.month = date_trunc('month', p_month)::date
     and (t.scope = 'joint' or t.created_by = auth.uid() or p_view = 'household')
   order by t.occurred_on desc, t.created_at desc
   limit greatest(1, least(p_limit, 100));
$$;

-- Lets the app ask whether the current session has passed the email OTP step.
create or replace function public.is_session_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select public.session_verified();
$$;

-- Only signed-in users may call these, and nobody may call the seed helper directly.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.seed_household_defaults(uuid) from authenticated;
```

---

## Appendix C: ZeptoMail helper code

`supabase/functions/_shared/zeptomail.ts` (Task 3.2):

```ts
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
```

If ZeptoMail rejects requests asking for a bounce address, set `ZEPTOMAIL_BOUNCE_ADDRESS` to the bounce address configured on your Mail Agent.

---

## Appendix D: Environment variables and secrets

**App (`.env.local`, and the web host's environment settings)**

| Name | Example | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Safe to expose |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Safe to expose; RLS protects data |

**Your Mac only (`.env.local`; no `EXPO_PUBLIC_` prefix, so never bundled into the app)**

| Name | Example | Notes |
|---|---|---|
| `SUPABASE_DEV_PROJECT_REF` | `abcdefghijklmnop` | budget-dev project ref; used by the safety and types scripts |
| `SUPABASE_DEV_DB_URL` | Session pooler connection string | Used by `npm run db:test` |
| `SUPABASE_PROD_PROJECT_REF` | `qrstuvwxyzabcdef` | Used only by `scripts/deploy-prod.sh` |

**Edge Functions (`supabase/functions/.env` for budget-dev and `.env.production` for budget-prod, uploaded with `npx supabase secrets set --env-file <file>`)**

| Name | Example | Used by |
|---|---|---|
| `ZEPTOMAIL_TOKEN` | Send Mail token from the Mail Agent | All email |
| `ZEPTOMAIL_API_URL` | `https://api.zeptomail.com/v1.1/email` | Use the host shown in your dashboard |
| `ZEPTOMAIL_FROM` | `no-reply@yourdomain.com` | Must be on the verified domain |
| `ZEPTOMAIL_FROM_NAME` | `Household Budget` | |
| `ZEPTOMAIL_BOUNCE_ADDRESS` | (optional) | Only if ZeptoMail asks for it |
| `OTP_PEPPER` | 64 random hex characters | Hashing login codes |
| `APP_URL` | `http://localhost:8081`, later your domain | Invite links |
| `FX_API_URL` | `https://open.er-api.com/v6/latest/CAD` | fx-refresh |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | (optional) | sheets-export |
| `SHEETS_SPREADSHEET_ID` | (optional) | sheets-export |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically. Never put the service role key in the app.

---

## Appendix E: Default data

Seeded by `create_household`, matching your Google Sheet:

| Category | Kind | Bucket | Default split of take-home |
|---|---|---|---|
| Rent | Fixed | Needs & Personal | Household rent × joint share ($675 at 50/50) |
| Groceries | Variable | Needs & Personal | 12% |
| Transport | Variable | Needs & Personal | 3% |
| Utilities | Fixed | Needs & Personal | 3% |
| Phone & Internet | Fixed | Needs & Personal | 3% |
| Insurance | Fixed | Needs & Personal | 1% |
| Eating Out | Variable | Needs & Personal | 3% |
| Subscriptions | Fixed | Needs & Personal | 1% |
| Debt Payment | Fixed | Needs & Personal | 3% |
| Black Tax | Variable | Needs & Personal | 3% |
| Miscellaneous | Variable | Needs & Personal | 6% |
| Investment | Variable | Investment | 25% |
| Emergency Funds | Variable | Emergency | 20% |
| Salary, Freelance Income | Income | – | – |

Other defaults: rule 55/25/20; joint share 50/50; utilisation ceiling 30%, ideal 10%; statement alert 3 days; max 2 hard inquiries per 12 months. Accounts: Chequing, Savings, Credit Card 1, Cash (CAD) and Naira Account (NGN).

With $4,000 take-home and $1,350 rent, each person's month comes to Needs & Personal $2,195 (54.9%), Investment $1,000 (25%), Emergency $800 (20%), and $5 unallocated.

---

## Appendix F: Fix-it prompts

**Something errors**
```text
This error happens when <what you did>:
<paste the full error and stack trace>
Relevant files: @<file1> @<file2>
Find the root cause before changing code. Explain it in two sentences, then make the smallest fix. Don't change unrelated files. Run `npx tsc --noEmit` afterwards.
```

**Behaviour is wrong but nothing errors**
```text
Expected: <exactly what should happen, with numbers>
Actual: <exactly what happens>
Steps: <1, 2, 3>
Relevant files: @<file>
Add temporary logging if needed to find the cause, explain it, fix it, then remove the logging.
```

**Database permission problems ("permission denied" or empty results)**
```text
As <primary | partner>, <query or screen> returns <error | no rows> but should return <expected>.
Check, in order: is the session verified (rpc is_session_verified), does the RLS policy on <table> in @supabase/migrations allow it, is the right function being used (get_feed / get_month_summary for partner data). Don't weaken a policy to make it work; tell me if the rule itself needs changing.
```

**Cursor went off track**
```text
Stop. Undo the changes from your last response (git checkout the affected files). Re-read @docs/BUILD_GUIDE.md Task <n.n> and do only what it says.
```

**Layout broken on one platform**
```text
On <web at 1280px | iPhone | Android>, <screen> looks like <describe or attach a screenshot>. It should look like <describe>. Fix it using flex/gap and theme tokens, and check that the other platforms still look right.
```

---

## Appendix G: Definition of done

The build is complete when all of these are true:

- [ ] Sign up, sign in with password plus emailed code, forgot password, and sign out all work on iOS, Android and web.
- [ ] Without a verified session, the database returns no data (tested).
- [ ] The primary creates the household; the partner joins only by emailed invite.
- [ ] Each person sees only their own view and the Household view; partner entries are masked; incomes and credit data are private.
- [ ] Only the primary can change household settings (enforced in the database).
- [ ] Budget, Overview, Transactions, Credit and Settings match the prototype on phone and web.
- [ ] NGN entries convert at the live or override rate; the rate refreshes daily.
- [ ] Statement reminders arrive once per cycle when utilisation is above the ceiling.
- [ ] `npm run check` passes; the security review has no open High findings.
- [ ] Web is deployed with your domain; preview builds run on both phones.

---

*Sources used for technical details: Zoho ZeptoMail "Email sending API" documentation; Supabase "JWT Claims Reference" (session_id and aal claims). This guide is a build plan, not financial advice.*
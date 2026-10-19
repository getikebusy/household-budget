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

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

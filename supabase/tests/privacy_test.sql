-- Privacy tests against budget-dev. The whole script is one transaction and rolls back.
begin;

create temporary table test_ids (
  p_id uuid primary key,
  w_id uuid not null,
  p_sess uuid not null,
  w_sess uuid not null,
  p_email text not null,
  w_email text not null
) on commit drop;

insert into test_ids (p_id, w_id, p_sess, w_sess, p_email, w_email) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'privacy-primary@example.test',
  'privacy-partner@example.test'
);

grant select on test_ids to authenticated;

-- Two auth users (primary P, partner W). If this insert is refused, stop: create
-- dashboard users and pass TEST_PRIMARY_ID / TEST_PARTNER_ID via psql -v instead.
do $setup$
declare
  r test_ids%rowtype;
  v_instance uuid;
begin
  select * into strict r from test_ids;
  select id into v_instance from auth.instances limit 1;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000';
  end if;

  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values
      (
        v_instance, r.p_id, 'authenticated', 'authenticated', r.p_email,
        crypt('privacy-test', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', ''
      ),
      (
        v_instance, r.w_id, 'authenticated', 'authenticated', r.w_email,
        crypt('privacy-test', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', ''
      );
  exception
    when insufficient_privilege or check_violation or not_null_violation or unique_violation then
      raise exception 'AUTH_USERS_INSERT_REFUSED (%): create two test users in the budget-dev dashboard (Authentication → Add user) and put their IDs and emails in .env.local as TEST_PRIMARY_ID, TEST_PRIMARY_EMAIL, TEST_PARTNER_ID and TEST_PARTNER_EMAIL.', sqlerrm;
    when others then
      if sqlstate in ('42501', '42502', '42503') then
        raise exception 'AUTH_USERS_INSERT_REFUSED (%): create two test users in the budget-dev dashboard (Authentication → Add user) and put their IDs and emails in .env.local as TEST_PRIMARY_ID, TEST_PRIMARY_EMAIL, TEST_PARTNER_ID and TEST_PARTNER_EMAIL.', sqlerrm;
      end if;
      raise;
  end;
end
$setup$;

insert into public.verified_sessions (session_id, user_id, expires_at)
select p_sess, p_id, now() + interval '1 day' from test_ids
union all
select w_sess, w_id, now() + interval '1 day' from test_ids;

-- P creates the household.
do $setup$
declare
  r test_ids%rowtype;
  v_hid uuid;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  v_hid := public.create_household('Odogwu', 4000, 1350);
  if v_hid is null then
    raise exception 'FAIL: create_household returned null';
  end if;
end
$setup$;
reset role;

-- Invite for W (no insert policy; owner/postgres fixture).
insert into public.invites (household_id, email, token_hash, invited_by, expires_at)
select hm.household_id,
       r.w_email,
       encode(digest('tok', 'sha256'), 'hex'),
       r.p_id,
       now() + interval '7 days'
  from test_ids r
  join public.household_members hm on hm.user_id = r.p_id;

-- W accepts.
do $setup$
declare
  r test_ids%rowtype;
  v_hid uuid;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.w_id::text,
      'session_id', r.w_sess::text,
      'email', r.w_email,
      'role', 'authenticated'
    )::text,
    true
  );
  v_hid := public.accept_invite('tok', 'Wifey', 4000);
  if v_hid is null then
    raise exception 'FAIL: accept_invite returned null';
  end if;
end
$setup$;
reset role;

-- W: personal expense.
do $setup$
declare
  r test_ids%rowtype;
  n int;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.w_id::text,
      'session_id', r.w_sess::text,
      'email', r.w_email,
      'role', 'authenticated'
    )::text,
    true
  );
  insert into public.transactions (
    household_id, created_by, scope, occurred_on, description, category_id,
    type, amount, currency, amount_cad
  )
  select hm.household_id, r.w_id, 'personal', current_date, 'Secret gift', c.id,
         'expense', 100, 'CAD', 100
    from public.categories c
    join public.household_members hm
      on hm.household_id = c.household_id and hm.user_id = r.w_id
   where c.name = 'Miscellaneous';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: expected to insert 1 personal expense, inserted %', n;
  end if;
end
$setup$;
reset role;

-- P: joint rent.
do $setup$
declare
  r test_ids%rowtype;
  n int;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  insert into public.transactions (
    household_id, created_by, scope, occurred_on, description, category_id,
    type, amount, currency, amount_cad
  )
  select hm.household_id, r.p_id, 'joint', current_date, 'October rent', c.id,
         'expense', 1350, 'CAD', 1350
    from public.categories c
    join public.household_members hm
      on hm.household_id = c.household_id and hm.user_id = r.p_id
   where c.name = 'Rent';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: expected to insert 1 joint expense, inserted %', n;
  end if;
end
$setup$;
reset role;

-- 1. P selecting from transactions sees only the joint row.
do $assert$
declare
  r test_ids%rowtype;
  n int;
  v_desc text;
  v_scope public.txn_scope;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) into n from public.transactions;
  if n <> 1 then
    raise exception 'FAIL: P saw % transaction(s), expected only the joint row', n;
  end if;
  select description, scope into v_desc, v_scope from public.transactions;
  if v_desc is distinct from 'October rent' or v_scope is distinct from 'joint' then
    raise exception 'FAIL: P saw % (%) instead of joint "October rent"', v_desc, v_scope;
  end if;
end
$assert$;

-- 2. P's household feed masks the partner's personal description.
do $assert$
declare
  r test_ids%rowtype;
  v_desc text;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select description into v_desc
    from public.get_feed(current_date, 'household')
   where scope = 'personal'
   limit 1;
  if v_desc is distinct from 'Wifey''s private entry' then
    raise exception 'FAIL: household feed partner row was %, expected "Wifey''s private entry"', v_desc;
  end if;
end
$assert$;

-- 3. P's me feed is only October rent at 675.00.
do $assert$
declare
  r test_ids%rowtype;
  n int;
  rec record;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) into n from public.get_feed(current_date, 'me');
  if n <> 1 then
    raise exception 'FAIL: P me-feed returned % row(s), expected 1', n;
  end if;
  select * into rec from public.get_feed(current_date, 'me');
  if rec.description is distinct from 'October rent' then
    raise exception 'FAIL: P me-feed description was %, expected "October rent"', rec.description;
  end if;
  if rec.view_amount_cad is distinct from 675.00 then
    raise exception 'FAIL: P me-feed view_amount_cad was %, expected 675.00', rec.view_amount_cad;
  end if;
end
$assert$;

-- 4. P me-summary 55/25/20 planned amounts.
do $assert$
declare
  r test_ids%rowtype;
  s jsonb;
  v_needs numeric;
  v_inv numeric;
  v_emg numeric;
  v_income numeric;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  s := public.get_month_summary(current_date, 'me');
  v_needs := (s -> 'buckets' -> 'needs' ->> 'planned')::numeric;
  v_inv := (s -> 'buckets' -> 'investment' ->> 'planned')::numeric;
  v_emg := (s -> 'buckets' -> 'emergency' ->> 'planned')::numeric;
  v_income := (s ->> 'budgeted_income')::numeric;
  if v_needs is distinct from 2195.00 then
    raise exception 'FAIL: P me needs.planned was %, expected 2195.00', v_needs;
  end if;
  if v_inv is distinct from 1000.00 then
    raise exception 'FAIL: P me investment.planned was %, expected 1000.00', v_inv;
  end if;
  if v_emg is distinct from 800.00 then
    raise exception 'FAIL: P me emergency.planned was %, expected 800.00', v_emg;
  end if;
  if v_income is distinct from 4000 then
    raise exception 'FAIL: P me budgeted_income was %, expected 4000', v_income;
  end if;
end
$assert$;

-- 5. Household needs planned is both people.
do $assert$
declare
  r test_ids%rowtype;
  s jsonb;
  v_needs numeric;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  s := public.get_month_summary(current_date, 'household');
  v_needs := (s -> 'buckets' -> 'needs' ->> 'planned')::numeric;
  if v_needs is distinct from 4390.00 then
    raise exception 'FAIL: household needs.planned was %, expected 4390.00', v_needs;
  end if;
end
$assert$;

-- 6. Each member sees only their own member_private row.
do $assert$
declare
  r test_ids%rowtype;
  n int;
  v_uid uuid;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) into n from public.member_private;
  select user_id into v_uid from public.member_private;
  if n <> 1 or v_uid is distinct from r.p_id then
    raise exception 'FAIL: P saw % member_private row(s) (user_id=%), expected only own', n, v_uid;
  end if;
end
$assert$;

do $assert$
declare
  r test_ids%rowtype;
  n int;
  v_uid uuid;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.w_id::text,
      'session_id', r.w_sess::text,
      'email', r.w_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) into n from public.member_private;
  select user_id into v_uid from public.member_private;
  if n <> 1 or v_uid is distinct from r.w_id then
    raise exception 'FAIL: W saw % member_private row(s) (user_id=%), expected only own', n, v_uid;
  end if;
end
$assert$;

-- 7. Partner cannot update settings or set joint share.
do $assert$
declare
  r test_ids%rowtype;
  n int;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.w_id::text,
      'session_id', r.w_sess::text,
      'email', r.w_email,
      'role', 'authenticated'
    )::text,
    true
  );
  update public.household_settings set util_ceiling = 0.99;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: partner updated % household_settings row(s)', n;
  end if;
  begin
    perform public.set_joint_share(0.6);
    raise exception 'FAIL: partner was allowed to call set_joint_share';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      if sqlerrm not ilike '%not allowed%' then
        raise exception 'FAIL: set_joint_share raised unexpected error: %', sqlerrm;
      end if;
  end;
end
$assert$;

-- 8. After P sets 60% share, their rent planned is 810.00.
do $assert$
declare
  r test_ids%rowtype;
  s jsonb;
  v_rent numeric;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  perform public.set_joint_share(0.6);
  s := public.get_month_summary(current_date, 'me');
  select (c ->> 'planned')::numeric
    into v_rent
    from jsonb_array_elements(s -> 'categories') c
   where c ->> 'name' = 'Rent';
  if v_rent is distinct from 810.00 then
    raise exception 'FAIL: P me Rent planned was %, expected 810.00', v_rent;
  end if;
end
$assert$;

-- 9. Unverified session cannot read categories.
do $assert$
declare
  r test_ids%rowtype;
  n int;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) into n from public.categories;
  if n <> 0 then
    raise exception 'FAIL: unverified session saw % categor%', n, case when n = 1 then 'y' else 'ies' end;
  end if;
end
$assert$;

-- 10. W cannot select P's credit_accounts.
do $assert$
declare
  r test_ids%rowtype;
  n int;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );
  insert into public.credit_accounts (user_id, household_id, name, type, credit_limit)
  select r.p_id, hm.household_id, 'P card', 'card', 1000
    from public.household_members hm
   where hm.user_id = r.p_id;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: could not insert P credit_accounts row';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.w_id::text,
      'session_id', r.w_sess::text,
      'email', r.w_email,
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) into n from public.credit_accounts;
  if n <> 0 then
    raise exception 'FAIL: W saw % credit_accounts row(s), expected 0', n;
  end if;
end
$assert$;

reset role;

-- 11. Every ordinary table in public has row level security.
do $assert$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;
  if missing is not null then
    raise exception 'FAIL: RLS is off for public table(s): %', missing;
  end if;

  select string_agg(tablename, ', ' order by tablename)
    into missing
    from pg_tables
   where schemaname = 'public'
     and not rowsecurity;
  if missing is not null then
    raise exception 'FAIL: pg_tables reports RLS off for: %', missing;
  end if;
end
$assert$;

-- 12. Authenticated clients cannot read login codes or verified sessions.
insert into public.login_otps (user_id, session_id, code_hash, expires_at)
select p_id, p_sess, repeat('a', 64), now() + interval '10 minutes'
  from test_ids;

do $assert$
declare
  r test_ids%rowtype;
  n int;
begin
  select * into strict r from test_ids;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', r.p_id::text,
      'session_id', r.p_sess::text,
      'email', r.p_email,
      'role', 'authenticated'
    )::text,
    true
  );

  begin
    select count(*) into n from public.login_otps;
    if n <> 0 then
      raise exception 'FAIL: authenticated read % login_otps row(s)', n;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    select count(*) into n from public.verified_sessions;
    if n <> 0 then
      raise exception 'FAIL: authenticated read % verified_sessions row(s)', n;
    end if;
  exception
    when insufficient_privilege then
      null;
  end;
end
$assert$;
reset role;

-- 13. The anon role cannot execute any function in public.
do $assert$
declare
  fn text;
begin
  select string_agg(format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), ', ' order by p.proname)
    into fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute');
  if fn is not null then
    raise exception 'FAIL: anon can execute %', fn;
  end if;
end
$assert$;

select 'ALL PRIVACY TESTS PASSED';

reset role;
rollback;

-- A removed member can be left with private pay and budget lines and no
-- household_members row. create_household and accept_invite then fail on
-- member_private's primary key, and the app only shows a generic error.

create or replace function public.clear_orphan_membership()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.session_verified() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if public.my_household_id() is not null then
    return;
  end if;
  delete from public.budget_lines where user_id = auth.uid();
  delete from public.member_private where user_id = auth.uid();
end;
$$;

create or replace function public.create_household(
  p_display_name text, p_take_home_cad numeric, p_rent_total_cad numeric default 0,
  p_household_name text default 'Our household')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_hid uuid;
begin
  if not public.session_verified() then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.my_household_id() is not null then raise exception 'already in a household'; end if;
  perform public.clear_orphan_membership();

  insert into public.households (name, created_by) values (p_household_name, auth.uid()) returning id into v_hid;
  insert into public.household_members (household_id, user_id, role, display_name, joint_share)
    values (v_hid, auth.uid(), 'primary', p_display_name, 0.5);
  insert into public.member_private (user_id, household_id, take_home_cad) values (auth.uid(), v_hid, p_take_home_cad);
  perform public.seed_household_defaults(v_hid);
  update public.household_settings set rent_total_cad = p_rent_total_cad where household_id = v_hid;
  perform public.ensure_budget_month(current_date);
  return v_hid;
end $$;

create or replace function public.accept_invite(p_token text, p_display_name text, p_take_home_cad numeric)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
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

  perform public.clear_orphan_membership();

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

revoke all on function public.clear_orphan_membership() from public, anon;
grant execute on function public.clear_orphan_membership() to authenticated, service_role;

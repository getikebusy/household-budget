-- Primary can remove the invited partner, or cancel an invite that has not been accepted.

create or replace function public.remove_partner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
  v_partner uuid;
begin
  if not (public.session_verified() and public.is_primary()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select user_id into v_partner
    from public.household_members
   where household_id = v_hid and role = 'partner';
  if v_partner is null then
    raise exception 'no partner to remove';
  end if;

  delete from public.budget_lines
   where household_id = v_hid and user_id = v_partner;
  delete from public.member_private
   where user_id = v_partner and household_id = v_hid;
  delete from public.household_members
   where household_id = v_hid and user_id = v_partner and role = 'partner';
end;
$$;

create or replace function public.cancel_invite()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
begin
  if not (public.session_verified() and public.is_primary()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.invites
     set expires_at = now()
   where household_id = v_hid
     and accepted_at is null
     and expires_at > now();
end;
$$;

revoke all on function public.remove_partner() from public, anon;
revoke all on function public.cancel_invite() from public, anon;
grant execute on function public.remove_partner() to authenticated, service_role;
grant execute on function public.cancel_invite() to authenticated, service_role;

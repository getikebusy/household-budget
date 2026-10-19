-- pgcrypto's digest() lives in the extensions schema. accept_invite was
-- created with search_path = public only, so invite acceptance failed.
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

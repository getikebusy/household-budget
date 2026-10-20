-- Each member picks the currency amounts are shown in. Display only:
-- household records stay in CAD and are converted at the latest rate.
alter table public.member_private
  add column display_currency public.currency_code not null default 'CAD';

create or replace function public.set_my_display_currency(p_currency public.currency_code)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.session_verified() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.member_private set display_currency = p_currency, updated_at = now() where user_id = auth.uid();
end $$;

revoke all on function public.set_my_display_currency(public.currency_code) from public, anon;
grant execute on function public.set_my_display_currency(public.currency_code) to authenticated, service_role;

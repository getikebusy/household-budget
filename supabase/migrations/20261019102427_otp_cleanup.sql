create or replace function public.cleanup_auth_codes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_otps
   where created_at < now() - interval '1 day';
  delete from public.verified_sessions
   where expires_at < now();
end;
$$;

revoke all on function public.cleanup_auth_codes() from public, anon, authenticated;
grant execute on function public.cleanup_auth_codes() to service_role;

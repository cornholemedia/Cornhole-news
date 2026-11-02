-- Admin writes stay open until an authenticator is verified.
-- After a verified factor exists, is_admin() is true only for an aal2 session.
-- Service-role digest ingest does not use this function.
-- Safe to run more than once.
-- TOTP is on by default in Supabase Authentication. If enrollment fails,
-- open Authentication -> Multi-Factor and enable TOTP.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles is missing. Run supabase/schema.sql first.';
  end if;
  if to_regclass('auth.mfa_factors') is null then
    raise exception 'auth.mfa_factors is missing. Enable Supabase Auth before this file.';
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_admin = true
  )
  and (
    not exists (
      select 1
      from auth.mfa_factors
      where user_id = auth.uid()
        and status = 'verified'
    )
    or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

comment on function public.is_admin() is
  'True for an admin profile. Once that account has a verified MFA factor, the session must be aal2. Accounts that have not enrolled are unchanged.';

-- Require an age-and-terms confirmation before a new account is created.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- Does not collect a birthdate. Existing accounts are left as they are.
--
-- The signup form sends raw_user_meta_data.age_confirmed = true only after the
-- person checks "I am at least 13 years old and agree to the Terms of Use and
-- Privacy Policy." Calling the public signup API without that flag is rejected.
--
-- To add a user from the Supabase dashboard, set User Metadata to:
--   {"age_confirmed": true, "username": "their_name"}

create or replace function public.enforce_signup_age_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.raw_user_meta_data->>'age_confirmed', '')) is distinct from 'true' then
    raise exception 'You must confirm that you are at least 13 years old and agree to the Terms of Use and Privacy Policy';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_signup_age_confirmation() from public, anon, authenticated;
grant execute on function public.enforce_signup_age_confirmation() to supabase_auth_admin, service_role;

drop trigger if exists enforce_signup_age_confirmation on auth.users;
create trigger enforce_signup_age_confirmation
  before insert on auth.users
  for each row execute procedure public.enforce_signup_age_confirmation();

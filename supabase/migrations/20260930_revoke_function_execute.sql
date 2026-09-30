-- Stop anonymous visitors from calling security-definer functions through the
-- public Data API. Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- Checked against the app before writing this:
--   handle_new_user
--     Trigger on auth.users. Supabase Auth (role supabase_auth_admin) runs it
--     when someone signs up. The website never calls it. Anonymous and
--     signed-in API roles do not need it. Revoking them does not stop signup
--     as long as supabase_auth_admin keeps EXECUTE.
--   is_admin
--     Used by row-level security when a signed-in admin saves a page.
--     Anonymous visitors only read pages, and that policy does not call this.
--   protect_profile_admin_flag
--     Trigger when a signed-in user creates or updates a profile. Anonymous
--     visitors cannot write profiles. Signed-in users still need EXECUTE so
--     the trigger can run.
--   touch_page_row
--     Trigger when a signed-in admin saves a page. Anonymous visitors cannot
--     write pages. Signed-in users still need EXECUTE so the trigger can run.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.protect_profile_admin_flag() from public, anon;
revoke execute on function public.touch_page_row() from public, anon;

-- Keep the grants signed-in use actually needs, in case an older script
-- removed them. service_role is unchanged.
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.protect_profile_admin_flag() to authenticated, service_role;
grant execute on function public.touch_page_row() to authenticated, service_role;

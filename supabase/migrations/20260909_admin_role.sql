-- Admin role + post moderation policies for Cornhole News
-- Paste into Supabase Dashboard -> SQL Editor -> Run

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Admins can update any post; authors can update their own
drop policy if exists "Authors can update their own posts" on public.posts;
create policy "Authors can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Admins can update any post" on public.posts;
create policy "Admins can update any post"
  on public.posts for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Admins can delete any post (authors already have their own delete policy)
drop policy if exists "Admins can delete any post" on public.posts;
create policy "Admins can delete any post"
  on public.posts for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Admins can delete any comment
drop policy if exists "Admins can delete any comment" on public.comments;
create policy "Admins can delete any comment"
  on public.comments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Mark the Cornhole_Admin profile as admin once it exists
update public.profiles
set is_admin = true
where username = 'Cornhole_Admin';

-- Harden posts_with_stats: prefer invoker rights when supported
do $$
begin
  execute 'alter view public.posts_with_stats set (security_invoker = true)';
exception
  when others then
    raise notice 'Could not set security_invoker on posts_with_stats: %', SQLERRM;
end $$;

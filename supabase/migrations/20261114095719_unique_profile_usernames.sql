create table public.profile_usernames (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text collate "C" not null unique,
  constraint profile_usernames_format check (username ~ '^[a-z0-9_]{3,24}$')
);

alter table public.profile_usernames enable row level security;

revoke all on table public.profile_usernames from public, anon, authenticated;
grant select, insert, update on table public.profile_usernames to authenticated;

create policy "Read own username"
  on public.profile_usernames for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Register own username"
  on public.profile_usernames for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Change own username"
  on public.profile_usernames for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

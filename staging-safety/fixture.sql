-- CI fixture only: a minimal subset of observed production FK/RLS contracts.
-- Never apply this file to a hosted database.
create table public.insect_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),insect_name text);
create table public.post_comments(id uuid primary key default gen_random_uuid(),post_id uuid references public.insect_posts(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade);
create table public.post_likes(id uuid primary key default gen_random_uuid(),post_id uuid references public.insect_posts(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade);
create table public.content_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid references auth.users(id) on delete cascade,post_id uuid references public.insect_posts(id) on delete set null,reason text,status text default 'pending');
create table public.account_deletion_audit(id uuid primary key default gen_random_uuid(),deleted_posts int,deleted_photos int,function_version text);
do $$ declare t text; begin foreach t in array array['gacha_coin_wallets','gacha_coin_purchase_credits','gacha_coin_spends','gacha_paid_draws'] loop
 execute format('create table public.%I(user_id uuid references auth.users(id))',t);
 execute format('alter table public.%I enable row level security',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end $$;
alter table public.insect_posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.content_reports enable row level security;
alter table public.account_deletion_audit enable row level security;
grant all on public.insect_posts,public.post_comments,public.post_likes,public.content_reports,public.account_deletion_audit to service_role;
grant select,insert on public.insect_posts to authenticated;
grant insert,select on public.content_reports to authenticated;
create policy posts_read on public.insect_posts for select to authenticated using(true);
create policy posts_write on public.insect_posts for insert to authenticated with check(user_id=(select auth.uid()));
create policy reports_write on public.content_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and status='pending');
-- Production has no client SELECT policy for content_reports.
create policy safety_photos_upload on storage.objects for insert to authenticated with check(bucket_id='insect-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy safety_photos_read on storage.objects for select to authenticated using(bucket_id='insect-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- A private work record coordinates storage, database and Auth deletion.
-- No clients can read or write it. Completion removes its account identifier.
create schema if not exists account_deletion_private;
revoke all on schema account_deletion_private from public, anon, authenticated;
create table account_deletion_private.requests (
  request_id uuid primary key,
  user_id uuid unique,
  worker uuid,
  locked_until timestamptz not null default now(),
  attempts integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table account_deletion_private.requests enable row level security;
revoke all on account_deletion_private.requests from public, anon, authenticated;

-- Callable by RLS only. No caller-supplied identity is accepted.
create function public.account_access_active_v21() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = (select auth.uid()))
    and exists (select 1 from auth.sessions s where s.user_id = (select auth.uid())
      and s.id::text = (select auth.jwt()->>'session_id'))
    and not exists (select 1 from account_deletion_private.requests d
      where d.user_id = (select auth.uid()) and d.completed_at is null);
$$;
revoke all on function public.account_access_active_v21() from public, anon;
grant execute on function public.account_access_active_v21() to authenticated;

-- This additional policy is restrictive, so it cannot grant access. Existing
-- ownership, moderation and purchase policies continue to apply as before.
do $$
declare relation text;
begin
  for relation in select distinct table_name from information_schema.columns
    where table_schema='public' and column_name in ('user_id','reporter_id','referrer_id','follower_id','followed_id')
  loop
    execute format('create policy account_active_v21 on public.%I as restrictive for all to authenticated using ((select public.account_access_active_v21())) with check ((select public.account_access_active_v21()))', relation);
  end loop;
end $$;
create policy account_active_v21 on storage.objects as restrictive for all to authenticated
  using ((select public.account_access_active_v21())) with check ((select public.account_access_active_v21()));

create function public.account_deletion_step_v21(
  p_action text, p_request uuid, p_user uuid default null,
  p_worker uuid default null, p_session uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare job account_deletion_private.requests%rowtype;
declare objects jsonb;
begin
  -- Only the Edge Function's service client can invoke this coordinator.
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if p_action = 'begin' then
    delete from account_deletion_private.requests where completed_at < now()-interval '7 days';
    if p_user is null or p_worker is null or not exists (
      select 1 from auth.sessions where id=p_session and user_id=p_user
    ) then return jsonb_build_object('error','reauthentication_required'); end if;
    -- Serializes requests from every Edge isolate for this account.
    perform 1 from auth.users where id=p_user for update;
    if not found then return jsonb_build_object('error','unauthorized'); end if;
    -- Preserve financial replay protection. These ledgers are empty in the current
    -- free release. A future paid release needs a separate retention design.
    if exists(select 1 from public.gacha_coin_purchase_credits where user_id=p_user)
       or exists(select 1 from public.apple_iap_events where user_id=p_user) then
      return jsonb_build_object('error','billing_retention_review');
    end if;
    select * into job from account_deletion_private.requests where user_id=p_user for update;
    if found then
      if job.request_id <> p_request then
        return jsonb_build_object('error','existing_request','request_id',job.request_id);
      end if;
    else
      insert into account_deletion_private.requests(request_id,user_id)
        values(p_request,p_user) on conflict (request_id) do nothing;
    end if;
  end if;
  select * into job from account_deletion_private.requests where request_id=p_request for update;
  if not found then return jsonb_build_object('deleted',false,'pending',false); end if;
  if p_action='status' then
    -- Reconcile the rare case where Auth committed but the HTTP response was lost.
    if job.completed_at is null and not exists(select 1 from auth.users where id=job.user_id) then
      update account_deletion_private.requests set user_id=null,worker=null,completed_at=now()
        where request_id=p_request;
      return jsonb_build_object('deleted',true,'pending',false);
    end if;
    return jsonb_build_object('deleted',job.completed_at is not null,'pending',job.completed_at is null);
  end if;
  if p_user is null or job.user_id is distinct from p_user then
    raise exception 'request_not_owned' using errcode='42501';
  end if;
  if p_action='begin' then
    if job.worker is not null and job.locked_until > now() then
      return jsonb_build_object('error','busy');
    end if;
    if job.attempts>=20 and job.started_at>now()-interval '1 day' then
      return jsonb_build_object('error','rate_limited');
    end if;
    update account_deletion_private.requests set worker=p_worker,locked_until=now()+interval '5 minutes',
      attempts=case when started_at<=now()-interval '1 day' then 1 else attempts+1 end,
      started_at=case when started_at<=now()-interval '1 day' then now() else started_at end
      where request_id=p_request;
    return jsonb_build_object('accepted',true,'request_id',p_request);
  end if;
  if job.worker is distinct from p_worker or job.locked_until<=now() then
    raise exception 'worker_lease_expired';
  end if;
  if p_action='renew' then
    update account_deletion_private.requests set locked_until=now()+interval '5 minutes' where request_id=p_request;
  elsif p_action='release' then
    update account_deletion_private.requests set worker=null,locked_until=now() where request_id=p_request;
  elsif p_action='inventory' then
    select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into objects from (
      select bucket_id,name from storage.objects
      where owner_id=p_user::text or owner=p_user or
        (bucket_id='insect-photos' and split_part(name,'/',1)=p_user::text)
      order by bucket_id,name limit 500
    ) o;
    return jsonb_build_object('objects',objects);
  elsif p_action='cleanup' then
    if exists(select 1 from storage.objects where owner_id=p_user::text or owner=p_user or
      (bucket_id='insect-photos' and split_part(name,'/',1)=p_user::text)) then
      raise exception 'storage_cleanup_incomplete';
    end if;
    -- Scope every mutation to the authenticated account. Foreign keys handle
    -- likes/comments on its posts, and remaining own profile/follow rows.
    delete from public.insect_posts where user_id=p_user;
    delete from public.monetization_events where user_id=p_user;
    delete from public.gacha_paid_draws where user_id=p_user;
    delete from public.gacha_coin_spends where user_id=p_user;
    delete from public.gacha_coin_wallets where user_id=p_user;
  elsif p_action='complete' then
    if exists(select 1 from auth.users where id=p_user) then raise exception 'auth_still_exists'; end if;
    update account_deletion_private.requests set user_id=null,worker=null,completed_at=now() where request_id=p_request;
    return jsonb_build_object('deleted',true);
  else raise exception 'invalid_deletion_action';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.account_deletion_step_v21(text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_step_v21(text,uuid,uuid,uuid,uuid) to service_role;

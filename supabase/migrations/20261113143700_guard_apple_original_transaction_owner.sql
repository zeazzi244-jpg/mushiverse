-- Serialize ownership claims for each Apple original transaction chain.
-- Unverified claims do not grant entitlements or credits.
create or replace function public.guard_apple_claim_original_owner()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.original_transaction_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('apple_iap_original:' || new.original_transaction_id, 0));
    if exists (
      select 1 from public.apple_purchase_claims c
      where c.original_transaction_id = new.original_transaction_id
        and c.user_id is distinct from new.user_id
    ) then
      raise exception 'original transaction already claimed by another user'
        using errcode = '23505', constraint = 'apple_purchase_claims_original_owner_guard';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists apple_claim_original_owner_guard on public.apple_purchase_claims;
create trigger apple_claim_original_owner_guard
before insert or update of original_transaction_id, user_id
on public.apple_purchase_claims
for each row execute function public.guard_apple_claim_original_owner();

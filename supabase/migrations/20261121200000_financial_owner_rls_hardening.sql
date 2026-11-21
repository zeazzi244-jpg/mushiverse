-- Narrow financial, purchase, report and referral data to owner access.
-- The legacy account_active_v21 FOR ALL policy ORed with owner SELECT rules.
-- Active users could otherwise read unrelated users' sensitive records.
DROP POLICY IF EXISTS account_active_v21 ON public.gacha_coin_spends;
DROP POLICY IF EXISTS account_active_v21 ON public.premium_entitlements;
DROP POLICY IF EXISTS account_active_v21 ON public.premium_waitlist;
DROP POLICY IF EXISTS account_active_v21 ON public.referral_claims;
DROP POLICY IF EXISTS account_active_v21 ON public.monetization_events;
DROP POLICY IF EXISTS account_active_v21 ON public.community_reports;

-- Preserve legitimate signup ability, but only for the caller's own
-- pending waitlist row. A client cannot assert an approved premium status.
DROP POLICY IF EXISTS premium_waitlist_owner_signup ON public.premium_waitlist;
CREATE POLICY premium_waitlist_owner_signup ON public.premium_waitlist
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND status = 'waiting');

-- All other write paths remain server-controlled or have existing
-- explicit owner INSERT policy (monetization_events and community_reports).
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.gacha_coin_spends, public.premium_entitlements,
     public.premium_waitlist, public.referral_claims,
     public.monetization_events, public.community_reports
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.gacha_coin_spends, public.premium_entitlements,
  public.referral_claims FROM PUBLIC, anon, authenticated;

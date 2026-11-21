-- Complete removal of legacy account_active_v21 FOR ALL RLS policy
-- from remaining private backend-only Apple/moderation tables.
-- These tables already have client DML privileges revoked, or an explicit
-- secure owner INSERT policy (content_reports_submit).
DROP POLICY IF EXISTS account_active_v21 ON public.apple_iap_events;
DROP POLICY IF EXISTS account_active_v21 ON public.apple_purchase_claims;
DROP POLICY IF EXISTS account_active_v21 ON public.content_reports;
DROP POLICY IF EXISTS account_active_v21 ON public.moderator_accounts;

REVOKE ALL ON public.apple_iap_events, public.apple_purchase_claims,
  public.moderator_accounts FROM PUBLIC, anon, authenticated;
-- Keep INSERT for legitimate owner-scoped report submissions; no client
-- SELECT, UPDATE or DELETE access to private moderation queue.
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.content_reports FROM PUBLIC, anon, authenticated;

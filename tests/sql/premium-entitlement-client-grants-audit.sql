-- Premium entitlement client grants must remain read-only for signed-in users.
DO $audit$
DECLARE bad_grants integer; own_read integer; policy_count integer; rls_enabled boolean;
BEGIN
 SELECT count(*) INTO bad_grants FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='premium_entitlements'
 AND grantee IN ('anon','authenticated')
 AND (grantee='anon' OR privilege_type<>'SELECT');
 IF bad_grants<>0 THEN RAISE EXCEPTION 'premium entitlement client privilege regression'; END IF;
 SELECT count(*) INTO own_read FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='premium_entitlements'
 AND grantee='authenticated' AND privilege_type='SELECT';
 IF own_read<>1 THEN RAISE EXCEPTION 'premium entitlement authenticated read missing'; END IF;
 SELECT relrowsecurity INTO rls_enabled FROM pg_class
 WHERE oid='public.premium_entitlements'::regclass;
 IF rls_enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'premium entitlement RLS disabled'; END IF;
 SELECT count(*) INTO policy_count FROM pg_policies
 WHERE schemaname='public' AND tablename='premium_entitlements'
 AND policyname='users_read_own_entitlement' AND cmd='SELECT';
 IF policy_count<>1 THEN RAISE EXCEPTION 'premium own-row read policy missing'; END IF;
END
$audit$;

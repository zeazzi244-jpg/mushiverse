-- Premium entitlements are server-managed. Preserve authenticated own-row SELECT.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.premium_entitlements FROM anon, authenticated;
REVOKE SELECT ON TABLE public.premium_entitlements FROM anon;
GRANT SELECT ON TABLE public.premium_entitlements TO authenticated;

CREATE OR REPLACE FUNCTION public.get_apple_production_verifier_secret()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE WHEN count(*) = 1 THEN max(decrypted_secret) END
  FROM vault.decrypted_secrets
  WHERE name = 'mushiverse_apple_production_verifier';
$$;
REVOKE ALL ON FUNCTION public.get_apple_production_verifier_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_apple_production_verifier_secret() TO service_role;

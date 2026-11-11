-- Defense in depth: Apple IAP claims must be written only by a trusted
-- server after authentication, never by browser or mobile clients directly.
-- The Edge Function uses the service-role key for these operations.
REVOKE ALL PRIVILEGES ON TABLE public.apple_purchase_claims FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.apple_purchase_claims_id_seq FROM anon, authenticated;

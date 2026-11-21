-- Grant the trusted Edge Function's service role access to the existing
-- atomic paid-draw RPC. Client roles remain denied. This does not expose a
-- paid draw to users or enable sale of coins.
REVOKE ALL ON FUNCTION public.draw_with_purchased_gacha_coins_and_lr(text,uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.draw_with_purchased_gacha_coins_and_lr(text,uuid,integer)
  TO service_role;

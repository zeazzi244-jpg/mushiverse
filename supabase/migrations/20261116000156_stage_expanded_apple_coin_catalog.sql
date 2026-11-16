-- Stage proposed JPY list prices. The catalog CHECK prevents enabling sales.
-- Existing rows, historical purchases and wallets retain their original values.
INSERT INTO public.apple_coin_pack_catalog (product_id, coins, planned_price_jpy, is_sale_enabled)
VALUES
  ('mushiverse.coins.300', 300, 320, false),
  ('mushiverse.coins.2500', 2500, 1800, false),
  ('mushiverse.coins.5500', 5500, 3600, false),
  ('mushiverse.coins.12000', 12000, 7800, false)
ON CONFLICT (product_id) DO NOTHING;

-- Planned Apple consumable catalog. All products remain unavailable for checkout.
-- Apple price tiers must be independently configured and verified in App Store Connect.
create table if not exists public.apple_coin_pack_catalog (
  product_id text primary key,
  coins integer not null check (coins > 0),
  planned_price_jpy integer not null check (planned_price_jpy > 0),
  is_sale_enabled boolean not null default false check (is_sale_enabled = false),
  updated_at timestamptz not null default now()
);
alter table public.apple_coin_pack_catalog enable row level security;
revoke all on public.apple_coin_pack_catalog from anon, authenticated;
insert into public.apple_coin_pack_catalog (product_id,coins,planned_price_jpy,is_sale_enabled)
values
  ('mushiverse.coins.100',100,160,false),
  ('mushiverse.coins.500',500,480,false),
  ('mushiverse.coins.1200',1200,980,false)
on conflict (product_id) do update set
  coins=excluded.coins,
  planned_price_jpy=excluded.planned_price_jpy,
  is_sale_enabled=false,
  updated_at=now();

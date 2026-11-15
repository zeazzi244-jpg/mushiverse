-- Add an opt-in server draw path. The current draw RPC remains unchanged.
create table public.albaseraph_inventory (
  singleton boolean primary key default true check (singleton),
  issued smallint not null default 0 check (issued between 0 and 3)
);

alter table public.albaseraph_inventory enable row level security;
revoke all on public.albaseraph_inventory from public, anon, authenticated, service_role;
insert into public.albaseraph_inventory (singleton) values (true);

create function public.draw_with_purchased_gacha_coins_and_lr(
  p_draw_id text, p_user_id uuid, p_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw jsonb;
  v_card jsonb;
  v_results jsonb := '[]'::jsonb;
  v_edition smallint;
begin
  if p_count is null then
    raise exception 'invalid_draw';
  end if;

  -- The existing RPC charges the wallet and holds the per-user transaction lock.
  -- The charge, any LR issuance, and the final draw receipt commit together.
  v_draw := public.draw_with_purchased_gacha_coins(p_draw_id, p_user_id, p_count);
  if not (v_draw->>'ok')::boolean or (v_draw->>'replayed')::boolean then
    return v_draw;
  end if;

  for v_card in
    select value from pg_catalog.jsonb_array_elements(v_draw->'results')
  loop
    -- N accounts for 80% of base results. 80% / 8000 = 0.01% per draw.
    -- Keep the SSR, SR and R rates intact; at sellout the base N result stands.
    if v_card->>'rarity' = 'N' and pg_catalog.random() < 0.000125 then
      update public.albaseraph_inventory
      set issued = issued + 1
      where singleton and issued < 3
      returning issued into v_edition;

      if found then
        v_card := pg_catalog.jsonb_build_object(
          'card_id', 101, 'rarity', 'LR', 'edition', v_edition
        );
      end if;
    end if;
    v_results := v_results || pg_catalog.jsonb_build_array(v_card);
  end loop;

  update public.gacha_paid_draws
  set results = v_results
  where draw_id = p_draw_id and user_id = p_user_id;

  return pg_catalog.jsonb_set(v_draw, '{results}', v_results);
end;
$$;

revoke all on function public.draw_with_purchased_gacha_coins_and_lr(text, uuid, integer)
  from public, anon, authenticated, service_role;
-- Grant to the trusted calling service only when the app and the odds display
-- are ready for a coordinated launch.

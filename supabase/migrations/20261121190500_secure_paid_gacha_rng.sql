-- Cryptographically secure 32-bit uniform variate in [0,1).
-- Uses pgcrypto and numeric arithmetic to avoid signed integer overflow.
CREATE OR REPLACE FUNCTION public.secure_gacha_uniform()
RETURNS double precision LANGUAGE sql VOLATILE SET search_path = ''
AS $fn$
  SELECT (
    (pg_catalog.get_byte(bytes,0)::numeric * 16777216 +
     pg_catalog.get_byte(bytes,1)::numeric * 65536 +
     pg_catalog.get_byte(bytes,2)::numeric * 256 +
     pg_catalog.get_byte(bytes,3)::numeric) / 4294967296::numeric
  )::double precision
  FROM (SELECT extensions.gen_random_bytes(4) AS bytes) crypto_source;
$fn$;
REVOKE ALL ON FUNCTION public.secure_gacha_uniform()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.draw_with_purchased_gacha_coins(p_draw_id text, p_user_id uuid, p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_cost integer; v_balance bigint; v_results jsonb:='[]'::jsonb; v_i integer; v_roll double precision; v_rarity text; v_card integer; v_existing jsonb;
begin
 if p_user_id is null or p_draw_id is null or length(p_draw_id)<8 or length(p_draw_id)>120 or p_count not in (1,10) then raise exception 'invalid_draw'; end if;
 v_cost:=case p_count when 1 then 50 else 450 end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select results into v_existing from public.gacha_paid_draws where draw_id=p_draw_id and user_id=p_user_id;
 if found then return pg_catalog.jsonb_build_object('ok',true,'replayed',true,'results',v_existing); end if;
 if exists(select 1 from public.gacha_paid_draws where draw_id=p_draw_id) then raise exception 'draw_id_already_used'; end if;
 select balance into v_balance from public.gacha_coin_wallets where user_id=p_user_id for update;
 if coalesce(v_balance,0)<v_cost then return pg_catalog.jsonb_build_object('ok',false,'reason','insufficient_balance'); end if;
 for v_i in 1..p_count loop
  v_roll:=public.secure_gacha_uniform();
  v_rarity:=case when v_roll<0.001 then 'SSR' when v_roll<0.02 then 'SR' when v_roll<0.20 then 'R' else 'N' end;
  v_card:=1+pg_catalog.floor(public.secure_gacha_uniform()*100)::integer;
  v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('card_id',v_card,'rarity',v_rarity));
 end loop;
 update public.gacha_coin_wallets set balance=balance-v_cost where user_id=p_user_id;
 insert into public.gacha_paid_draws(draw_id,user_id,draw_count,coins_spent,results) values(p_draw_id,p_user_id,p_count,v_cost,v_results);
 return pg_catalog.jsonb_build_object('ok',true,'replayed',false,'results',v_results,'balance',v_balance-v_cost);
end $function$


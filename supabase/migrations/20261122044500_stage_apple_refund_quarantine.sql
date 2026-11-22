-- Staged refund quarantine: write only after independent Apple-signed refund proof.
-- No App Store notification endpoint is enabled by this migration.
-- Refunds never silently erase earned cards or free coins.
CREATE TABLE IF NOT EXISTS public.apple_coin_refund_holds (
 transaction_id text PRIMARY KEY REFERENCES public.gacha_coin_purchase_credits(transaction_id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 revocation_date timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.apple_coin_refund_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_coin_refund_holds FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_apple_refund_after_verified_jws(
 p_transaction_id text, p_user_id uuid, p_revocation_date timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $refund$
DECLARE v_event public.apple_iap_events%ROWTYPE;
DECLARE v_credit public.gacha_coin_purchase_credits%ROWTYPE;
DECLARE v_hold public.apple_coin_refund_holds%ROWTYPE;
BEGIN
 IF p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{6,30}$'
   OR p_user_id IS NULL OR p_revocation_date IS NULL
   OR p_revocation_date > pg_catalog.now() + interval '5 minutes'
 THEN RAISE EXCEPTION 'invalid_refund_evidence'; END IF;
 -- Serialize refunds with paid draws; they take this same account lock.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_user_id::text, 0));
 SELECT * INTO v_credit FROM public.gacha_coin_purchase_credits
   WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF NOT FOUND OR v_credit.user_id IS DISTINCT FROM p_user_id
    OR v_credit.product_id IS DISTINCT FROM 'mushiverse.coins.100'
    OR v_credit.coins IS DISTINCT FROM 100
 THEN RAISE EXCEPTION 'refund_credit_owner_mismatch'; END IF;
 SELECT * INTO v_event FROM public.apple_iap_events
   WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF NOT FOUND OR v_event.user_id IS DISTINCT FROM p_user_id
    OR v_event.product_id IS DISTINCT FROM v_credit.product_id
    OR v_event.environment IS DISTINCT FROM 'Production'
    OR v_event.verified_at IS NULL
    OR v_event.purchase_date IS NULL
    OR p_revocation_date < v_event.purchase_date
    OR (v_event.revocation_date IS NOT NULL AND
        v_event.revocation_date IS DISTINCT FROM p_revocation_date)
 THEN RAISE EXCEPTION 'refund_verified_event_mismatch'; END IF;
 SELECT * INTO v_hold FROM public.apple_coin_refund_holds
   WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF FOUND AND (v_hold.user_id IS DISTINCT FROM p_user_id
   OR v_hold.revocation_date IS DISTINCT FROM p_revocation_date)
 THEN RAISE EXCEPTION 'refund_replay_conflict'; END IF;
 INSERT INTO public.apple_coin_refund_holds
   (transaction_id,user_id,revocation_date)
 VALUES (p_transaction_id,p_user_id,p_revocation_date)
 ON CONFLICT (transaction_id) DO NOTHING;
 UPDATE public.apple_iap_events SET revocation_date=p_revocation_date
   WHERE transaction_id=p_transaction_id
     AND (revocation_date IS NULL OR revocation_date=p_revocation_date);
 IF NOT FOUND THEN RAISE EXCEPTION 'refund_event_changed'; END IF;
 RETURN true;
END;
$refund$;
REVOKE ALL ON FUNCTION public.record_apple_refund_after_verified_jws(text,uuid,timestamptz)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_apple_refund_after_verified_jws(text,uuid,timestamptz)
 TO service_role;

-- Preserve existing paid draw receipts for idempotent replay; reject all NEW
-- paid draws when an Apple refund requires manual settlement.
DO $patch$
DECLARE definition text;
DECLARE marker text := 'if found then return pg_catalog.jsonb_build_object(''ok'',true,''replayed'',true,''results'',v_existing); end if;';
DECLARE insert_guard text := marker || chr(10) ||
 ' if exists (select 1 from public.apple_coin_refund_holds where user_id=p_user_id)' ||
 ' then raise exception ''apple_refund_reconciliation_required''; end if;';
BEGIN
 SELECT pg_catalog.pg_get_functiondef(
 'public.draw_with_purchased_gacha_coins(text,uuid,integer)'::regprocedure) INTO definition;
 IF pg_catalog.strpos(definition, 'apple_refund_reconciliation_required')>0 THEN RETURN; END IF;
 IF pg_catalog.strpos(definition,marker)=0
 THEN RAISE EXCEPTION 'paid_draw_guard_anchor_changed'; END IF;
 EXECUTE pg_catalog.replace(definition,marker,insert_guard);
END;
$patch$;

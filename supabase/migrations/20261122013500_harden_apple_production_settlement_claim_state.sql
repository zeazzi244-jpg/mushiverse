-- Fail closed when a claim changes state after JWS verification but before the atomic RPC.
-- Production billing gates and sale flags remain untouched.
DO $migration$
DECLARE definition text;
DECLARE before_guard text := 'OR v_claim.status = ''rejected''' || chr(10) || '    OR v_claim.environment NOT IN (''Production'')';
DECLARE after_guard text := 'OR v_claim.status NOT IN (''pending'', ''verified'')' || chr(10) || '    OR (v_claim.environment IS NOT NULL AND v_claim.environment <> ''Production'')';
BEGIN
 SELECT pg_get_functiondef('public.settle_verified_apple_coin_production(text,text,uuid,text,timestamptz)'::regprocedure) INTO definition;
 IF position(after_guard IN definition) > 0 THEN RETURN; END IF;
 IF position(before_guard IN definition) = 0 THEN RAISE EXCEPTION 'unexpected settlement guard; refusing migration'; END IF;
 EXECUTE replace(definition,before_guard,after_guard);
END $migration$;

import {drawCoins} from '../_shared/coin-ledger.ts';
import {authenticateSupabaseAccount} from '../_shared/supabase-account.ts';
import {createPaidDrawHandler} from '../_shared/paid-draw-handler.ts';
Deno.serve(createPaidDrawHandler({
 authenticate:authenticateSupabaseAccount,
 enabled:()=>Deno.env.get('APPLE_PAID_DRAWS_ENABLED')==='true',
 environment:()=>Deno.env.get('APPLE_IAP_ENVIRONMENT')??'',
 draw:drawCoins,
}));

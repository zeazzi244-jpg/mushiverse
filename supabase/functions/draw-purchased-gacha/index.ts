import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { authenticateSupabaseAccount } from '../_shared/supabase-account.ts';
import { createPaidDrawHandler } from '../_shared/paid-draw-handler.ts';
Deno.serve(createPaidDrawHandler({
  authenticate: authenticateSupabaseAccount,
  enabled:()=>Deno.env.get('APPLE_PAID_DRAWS_ENABLED')==='true',
  environment:()=>Deno.env.get('APPLE_IAP_ENVIRONMENT')??'',
  draw:async(drawID,count,account,environment)=>{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)throw Error('unavailable');
    const admin=createClient(url,key,{auth:{persistSession:false}});
    const {data,error}=await admin.rpc('draw_with_purchased_gacha_coins_v2',{
      p_draw_id:drawID,p_user_id:account.id,p_count:count,p_environment:environment,p_session_id:account.sessionID,
    });
    if(error||!data)throw Error('draw_unavailable');return data;
  },
}));

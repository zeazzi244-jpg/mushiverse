// Candidate entry point. Deployment is not authorized by this repository change.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createDeleteAccountHandler} from './handler.mjs';
Deno.serve(async(req:Request)=>{
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return new Response(JSON.stringify({deleted:false,error:'server_not_configured'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 return createDeleteAccountHandler({caller:createClient(url,anon,options),admin:createClient(url,service,options)})(req);
});

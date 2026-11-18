import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createDeleteAccountHandler } from './handler.mjs';

const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(async (request: Request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) {
    return new Response(JSON.stringify({ deleted: false, error: 'server_not_configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return createDeleteAccountHandler({
    caller: createClient(url, anon, options), admin: createClient(url, service, options),
  })(request);
});

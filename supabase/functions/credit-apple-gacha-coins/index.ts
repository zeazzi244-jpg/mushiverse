import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fail-closed staging endpoint. No coin credit until Apple JWS verification is implemented.
const json = (data: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(auth)) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return json({ error: "unavailable" }, 503);
  try {
    const client = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
    // Apple transaction verification is not yet available. Never grant coins here.
    return json({ error: "apple_verification_not_configured", credited_or_previously_credited: false }, 503);
  } catch {
    return json({ error: "unavailable" }, 503);
  }
});

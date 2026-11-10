import { Buffer } from 'node:buffer';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const authenticateSupabaseAccount = async (bearer: string) => {
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw Error('unavailable');
    const client = createClient(url, key, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return null;
    // Decode ONLY AFTER getUser has independently validated this JWT with Supabase Auth.
    // The session ID is checked against auth.sessions again inside the atomic SQL operation.
    const claims = JSON.parse(Buffer.from(bearer.replace(/^Bearer\s+/i, '').split('.')[1], 'base64url').toString('utf8'));
    if (claims.sub !== data.user.id || typeof claims.session_id !== 'string' || !uuid.test(claims.session_id)) return null;
    return { id: data.user.id, sessionID: claims.session_id };
};

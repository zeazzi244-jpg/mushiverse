const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export function createDeleteAccountHandler({ caller, admin, now = Date.now, randomUUID = () => crypto.randomUUID() }) {
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ deleted: false, error: 'method_not_allowed' }, 405);
    let userId, requestId, worker;
    const step = async (action, extra = {}) => {
      const result = await admin.rpc('account_deletion_step_v21', {
        p_action: action, p_request: requestId, p_user: userId || null, p_worker: worker || null, ...extra,
      });
      if (result.error) throw new Error('deletion_step_failed');
      return result.data;
    };
    try {
      const raw = await request.text();
      if (raw.length > 2048) return json({ deleted: false, error: 'request_too_large' }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return json({ deleted: false, error: 'invalid_json' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).some(key => !['action', 'request_id', 'confirmation'].includes(key))) {
        return json({ deleted: false, error: 'invalid_body' }, 400);
      }
      requestId = body.request_id;
      if (!UUID.test(requestId || '')) return json({ deleted: false, error: 'invalid_request_id' }, 400);
      // The random receipt is a capability for a boolean result only. It exposes
      // no account ID, email, or content and cannot start or resume deletion.
      if (body.action === 'status') {
        const status = await step('status');
        return json({ deleted: status.deleted === true, pending: status.pending === true });
      }
      if (body.action !== 'delete' || body.confirmation !== 'DELETE_MY_ACCOUNT') {
        return json({ deleted: false, error: 'confirmation_required' }, 400);
      }
      const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
      if (!token) return json({ deleted: false, error: 'unauthorized' }, 401);
      const verified = await caller.auth.getUser(token);
      const account = verified.data?.user;
      if (verified.error || !account?.id) return json({ deleted: false, error: 'unauthorized' }, 401);
      userId = account.id;
      // getUser validated this JWT at the Auth server. Only then inspect its
      // signed password-authentication time, never a timestamp supplied in body.
      let claims;
      try { claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
      catch { return json({ deleted: false, error: 'unauthorized' }, 401); }
      const passwordTime = Math.max(0, ...(claims.amr || []).filter(a => a.method === 'password').map(a => a.timestamp));
      if (claims.sub !== userId || !claims.session_id || !Number.isFinite(passwordTime) ||
          now() / 1000 - passwordTime > 300 || passwordTime > now() / 1000 + 30) {
        return json({ deleted: false, error: 'reauthentication_required' }, 403);
      }
      worker = randomUUID();
      const started = await step('begin', { p_session: claims.session_id });
      if (started.error) return json({ deleted: false, error: started.error, request_id: started.request_id }, ['busy', 'existing_request'].includes(started.error) ? 409 : 403);
      if (started.deleted) return json({ deleted: true });
      if (!started.accepted) throw new Error('deletion_not_started');
      requestId = started.request_id;
      // Account writes are now denied by restrictive RLS. Enumerate through the
      // server inventory, including legacy paths and objects owned outside /uid/.
      for (let batch = 0; batch < 100; batch++) {
        await step('renew');
        const inventory = await step('inventory');
        if (!inventory.objects.length) break;
        const buckets = new Map();
        for (const object of inventory.objects) {
          if (!buckets.has(object.bucket_id)) buckets.set(object.bucket_id, []);
          buckets.get(object.bucket_id).push(object.name);
        }
        for (const [bucket, paths] of buckets) {
          const removed = await admin.storage.from(bucket).remove(paths);
          if (removed.error) throw new Error('photo_delete_failed');
        }
        if (batch === 99) throw new Error('more_photos_retry');
      }
      await step('cleanup');
      const result = await admin.auth.admin.deleteUser(userId, false);
      if (result.error) throw new Error('auth_delete_failed');
      // Completion additionally checks auth.users absence inside PostgreSQL.
      const complete = await step('complete');
      if (!complete.deleted) throw new Error('completion_unconfirmed');
      return json({ deleted: true, request_id: requestId });
    } catch (error) {
      // A lost response after Auth deletion is reconciled by the same receipt.
      // An error before that point always remains incomplete and retryable.
      if (worker && userId) {
        try {
          const status = await step('status');
          if (status.deleted) return json({ deleted: true });
          await step('release');
        } catch { /* Keep the lock until its bounded lease expires. */ }
      }
      console.error('account_deletion_v21_failed', { request_id: requestId, stage: error.message });
      return json({ deleted: false, error: 'deletion_incomplete', retryable: true, request_id: requestId }, 503);
    }
  };
}

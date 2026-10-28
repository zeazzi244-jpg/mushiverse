import { validateCoinTransaction } from './apple-coin-policy.ts';

export type AuthenticatedAccount = { id: string; sessionID: string };
export type CreditDependencies = {
  authenticate: (bearer: string) => Promise<AuthenticatedAccount | null>;
  enabled: () => boolean;
  verify: (signed: string, account: AuthenticatedAccount) => Promise<Record<string, unknown>>;
  credit: (tx: Record<string, unknown>, account: AuthenticatedAccount) => Promise<boolean>;
  environment: () => string;
};
const json = (data: Record<string, unknown>, status: number) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Bounded by bytes AND total time, including a stream that never finishes. No financial side effects.
export async function readPurchaseBody(request: Request, timeoutMS = 5000): Promise<string> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw Error('invalid_request');
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 32768)) throw Error('payload_too_large');
  const reader = request.body?.getReader(); if (!reader) throw Error('invalid_request');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('request_timeout')), timeoutMS); });
  try {
    const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]); if (done) break;
      size += value.byteLength; if (size > 32768) throw Error('payload_too_large');
      chunks.push(new Uint8Array(value));
    }
    const body = JSON.parse(await new Blob(chunks).text());
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.signed_transaction !== 'string' ||
        !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(body.signed_transaction)) throw Error('invalid_request');
    return body.signed_transaction;
  } finally {
    clearTimeout(timer);
    // Do not await cancellation: a hostile underlying stream can also stall cancel().
    void reader.cancel().catch(() => {});
  }
}

export function createAppleCreditHandler(deps: CreditDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const bearer = request.headers.get('authorization') ?? '';
    if (bearer.length > 8192 || !/^Bearer\s+\S+$/i.test(bearer)) return json({ error: 'unauthorized' }, 401);
    try {
      const account = await deps.authenticate(bearer);
      if (!account) return json({ error: 'unauthorized' }, 401);
      if (!deps.enabled()) return json({ error: 'apple_verification_not_configured', credited_or_previously_credited: false }, 503);
      let signed: string;
      try { signed = await readPurchaseBody(request); }
      catch (error) {
        const code = error instanceof Error ? error.message : 'invalid_request';
        return json({ error: code === 'payload_too_large' || code === 'request_timeout' ? code : 'invalid_request' }, code === 'payload_too_large' ? 413 : code === 'request_timeout' ? 408 : 400);
      }
      let tx: Record<string, unknown>;
      try {
        tx = await deps.verify(signed, account);
        validateCoinTransaction(tx, account.id, deps.environment());
      } catch { return json({ error: 'apple_verification_failed', credited_or_previously_credited: false }, 422); }
      // Verification and Apple lookup can take time. Recheck caller before privileged credit.
      const current = await deps.authenticate(bearer);
      if (!current || current.id !== account.id || current.sessionID !== account.sessionID) return json({ error: 'unauthorized' }, 401);
      if (!deps.enabled()) return json({ error: 'unavailable' }, 503);
      if (!await deps.credit(tx, current)) return json({ error: 'credit_unavailable' }, 503);
      return json({ credited_or_previously_credited: true, transaction_id: tx.transactionId, product_id: tx.productId }, 200);
    } catch { return json({ error: 'unavailable' }, 503); }
  };
}

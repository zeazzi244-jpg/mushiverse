import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.mjs';

const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receipt = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = 1780000000;
const token = 'header.' + Buffer.from(JSON.stringify({
  sub: user, session_id: user, amr: [{ method: 'password', timestamp: now }],
})).toString('base64url') + '.signature';
const body = { action: 'delete', request_id: receipt, confirmation: 'DELETE_MY_ACCOUNT' };

function setup({ busy = false, storageError = false } = {}) {
  const actions = [];
  let deleted = false;
  const handler = createDeleteAccountHandler({
    now: () => now * 1000,
    caller: { auth: { getUser: async value => ({ data: { user: value === token ? { id: user } : null } }) } },
    admin: {
      rpc: async (_name, params) => {
        const action = params.p_action;
        actions.push(action);
        if (action !== 'status') assert.equal(params.p_user, user);
        if (action === 'begin') return { data: busy ? { error: 'busy' } : { accepted: true, request_id: receipt } };
        if (action === 'inventory') return { data: { objects: storageError ? [{ bucket_id: 'insect-photos', name: user + '/test.jpg' }] : [] } };
        return { data: { deleted } };
      },
      storage: { from: () => ({ remove: async () => ({ error: new Error('Storage unavailable') }) }) },
      auth: { admin: { deleteUser: async id => {
        assert.equal(id, user);
        actions.push('deleteAuth');
        deleted = true;
        return {};
      } } },
    },
  });
  const request = (payload, authorization) => handler(new Request('https://example.invalid/delete-account', {
    method: 'POST', headers: authorization ? { Authorization: 'Bearer ' + authorization } : {}, body: JSON.stringify(payload),
  }));
  return { request, actions };
}

test('account deletion rejects unsigned requests and caller-supplied user IDs', async () => {
  const { request, actions } = setup();
  assert.equal((await request(body)).status, 401);
  assert.equal((await request({ ...body, user_id: receipt }, token)).status, 400);
  assert.deepEqual(actions, []);
});

test('concurrent requests cannot reach cleanup or Auth deletion', async () => {
  const { request, actions } = setup({ busy: true });
  assert.equal((await request(body, token)).status, 409);
  assert.deepEqual(actions, ['begin']);
});

test('storage failure leaves Auth intact and releases the worker for retry', async () => {
  const { request, actions } = setup({ storageError: true });
  const response = await request(body, token);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).deleted, false);
  assert.deepEqual(actions, ['begin', 'renew', 'inventory', 'status', 'release']);
});

test('success deletes only the verified account and can be recovered by receipt', async () => {
  const { request, actions } = setup();
  const response = await request(body, token);
  assert.equal((await response.json()).deleted, true);
  assert.deepEqual(actions, ['begin', 'renew', 'inventory', 'cleanup', 'deleteAuth', 'complete']);
  const recovered = await request({ action: 'status', request_id: receipt });
  assert.deepEqual(await recovered.json(), { deleted: true, pending: false });
});

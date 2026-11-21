import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(
 new URL('../supabase/migrations/20261121202000_remove_remaining_broad_rls.sql',import.meta.url),
 'utf8'
);
test('no remaining legacy permissive account-wide access for Apple or moderation tables',()=>{
  for(const table of ['apple_iap_events','apple_purchase_claims','content_reports','moderator_accounts'])
    assert.ok(sql.includes('DROP POLICY IF EXISTS account_active_v21 ON public.'+table),table);
  assert.match(sql,/REVOKE ALL ON public\.apple_iap_events, public\.apple_purchase_claims/);
  assert.match(sql,/REVOKE SELECT, UPDATE, DELETE/);
  assert.doesNotMatch(sql,/CREATE POLICY account_active_v21/);
});

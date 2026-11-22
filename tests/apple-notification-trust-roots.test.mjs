import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, X509Certificate} from 'node:crypto';

const notification=readFileSync(new URL('../supabase/functions/apple-refund-notifications/index.ts',import.meta.url),'utf8');
const productionVerifier=readFileSync(new URL('../supabase/functions/_shared/apple-production-coin-verifier.ts',import.meta.url),'utf8');
const g2=notification.match(/const APPLE_G2_ROOT_DER_BASE64 = "([^"]+)"/)?.[1];
const g3=productionVerifier.match(/export const APPLE_G3_ROOT_DER_BASE64 = "([^"]+)"/)?.[1];
const digest=value=>createHash('sha256').update(Buffer.from(value,'base64')).digest('hex').toUpperCase();

test('both trusted Apple roots match published DER certificate fingerprints',()=>{
  assert.ok(g2&&g3);
  assert.equal(digest(g2),'C2B9B042DD57830E7D117DAC55AC8AE19407D38E41D88F3215BC3A890444A050');
  assert.equal(digest(g3),'63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179');
  assert.match(new X509Certificate(Buffer.from(g2,'base64')).subject,/Apple Root CA - G2/);
  assert.match(new X509Certificate(Buffer.from(g3,'base64')).subject,/Apple Root CA - G3/);
});
test('notification verification remains cryptographic and revocation-checked',()=>{
  assert.match(notification,/const roots=\[g2Root,root\]/);
  assert.match(notification,/new SignedDataVerifier\(roots,true,Environment\.PRODUCTION,bundleId,appId\)/);
  assert.match(notification,/new SignedDataVerifier\(roots,true,Environment\.SANDBOX,bundleId\)/);
  assert.match(notification,/notification\.notificationType!=="REFUND"/);
  assert.match(notification,/verifier\.verifyAndDecodeTransaction\(data\.signedTransactionInfo\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverSandboxDate} from '../services/apple-sandbox-verifier/sandbox-date-recovery.mjs';

const now=Date.now();
const expected={environment:'Sandbox',transactionId:'123456789',originalTransactionId:'123456789',productId:'mushiverse.coins.100',appAccountToken:'11111111-1111-4111-8111-111111111111'};
const fresh={...expected,bundleId:'com.rikuto.mushiverse',type:'Consumable',quantity:1,inAppOwnershipType:'PURCHASED',purchaseDate:now-1000,signedDate:now};
const old={...fresh,signedDate:now-2000};
// Mock verified evidence only; no real credentials or Apple network calls.
test('date recovery fetches once and revalidates the new signed transaction',async()=>{
  let fetched=0,verified=0;
  const result=await recoverSandboxDate(old,expected,{fetchTransaction:async id=>{assert.equal(id,expected.transactionId);fetched++;return {signedTransactionInfo:'mock.signed.value'}},verifyTransaction:async()=>{verified++;return fresh}});
  assert.equal(fetched,1);assert.equal(verified,1);assert.equal(result.verified.coins,100);
});
test('date recovery refuses account mismatch without contacting Apple',async()=>{
  await assert.rejects(recoverSandboxDate({...old,appAccountToken:'other'},expected,{fetchTransaction:()=>assert.fail('unexpected lookup'),verifyTransaction:()=>fresh}),/invalid_signed_date/);
});
test('date recovery never credits evidence that still fails full policy',async()=>{
  for(const invalid of [old,{...fresh,productId:'mushiverse.coins.500'},{...fresh,revocationDate:now}])await assert.rejects(recoverSandboxDate(old,expected,{fetchTransaction:async()=>({signedTransactionInfo:'mock.signed.value'}),verifyTransaction:async()=>invalid}));
});
test('date recovery fails closed when upstream is unavailable',async()=>{
  await assert.rejects(recoverSandboxDate(old,expected,{fetchTransaction:async()=>{throw Error('network')},verifyTransaction:()=>assert.fail('unexpected verification')}),/apple_recovery_unavailable/);
  await assert.rejects(recoverSandboxDate(old,expected,{timeoutMs:5,fetchTransaction:()=>new Promise(()=>{}),verifyTransaction:()=>assert.fail('unexpected verification')}),/apple_recovery_unavailable/);
});

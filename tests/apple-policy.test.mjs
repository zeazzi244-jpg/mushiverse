import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCoinTransaction} from '../supabase/functions/_shared/apple-coin-policy.ts';
import {SignedDataVerifier,Environment} from '@apple/app-store-server-library';
const user='11111111-1111-4111-8111-111111111111',now=Date.now();
const tx={bundleId:'com.rikuto.mushiverse',environment:'Sandbox',type:'Consumable',inAppOwnershipType:'PURCHASED',quantity:1,appAccountToken:user,transactionId:'123456789',productId:'mushiverse.coins.100',purchaseDate:now-10000,signedDate:now-5000};
test('supported verified products and account UUID case normalization',()=>{
 for(const productId of ['mushiverse.coins.100','mushiverse.coins.550','mushiverse.coins.1200'])assert.equal(validateCoinTransaction({...tx,productId,appAccountToken:user.toUpperCase()},user,'Sandbox',now).productID,productId);
});
for(const [field,value] of Object.entries({bundleId:'wrong',environment:'Production',type:'Auto-Renewable Subscription',inAppOwnershipType:'FAMILY_SHARED',quantity:2,appAccountToken:'wrong',transactionId:'fake',productId:'toString',purchaseDate:now+100000,signedDate:NaN,revocationDate:now,revocationReason:0})){
 test('reject '+field,()=>assert.throws(()=>validateCoinTransaction({...tx,[field]:value},user,'Sandbox',now)));
}
test('reject unsupported environments and missing dates',()=>{
 assert.throws(()=>validateCoinTransaction({...tx,environment:'Xcode'},user,'Xcode',now));
 assert.throws(()=>validateCoinTransaction({...tx,signedDate:undefined},user,'Sandbox',now));
});
test('official Apple verifier rejects a forged JWS; policy is not proof of signature',async()=>{
 const verifier=new SignedDataVerifier([],true,Environment.SANDBOX,tx.bundleId,12345);
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 await assert.rejects(()=>verifier.verifyAndDecodeTransaction(b64({alg:'none'})+'.'+b64(tx)+'.fake'));
});

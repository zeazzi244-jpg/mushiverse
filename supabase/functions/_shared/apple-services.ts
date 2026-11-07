import { Buffer } from 'node:buffer';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from 'npm:@apple/app-store-server-library@3.1.0';
export function appleServices() {
  const env=Deno.env.get('APPLE_IAP_ENVIRONMENT');
  const privateKey=Deno.env.get('APPLE_IAP_PRIVATE_KEY'),keyID=Deno.env.get('APPLE_IAP_KEY_ID'),issuerID=Deno.env.get('APPLE_IAP_ISSUER_ID');
  const rootsJSON=Deno.env.get('APPLE_ROOT_CERTIFICATES_BASE64_JSON'),appID=Number(Deno.env.get('APPLE_APP_ID'));
  if((env!==Environment.SANDBOX&&env!==Environment.PRODUCTION)||!privateKey||!keyID||!issuerID||!rootsJSON||!Number.isSafeInteger(appID)||appID<=0)throw Error('unavailable');
  const roots=JSON.parse(rootsJSON);
  if(!Array.isArray(roots)||!roots.length||roots.some(x=>typeof x!=='string'||!x))throw Error('unavailable');
  return {environment:env,
    verifier:new SignedDataVerifier(roots.map(x=>Buffer.from(x,'base64')),true,env,'com.rikuto.mushiverse',appID),
    apple:new AppStoreServerAPIClient(privateKey,keyID,issuerID,'com.rikuto.mushiverse',env)};
}

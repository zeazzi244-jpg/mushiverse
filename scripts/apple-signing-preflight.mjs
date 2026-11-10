import {createPrivateKey,sign} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function inspectSigning(env=process.env,fetcher=fetch){
 const required=['ASC_KEY_ID','ASC_ISSUER_ID','ASC_API_KEY_P8_BASE64'];
 const missing=required.filter(name=>!env[name]);
 const report={state:'not_configured',missing,bundleID:'com.rikuto.mushiverse',appleAuthorization:'not_checked',provisioning:'not_checked',uploadPerformed:false};
 if(missing.length)return report;
 try{
  if(!/^[A-Z0-9]{10}$/.test(env.ASC_KEY_ID)||!/^[0-9a-f-]{36}$/i.test(env.ASC_ISSUER_ID))throw Error('invalid_identifiers');
  const encoded=env.ASC_API_KEY_P8_BASE64.replace(/\s/g,'');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('invalid_key_encoding');
  const key=createPrivateKey(Buffer.from(encoded,'base64'));
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('invalid_key_type');
  const now=Math.floor(Date.now()/1000),part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=part({alg:'ES256',kid:env.ASC_KEY_ID,typ:'JWT'})+'.'+part({iss:env.ASC_ISSUER_ID,iat:now,exp:now+120,aud:'appstoreconnect-v1'});
  const jwt=body+'.'+sign('sha256',Buffer.from(body),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const response=await fetcher('https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D='+report.bundleID,{method:'GET',headers:{Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {...report,state:'blocked',missing:[],appleAuthorization:'http_'+response.status};
  const result=await response.json();
  if(!Array.isArray(result.data)||!result.data.some(app=>app.attributes?.bundleId===report.bundleID))return {...report,state:'blocked',missing:[],appleAuthorization:'app_not_accessible'};
  return {...report,state:'read_only_api_verified',missing:[],appleAuthorization:'verified'};
 }catch{return {...report,state:'blocked',missing:[],appleAuthorization:'key_or_network_check_failed'}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const capacitor=JSON.parse(await readFile('capacitor.config.json','utf8'));
 if(capacitor.appId!=='com.rikuto.mushiverse')throw Error('unexpected_bundle_id');
 const report=await inspectSigning();
 // Report only safe status fields. No key, JWT, Apple response body or account data.
 await writeFile('signing-readiness.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(report.state==='blocked')process.exitCode=1;
}

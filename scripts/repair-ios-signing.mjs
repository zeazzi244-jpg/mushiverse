import {createPrivateKey, sign, createHash, X509Certificate} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const approvedID='3WMVSRYMNU';
const approvedSHA='6A9813ED76F204FB17385A5972E5D2EBB41E4B0B';
export function token(env=process.env) {
 const now=Math.floor(Date.now()/1000), part=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const body=part({alg:'ES256',kid:env.ASC_KEY_ID,typ:'JWT'})+'.'+part({iss:env.ASC_ISSUER_ID,iat:now,exp:now+120,aud:'appstoreconnect-v1'});
 return body+'.'+sign('sha256',Buffer.from(body),{key:createPrivateKey(Buffer.from(env.ASC_API_KEY_P8_BASE64,'base64')),dsaEncoding:'ieee-p1363'}).toString('base64url');
}
export async function apple(path,method='GET',data,fetcher=fetch) {
 const r=await fetcher('https://api.appstoreconnect.apple.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(30000)});
 if(!r.ok) throw Error('Apple '+method+' '+path.split('?')[0]+' HTTP '+r.status);
 return r.status===204?null:await r.json();
}
export function verifyApproved(cert) {
 const a=cert?.attributes;
 if(cert?.id!==approvedID || a?.certificateType!=='DEVELOPMENT' ||
 new X509Certificate(Buffer.from(a.certificateContent,'base64')).fingerprint.replaceAll(':','')!==approvedSHA)
 throw Error('Certificate differs from owner-approved identity');
}
async function prepare(){
 if(process.env.GITHUB_REF!=='refs/heads/codex/verified-changes-20261028') throw Error('Unexpected signing branch');
 const dir=process.env.RUNNER_TEMP, p12=join(dir,'signing-identity.p12');
 const pass=createHash('sha256').update('MUSHIVERSE signing backup v1\0').update(Buffer.from(process.env.ASC_API_KEY_P8_BASE64,'base64')).digest('hex');
 const env={...process.env,P12_PASSWORD:pass};
 const run=(command,args)=>execFileSync(command,args,{env,stdio:'pipe'});
 let restored=false;
 try {await readFile(p12);restored=true;} catch(e){if(e.code!=='ENOENT')throw e;}
 if(!restored){
  if(process.env.ROTATE_APPROVED_CERTIFICATE!=='true') throw Error('No signing backup. Explicit approved certificate repair required.');
  // Generate the replacement key/CSR locally BEFORE the scoped revocation.
  run('openssl',['genrsa','-out',join(dir,'signing.key'),'2048']);
  run('openssl',['req','-new','-key',join(dir,'signing.key'),'-out',join(dir,'signing.csr'),'-subj','/CN=MUSHIVERSE CI']);
  const current=await apple('certificates/'+approvedID);
  verifyApproved(current.data);
  await apple('certificates/'+approvedID,'DELETE');
  console.log('Revoked only owner-approved development certificate '+approvedID);
  const result=await apple('certificates','POST',{data:{type:'certificates',attributes:{certificateType:'DEVELOPMENT',csrContent:await readFile(join(dir,'signing.csr'),'utf8')}}});
  const cert=result.data;
  if(cert?.attributes?.certificateType!=='DEVELOPMENT')throw Error('Unexpected replacement certificate type');
  await writeFile(join(dir,'signing.cer'),Buffer.from(cert.attributes.certificateContent,'base64'),{mode:0o600});
  run('openssl',['x509','-inform','DER','-in',join(dir,'signing.cer'),'-out',join(dir,'signing.pem')]);
  run('openssl',['pkcs12','-export','-inkey',join(dir,'signing.key'),'-in',join(dir,'signing.pem'),'-out',p12,'-passout','env:P12_PASSWORD','-iter','100000']);
  console.log('Created replacement development certificate '+cert.id+'; encrypted backup prepared.');
 }
 // Validate the P12 before touching the temporary keychain.
 run('openssl',['pkcs12','-in',p12,'-passin','env:P12_PASSWORD','-clcerts','-nokeys','-out',join(dir,'signing.pem')]);
 const cert=new X509Certificate(await readFile(join(dir,'signing.pem')));
 const sha=cert.fingerprint.replaceAll(':','');
 const keychain=join(dir,'mushiverse-signing.keychain-db');
 run('security',['create-keychain','-p',pass,keychain]);
 run('security',['set-keychain-settings','-lut','21600',keychain]);
 run('security',['unlock-keychain','-p',pass,keychain]);
 run('security',['import',p12,'-P',pass,'-k',keychain,'-T','/usr/bin/codesign','-T','/usr/bin/security']);
 run('security',['list-keychains','-d','user','-s',keychain,join(process.env.HOME,'Library/Keychains/login.keychain-db')]);
 run('security',['default-keychain','-d','user','-s',keychain]);
 run('security',['set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',pass,keychain]);
 const identities=run('security',['find-identity','-v','-p','codesigning',keychain]).toString();
 if(!identities.includes(sha)) throw Error('Imported private key is not a usable signing identity');
 await writeFile(process.env.GITHUB_ENV,'SIGNING_SHA1='+sha+'\n',{flag:'a'});
 console.log(restored?'Restored encrypted signing identity.':'Imported replacement signing identity.');
}
if(process.argv[1]?.endsWith('/repair-ios-signing.mjs')){
 try {await prepare();}catch(e){console.error(e instanceof Error && e.message.startsWith('Apple ')?e.message:'Signing setup failed; inspect step status. No secrets printed.');process.exitCode=1;}
}

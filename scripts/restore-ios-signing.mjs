import {createPrivateKey, sign, createHash, X509Certificate} from 'node:crypto';
import {readFile, writeFile, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
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
async function prepare(){
 if(process.env.GITHUB_REF!=='refs/heads/main') throw Error('Unexpected signing branch');
 const dir=process.env.RUNNER_TEMP, p12=join(dir,'signing-identity.p12');
 const pass=createHash('sha256').update('MUSHIVERSE signing backup v1\0').update(Buffer.from(process.env.ASC_API_KEY_P8_BASE64,'base64')).digest('hex');
 const env={...process.env,P12_PASSWORD:pass};
 const run=(command,args)=>{
  try{return execFileSync(command,args,{env,stdio:'pipe'});}
  catch(e){
   const known=['MAC verification failed','Unknown format','User interaction is not allowed','The specified item already exists','unable to load certificates','invalid password','Unknown option'];
   const category=known.find(s=>String(e.stderr||'').includes(s))||'tool_error';
   console.error('Signing tool failed: '+command+' '+args[0]+'; status='+e.status+'; category='+category);
   throw e;
  }
 };
 // Validate the P12 before touching the temporary keychain.
 run('openssl',['pkcs12','-in',p12,'-passin','env:P12_PASSWORD','-clcerts','-nokeys','-out',join(dir,'signing.pem')]);
 const cert=new X509Certificate(await readFile(join(dir,'signing.pem')));
 const sha=cert.fingerprint.replaceAll(':','');
 const keychain=join(dir,'mushiverse-signing.keychain-db');
 run('security',['create-keychain','-p',pass,keychain]);
 run('security',['set-keychain-settings','-lut','21600',keychain]);
 run('security',['unlock-keychain','-p',pass,keychain]);
 // macOS Security may reject OpenSSL 3's default PKCS12 encoding. Convert only the
 // local import copy; retain the stronger original password-encrypted backup.
 const material=join(dir,'import-material.pem'), compatible=join(dir,'import-identity.p12');
 try {
  run('openssl',['pkcs12','-in',p12,'-passin','env:P12_PASSWORD','-nodes','-out',material]);
  run('openssl',['pkcs12','-export','-in',material,'-out',compatible,'-passout','env:P12_PASSWORD','-keypbe','PBE-SHA1-3DES','-certpbe','PBE-SHA1-3DES','-macalg','sha1','-iter','100000']);
  run('security',['import',compatible,'-P',pass,'-k',keychain,'-T','/usr/bin/codesign','-T','/usr/bin/security']);
 } finally {await rm(material,{force:true}); await rm(compatible,{force:true});}
 run('security',['list-keychains','-d','user','-s',keychain,join(process.env.HOME,'Library/Keychains/login.keychain-db')]);
 run('security',['default-keychain','-d','user','-s',keychain]);
 run('security',['set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',pass,keychain]);
 const identities=run('security',['find-identity','-v','-p','codesigning',keychain]).toString();
 if(!identities.includes(sha)) throw Error('Imported private key is not a usable signing identity');
 await writeFile(process.env.GITHUB_ENV,'SIGNING_SHA1='+sha+'\n',{flag:'a'});
 console.log('Restored encrypted signing identity.');
}
if(process.argv[1]?.endsWith('/restore-ios-signing.mjs')){
 try {await prepare();}catch(e){console.error(e instanceof Error && e.message.startsWith('Apple ')?e.message:'Signing setup failed; inspect step status. No secrets printed.');process.exitCode=1;}
}

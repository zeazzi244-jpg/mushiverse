import {createPrivateKey, sign, X509Certificate} from 'node:crypto';
export async function inspectCertificates(env = process.env, fetcher = fetch) {
  const key = createPrivateKey(Buffer.from(env.ASC_API_KEY_P8_BASE64, 'base64'));
  const now = Math.floor(Date.now() / 1000);
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = part({alg:'ES256',kid:env.ASC_KEY_ID,typ:'JWT'}) + '.' +
    part({iss:env.ASC_ISSUER_ID,iat:now,exp:now+120,aud:'appstoreconnect-v1'});
  const jwt = body + '.' + sign('sha256',Buffer.from(body),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const response = await fetcher('https://api.appstoreconnect.apple.com/v1/certificates?limit=200',
    {method:'GET',headers:{Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(15000)});
  if (!response.ok) return {state:'unavailable',httpStatus:response.status,mutationsPerformed:false};
  const result = await response.json();
  if (!Array.isArray(result.data)) throw Error('invalid_certificate_response');
  return {state:'read_only_inventory',mutationsPerformed:false,truncated:Boolean(result.links?.next),
    certificates:result.data.map(({id,attributes:a}) => {
      const fingerprint = new X509Certificate(Buffer.from(a.certificateContent,'base64')).fingerprint.replaceAll(':','');
      return {id,type:a.certificateType,expires:a.expirationDate,sha1:fingerprint,
        matchesV139:fingerprint==='6A9813ED76F204FB17385A5972E5D2EBB41E4B0B'};
    })};
}
if (process.argv[1]?.endsWith('/inspect-apple-certificates.mjs')) {
  try { console.log(JSON.stringify(await inspectCertificates())); }
  catch { console.error('Certificate inventory unavailable; no certificate changes made.'); process.exitCode=1; }
}

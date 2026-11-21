import {createCipheriv, createPublicKey, publicEncrypt, randomBytes} from 'node:crypto';
import {readReviewStatus} from './status.mjs';

const recipient = createPublicKey({key:Buffer.from(process.env.REPORT_PUBLIC_KEY,'base64'),format:'der',type:'spki'});
if (recipient.asymmetricKeyType !== 'rsa' || recipient.asymmetricKeyDetails.modulusLength < 3072) throw Error('Expected RSA key of at least 3072 bits');
const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm',key,iv);
const data = Buffer.concat([cipher.update(JSON.stringify(await readReviewStatus()),'utf8'),cipher.final()]);
const wrapped = publicEncrypt({key:recipient,oaepHash:'sha256'},key);
console.log(JSON.stringify(Object.fromEntries(Object.entries({wrapped,iv,data,tag:cipher.getAuthTag()}).map(([name,bytes])=>[name,bytes.toString('base64')]))));

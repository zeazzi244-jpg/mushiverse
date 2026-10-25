import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd();
const files=['index.html','www/index.html'];
for(const f of files){const path=join(root,f);if(!existsSync(path))throw Error('Missing '+f);if(statSync(path).size<1000)throw Error('Unexpectedly small '+f);}
const source=readFileSync(join(root,'index.html'),'utf8');
const bundle=readFileSync(join(root,'www/index.html'),'utf8');
for(const token of ['<html','</html>','mushiverse-version','id="feed"','id="home"','id="profile"']){
 if(!source.includes(token)||!bundle.includes(token))throw Error('Web bundle missing marker: '+token);
}
if(source!==bundle)throw Error('Bundled index.html does not match source index.html');
const config=JSON.parse(readFileSync(join(root,'capacitor.config.json'),'utf8'));
if(config.webDir!=='www')throw Error('Capacitor webDir must be www');
if(!config.appId||!/^([A-Za-z][A-Za-z0-9-]*\.)+[A-Za-z][A-Za-z0-9-]*$/.test(config.appId))throw Error('Invalid appId format');
if(config.appId==='com.mushiverse.prototype')console.warn('WARNING: temporary appId — replace with App Store Connect bundle identifier before native archive.');
console.log('PASS: web bundle integrity and Capacitor config structure');

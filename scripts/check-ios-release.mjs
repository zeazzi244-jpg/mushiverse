import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const config=JSON.parse(readFileSync('capacitor.config.json','utf8'));
const problems=[];
if(config.appId==='com.mushiverse.prototype')problems.push('Bundle ID is still the temporary prototype value');
if(!existsSync(join('ios','App','App.xcodeproj','project.pbxproj')))problems.push('Native Xcode project not generated');
if(!existsSync('www/index.html'))problems.push('Bundled web assets missing (run npm run build:web)');
if(config.server?.url)problems.push('Remote server.url is configured: production app must package its local assets');
if(problems.length){console.error('NOT READY FOR iOS RELEASE:\n'+problems.map((s,i)=>`${i+1}. ${s}`).join('\n'));process.exitCode=1}
else console.log('Basic native structure present. Requires real signing, device tests, and App Store review separately.');

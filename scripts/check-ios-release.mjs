import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import xcode from 'xcode';
import {validateSwiftSources} from './ios-project-paths.mjs';
const config=JSON.parse(readFileSync('capacitor.config.json','utf8'));
const problems=[];
if(config.appId!=='com.rikuto.mushiverse')problems.push('Bundle ID does not match the App Store Connect app: com.rikuto.mushiverse');
if(!existsSync(join('ios','App','App.xcodeproj','project.pbxproj')))problems.push('Native Xcode project not generated');
if(!existsSync('www/index.html'))problems.push('Bundled web assets missing (run npm run build:web)');
if(config.webDir!=='www')problems.push('Capacitor webDir must be www for the generated web bundle');
if(config.server?.url)problems.push('Remote server.url is configured: production app must package its local assets');
const nativeRoot=join('ios','App','App');
const approvedIcon=join('assets','MUSHIVERSE-AppIcon-1024.png');
const nativeIcon=join(nativeRoot,'Assets.xcassets','AppIcon.appiconset','AppIcon-512@2x.png');
if(!existsSync(approvedIcon)||!existsSync(nativeIcon)) problems.push('Approved iOS icon files are missing');
else {
 const icon=readFileSync(approvedIcon);
 if(icon.length<33||!icon.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||icon.readUInt32BE(16)!==1024||icon.readUInt32BE(20)!==1024||icon[25]!==2) problems.push('Approved icon must be a 1024x1024 RGB PNG');
 if(!icon.equals(readFileSync(nativeIcon))) problems.push('Native icon does not match approved artwork');
}
const iconMetadata=join(nativeRoot,'Assets.xcassets','AppIcon.appiconset','Contents.json');
try {
 const {images}=JSON.parse(readFileSync(iconMetadata,'utf8'));
 if(!images?.some(image=>image.filename==='AppIcon-512@2x.png' && image.size==='1024x1024')){
  problems.push('AppIcon Contents.json does not match the approved icon');
 }
} catch(error) {
 problems.push('Invalid AppIcon metadata: '+error.message);
}
const nativeWebRoot = join(nativeRoot, 'public');
for (const asset of [
 'index.html',
 'css/adventure-ui.css',
 'assets/ai-insect-collection.mjs',
 'assets/vendor/supabase.js',
 'assets/vendor/leaflet/leaflet.js',
 'assets/vendor/leaflet/leaflet.css',
 'docs/ai_insect_catalog_v1.json',
]) {
 const webAsset = join('www', asset);
 const nativeAsset = join(nativeWebRoot, asset);
 if (!existsSync(webAsset) || !existsSync(nativeAsset)) {
  problems.push('Missing iOS web asset: ' + asset + ' (run npm run ios:sync)');
  continue;
 }
 const expected = readFileSync(webAsset);
 if (!expected.length || !expected.equals(readFileSync(nativeAsset))) {
  problems.push('Empty or stale iOS web asset: ' + asset + ' (run npm run ios:sync)');
 }
}

const projectPath=join('ios','App','App.xcodeproj','project.pbxproj');
if(existsSync(projectPath)){
 const project=readFileSync(projectPath,'utf8');
 const parsed=xcode.project(projectPath);parsed.parseSync();problems.push(...validateSwiftSources(parsed,resolve('ios/App')));
 for(const name of ['MushiverseCoinStore.swift','MushiverseCoinShopView.swift','MushiverseBridgeViewController.swift']){
  if(!existsSync(join(nativeRoot,name))||!project.includes(`${name} in Sources`))problems.push(`Native source is not in target: ${name}`);
 }
 const plist=readFileSync(join(nativeRoot,'Info.plist'),'utf8');
 for(const key of ['NSCameraUsageDescription','NSPhotoLibraryUsageDescription','NSLocationWhenInUseUsageDescription']){
  if(!plist.includes(`<key>${key}</key>`))problems.push(`Missing privacy usage: ${key}`);
 }
 const storyboard=readFileSync(join(nativeRoot,'Base.lproj','Main.storyboard'),'utf8');
 if(!storyboard.includes('customClass="MushiverseBridgeViewController"'))problems.push('Custom Capacitor bridge controller is not connected');
}
if(problems.length){console.error('NOT READY FOR iOS RELEASE:\n'+problems.map((s,i)=>`${i+1}. ${s}`).join('\n'));process.exitCode=1}
else console.log('Basic native structure present. Requires real signing, device tests, and App Store review separately.');

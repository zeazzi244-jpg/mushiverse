import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const config=JSON.parse(readFileSync('capacitor.config.json','utf8'));
const problems=[];
if(config.appId!=='com.rikuto.mushiverse')problems.push('Bundle ID does not match the App Store Connect app: com.rikuto.mushiverse');
if(!existsSync(join('ios','App','App.xcodeproj','project.pbxproj')))problems.push('Native Xcode project not generated');
if(!existsSync('www/index.html'))problems.push('Bundled web assets missing (run npm run build:web)');
if(config.webDir!=='www')problems.push('Capacitor webDir must be www for the generated web bundle');
if(config.server?.url)problems.push('Remote server.url is configured: production app must package its local assets');
const nativeRoot=join('ios','App','App');
const projectPath=join('ios','App','App.xcodeproj','project.pbxproj');
if(existsSync(projectPath)){
 const project=readFileSync(projectPath,'utf8');
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

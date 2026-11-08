import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Place the approved 1024x1024 PNG at assets/MUSHIVERSE-AppIcon-1024.png.
// Run after `npx cap add ios` or `npx cap sync ios`.
const root = process.cwd();
const source = join(root, 'assets', 'MUSHIVERSE-AppIcon-1024.png');
const dest = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
if (!existsSync(source)) {
  console.error('Missing approved icon PNG: ' + source);
  process.exit(1);
}
if (!existsSync(join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'))) {
  console.error('Missing native iOS project. Run npm run ios:add first.');
  process.exit(1);
}
const bytes = readFileSync(source);
const validPng = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
const width = validPng ? bytes.readUInt32BE(16) : 0;
const height = validPng ? bytes.readUInt32BE(20) : 0;
const colorType = validPng ? bytes[25] : -1;
if (width !== 1024 || height !== 1024 || ![2,6].includes(colorType)) {
  console.error('Approved icon must be a 1024x1024 RGB/RGBA PNG.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
copyFileSync(source, join(dest, 'AppIcon-512@2x.png'));
writeFileSync(join(dest, 'Contents.json'), JSON.stringify({images:[{filename:'AppIcon-512@2x.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}}, null, 2) + '\n');
console.log('Approved MUSHIVERSE app icon installed into iOS asset catalog.');

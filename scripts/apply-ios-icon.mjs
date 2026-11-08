import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
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
mkdirSync(dest, { recursive: true });
copyFileSync(source, join(dest, 'AppIcon-512@2x.png'));
writeFileSync(join(dest, 'Contents.json'), JSON.stringify({images:[{filename:'AppIcon-512@2x.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}}, null, 2) + '\n');
console.log('Approved MUSHIVERSE app icon installed into iOS asset catalog.');

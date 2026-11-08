import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const problems = [];
const icon = join('ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const image = join(icon, 'AppIcon-512@2x.png');
const metadata = join(icon, 'Contents.json');
if (config.appId !== 'com.rikuto.mushiverse') problems.push('Bundle ID does not match com.rikuto.mushiverse');
if (!existsSync(join('ios', 'App', 'App.xcodeproj', 'project.pbxproj'))) problems.push('Native Xcode project not generated');
if (!existsSync('www/index.html')) problems.push('Bundled web assets missing');
if (config.webDir !== 'www') problems.push('Capacitor webDir must be www');
if (config.server?.url) problems.push('Remote server.url is not allowed for offline packaged release');
if (!existsSync(image) || !existsSync(metadata)) problems.push('Approved AppIcon assets are missing');
else {
  try {
    const bytes = readFileSync(image);
    const png = bytes.length > 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (!png || bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024 || bytes[25] !== 2) {
      problems.push('AppIcon must be 1024x1024 opaque RGB PNG');
    }
    const data = JSON.parse(readFileSync(metadata, 'utf8'));
    if (!data.images?.some(x => x.filename === 'AppIcon-512@2x.png' && x.size === '1024x1024')) problems.push('AppIcon Contents.json does not match');
  } catch (error) { problems.push('Invalid AppIcon metadata or PNG: ' + error.message); }
}
if (problems.length) {
  console.error('NOT READY FOR iOS RELEASE:\n' + problems.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  process.exitCode = 1;
} else console.log('Local iOS assets verified. Signing, device testing and App Store approval still required.');

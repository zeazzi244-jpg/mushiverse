import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const problems = [];
const icon = join('ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const image = join(icon, 'AppIcon-512@2x.png');
const metadata = join(icon, 'Contents.json');
const approvedSource = join('assets', 'MUSHIVERSE-AppIcon-1024.png');
const theme = join('www', 'css', 'adventure-ui.css');
if (config.appId !== 'com.rikuto.mushiverse') problems.push('Bundle ID does not match com.rikuto.mushiverse');
if (!existsSync(join('ios', 'App', 'App.xcodeproj', 'project.pbxproj'))) problems.push('Native Xcode project not generated');
if (!existsSync('www/index.html')) problems.push('Bundled web assets missing');
if (!existsSync(theme)) problems.push('Adventure UI stylesheet missing from bundled web assets');
if (existsSync('www/index.html')) {
  try {
    const html = readFileSync('www/index.html', 'utf8');
    if (!/<body\b/i.test(html) || !/<\/body\s*>/i.test(html) ||
        !/<\/html\s*>/i.test(html) || !/<script\b/i.test(html)) {
      problems.push('Bundled index.html is incomplete or missing app startup markup');
    }
    if (!html.includes('adventure-ui.css')) {
      problems.push('Bundled index.html does not reference the forest theme');
    }
  } catch (error) { problems.push('Unable to read bundled index.html: ' + error.message); }
}
if (existsSync(theme)) {
  try {
    const css = readFileSync(theme, 'utf8');
    if (!css.trim() || !css.includes('--mv-surface')) {
      problems.push('Bundled adventure stylesheet is empty or missing its palette');
    }
  } catch (error) { problems.push('Unable to read bundled stylesheet: ' + error.message); }
}
if (!existsSync(approvedSource)) problems.push('Approved source icon missing');
if (config.webDir !== 'www') problems.push('Capacitor webDir must be www');
if (config.server?.url) problems.push('Remote server.url is not allowed for offline packaged release');
if (config.server?.cleartext === true) problems.push('Cleartext WebView traffic is forbidden for App Store release');
if (Array.isArray(config.server?.allowNavigation) && config.server.allowNavigation.length > 0) problems.push('WebView allowNavigation must be empty for offline packaged release');
if (config.server?.allowNavigation && !Array.isArray(config.server.allowNavigation)) problems.push('Invalid WebView allowNavigation configuration');
if (!existsSync(image) || !existsSync(metadata)) problems.push('Approved AppIcon assets are missing');
else {
  try {
    const bytes = readFileSync(image);
    const png = bytes.length > 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (!png || bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024 || bytes[25] !== 2) {
      problems.push('AppIcon must be 1024x1024 opaque RGB PNG');
    }
    if (existsSync(approvedSource)) {
      const digest = bytes => createHash('sha256').update(bytes).digest('hex');
      if (digest(bytes) !== digest(readFileSync(approvedSource))) problems.push('Native AppIcon differs from approved source PNG');
    }
    const data = JSON.parse(readFileSync(metadata, 'utf8'));
    if (!data.images?.some(x => x.filename === 'AppIcon-512@2x.png' && x.size === '1024x1024')) problems.push('AppIcon Contents.json does not match');
  } catch (error) { problems.push('Invalid AppIcon metadata or PNG: ' + error.message); }
}
if (problems.length) {
  console.error('NOT READY FOR iOS RELEASE:\n' + problems.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  process.exitCode = 1;
} else console.log('Local iOS assets verified. Signing, device testing and App Store approval still required.');

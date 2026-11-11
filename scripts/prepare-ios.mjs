import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
const project = join('ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const icon = join('assets', 'MUSHIVERSE-AppIcon-1024.png');
if (!existsSync(icon)) {
  console.error('Approved icon missing: ' + icon + '. Do not ship a placeholder.');
  process.exit(1);
}
// Fail before touching the native project when the approved source is invalid.
const bytes = readFileSync(icon);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const validIcon = bytes.length >= 33
  && bytes.subarray(0, 8).equals(pngSignature)
  && bytes.toString('ascii', 12, 16) === 'IHDR'
  && bytes.readUInt32BE(16) === 1024
  && bytes.readUInt32BE(20) === 1024
  && bytes[24] === 8
  && bytes[25] === 2;
if (!validIcon) {
  console.error('Approved icon must be a 1024x1024 8-bit opaque RGB PNG: ' + icon);
  process.exit(1);
}
run('npm', ['run', 'build:web']);
if (!existsSync(project)) run('npx', ['cap', 'add', 'ios']);
else run('npx', ['cap', 'sync', 'ios']);
run('npm', ['run', 'ios:icon']);
run('npm', ['run', 'ios:check']);
console.log('iOS assets prepared. Archive and upload with Xcode/App Store Connect.');

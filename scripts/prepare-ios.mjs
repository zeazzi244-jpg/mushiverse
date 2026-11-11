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
  && bytes[25] === 2
  && bytes[26] === 0 // PNG compression method
  && bytes[27] === 0 // PNG filter method
  && bytes[28] === 0; // Non-interlaced, as required for the approved icon
// Verify the chunk boundaries and a terminal IEND chunk, not only the header.
// A truncated PNG can have a valid IHDR but still fail during icon generation.
let offset = 8;
let hasIend = false;
while (validIcon && offset + 12 <= bytes.length) {
  const length = bytes.readUInt32BE(offset);
  const end = offset + 12 + length;
  if (end > bytes.length) break;
  const type = bytes.toString('ascii', offset + 4, offset + 8);
  if (type === 'IEND') {
    hasIend = length === 0 && end === bytes.length;
    break;
  }
  offset = end;
}
if (!validIcon || !hasIend) {
  console.error('Approved icon must be a complete 1024x1024 8-bit opaque RGB PNG: ' + icon);
  process.exit(1);
}
run('npm', ['run', 'build:web']);
if (!existsSync(project)) run('npx', ['cap', 'add', 'ios']);
else run('npx', ['cap', 'sync', 'ios']);
run('npm', ['run', 'ios:icon']);
run('npm', ['run', 'ios:check']);
console.log('iOS assets prepared. Archive and upload with Xcode/App Store Connect.');

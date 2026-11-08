import { existsSync } from 'node:fs';
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
run('npm', ['run', 'build:web']);
if (!existsSync(project)) run('npx', ['cap', 'add', 'ios']);
else run('npx', ['cap', 'sync', 'ios']);
run('npm', ['run', 'ios:icon']);
run('npm', ['run', 'ios:check']);
console.log('iOS assets prepared. Archive and upload with Xcode/App Store Connect.');

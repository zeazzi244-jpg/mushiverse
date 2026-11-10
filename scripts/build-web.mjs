import { existsSync, mkdirSync, readdirSync, cpSync, copyFileSync, rmSync, lstatSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const root = process.cwd();
const entry = join(root, 'index.html');
if (!existsSync(entry)) throw new Error('Root index.html not found');

const out = join(root, 'www');
const allowedExtensions = new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.mp3','.wav','.webmanifest']);
const excluded = new Set(['node_modules','ios','android','www','.git','.github','scripts']);
const publicFolders = new Set(['assets','images','img','css','js','fonts','media']);

function allowedName(name) {
  const lower = name.toLowerCase();
  if (lower.startsWith('.') || lower.endsWith('~') || lower.endsWith('.map')) return false;
  if (/(?:^|[._-])(secret|private|backup|credential|credentials)(?:[._-]|$)/i.test(lower)) return false;
  if (/\.(?:pem|key|p12|p8|mobileprovision|bak|orig|log|md|ts|tsx)$/i.test(lower)) return false;
  return true;
}
function allowedFile(path) {
  const name = basename(path);
  return allowedName(name) && allowedExtensions.has(extname(name).toLowerCase()) &&
    !['package.json','capacitor.config.json'].includes(name.toLowerCase());
}
function safeAsset(source) {
  const info = lstatSync(source);
  // Do not follow links into the user's filesystem or copy unexpected file types.
  if (info.isSymbolicLink()) return false;
  if (!allowedName(basename(source))) return false;
  return info.isDirectory() || (info.isFile() && allowedFile(source));
}

// Build into a fresh directory. Preserve only explicitly public files.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of readdirSync(root)) {
  if (excluded.has(name) || !allowedName(name)) continue;
  const src = join(root, name);
  const info = lstatSync(src);
  if (info.isSymbolicLink()) continue;
  if (info.isDirectory()) {
    if (publicFolders.has(name)) {
      cpSync(src, join(out, name), { recursive: true, filter: safeAsset });
    }
  } else if (info.isFile() && allowedFile(src)) {
    copyFileSync(src, join(out, name));
  }
}
if (!existsSync(join(out, 'index.html'))) throw new Error('Release bundle has no index.html');
console.log('Web bundle generated at www/ — validate native startup and offline features before submission.');

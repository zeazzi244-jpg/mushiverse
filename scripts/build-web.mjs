import { existsSync, mkdirSync, readdirSync, cpSync, copyFileSync, rmSync, lstatSync, renameSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const root = process.cwd();
const entry = join(root, 'index.html');
if (!existsSync(entry)) throw new Error('Root index.html not found');

const out = join(root, 'www');
const staging = join(root, 'www-build-staging');
const allowedExtensions = new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.mp3','.wav','.webmanifest']);
const excluded = new Set(['node_modules','ios','android','www','www-build-staging','www-build-previous','.git','.github','scripts']);
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

// Recover a validated bundle if the previous process stopped after moving www
// to its backup but before completing the staging swap. Never erase this backup
// merely because a new build starts.
const backup = join(root, 'www-build-previous');
if (!existsSync(out) && existsSync(backup)) renameSync(backup, out);

// Preflight source assets before deleting a previously usable offline bundle.
const { readFileSync } = await import('node:fs');
const sourceHtml = readFileSync(entry, 'utf8');
const sourceCssPath = join(root, 'css', 'adventure-ui.css');
if (!existsSync(sourceCssPath) || !lstatSync(sourceCssPath).isFile()) {
  throw new Error('Source adventure stylesheet is missing');
}
const sourceCss = readFileSync(sourceCssPath, 'utf8');
if (!/<body\b/i.test(sourceHtml) || !/<script\b/i.test(sourceHtml) ||
    !sourceHtml.includes('adventure-ui.css')) {
  throw new Error('Source index.html is missing required app startup markup');
}
if (!sourceCss.trim() || !sourceCss.includes('--mv-surface')) {
  throw new Error('Source adventure stylesheet is empty or missing its forest palette');
}

// Build into a fresh directory. Preserve only explicitly public files.
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
for (const name of readdirSync(root)) {
  if (excluded.has(name) || !allowedName(name)) continue;
  const src = join(root, name);
  const info = lstatSync(src);
  if (info.isSymbolicLink()) continue;
  if (info.isDirectory()) {
    if (publicFolders.has(name)) {
      cpSync(src, join(staging, name), { recursive: true, filter: safeAsset });
    }
  } else if (info.isFile() && allowedFile(src)) {
    copyFileSync(src, join(staging, name));
  }
}
if (!existsSync(join(staging, 'index.html'))) throw new Error('Release bundle has no index.html');
// Fail the build before shipping a blank or unstyled native WebView.
// These are required local startup assets, not optional network resources.
const requiredAssets = ['index.html', 'css/adventure-ui.css'];
for (const relative of requiredAssets) {
  const target = join(staging, relative);
  if (!existsSync(target) || !lstatSync(target).isFile()) {
    throw new Error('Release bundle is missing required startup asset: ' + relative);
  }
}
const html = readFileSync(join(staging, 'index.html'), 'utf8');
if (!/<body\b/i.test(html) || !/<script\b/i.test(html)) {
  throw new Error('Release index.html has no app body or startup script');
}
// A zero-byte stylesheet can leave the native WebView unreadable even when the file exists.
const adventureCss = readFileSync(join(staging, 'css/adventure-ui.css'), 'utf8');
if (!adventureCss.trim() || !adventureCss.includes('--mv-surface')) {
  throw new Error('Release adventure stylesheet is empty or missing its forest palette');
}
if (!html.includes('adventure-ui.css')) {
  throw new Error('Release index.html does not reference the bundled adventure UI stylesheet');
}
// Validate local script and stylesheet URLs in the staged entry point. A missing
// startup dependency can produce a blank iOS WebView despite a valid index.html.
for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/gi)) {
  const url = match[1].split(/[?#]/, 1)[0];
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue; // Remote assets
  let normalized;
  try { normalized = decodeURIComponent(url).replace(/^\/?/, ''); }
  catch { throw new Error('Release bundle has invalid startup asset URL: ' + url); }
  const segments = normalized.split('/');
  if (segments.includes('..') || !normalized || !existsSync(join(staging, normalized))) {
    throw new Error('Release bundle is missing referenced startup asset: ' + url);
  }
}

// Only replace the previously usable offline bundle after all checks succeed.
if (existsSync(out)) {
  // A leftover backup is safe to replace only when a current www exists.
  rmSync(backup, { recursive: true, force: true });
  renameSync(out, backup);
}
try {
  renameSync(staging, out);
} catch (error) {
  if (existsSync(backup) && !existsSync(out)) renameSync(backup, out);
  throw error;
}
rmSync(backup, { recursive: true, force: true });
console.log('Web bundle generated at www/ — validate native startup and offline features before submission.');

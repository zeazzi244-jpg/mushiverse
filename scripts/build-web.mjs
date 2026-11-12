import { existsSync, mkdirSync, readdirSync, cpSync, copyFileSync, rmSync, lstatSync, renameSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

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
  // A malformed URL can silently break startup in WKWebView.
  if (!url || url.includes('\\')) {
    throw new Error('Release bundle has malformed startup asset URL: ' + match[1]);
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue; // Remote assets
  let normalized;
  try { normalized = decodeURIComponent(url).replace(/^\/?/, ''); }
  catch { throw new Error('Release bundle has invalid startup asset URL: ' + url); }
  const segments = normalized.split('/');
  if (normalized.includes('\\') || segments.includes('.')) {
    throw new Error('Release bundle has unsafe startup asset URL: ' + url);
  }
  const asset = join(staging, normalized);
  if (segments.includes('..') || !normalized || !existsSync(asset) || !lstatSync(asset).isFile()) {
    throw new Error('Release bundle is missing referenced startup asset: ' + url);
  }
  // A zero-byte startup script or stylesheet exists on disk but can still
  // leave Capacitor's offline WebView blank. Reject it before replacing www.
  if (!readFileSync(asset).length) {
    throw new Error('Release bundle has empty referenced startup asset: ' + url);
  }
  // Catch JavaScript parse errors before replacing the last working offline bundle.
  if (extname(normalized).toLowerCase() === '.js') {
    const syntax = spawnSync(process.execPath, ['--check', asset], { encoding: 'utf8' });
    if (syntax.error || syntax.status !== 0) {
      throw new Error('Release bundle has invalid startup JavaScript: ' + url + '\\n' + (syntax.stderr || syntax.error?.message || 'syntax check failed'));
    }
  }
}

// Ensure the forest theme does not silently reference missing local font/image
// assets. WKWebView cannot recover those assets when the device is offline.
for (const match of adventureCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/gi)) {
  const url = (match[1] || match[2] || match[3]).trim().split(/[?#]/, 1)[0];
  if (!url || url.startsWith('#') || /^(?:data:|https?:|\/\/)/i.test(url)) continue;
  if (url.includes('\\')) throw new Error('Release stylesheet has malformed asset URL: ' + url);
  let decoded;
  try { decoded = decodeURIComponent(url); }
  catch { throw new Error('Release stylesheet has invalid asset URL: ' + url); }
  const parts = decoded.split('/');
  if (decoded.startsWith('/') || parts.includes('..') || parts.includes('.')) {
    throw new Error('Release stylesheet has unsafe asset URL: ' + url);
  }
  const asset = join(staging, 'css', decoded);
  if (!existsSync(asset) || !lstatSync(asset).isFile() || !readFileSync(asset).length) {
    throw new Error('Release stylesheet references missing local asset: ' + url);
  }
}

// Validate all shipped stylesheets, not only adventure-ui.css. A missing font
// or image in a secondary theme can make an otherwise healthy WebView unreadable.
function validateBundledCss(directory) {
  for (const name of readdirSync(directory)) {
    const file = join(directory, name);
    const info = lstatSync(file);
    if (info.isDirectory()) {
      validateBundledCss(file);
      continue;
    }
    if (!info.isFile() || extname(name).toLowerCase() !== '.css') continue;
    // Ignore commented-out imports and URLs: they are not fetched by WKWebView.
    // Otherwise documentation examples can falsely fail an offline release build.
    const stylesheet = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // CSS @import dependencies are startup assets too. A missing nested theme
    // stylesheet can silently leave the native WebView with unreadable text.
    for (const match of stylesheet.matchAll(/@import\s+(?:url\(\s*)?(?:["']([^"']+)["']|([^\s;)]+))\s*\)?/gi)) {
      const raw = (match[1] || match[2] || '').trim();
      if (!raw || /^(?:data:|https?:|\/\/)/i.test(raw)) continue;
      const url = raw.split(/[?#]/, 1)[0];
      let decoded;
      try { decoded = decodeURIComponent(url); }
      catch { throw new Error('Bundled CSS has invalid import URL in ' + name + ': ' + raw); }
      if (!decoded || decoded.startsWith('/') || decoded.includes('\\') ||
          decoded.split('/').some(part => part === '..' || part === '.')) {
        throw new Error('Bundled CSS has unsafe import URL in ' + name + ': ' + raw);
      }
      const imported = join(dirname(file), decoded);
      if (extname(imported).toLowerCase() !== '.css' || !existsSync(imported) ||
          !lstatSync(imported).isFile() || !readFileSync(imported).length) {
        throw new Error('Bundled CSS references missing local import in ' + name + ': ' + raw);
      }
    }
    for (const match of stylesheet.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)) {
      const raw = (match[1] || match[2] || match[3]).trim();
      if (!raw || raw.startsWith('#') || /^(?:data:|https?:|\/\/)/i.test(raw)) continue;
      const url = raw.split(/[?#]/, 1)[0];
      let decoded;
      try { decoded = decodeURIComponent(url); }
      catch { throw new Error('Bundled CSS has invalid asset URL in ' + name + ': ' + raw); }
      if (!decoded || decoded.startsWith('/') || decoded.includes('\\') ||
          decoded.split('/').includes('..')) {
        throw new Error('Bundled CSS has unsafe asset URL in ' + name + ': ' + raw);
      }
      // CSS url() is resolved relative to the stylesheet, not the asset folder root.
      const asset = join(dirname(file), decoded);
      if (!existsSync(asset) || !lstatSync(asset).isFile() || !readFileSync(asset).length) {
        throw new Error('Bundled CSS references missing local asset in ' + name + ': ' + raw);
      }
    }
  }
}
for (const folder of publicFolders) {
  const directory = join(staging, folder);
  if (existsSync(directory)) validateBundledCss(directory);
}

// Reject truncated HTML before it reaches an iOS WebView. A partially written
// entry point can pass basic <body>/<script> presence checks yet render blank.
if (!/<\/body\s*>/i.test(html) || !/<\/html\s*>/i.test(html)) {
  throw new Error('Release index.html is missing closing document tags');
}
const scriptOpenCount = [...html.matchAll(/<script\b[^>]*>/gi)].length;
const scriptCloseCount = [...html.matchAll(/<\/script\s*>/gi)].length;
if (scriptOpenCount !== scriptCloseCount) {
  throw new Error('Release index.html has unbalanced script tags: ' + scriptOpenCount + ' opened, ' + scriptCloseCount + ' closed');
}

// Validate inline startup scripts as well: MUSHIVERSE currently embeds much of
// its app code directly in index.html, so checking external .js alone is not enough.
let inlineScriptIndex = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  const attributes = match[1];
  const source = match[2];
  // Only executable JavaScript script types should be syntax-checked. HTML templates,
  // JSON data and custom script payloads are inert in WKWebView.
  const scriptType = attributes.match(/\btype\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/i)?.[1] ||
    attributes.match(/\btype\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/i)?.[2];
  if (!source.trim() || (scriptType && !/^(?:module|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript)$/i.test(scriptType.trim()))) continue;
  inlineScriptIndex++;
  const identifier = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1] || 'inline #' + inlineScriptIndex;
  // Inline module scripts must be parsed as ESM; Node treats stdin as CommonJS
  // unless --input-type=module is supplied, rejecting valid import/export syntax.
  const isModule = /\btype\s*=\s*(?:["']module["']|module(?=\s|$))/i.test(attributes);
  const syntax = spawnSync(process.execPath, isModule ? ['--input-type=module', '--check'] : ['--check'], {
    input: source,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
  if (syntax.error || syntax.status !== 0) {
    throw new Error('Release bundle has invalid inline startup JavaScript (' + identifier + '):\n' +
      (syntax.stderr || syntax.error?.message || 'syntax check failed'));
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

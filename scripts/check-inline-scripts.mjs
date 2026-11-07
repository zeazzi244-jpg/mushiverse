import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
const html = readFileSync('index.html', 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
  new Script(match[2], { filename: `index.html inline script ${++count}` });
}
console.log(`PASS: ${count} inline scripts parse`);

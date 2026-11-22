import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=index.indexOf('function syncStartupBackend(){');
const end=index.indexOf('\nfunction init(){',begin);
assert.ok(begin>=0&&end>begin);
const source=index.slice(begin,end);

test('startup does not make blocking network getUser request before login',()=>{
  assert.doesNotMatch(source,/db\.auth\.getUser\(/);
  assert.match(source,/db\.auth\.getSession\(/);
});
test('startup subscribes to session events before restoring session',()=>{
  assert.ok(source.indexOf('db.auth.onAuthStateChange(')<source.indexOf('db.auth.getSession('));
  assert.match(source,/event==='INITIAL_SESSION'/);
  assert.match(source,/applyStartupUser\(data\?\.session\?\.user\|\|null\)/);
});
test('server data access still goes through authorized Supabase client',()=>{
  assert.match(index,/db\.from\('insect_posts'\)/);
  assert.match(index,/db\.functions\.invoke\('get-premium-status'/);
});

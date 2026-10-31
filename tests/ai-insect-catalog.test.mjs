import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = JSON.parse(readFileSync(join(root,'docs/ai_insect_catalog_v1.json'),'utf8'));
const validator = join(root,'scripts/validate_ai_insect_catalog.cjs');
function validate(data) {
 const dir = mkdtempSync(join(tmpdir(),'mushiverse-catalog-'));
 try {
  const file=join(dir,'catalog.json');writeFileSync(file,JSON.stringify(data));
  const run=spawnSync(process.execPath,[validator],{encoding:'utf8',env:{...process.env,AI_INSECT_CATALOG_PATH:file}});
  return {status:run.status,stdout:run.stdout,stderr:run.stderr};
 } finally {rmSync(dir,{recursive:true,force:true});}
}
const clone=()=>structuredClone(canonical);
test('canonical 100-card catalog passes',()=>{const r=validate(clone());assert.equal(r.status,0,r.stdout+r.stderr)});
test('duplicate ID fails even if card count remains 100',()=>{const d=clone();d.cards[1].id=d.cards[0].id;const r=validate(d);assert.notEqual(r.status,0);assert.match(r.stdout,/Duplicate ID/)});
test('missing or malformed card fails without crashing',()=>{const d=clone();d.cards[1]=null;const r=validate(d);assert.notEqual(r.status,0);assert.match(r.stdout,/Invalid card/)});
test('incorrect rarity fails',()=>{const d=clone();d.cards[0].rarity='SSR';const r=validate(d);assert.notEqual(r.status,0);assert.match(r.stdout,/rarity expected N/)});
test('duplicate names fail',()=>{const d=clone();d.cards[1].name=d.cards[0].name;const r=validate(d);assert.notEqual(r.status,0);assert.match(r.stdout,/Duplicate name/)});

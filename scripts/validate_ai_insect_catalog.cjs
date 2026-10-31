#!/usr/bin/env node
// Validate the canonical 100-card fictional insect catalog.
const fs = require('node:fs');
const path = require('node:path');
const catalogPath = process.env.AI_INSECT_CATALOG_PATH || path.join(__dirname, '../docs/ai_insect_catalog_v1.json');
const errors = [];
let catalog;
try { catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')); }
catch (e) { console.error('Cannot load catalog:', e.message); process.exit(1); }
const cards = catalog && catalog.cards;
if (!Array.isArray(cards)) {
 console.error('Invalid catalog: cards must be an array');
 process.exit(1);
}
if (cards.length !== 100) errors.push('Expected exactly 100 cards');
const ids = new Set(), names = new Set();
const rarityCounts = {N:0,R:0,SR:0,SSR:0};
let approvedArt = 0;
for (const [index, c] of cards.entries()) {
 if (!c || typeof c !== 'object' || Array.isArray(c)) { errors.push('Invalid card at index '+index); continue; }
 if (typeof c.id !== 'string' || !/^AI-[0-9]{3}$/.test(c.id) || Number(c.id.slice(3)) < 1 || Number(c.id.slice(3)) > 100) {
  errors.push('Invalid ID at index '+index+': '+String(c.id));
 } else {
  if (ids.has(c.id)) errors.push('Duplicate ID '+c.id);
  ids.add(c.id);
  const n = Number(c.id.slice(3));
  const expected = n <= 40 ? 'N' : n <= 70 ? 'R' : n <= 90 ? 'SR' : 'SSR';
  if (c.rarity !== expected) errors.push(c.id+' rarity expected '+expected+', got '+c.rarity);
 }
 if (typeof c.name !== 'string' || !c.name.trim()) errors.push('Missing name at index '+index);
 else {
  if (names.has(c.name)) errors.push('Duplicate name '+c.name);
  names.add(c.name);
 }
 if (c.fictional !== true) errors.push(String(c.id)+' must be fictional');
 if (!['pending','review','approved'].includes(c.art_status)) errors.push(String(c.id)+' invalid art_status');
 if (c.art_status === 'approved') approvedArt++;
 if (Object.hasOwn(rarityCounts,c.rarity)) rarityCounts[c.rarity]++;
 else errors.push(String(c.id)+' invalid rarity '+String(c.rarity));
}
for (let n=1; n<=100; n++) {
 const id='AI-'+String(n).padStart(3,'0');
 if (!ids.has(id)) errors.push('Missing '+id);
}
for (const [rarity,expected] of Object.entries({N:40,R:30,SR:20,SSR:10})) {
 if (rarityCounts[rarity]!==expected) errors.push(rarity+' count expected '+expected+', got '+rarityCounts[rarity]);
}
console.log(JSON.stringify({total:cards.length,rarity_counts:rarityCounts,unique_names:names.size,approved_art:approvedArt,errors},null,2));
if (errors.length) process.exitCode=1;

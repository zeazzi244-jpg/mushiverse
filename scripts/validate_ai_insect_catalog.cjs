#!/usr/bin/env node
// Validate MUSHIVERSE fictional AI insect catalog. Run: node scripts/validate_ai_insect_catalog.cjs
const fs = require('node:fs');
const path = require('node:path');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/ai_insect_catalog_v1.json'), 'utf8'));
const errors = [];
const cards = catalog.cards;
if (!Array.isArray(cards) || cards.length !== 100) errors.push('Expected exactly 100 cards');
const seenIds = new Set(), seenNames = new Set();
const ranges = [[1,40,'N'],[41,70,'R'],[71,90,'SR'],[91,100,'SSR']];
for (let n=1; n<=100; n++) {
  const id = 'AI-'+String(n).padStart(3,'0');
  const c = cards.find(x=>x.id===id);
  if (!c) { errors.push('Missing '+id); continue; }
  if (seenIds.has(c.id)) errors.push('Duplicate ID '+c.id);
  seenIds.add(c.id);
  if (typeof c.name !== 'string' || !c.name.trim()) errors.push('Missing name '+id);
  if (seenNames.has(c.name)) errors.push('Duplicate name '+c.name);
  seenNames.add(c.name);
  const rarity = ranges.find(([start,end])=>n>=start&&n<=end)[2];
  if (c.rarity !== rarity) errors.push(id+' rarity expected '+rarity+', got '+c.rarity);
  if (c.fictional !== true) errors.push(id+' must be marked fictional');
  if (!['pending','review','approved'].includes(c.art_status)) errors.push(id+' invalid art_status');
}
for (const c of cards) if (!/^AI-\\d{3}$/.test(c.id) || Number(c.id.slice(3))<1 || Number(c.id.slice(3))>100) errors.push('Unexpected ID '+c.id);
console.log(JSON.stringify({total:cards.length,rarity_counts:Object.fromEntries(['N','R','SR','SSR'].map(r=>[r,cards.filter(c=>c.rarity===r).length])),unique_names:seenNames.size,approved_art:cards.filter(c=>c.art_status==='approved').length,errors},null,2));
if(errors.length) process.exitCode=1;

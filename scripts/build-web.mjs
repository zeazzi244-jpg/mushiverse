import { existsSync, mkdirSync, readdirSync, cpSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const root=process.cwd();
if(!existsSync(join(root,'index.html')))throw new Error('Root index.html not found');
const out=join(root,'www');rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const assets=new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.mp3','.wav','.webmanifest']);
const excluded=new Set(['node_modules','ios','android','www','.git','.github','scripts']);
for(const name of readdirSync(root)){
 if(excluded.has(name))continue;
 const src=join(root,name),dst=join(out,name),stat=statSync(src);
 if(stat.isDirectory()){
  // Bundle only explicit public asset folders, not secrets or project configs.
  if(['assets','images','img','css','js','fonts','media'].includes(name))cpSync(src,dst,{recursive:true});
 }else if(assets.has(extname(name).toLowerCase()) && !['package.json','capacitor.config.json'].includes(name)) copyFileSync(src,dst);
}
console.log('Web bundle generated at www/ — check offline/network features before native submission.');

// Package boot dependencies locally so a CDN outage does not disable login or map controls.
const vendor=join(out,'assets','vendor');mkdirSync(vendor,{recursive:true});
copyFileSync(join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),join(vendor,'supabase.js'));
cpSync(join(root,'node_modules/leaflet/dist'),join(vendor,'leaflet'),{recursive:true});

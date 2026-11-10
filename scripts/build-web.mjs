import { existsSync, mkdirSync, readdirSync, cpSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
const root=process.cwd();
if(!existsSync(join(root,'index.html')))throw new Error('Root index.html not found');
const out=join(root,'www');rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const assets=new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.mp3','.wav','.webmanifest']);
const excluded=new Set(['node_modules','ios','android','www','.git','.github','scripts']);
const publicFolders=new Set(['assets','images','img','css','js','fonts','media']);
// Never ship hidden files, source maps, credentials or development backups in the app bundle.
function isPublicAsset(source){
 const name=basename(source).toLowerCase();
 if(name.startsWith('.') || name.endsWith('.map') || name.endsWith('~'))return false;
 if(/(?:^|[._-])(secret|private|backup|credential|credentials)(?:[._-]|$)/i.test(name))return false;
 if(/\.(?:pem|key|p12|p8|mobileprovision|bak|orig|log|md|ts|tsx)$/i.test(name))return false;
 return true;
}
for(const name of readdirSync(root)){
 if(excluded.has(name) || !isPublicAsset(name))continue;
 const src=join(root,name),dst=join(out,name),stat=statSync(src);
 if(stat.isDirectory()){
  if(publicFolders.has(name))cpSync(src,dst,{recursive:true,filter:isPublicAsset});
 }else if(assets.has(extname(name).toLowerCase()) && !['package.json','capacitor.config.json'].includes(name))copyFileSync(src,dst);
}
console.log('Web bundle generated at www/ — check offline/network features before native submission.');

// Package boot dependencies locally so a CDN outage does not disable login or map controls.
const vendor=join(out,'assets','vendor');mkdirSync(vendor,{recursive:true});
copyFileSync(join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),join(vendor,'supabase.js'));
const leafletSource=join(root,'node_modules/leaflet/dist');
const leafletDest=join(vendor,'leaflet');
mkdirSync(leafletDest,{recursive:true});
for(const file of ['leaflet.js','leaflet.css'])copyFileSync(join(leafletSource,file),join(leafletDest,file));
cpSync(join(leafletSource,'images'),join(leafletDest,'images'),{recursive:true,filter:isPublicAsset});

// Public fictional-card catalog used by the standalone gallery preview.
// Copy only this allowlisted JSON; never publish the whole docs directory.
const catalogSource=join(root,'docs','ai_insect_catalog_v1.json');
if(!existsSync(catalogSource))throw new Error('AI insect catalog missing');
const catalogDest=join(out,'docs');mkdirSync(catalogDest,{recursive:true});
copyFileSync(catalogSource,join(catalogDest,'ai_insect_catalog_v1.json'));

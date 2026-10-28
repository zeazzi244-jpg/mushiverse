import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import xcode from 'xcode';
import {validateSwiftSources} from '../scripts/ios-project-paths.mjs';
const parse=()=>{const p=xcode.project('ios/App/App.xcodeproj/project.pbxproj');p.parseSync();return p};
test('all compiled Swift sources resolve through the Xcode group tree',()=>assert.deepEqual(validateSwiftSources(parse(),resolve('ios/App')),[]));
test('orphaned and incorrectly located Swift references fail structural preflight',()=>{
 const p=parse(),objects=p.hash.project.objects;
 const id=Object.keys(objects.PBXFileReference).find(id=>objects.PBXFileReference[id]?.path==='"MushiverseCoinStore.swift"');
 assert.ok(id);
 objects.PBXFileReference[id].path='"missing.swift"';assert.ok(validateSwiftSources(p,resolve('ios/App')).some(s=>s.includes('missing.swift')));
 objects.PBXFileReference[id].path='"MushiverseCoinStore.swift"';
 for(const group of Object.values(objects.PBXGroup))if(group?.children)group.children=group.children.filter(c=>c.value!==id);
 assert.ok(validateSwiftSources(p,resolve('ios/App')).some(s=>s.includes('outside the project group tree')));
});

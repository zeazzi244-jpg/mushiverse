import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignBuildNumber} from '../scripts/set-signed-build-number.mjs';
const source=readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');
test('signed build is newer than previously shipped v139 and updates both configurations',()=>{
 const {updated,build}=assignBuildNumber(source,'1','1');
 assert.equal(build,241);
 assert.equal((updated.match(/CURRENT_PROJECT_VERSION = 241;/g)||[]).length,2);
 assert.equal((updated.match(/CURRENT_PROJECT_VERSION = 1;/g)||[]).length,0);
 assert.equal(updated.replaceAll('CURRENT_PROJECT_VERSION = 241;','CURRENT_PROJECT_VERSION = 1;'),source);
});
test('workflow retries and new runs receive distinct numbers',()=>{
 const first=assignBuildNumber(source,'42','1').build;
 const retry=assignBuildNumber(source,'42','2').build;
 const next=assignBuildNumber(source,'43','1').build;
 assert.ok(first>139&&retry>first&&next>retry);
});
test('invalid CI context and unexpected project structure fail closed',()=>{
 for(const [run,attempt] of [[undefined,'1'],['0','1'],['1','0'],['1','100'],['abc','1'],['1.5','1']])assert.throws(()=>assignBuildNumber(source,run,attempt));
 assert.throws(()=>assignBuildNumber('CURRENT_PROJECT_VERSION = 1;',1,1),/unexpected_xcode/);
});

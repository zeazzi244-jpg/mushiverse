import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function v34ClearDeletedAccountLocalData('),end=html.indexOf('function renderV34Creator(){',start);
assert(start>=0&&end>start);const source=html.slice(start,end);
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const prefixes=['mushiverse-post-draft-v1:user:','mushiverse-profile-v86:user:','mushiverse-v77-game:user:'];
function fixture(options={}){
 const saved=new Map(prefixes.flatMap(p=>[[p+A,'A private'],[p+B,'B private']]));
 saved.set('mushiverse-v77-game:guest','guest legacy');saved.set('mushiverse-profile-v86','unscoped legacy');
 const removed=[],alerts=[],signouts=[];let active=A,reloads=0,calls=0;
 const context=vm.createContext({
  globalLang:()=> 'ja',document:{getElementById:()=>({value:'削除'})},
  v34RefreshAuth:async()=>({id:A}),v34ServerCallable:()=>true,confirm:()=>true,
  localStorage:{removeItem:key=>{removed.push(key);if(options.localError&&key===prefixes[1]+A)throw Error('quota');saved.delete(key)}},
  db:{functions:{invoke:async()=>{calls++;if(options.switchToB)active=B;return options.response||{data:{deleted:true},error:null}}},
   auth:{getSession:async()=>{if(options.sessionError)throw Error('offline');return {data:{session:{user:{id:active}}},error:null}},signOut:async options=>{signouts.push(options);active=null;return {error:null}}}},
  V34_FN:{deleteAccount:'delete-account'},APP_VERSION:'test',v34LastMessage:'',
  alert:text=>alerts.push(text),toast:()=>{},renderV34:()=>{},location:{reload:()=>{reloads++}}
 });
 vm.runInContext(source,context);
 return {context,saved,removed,alerts,signouts,run:()=>context.v34DeleteAccount(),state:()=>({active,reloads,calls})};
}
test('confirmed deletion clears only the deleted owner scoped keys',async()=>{
 const f=fixture();await f.run();
 assert.deepEqual(f.removed,prefixes.map(p=>p+A));
 for(const prefix of prefixes)assert.equal(f.saved.get(prefix+B),'B private');
 assert.equal(f.saved.get('mushiverse-v77-game:guest'),'guest legacy');
 assert.equal(f.saved.get('mushiverse-profile-v86'),'unscoped legacy');
 assert.equal(f.signouts.length,1);assert.equal(f.signouts[0].scope,'local');assert.equal(f.state().reloads,1);
});
test('account switch while server deletion is pending does not log out or reload the new account',async()=>{
 const f=fixture({switchToB:true});await f.run();
 assert.equal(f.state().active,B);assert.equal(f.signouts.length,0);assert.equal(f.state().reloads,0);
 for(const prefix of prefixes)assert.equal(f.saved.get(prefix+B),'B private');
});
test('failed or unconfirmed server deletion preserves both accounts local data',async()=>{
 for(const response of [{data:{deleted:false},error:null},{data:null,error:{message:'server unavailable'}}]){
  const f=fixture({response});await f.run();assert.deepEqual(f.removed,[]);
  for(const prefix of prefixes){assert.equal(f.saved.get(prefix+A),'A private');assert.equal(f.saved.get(prefix+B),'B private')}
  assert.equal(f.signouts.length,0);assert.equal(f.state().reloads,0);
 }
});
test('local cleanup failure is disclosed and never broadens the deletion scope',async()=>{
 const f=fixture({localError:true});await f.run();
 assert(f.alerts[0].includes('端末内データの一部を消去できませんでした'));
 for(const prefix of prefixes)assert.equal(f.saved.get(prefix+B),'B private');
 assert.deepEqual(f.removed,prefixes.map(p=>p+A));
});
test('unreadable active session cannot sign out or reload a possibly different account',async()=>{
 const f=fixture({switchToB:true,sessionError:true});await f.run();
 assert.equal(f.state().active,B);assert.equal(f.signouts.length,0);assert.equal(f.state().reloads,0);
});

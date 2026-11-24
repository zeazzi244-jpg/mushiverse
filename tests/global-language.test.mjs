import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function globalLang(){'),html.indexOf('// v67: make the language helper'));
function language(saved, navigator, fail=false){
  return runInNewContext(source+'\nglobalLang()',{
    GLOBAL_LANG_KEY:'language',navigator,
    localStorage:{getItem(){if(fail)throw Error('unavailable');return saved;}}
  });
}
test('global language uses device preference on first launch and preserves explicit choices',()=>{
  assert.equal(language(null,{languages:['ja-JP']}),'ja');
  assert.equal(language(null,{languages:['en-US']}),'en');
  assert.equal(language(null,{language:'ko-KR'}),'en');
  assert.equal(language('ja',{language:'en-US'}),'ja');
  assert.equal(language('en',{language:'ja-JP'}),'en');
  assert.equal(language('invalid',{language:'ja-JP'}),'ja');
  assert.equal(language(null,{language:'en-GB'},true),'en');
});
test('English navigation preserves icons and badges and can switch back to Japanese',()=>{
  const icon={nodeType:1},badge={nodeType:1,textContent:'7'};
  const label={nodeType:3,textContent:'ホーム'};
  const button={dataset:{tab:'home'},childNodes:[icon,label,badge],setAttribute(k,v){this[k]=v}};
  const nav={querySelectorAll:()=>[button],setAttribute(k,v){this[k]=v}};
  const skip={textContent:''};
  const context={document:{querySelector:s=>s==='nav.nav'?nav:skip}};
  runInNewContext(source+'\ntranslateGlobalNavigation("en")',context);
  assert.equal(label.textContent,'Home');
  assert.equal(button['aria-label'],'Home');
  assert.equal(nav['aria-label'],'Main navigation');
  assert.equal(skip.textContent,'Skip to main content');
  assert.equal(button.childNodes[0],icon);
  assert.equal(button.childNodes[2],badge);
  runInNewContext('translateGlobalNavigation("ja")',context);
  assert.equal(label.textContent,'ホーム');
  assert.equal(badge.textContent,'7');
});

test('account language changes preserve login fields and existing authentication calls',()=>{
  const auth=html.slice(html.indexOf('function authUI(){'),html.indexOf('const MAP_GEO_CACHE_KEY'));
  assert.match(auth,/id="authEmail"[^>]+data-en-placeholder="Email address"/);
  assert.match(auth,/id="authPassword"[^>]+data-en-placeholder="Password"/);
  assert.match(auth,/db\.auth\.signInWithPassword\(\{email,password\}\)/);
  assert.match(auth,/db\.auth\.signUp\(\{email,password,emailRedirectTo:location\.origin\+location\.pathname\}\)/);
  assert.match(auth,/Signing in…/);
  assert.match(auth,/Connection interrupted/);
  const messages={postAuthMessage:{},mvPostSignIn:{},mvStartSignIn:{}};
  const context={GLOBAL_LANG_KEY:'language',navigator:{language:'en-US'},localStorage:{getItem:()=>null},user:null,$:id=>messages[id]};
  runInNewContext(source+'\ntranslateGlobalAuth()',context);
  assert.equal(messages.postAuthMessage.textContent,'Sign in to publish your discoveries.');
  assert.equal(messages.mvStartSignIn.textContent,'Create account / Sign in');
  context.user={id:'test'};
  runInNewContext('translateGlobalAuth()',context);
  assert.equal(messages.postAuthMessage.textContent,'You can publish photos and insect observations.');
});

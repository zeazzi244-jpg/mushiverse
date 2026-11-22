import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const feedScript=html.match(/<script id="mv110-follow-feed">([\s\S]*?)<\/script>/)?.[1]||'';

test('the follow-feed exists once in the shipped document',()=>{
 assert.equal((html.match(/<section id="mv110FollowFeed"/g)||[]).length,1);
 assert.match(html,/<button type="button" id="mv110Reload">/);
 assert.ok(feedScript);
});

test('follow-feed initializes existing controls instead of returning early or creating duplicate markup',()=>{
 assert.match(feedScript,/const panel=document\.getElementById\('mv110FollowFeed'\)/);
 assert.match(feedScript,/reload\.addEventListener\('click',refresh\)/);
 assert.doesNotMatch(feedScript,/createElement\('section'\)/);
 assert.doesNotMatch(feedScript,/if\(!home\|\|document\.getElementById\('mv110FollowFeed'\)\)return/);
});

test('follow-feed rechecks account state on sign-in or sign-out',()=>{
 assert.match(feedScript,/addEventListener\('mushiverse:profile-account',refresh\)/);
 assert.match(html,/dispatchEvent\(new Event\('mushiverse:profile-account'\)\)/);
});

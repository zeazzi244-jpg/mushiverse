import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('profile images survive a reload and account changes preserve each owner and the legacy profile', () => {
  const html = readFileSync('www/index.html', 'utf8');
  const source = html.match(/const legacyKey='mushiverse-profile-v86';[\s\S]*?(?=function initProfile)/)[0];
  const legacy = 'mushiverse-profile-v86';
  const stored = new Map([[legacy, '{"name":"previous","cover":"old-photo"}']]);
  const localStorage = {
    getItem: key => stored.get(key),
    setItem: (key, value) => stored.set(key, value)
  };
  const window = {};
  const open = () => runInNewContext(source + '\n({profileKey,load,save})', {window,localStorage});
  let profile = open();
  window.user = {id:'a'};
  assert.equal(profile.save(profile.profileKey(), {avatar:'photo-a',cover:'cover-a'}), true);
  profile = open();
  assert.equal(profile.load().cover, 'cover-a');
  window.user = {id:'b'};
  assert.equal(profile.load().avatar, undefined);
  delete window.user;
  assert.equal(profile.load().cover, undefined);
  assert.equal(profile.load(legacy).cover, 'old-photo');
  window.user = {id:'a'};
  assert.equal(profile.load().avatar, 'photo-a');
});

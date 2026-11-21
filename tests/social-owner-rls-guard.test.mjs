import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(
  new URL('../supabase/migrations/20261121201000_stop_cross_user_social_mutation.sql',import.meta.url),
  'utf8'
);

test('social RLS never grants every active user owner-level changes',()=>{
  const tables=['profile_usernames','user_follows','insect_posts',
    'post_comments','post_likes','gacha_collection_leaderboard'];
  for(const table of tables){
    assert.ok(sql.includes('DROP POLICY IF EXISTS account_active_v21 ON public.'+table),table);
  }
  assert.doesNotMatch(sql,/CREATE POLICY\s+account_active_v21/i);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('Postgres credit/debit atomicity, replay identity, permissions and card rarity',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';insert into auth.users values('${A}'),('${B}');`);
 await db.exec(readFileSync('supabase/migrations/20261028_gacha_coin_wallet.sql','utf8'));
 await db.exec(`create table public.gacha_paid_draws(draw_id text primary key,user_id uuid not null references auth.users(id),draw_count integer not null,coins_spent integer not null,results jsonb not null,created_at timestamptz not null default now());alter table public.gacha_paid_draws enable row level security;`);
 await db.exec(readFileSync('supabase/sql/coin-wallet-v2.sql','utf8'));
 const credit=(id,user=A,product='mushiverse.coins.1200',env='Sandbox')=>db.query('select public.credit_verified_gacha_purchase_v2($1,$2,$3,$4) ok',[id,user,product,env]);
 const draw=(id,count=10,user=A)=>db.query('select public.draw_with_purchased_gacha_coins_v2($1,$2,$3) result',[id,user,count]);
 const balance=async()=>Number((await db.query('select balance from gacha_coin_wallets where user_id=$1',[A])).rows[0].balance);
 await credit('123456789');await credit('123456789');assert.equal(await balance(),1200);
 await assert.rejects(()=>credit('123456789',B));await assert.rejects(()=>credit('123456789',A,'mushiverse.coins.100'));await assert.rejects(()=>credit('123456789',A,'mushiverse.coins.1200','Production'));
 const first=(await draw('test-draw-1')).rows[0].result;assert.equal(first.results.length,10);assert.equal(await balance(),750);
 const replay=(await draw('test-draw-1')).rows[0].result;assert.deepEqual(replay.results,first.results);assert.equal(await balance(),750);
 await assert.rejects(()=>draw('test-draw-1',1));await assert.rejects(()=>draw('test-draw-1',10,B));await assert.rejects(()=>draw('test-null',null));
 await draw('test-draw-2');assert.equal(await balance(),300);
 assert.equal((await draw('test-draw-3')).rows[0].result.reason,'insufficient_balance');assert.equal(await balance(),300);
 for(const c of first.results){const bounds={N:[1,40],R:[41,70],SR:[71,90],SSR:[91,100]}[c.rarity];assert.ok(c.card_id>=bounds[0]&&c.card_id<=bounds[1]);}
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_function_privilege($1,'public.credit_verified_gacha_purchase_v2(text,uuid,text,text)','execute') ok`,[role])).rows[0].ok,false);
 await db.exec('set role authenticated');await assert.rejects(()=>credit('987654321'));await db.exec('reset role');assert.equal(await balance(),300);
 }finally{await db.close()}
});

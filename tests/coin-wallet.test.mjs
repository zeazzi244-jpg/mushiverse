import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('Postgres isolated coin ledger',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 insert into auth.users(id) values('${A}'),('${B}');insert into auth.sessions values('${SA}','${A}'),('${SB}','${B}');`);
 await db.exec(readFileSync('supabase/sql/coin-wallet-v2.sql','utf8'));
 const credit=(id,user=A,product='mushiverse.coins.1200',env='Sandbox',session=user===A?SA:SB)=>db.query('select public.credit_verified_gacha_purchase_v2($1,$2,$3,$4,$5) ok',[id,user,product,env,session]);
 const draw=(id,count=10,user=A,env='Sandbox',session=user===A?SA:SB)=>db.query('select public.draw_with_purchased_gacha_coins_v2($1,$2,$3,$4,$5) result',[id,user,count,env,session]);
 const balance=async(env='Sandbox',user=A)=>Number((await db.query('select balance from gacha_coin_wallets_v2 where user_id=$1 and environment=$2',[user,env])).rows[0]?.balance||0);
 await t.test('same-user verified replay credits once; wrong user/product/session rejects',async()=>{
 await db.exec('set role service_role');await credit('123456789');await credit('123456789');assert.equal(await balance(),1200);
 await assert.rejects(()=>credit('123456789',B));await assert.rejects(()=>credit('123456789',A,'mushiverse.coins.100'));await assert.rejects(()=>credit('123456789',A,'mushiverse.coins.1200','Sandbox',SB));await db.exec('reset role');
 });
 await t.test('Sandbox and Production never share balance or debit',async()=>{
 assert.equal(await balance('Production'),0);assert.equal((await draw('prod-no-funds',1,A,'Production')).rows[0].result.reason,'insufficient_balance');
 await credit('123456789',A,'mushiverse.coins.100','Production');assert.equal(await balance('Production'),100);assert.equal(await balance(),1200);
 await draw('production-draw',1,A,'Production');assert.equal(await balance('Production'),50);assert.equal(await balance(),1200);
 });
 await t.test('draw replay binds count/user/results and enforces insufficient funds',async()=>{
 const first=(await draw('test-draw-1')).rows[0].result;assert.equal(first.results.length,10);assert.equal(await balance(),750);
 const replay=(await draw('test-draw-1')).rows[0].result;assert.deepEqual(replay.results,first.results);assert.equal(await balance(),750);
 await assert.rejects(()=>draw('test-draw-1',1));await assert.rejects(()=>draw('test-draw-1',10,B));await assert.rejects(()=>draw('test-null',null));
 await draw('test-draw-2');assert.equal(await balance(),300);assert.equal((await draw('test-draw-3')).rows[0].result.reason,'insufficient_balance');
 for(const c of first.results){const bounds={N:[1,40],R:[41,70],SR:[71,90],SSR:[91,100]}[c.rarity];assert.ok(c.card_id>=bounds[0]&&c.card_id<=bounds[1]);}
 });
 await t.test('failure to persist draw results rolls back debit',async()=>{
 await db.exec(`create function public.reject_test_draw() returns trigger language plpgsql as $$begin if new.draw_id='forced-draw-failure' then raise exception 'test result persistence failure';end if;return new;end$$;create trigger reject_test_draw before insert on gacha_paid_draws_v2 for each row execute function reject_test_draw();`);
 const before=await balance();await assert.rejects(()=>draw('forced-draw-failure',1));assert.equal(await balance(),before);
 });
 await t.test('RLS restricts reads and forbids client credit/debit',async()=>{
 for(const role of ['anon','authenticated'])for(const signature of ['credit_verified_gacha_purchase_v2(text,uuid,text,text,uuid)','draw_with_purchased_gacha_coins_v2(text,uuid,integer,text,uuid)'])assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') ok',[role,'public.'+signature])).rows[0].ok,false);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${B}'`);assert.equal((await db.query('select * from gacha_coin_wallets_v2')).rows.length,0);
 await assert.rejects(()=>credit('987654321'));await assert.rejects(()=>db.query('update gacha_coin_wallets_v2 set balance=99999'));await db.exec('reset role');
 });
 await t.test('revoked/banned/deleted sessions reject and deletion preserves replay tombstones',async()=>{
 await credit('987654321',B);await draw('user-b-draw-1',1,B);
 await db.exec(`delete from auth.sessions where id='${SB}'`);await assert.rejects(()=>credit('987654322',B));await assert.rejects(()=>draw('user-b-draw-2',1,B));
 await db.exec(`insert into auth.sessions values('${SB}','${B}');update auth.users set banned_until=now()+interval '1 day' where id='${B}'`);await assert.rejects(()=>credit('987654322',B));
 await db.exec(`delete from auth.users where id='${B}';insert into auth.users(id) values('${B}');insert into auth.sessions values('${SB}','${B}')`);
 await assert.rejects(()=>credit('987654321',B));await assert.rejects(()=>draw('user-b-draw-1',1,B));assert.equal(await balance('Sandbox',B),0);
 });
 }finally{await db.close()}
});

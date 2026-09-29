import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { CharacterRepository } from '../packages/persistence/src/postgres.js';
import { Coordination } from '../packages/persistence/src/redis.js';

test('PostgreSQL migration, atomic retries, optimistic revisions, fencing and append-only ledger', {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const schema=`haven_test_${randomUUID().replaceAll('-','')}`,admin=new Pool({connectionString:process.env.TEST_DATABASE_URL,connectionTimeoutMillis:3000});
  const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,connectionTimeoutMillis:3000,options:`-c search_path=${schema}`});
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);await pool.query(await readFile('infra/migrations/001_identity_checkpoints.sql','utf8'));
    const accountId=randomUUID(),characterId=randomUUID();
    await pool.query('INSERT INTO accounts(id,login_name,password_hash) VALUES($1,$2,$3)',[accountId,'test-account','test-fixture-not-a-real-password']);
    await pool.query('INSERT INTO characters(id,account_id,name) VALUES($1,$2,$3)',[characterId,accountId,'Survivor']);
    await pool.query('INSERT INTO character_checkpoints(character_id,state) VALUES($1,$2::jsonb)',[characterId,JSON.stringify({scrap:0})]);
    const repo=new CharacterRepository(pool),epoch=await repo.acquireEpoch(accountId,characterId);
    const input={accountId,characterId,epoch,expectedRevision:0,operationId:randomUUID(),kind:'test_pickup',state:{scrap:10}};
    assert.deepEqual(await repo.commit(input),{revision:1});assert.deepEqual(await repo.commit(input),{revision:1});
    await assert.rejects(repo.commit({...input,state:{scrap:999}}),/operation_reused/);
    const raced=await Promise.allSettled([11,12].map(scrap=>repo.commit({...input,operationId:randomUUID(),expectedRevision:1,state:{scrap}})));
    assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(Number((await repo.load(accountId,characterId))!.revision),2);
    await repo.acquireEpoch(accountId,characterId);await assert.rejects(repo.commit({...input,expectedRevision:2,operationId:randomUUID()}),/stale_session/);
    assert.equal(Number((await pool.query('SELECT count(*) FROM value_ledger')).rows[0].count),2);
    await assert.rejects(pool.query('UPDATE value_ledger SET after_state=before_state'),/append-only/);
  } finally {await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
});
test('Redis leases, ownership-safe release, presence and rate limits', {skip:!process.env.TEST_REDIS_URL},async()=>{
  const id=`test_${randomUUID()}`,redis=new Coordination(process.env.TEST_REDIS_URL!,process.env.REDIS_TLS_SERVERNAME);
  try {
    await redis.connect();const token=await redis.acquireCharacter(id);assert.ok(token);assert.equal(await redis.acquireCharacter(id),undefined);
    assert.equal(await redis.renewCharacter(id,'wrong-token'),false);await redis.releaseCharacter(id,'wrong-token');assert.equal(await redis.renewCharacter(id,token),true);
    await redis.presence(id,'test-channel');assert.equal(await redis.rateLimit(id,1,10),true);assert.equal(await redis.rateLimit(id,1,10),false);
    await redis.releaseCharacter(id,token);assert.ok(await redis.acquireCharacter(id));
  } finally {if(redis.client.isReady)await redis.client.sendCommand(['DEL',`haven:v1:lease:${id}`,`haven:v1:presence:${id}`,`haven:v1:rate:${id}`]);await redis.close();}
});

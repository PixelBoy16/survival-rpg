import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';

/** Backend-only boundary. Never expose commit input as a browser state-upload API. */
const Commit=z.strictObject({accountId:z.string().uuid(),characterId:z.string().uuid(),operationId:z.string().uuid(),kind:z.string().min(1).max(64),epoch:z.number().int().nonnegative().safe(),expectedRevision:z.number().int().nonnegative().safe(),state:z.record(z.string(),z.unknown())});
export type CommitInput=z.infer<typeof Commit>;
export class PersistenceConflict extends Error {}
export class CharacterRepository {
  constructor(readonly pool:Pool) {}
  async load(accountId:string,characterId:string) {
    const result=await this.pool.query('SELECT c.session_epoch, s.revision, s.schema_version, s.state FROM characters c JOIN character_checkpoints s ON s.character_id=c.id WHERE c.id=$1 AND c.account_id=$2',[characterId,accountId]);
    return result.rows[0] as {session_epoch:string;revision:string;schema_version:number;state:Record<string,unknown>}|undefined;
  }
  async acquireEpoch(accountId:string,characterId:string) {
    const result=await this.pool.query('UPDATE characters SET session_epoch=session_epoch+1 WHERE id=$1 AND account_id=$2 RETURNING session_epoch',[characterId,accountId]);
    if(!result.rowCount)throw new PersistenceConflict('character_owner');
    return Number(result.rows[0].session_epoch);
  }
  async commit(input:CommitInput) {
    const request=Commit.parse(input),encoded=JSON.stringify(request.state);
    if(Buffer.byteLength(encoded)>1024*1024)throw new PersistenceConflict('checkpoint_size');
    const hash=createHash('sha256').update(JSON.stringify({kind:request.kind,state:request.state})).digest('hex');
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked=await client.query('SELECT c.session_epoch,s.revision,s.state FROM characters c JOIN character_checkpoints s ON s.character_id=c.id WHERE c.id=$1 AND c.account_id=$2 FOR UPDATE OF c,s',[request.characterId,request.accountId]);
      const row=locked.rows[0];if(!row)throw new PersistenceConflict('character_owner');
      if(Number(row.session_epoch)!==request.epoch)throw new PersistenceConflict('stale_session');
      const duplicate=await client.query('SELECT request_hash,result FROM value_operations WHERE character_id=$1 AND operation_id=$2',[request.characterId,request.operationId]);
      if(duplicate.rowCount){if(duplicate.rows[0].request_hash!==hash)throw new PersistenceConflict('operation_reused');await client.query('COMMIT');return duplicate.rows[0].result as {revision:number};}
      if(Number(row.revision)!==request.expectedRevision)throw new PersistenceConflict('stale_revision');
      const result={revision:request.expectedRevision+1};
      await client.query('UPDATE character_checkpoints SET state=$1::jsonb,revision=$2,updated_at=now() WHERE character_id=$3',[encoded,result.revision,request.characterId]);
      await client.query('INSERT INTO value_operations(character_id,operation_id,kind,request_hash,revision,result) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[request.characterId,request.operationId,request.kind,hash,result.revision,JSON.stringify(result)]);
      await client.query('INSERT INTO value_ledger(character_id,operation_id,before_state,after_state) VALUES($1,$2,$3::jsonb,$4::jsonb)',[request.characterId,request.operationId,JSON.stringify(row.state),encoded]);
      await client.query('COMMIT');return result;
    } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
  }
}

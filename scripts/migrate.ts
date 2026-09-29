import { Pool } from 'pg';
import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000});
const client=await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(87241003)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir('infra/migrations')).filter(n=>/^\d+_.*\.sql$/.test(n)).sort()){
    const version=Number(name.split('_')[0]),sql=await readFile(`infra/migrations/${name}`,'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
    const existing=await client.query('SELECT checksum FROM schema_migrations WHERE version=$1',[version]);
    if(existing.rowCount){if(existing.rows[0].checksum!==checksum)throw Error(`Migration checksum changed: ${name}`);continue;}
    await client.query('BEGIN');try{await client.query(sql);await client.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)',[version,checksum]);await client.query('COMMIT');console.log(`Applied ${name}`);}catch(error){await client.query('ROLLBACK');throw error;}
  }
} finally {await client.query('SELECT pg_advisory_unlock(87241003)');client.release();await pool.end();}

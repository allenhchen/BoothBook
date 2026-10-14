import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export function databasePath(){return resolve(process.env.BOOTHBOOK_DB_PATH||join(homedir(),'.boothbook','boothbook.sqlite'))}
export function openLocalDatabase(filename,migrationRoot){
 mkdirSync(dirname(filename),{recursive:true,mode:0o700});
 const existed=existsSync(filename),sqlite=new DatabaseSync(filename,{timeout:5000});
 sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 function snapshot(reason='manual'){
  const directory=join(dirname(filename),'backups');mkdirSync(directory,{recursive:true,mode:0o700});
  const output=join(directory,`boothbook-${new Date().toISOString().replace(/[:.]/g,'-')}-${reason}-${randomUUID().slice(0,8)}.sqlite`);
  // SQLite writes a consistent standalone snapshot, including committed WAL data.
  sqlite.prepare('VACUUM INTO ?').run(output);return output;
 }
 try{
  sqlite.exec('CREATE TABLE IF NOT EXISTS boothbook_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
  const journal=JSON.parse(readFileSync(join(migrationRoot,'meta','_journal.json'),'utf8'));
  const entries=journal.entries.map(e=>{const sql=readFileSync(join(migrationRoot,e.tag+'.sql'),'utf8');return {name:e.tag,sql,checksum:createHash('sha256').update(sql).digest('hex')}});
  const applied=sqlite.prepare('SELECT name,checksum FROM boothbook_migrations').all();
  for(const row of applied){const entry=entries.find(e=>e.name===row.name);if(!entry||entry.checksum!==row.checksum)throw Error('Database migrations differ from this version. Do not downgrade or edit applied migration files. Restore a matching backup if needed.')}
  const pending=entries.filter(e=>!applied.some(a=>a.name===e.name));
  if(pending.length&&existed)snapshot('before-migration');
  if(pending.length){sqlite.exec('BEGIN IMMEDIATE');try{for(const entry of pending){sqlite.exec(entry.sql);sqlite.prepare('INSERT INTO boothbook_migrations VALUES (?,?)').run(entry.name,entry.checksum)}sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}}
  sqlite.exec('PRAGMA optimize;');
 }catch(e){sqlite.close();throw e}
 const db={prepare(sql){const statement=sqlite.prepare(sql);return {bind(...values){return {run(){return {meta:{changes:Number(statement.run(...values).changes)}}},first(){return statement.get(...values)||null},all(){return {results:statement.all(...values)}}}}}},
  async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements)results.push(statement.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}
 };
 return {db,sqlite,snapshot,close(){sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');sqlite.close()}};
}

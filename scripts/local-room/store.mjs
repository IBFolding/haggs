// Disposable local integration backend only. Never use for production data.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
export function openLocalRoomStore(filename, limit) {
 if (process.env.NODE_ENV === 'production') throw Error('Local room store is unavailable in production.');
 if (!Number.isSafeInteger(limit) || limit <= 0) throw Error('Invalid quota.');
 const db = new DatabaseSync(filename);
 db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS room_objects (owner TEXT NOT NULL, session TEXT NOT NULL, path TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, digest TEXT NOT NULL, data BLOB, committed INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL, lease TEXT, PRIMARY KEY(owner,session));`);
 const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } };
 const pathFor=(owner,session)=>`rooms/u-${owner}/${session}/recording.mp4`;
 return {
  close:()=>db.close(),
  quota:{
   reserve:async(owner,session,size,digest)=>tx(()=>{const row=db.prepare('SELECT size,digest FROM room_objects WHERE owner=? AND session=?').get(owner,session); if(row) return row.size===size && row.digest===digest?'existing':'denied'; const used=db.prepare('SELECT COALESCE(SUM(size),0) AS n FROM room_objects WHERE owner=?').get(owner).n; if(size<=0 || used+size>limit) return 'denied'; db.prepare('INSERT INTO room_objects(owner,session,path,size,digest,expires) VALUES(?,?,?,?,?,?)').run(owner,session,pathFor(owner,session),size,digest,Date.now()+86400000);return 'created';}),
   commit:async(owner,session,size,digest)=>tx(()=>{const row=db.prepare('SELECT size,digest,data FROM room_objects WHERE owner=? AND session=?').get(owner,session);if(!row || row.size!==size || row.digest!==digest || !row.data || createHash('sha256').update(row.data).digest('hex')!==digest)return false;db.prepare('UPDATE room_objects SET committed=1 WHERE owner=? AND session=?').run(owner,session);return true;})
  },
  blob:{
   putOnce:async(path,bytes)=>tx(()=>{const row=db.prepare('SELECT size,digest,data FROM room_objects WHERE path=?').get(path);if(!row||row.data||row.size!==bytes.length||row.digest!==createHash('sha256').update(bytes).digest('hex')) throw Error('Invalid or duplicate object.');db.prepare('UPDATE room_objects SET data=? WHERE path=?').run(bytes,path);}),
   read:async(path,max)=>{const row=db.prepare('SELECT size,data FROM room_objects WHERE path=?').get(path);return row && row.size<=max && row.data?new Uint8Array(row.data):null;},
   deleteIfMatch:async(path,size,digest)=>tx(()=>{const row=db.prepare('SELECT size,digest,data,lease FROM room_objects WHERE path=?').get(path);if(!row||!row.lease||row.size!==size||row.digest!==digest||!row.data||createHash('sha256').update(row.data).digest('hex')!==digest)return false;db.prepare('UPDATE room_objects SET data=NULL WHERE path=?').run(path);return true;})
  },
  cleanup:{
   claim:async(owner,session,now)=>tx(()=>{const row=db.prepare('SELECT * FROM room_objects WHERE owner=? AND session=?').get(owner,session);if(!row||row.expires>now||row.lease||!row.data)return null;const lease=randomUUID();db.prepare('UPDATE room_objects SET lease=? WHERE owner=? AND session=?').run(lease,owner,session);return {path:row.path,bytes:row.size,sha256:row.digest,lease};}),
   finish:async(owner,session,lease)=>tx(()=>db.prepare('DELETE FROM room_objects WHERE owner=? AND session=? AND lease=? AND data IS NULL').run(owner,session,lease).changes===1)
  }
 };
}

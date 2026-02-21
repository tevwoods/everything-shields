import fs from 'fs';
import path from 'path';

const backupDir = path.join(process.cwd(), 'packs-backup-20251107-111953');
const newDir = path.join(process.cwd(), 'packs', 'Everything Shields');
const out = { generated: new Date().toISOString(), packs: {} };

if (!fs.existsSync(backupDir)) { console.error('Backup dir missing:', backupDir); process.exit(1); }
if (!fs.existsSync(newDir)) { console.error('New packs dir missing:', newDir); process.exit(1); }

const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
for (const file of files) {
  const base = file.replace('.db','');
  const oldPath = path.join(backupDir, file);
  const newPath = path.join(newDir, file);
  const packReport = { file, totalOld:0, totalNew:0, missingInNew:[], missingInOld:[], diffs: [] };
  if (!fs.existsSync(newPath)) { packReport.error = 'missing_new_file'; out.packs[base] = packReport; continue; }
  const oldLines = fs.readFileSync(oldPath,'utf8').split(/\r?\n/).filter(Boolean);
  const newLines = fs.readFileSync(newPath,'utf8').split(/\r?\n/).filter(Boolean);
  packReport.totalOld = oldLines.length; packReport.totalNew = newLines.length;
  const oldDocs = {};
  oldLines.forEach(l=>{ try{ const d=JSON.parse(l); oldDocs[d._id||d.id||d.name]=d }catch(e){ }
  });
  const newDocs = {};
  newLines.forEach(l=>{ try{ const d=JSON.parse(l); newDocs[d._id||d.id||d.name]=d }catch(e){ }
  });
  // Find missing ids
  for (const id of Object.keys(oldDocs)) {
    if (!newDocs[id]) packReport.missingInNew.push(id);
  }
  for (const id of Object.keys(newDocs)) {
    if (!oldDocs[id]) packReport.missingInOld.push(id);
  }
  // Compare documents present in both (limit to 20 diffs per pack)
  let diffsCount=0;
  for (const id of Object.keys(oldDocs)) {
    if (newDocs[id] && diffsCount<20) {
      const o=oldDocs[id]; const n=newDocs[id];
      const diff = { id, changes: [] };
      const oKeys = new Set(Object.keys(o));
      const nKeys = new Set(Object.keys(n));
      for (const k of oKeys) if (!nKeys.has(k)) diff.changes.push({ key:k, oldPresent:true, newPresent:false });
      for (const k of nKeys) if (!oKeys.has(k)) diff.changes.push({ key:k, oldPresent:false, newPresent:true });
      // check system->hp presence and types
      const oHp = o.system && o.system.hp; const nHp = n.system && n.system.hp;
      if ((!!oHp) !== (!!nHp)) diff.changes.push({ key:'system.hp.presence', old:!!oHp, new:!!nHp });
      if (oHp && nHp) {
        if (typeof oHp.value !== typeof nHp.value) diff.changes.push({ key:'system.hp.value.type', old:typeof oHp.value, new:typeof nHp.value });
        if (typeof oHp.max !== typeof nHp.max) diff.changes.push({ key:'system.hp.max.type', old:typeof oHp.max, new:typeof nHp.max });
      }
      if (diff.changes.length) { packReport.diffs.push(diff); diffsCount++; }
    }
  }
  out.packs[base]=packReport;
}

fs.writeFileSync(path.join(process.cwd(),'packs-migration-compare.json'), JSON.stringify(out,null,2));
console.log('Comparison written to packs-migration-compare.json');

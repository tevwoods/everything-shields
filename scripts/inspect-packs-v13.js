import fs from 'fs';
import path from 'path';

const PACKS_DIR = path.join(process.cwd(), 'packs-v13');
const report = {
  generated: new Date().toISOString(),
  packs: {}
};

function checkDoc(doc, packName) {
  const issues = [];
  if (!doc._id) issues.push('missing _id');
  if (!doc.name) issues.push('missing name');
  if (!doc.type) issues.push('missing type');
  if (!doc.system && doc.type !== 'JournalEntry') issues.push('missing system');
  if (!doc.schemaVersion) issues.push('missing schemaVersion');

  // Type-specific checks
  if (doc.type === 'armor' || doc.type === 'equipment' || doc.category === 'shield' || doc.type === 'Item') {
    // for shield items we expect hp and hardness
    if (doc.system) {
      if (doc.system.hp === undefined && !(doc.system.hp && typeof doc.system.hp.value === 'number')) {
        // try alternative shapes
        if (!doc.system.hp && !(doc.system?.attributes?.hp)) issues.push('missing hp');
      }
      if (doc.system.hardness === undefined && !(doc.system?.hardness >= 0)) issues.push('missing hardness');
    }
  }

  if (doc.type === 'action') {
    if (!doc.system?.actionType && !doc.system?.actions) issues.push('missing actionType/actions');
  }

  return issues;
}

function inspectPack(filePath) {
  const name = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  let docs;
  try {
    docs = JSON.parse(raw);
  } catch (e) {
    report.packs[name] = { error: 'invalid-json', message: e.message };
    return;
  }

  const packReport = {
    total: docs.length,
    invalidJson: false,
    examples: docs.slice(0,3).map(d => ({_id: d._id, name: d.name, type: d.type})),
    anomalies: []
  };

  docs.forEach((doc, i) => {
    const issues = checkDoc(doc, name);
    if (issues.length) {
      packReport.anomalies.push({ index: i, _id: doc._id || null, name: doc.name || null, type: doc.type || null, issues });
    }
  });

  report.packs[name] = packReport;
}

function main() {
  if (!fs.existsSync(PACKS_DIR)) {
    console.error('packs-v13 folder not found at', PACKS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.json'));
  files.forEach(f => inspectPack(path.join(PACKS_DIR, f)));

  const outPath = path.join(process.cwd(), 'packs-v13-inspection.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Inspection complete. Report written to', outPath);
}

main();

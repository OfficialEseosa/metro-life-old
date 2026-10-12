// Bounded static excerpts for REA 6.3's semantic node ceiling. Never executes the target.
import { parse } from 'file:///C:/Users/rapha/tools/rea/node_modules/@babel/parser/lib/index.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = 'C:/Users/rapha/tools/rea/analysis-inputs/features';
mkdirSync(root, { recursive: true });
const requests = [
  ['3hix095xid-pq.js', 'world-map', 'function({game:e,selected:o,onPick:a,ads:n=[]'],
  ['3hix095xid-pq.js', 'travel-vehicle', 'function rp('],
  ['3hix095xid-pq.js', 'traffic', 'function t9('],
  ['3hix095xid-pq.js', 'airport-crowd', 'walk:M.PHONE'],
  ['2wn1at3jbyiyr.js', 'travel-start', 'function sN('],
  ['2wn1at3jbyiyr.js', 'travel-arrive', 'function sP('],
  ['2wn1at3jbyiyr.js', 'home-walk', 'e.path.shift()'],
  ['2a6i2oyqx4umq.js', 'venue-view', 'function t7('],
];
const manifest = [];
for (const [name, label, anchor] of requests) {
  const source = path.resolve('reference/chunks', name); const text = readFileSync(source, 'utf8');
  const offset = text.indexOf(anchor); if (offset < 0) throw new Error(`Missing ${anchor}`);
  const ast = parse(text, { sourceType: 'unambiguous' }); let match;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (/Function/.test(node.type ?? '') && node.start <= offset && node.end > offset && (!match || node.end - node.start < match.end - match.start)) match = node;
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
  visit(ast); if (!match) throw new Error(`No function at ${offset}`);
  const excerpt = text.slice(match.start, match.end);
  const dir = path.join(root, label); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${label}.js`), `// Static excerpt from ${name}; UTF-16 offsets [${match.start},${match.end}). External bindings unresolved.\nconst extracted = (${excerpt});\n`);
  manifest.push({ label, source, source_sha256: createHash('sha256').update(text).digest('hex'), start_utf16: match.start, end_utf16: match.end, excerpt_sha256: createHash('sha256').update(excerpt).digest('hex'), input: dir });
}
writeFileSync('evidence/rea-study/feature-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.map(x => ({ label: x.label, units: x.end_utf16 - x.start_utf16 }))));

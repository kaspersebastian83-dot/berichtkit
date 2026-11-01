// Service Worker: jede offline vorgehaltene Datei gibt es, und jede Skriptdatei der Seite ist dabei.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(root, a)), 'fehlt: ' + a);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) if (!/^https?:/.test(m[1])) assert.ok(assets.includes('./' + m[1]), 'nicht offline: ' + m[1]);
// Leiste byte-gleich mit LabelKit (falls daneben ausgecheckt)
const lk = path.join(root, '..', 'labelkit', 'index.html');
if (fs.existsSync(lk)) {
  // Marker ohne Versionsnummer – ein fehlender Marker darf nicht zwei leere Ausschnitte vergleichen (Review 1.16.0)
  const block = t => { const a = t.indexOf('/* ===== MOSAIK-LEISTE v'), e = t.indexOf('/* ===== Ende MOSAIK-LEISTE v'); assert.ok(a >= 0 && e > a, 'Leisten-Block fehlt'); return t.slice(a, e); };
  assert.equal(block(fs.readFileSync(path.join(root, 'mosaik-leiste.js'), 'utf8')), block(fs.readFileSync(lk, 'utf8')), 'Leiste wie in LabelKit');
}
console.log(`Service Worker: ${assets.length} Dateien, alle vorhanden` + (fs.existsSync(lk) ? '; Leiste gleich wie LabelKit' : ''));

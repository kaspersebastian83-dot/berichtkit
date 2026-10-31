// Brandbericht festgeschrieben (node tests/brand-golden.cjs): Die Modelle der erfundenen Brand-Beispielberichte
// (tests/daten/brand.cjs) müssen genau dem gespeicherten Stand entsprechen – Texte, Reihenfolge der Hinweise, Lücken, Anlagen.
// Gespeichert aus 1.12.0 (Schritt 3, Gerüst – mit der Sperre „noch im Aufbau“). Ändert sich der Brandbericht gewollt
// (Schritt 4/5): node tests/brand-golden.cjs --neu und die Änderung in tests/daten/brand-golden.json im Diff ansehen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const T = require('../bericht-text.js'), B = require('./daten/beispiel.cjs'), { faelle } = require('./daten/brand.cjs');
const DATEI = path.join(__dirname, 'daten', 'brand-golden.json');
const jetzt = {};
for (const [name, f] of Object.entries(faelle)) {
  const m0 = T.bericht({ cfg: B.cfg, mitarbeiter: B.mitarbeiter, ...f });
  jetzt[name] = JSON.parse(JSON.stringify(m0.sperren.length ? T.alsEntwurf(m0) : m0));
}
if (process.argv.includes('--neu')) { fs.writeFileSync(DATEI, JSON.stringify(jetzt, null, 1) + '\n'); console.log('brand-golden.json neu geschrieben'); return; }
const gespeichert = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
assert.deepEqual(Object.keys(jetzt), Object.keys(gespeichert), 'andere Beispielfälle');
for (const name of Object.keys(jetzt)) {
  assert.deepEqual(jetzt[name], gespeichert[name], `${name}: Brandbericht weicht vom festgeschriebenen Stand ab (gewollt? → --neu)`);
  assert.equal(JSON.stringify(jetzt[name]), JSON.stringify(gespeichert[name]), `${name}: gleicher Inhalt, andere Reihenfolge der Felder`);
}
console.log(`Brandbericht: ${Object.keys(jetzt).length} Beispielberichte wie festgeschrieben`);

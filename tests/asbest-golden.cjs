// Asbestbericht festgeschrieben (node tests/asbest-golden.cjs): Die Modelle der Beispielberichte (tests/daten/faelle.cjs) müssen
// genau dem gespeicherten Stand entsprechen – Texte, Reihenfolge der Hinweise, Aufbau. Schützt den Asbestbericht, während
// gemeinsame Bausteine für weitere Berichtsarten umgebaut werden. Gespeichert aus 1.10.0; geprüft gleich mit 1.9.0 (bis auf die
// neuen Tabellenfelder spalten/ohneUmbruch). Ändert sich der Asbestbericht gewollt: node tests/asbest-golden.cjs --neu
// und die Änderung in tests/daten/asbest-golden.json im Diff ansehen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const T = require('../bericht-text.js'), B = require('./daten/beispiel.cjs'), { faelle } = require('./daten/faelle.cjs');
const DATEI = path.join(__dirname, 'daten', 'asbest-golden.json');
const jetzt = {};
for (const [name, f] of Object.entries(faelle)) {
  const m0 = T.bericht({ ...f, cfg: B.cfg, mitarbeiter: B.mitarbeiter });
  jetzt[name] = JSON.parse(JSON.stringify(f.entwurf ? T.alsEntwurf(m0) : m0));
}
if (process.argv.includes('--neu')) { fs.writeFileSync(DATEI, JSON.stringify(jetzt, null, 1) + '\n'); console.log('asbest-golden.json neu geschrieben'); return; }
const gespeichert = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
assert.deepEqual(Object.keys(jetzt), Object.keys(gespeichert), 'andere Beispielfälle');
for (const name of Object.keys(jetzt)) {
  assert.deepEqual(jetzt[name], gespeichert[name], `${name}: Asbestbericht weicht vom festgeschriebenen Stand ab (gewollt? → --neu)`);
  assert.equal(JSON.stringify(jetzt[name]), JSON.stringify(gespeichert[name]), `${name}: gleicher Inhalt, andere Reihenfolge der Felder`);
}
console.log(`Asbestbericht: ${Object.keys(jetzt).length} Beispielberichte wie festgeschrieben`);

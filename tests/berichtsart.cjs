// Berichtsart und Aufteilung der Textbausteine (node tests/berichtsart.cjs): bericht-text.js wählt die Berichtsart,
// bericht-gemeinsam.js / bericht-asbest.js liefern die Bausteine; Word-Ausgabe mit Spaltenbreiten je Tabelle und Unterüberschrift.
// Die Word-Datei entsteht mit derselben docx-Bibliothek wie in der App (vendor/docx.iife.js) – keine zusätzliche Abhängigkeit.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
const T = require('../bericht-text.js'), G = require('../bericht-gemeinsam.js'), A = require('../bericht-asbest.js'), W = require('../bericht-docx.js');
const B = require('./daten/beispiel.cjs');
const D = vm.runInThisContext('(function(){' + fs.readFileSync(path.join(ROOT, 'vendor/docx.iife.js'), 'utf8') + '\n;return docx;})()');
let n = 0; const fall = async (name, fn) => { await fn(); n++; console.log('ok –', name); };
const form = (o = {}) => ({ datum: '2026-10-27', mitteilung: 1, variante: 'eigen', probenehmer: 'Mes', sv: 'Tst', mt: 'Mes', ...o });
const eingabe = f => ({ pj: B.pj(), lk: B.lk([[1, '2026-10-16', 'Umkleide Schwimmbad', 'Fliesenkleber', 'Bituminöse Proben / Kleber']]),
  erg: B.erg([[1, 'chrysotil']]), cfg: B.cfg, mitarbeiter: B.mitarbeiter, form: f });
/** Eine Datei aus einem ZIP (Word-Datei → word/document.xml) */
function zipDatei(buf, name) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0, k = buf.readUInt16LE(eocd + 10); i < k; i++) {
    const methode = buf.readUInt16LE(p + 10), groesse = buf.readUInt32LE(p + 20), lName = buf.readUInt16LE(p + 28), ofs = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + lName) === name) {
      const start = ofs + 30 + buf.readUInt16LE(ofs + 26) + buf.readUInt16LE(ofs + 28), daten = buf.subarray(start, start + groesse);
      return (methode === 8 ? zlib.inflateRawSync(daten) : daten).toString('utf8');
    }
    p += 46 + lName + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return null;
}
const bilder = { logoSvg: fs.readFileSync(path.join(ROOT, 'assets/logo-schiffers.svg')), logoPng: fs.readFileSync(path.join(ROOT, 'assets/logo-schiffers.png')), sig: {}, fotos: {} };
const wordXml = async m => zipDatei(await D.Packer.toBuffer(W.erstellen(D, m, bilder)), 'word/document.xml');

(async () => {
  await fall('Berichtsarten: Asbest bereit, Brand angekündigt', () => {
    assert.deepEqual(T.BERICHTSARTEN.map(a => [a.art, a.bereit]), [['asbest', true], ['brand', false]]);
    assert.equal(T.berichtsart({}), 'asbest'); assert.equal(T.berichtsart(null), 'asbest');
    assert.equal(T.berichtsart({ art: ' Brand ' }), 'brand');
  });

  await fall('bericht(): ohne art = art „asbest“ = Asbestmodul direkt', () => {
    const ohne = T.bericht(eingabe(form())), mit = T.bericht(eingabe(form({ art: 'asbest' }))), direkt = A.bericht(eingabe(form()));
    assert.deepEqual(mit, ohne); assert.deepEqual(direkt, ohne);
    assert.equal(ohne.deckblatt.titel, 'Untersuchungsbericht vom 27.10.2026'); assert.equal(ohne.kopf[0], ohne.deckblatt.titel);
  });

  await fall('bericht(): Berichtsart ohne Modul wirft – nie ein Asbestbericht stattdessen', () => {
    assert.throws(() => T.bericht(eingabe(form({ art: 'brand' }))), /Berichtsart „brand“ gibt es in BerichtKit noch nicht/);
    assert.throws(() => T.bericht(eingabe(form({ art: 'pak' }))), /„pak“/);
  });

  await fall('Fassade gibt die gemeinsamen Bausteine unverändert weiter', () => {
    for (const k of ['person', 'svVorschlag', 'projektSicht', 'probenSammeln', 'alsEntwurf', 'text', 'mitArtikel', 'raumAusschreiben', 'asbestBefund'])
      assert.equal(T[k], G[k], k);
  });

  await fall('Asbest Tabelle 1: Spaltenbreiten und Labor-Nr. ohne Umbruch stehen im Modell', () => {
    const tab = T.bericht(eingabe(form())).abschnitte[2].inhalt.find(x => x.t === 'tab');
    assert.deepEqual(tab.spalten, [950, 2080, 2240, 1850, 1950]); assert.equal(tab.spalten.reduce((a, b) => a + b), 9070);
    assert.deepEqual(tab.ohneUmbruch, [1]); assert.equal(tab.spalten.length, tab.kopf.length);
  });

  await fall('Word: Spalten aus dem Modell, sonst gleich breit; Unterüberschrift kursiv, nicht unterstrichen', async () => {
    const m = T.bericht(eingabe(form()));
    m.abschnitte.push({ titel: '5. Befund (Probe)', inhalt: [
      { t: 'h2', runs: ['5.1 Chlorid ', { gap: '[Raum]' }] },
      { t: 'tab', caption: 'Tabelle 2: Gleich breit', kopf: ['A', 'B', 'C'], zeilen: [['1-2', 'x', 'y']] },
      { t: 'tab', caption: 'Tabelle 3: Eigene Breiten', kopf: ['A', 'B'], spalten: [2000, 7070], zeilen: [['a', 'b']] },
      { t: 'p', runs: ['Schluss.'] },
    ] });
    const xml = await wordXml(m);
    const grids = [...xml.matchAll(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g)].map(g => [...g[1].matchAll(/w:w="(\d+)"/g)].map(x => +x[1]));
    assert.deepEqual(grids.slice(0, 3), [[950, 2080, 2240, 1850, 1950], [3023, 3023, 3024], [2000, 7070]]);
    const h2 = (xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?5\.1 Chlorid[\s\S]*?<\/w:p>/) || [])[0];   // genau dieser Absatz
    assert.ok(h2, 'Unterüberschrift im Dokument');
    assert.match(h2, /<w:outlineLvl w:val="1"\/>/); assert.match(h2, /<w:keepNext\/>/); assert.match(h2, /<w:i\/>/);
    assert.doesNotMatch(h2, /<w:u /); assert.match(h2, /w:highlight w:val="yellow"/);   // Lücke bleibt gelb
    // Labor-Nr. (Tabelle 1, Spalte 2) mit geschütztem Bindestrich, sonst nirgends; „1-2“ in Tabelle 2 bleibt normaler Text
    const tabellen = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g), zellen = tab => tab.split('<w:tr>')[2].split('<w:tc>').slice(1);
    const z1 = zellen(tabellen[0]);
    assert.ok(z1[1].includes('<w:noBreakHyphen/>'), 'Labor-Nr. ohne Umbruch'); assert.ok(!z1.filter((_, i) => i !== 1).some(z => z.includes('noBreakHyphen')));
    assert.equal(xml.split('<w:noBreakHyphen/>').length - 1, 2, 'nur die Bindestriche der Labor-Nr. 999-2026-0000101');
    assert.match(zellen(tabellen[1])[0], />1-2<\/w:t>/);
  });

  await fall('Word: falsche Spaltenangaben fallen auf statt einer verschobenen Tabelle', async () => {
    const mit = tab => { const m = T.bericht(eingabe(form())); m.abschnitte[2].inhalt = [tab]; return m; };
    const tab = { t: 'tab', caption: 'Tabelle X', kopf: ['A', 'B'], zeilen: [['a', 'b']] };
    await assert.rejects(async () => wordXml(mit({ ...tab, spalten: [4000, 4000] })), /Tabelle X: spalten müssen 2 Breiten mit zusammen 9070/);
    await assert.rejects(async () => wordXml(mit({ ...tab, spalten: [9070] })), /spalten müssen 2 Breiten/);
    await assert.rejects(async () => wordXml(mit({ ...tab, zeilen: [['a', 'b', 'c']] })), /Zeile mit anderer Spaltenzahl/);
  });

  console.log(`${n} Fälle bestanden.`);
})().catch(e => { console.error(e); process.exit(1); });

// Lücken-Kommentare in der Word-Datei (node tests/luecken-kommentare.cjs): Zu jeder gelben Lücke steht ein Kommentar am Rand
// („Noch ausfüllen: …“, Autor „BerichtKit“, Initialen „BK“) – an jeder Stelle auf dem Deckblatt, im Text, in Tabellen, Unterschriften
// und Anlagen. Ausnahme Kopfzeile der Folgeseiten: Einen Kommentar dort lädt LibreOffice nicht („source file could not be loaded“);
// jede Kopf-Lücke steht auch auf dem Deckblatt oder im Text und hat dort ihren Kommentar – geprüft unten.
// Gelber Text und [Großbuchstabe …] bleiben, damit die Projektzentrale (word-luecken.js) bei der Übergabe dieselben Lücken findet
// wie vor den Kommentaren. Liegt ../projektzentrale daneben (CI), läuft deren word-luecken.js gegen dieselben Dateien.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
const T = require('../bericht-text.js'), W = require('../bericht-docx.js'), BL = require('../bericht-luecken.js'), B = require('./daten/beispiel.cjs'), { faelle } = require('./daten/faelle.cjs');
const BD = require('./daten/brand.cjs'), BRAND = Object.entries(BD.faelle).map(([name, f]) => [name, { ...f, entwurf: true }]);   // Brand als Entwurf: Kennzeile „ENTWURF“ im Kopf mitgeprüft
const D = vm.runInThisContext('(function(){' + fs.readFileSync(path.join(ROOT, 'vendor/docx.iife.js'), 'utf8') + '\n;return docx;})()');
const PZ = path.join(ROOT, '..', 'projektzentrale', 'word-luecken.js');
const WL = fs.existsSync(PZ) ? require(PZ) : null;
if (!WL && process.env.SPEKTRON_ORDNER_PFLICHT) throw new Error('../projektzentrale/word-luecken.js fehlt (CI klont die Projektzentrale daneben)');
let n = 0; const fall = async (name, fn) => { await fn(); n++; console.log('ok –', name); };

/** Alle Teile einer Word-Datei (ZIP) als Text */
function teile(buf) {
  const out = {}, eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0, k = buf.readUInt16LE(eocd + 10); i < k; i++) {
    const methode = buf.readUInt16LE(p + 10), groesse = buf.readUInt32LE(p + 20), lName = buf.readUInt16LE(p + 28), ofs = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + lName);
    const start = ofs + 30 + buf.readUInt16LE(ofs + 26) + buf.readUInt16LE(ofs + 28), daten = buf.subarray(start, start + groesse);
    out[name] = (methode === 8 ? zlib.inflateRawSync(daten) : daten).toString('utf8');
    p += 46 + lName + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}
const TEXTTEILE = /^word\/(document|header\d*|footer\d*)\.xml$/, KOPF = /^word\/(header|footer)\d*\.xml$/;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const entschluesseln = s => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENT[e]);
/** Kommentare aus word/comments.xml: [{ id, author, initials, text }] */
const kommentare = xml => [...(xml || '').matchAll(/<w:comment ([^>]*)>([\s\S]*?)<\/w:comment>/g)].map(([, attr, inhalt]) => ({
  id: +/w:id="(\d+)"/.exec(attr)[1], author: (/w:author="([^"]*)"/.exec(attr) || [])[1], initials: (/w:initials="([^"]*)"/.exec(attr) || [])[1],
  text: entschluesseln([...inhalt.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(x => x[1]).join('')) }));
/** Je Kommentarbereich der gelbe Text dazwischen: { id → '[…]' }, dazu wie oft Anfang, Ende und Verweis vorkommen */
function bereiche(tt) {
  const text = {}, zahl = { start: {}, ende: {}, ref: {} };
  for (const [name, xml] of Object.entries(tt)) {
    if (!TEXTTEILE.test(name)) continue;
    for (const [, art, id] of xml.matchAll(/<w:comment(RangeStart|RangeEnd|Reference) w:id="(\d+)"\/>/g)) {
      const k = art === 'RangeStart' ? 'start' : art === 'RangeEnd' ? 'ende' : 'ref'; zahl[k][id] = (zahl[k][id] || 0) + 1;
    }
    for (const [, id, zwischen] of xml.matchAll(/<w:commentRangeStart w:id="(\d+)"\/>([\s\S]*?)<w:commentRangeEnd w:id="\1"\/>/g)) {
      assert.match(zwischen, /<w:highlight w:val="yellow"\/>/, `Kommentar ${id}: Text im Bereich ist gelb`);
      text[id] = entschluesseln([...zwischen.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(x => x[1]).join(''));
    }
  }
  return { text, zahl };
}
/** Gelbe Textläufe (jede Lücke ist genau ein gelber Lauf): Texte, wahlweise nur Kopf-/Fußzeilen oder nur der Rest */
const gelbeTexte = (tt, nurKopf) => Object.entries(tt).filter(([k]) => TEXTTEILE.test(k) && KOPF.test(k) === nurKopf)
  .flatMap(([, xml]) => [...xml.matchAll(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:highlight w:val="yellow"\/>(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>([^<]*)<\/w:t>/g)].map(x => entschluesseln(x[1])));
const gelbeLaeufe = tt => gelbeTexte(tt, false).length;
/** Ohne Kommentar-Markup – so sah die Datei vor 1.11.0 aus (Prüfung: word-luecken.js findet darin dasselbe) */
const ohneKommentare = xml => xml.replace(/<w:commentRange(?:Start|End) w:id="\d+"\/>|<w:r>(?:<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>)?<w:commentReference w:id="\d+"\/><\/w:r>/g, '');

const bilder = { logoSvg: fs.readFileSync(path.join(ROOT, 'assets/logo-schiffers.svg')), logoPng: fs.readFileSync(path.join(ROOT, 'assets/logo-schiffers.png')), sig: {}, fotos: {} };
const wordVon = async (m, optionen, mitBildern = bilder) => { const buf = await D.Packer.toBuffer(W.erstellen(D, m, mitBildern, optionen)); return { buf, tt: teile(buf) }; };
/** Brandbericht ab 1.14.0 mit Fotos: alle Fotos lesbar außer IMG_0201.jpg (BR4 – dort zusätzlich Bildunterschrift als Lücke) */
const TESTFOTO = { data: fs.readFileSync(path.join(__dirname, 'daten', 'testfoto.jpg')), w: 480, h: 320 };
const brandBilder = m => { const fotos = {}; for (const a of m.abschnitte) for (const x of a.inhalt) if (x.t === 'fig' && x.datei !== 'IMG_0201.jpg') fotos[x.label] = TESTFOTO; return { ...bilder, fotos }; };
const ohneBild = (m, b) => m.abschnitte.flatMap(a => a.inhalt).filter(x => x.t === 'fig' && !b.fotos[x.label]).map(x => x.datei);
/** Nummern, die sich durch die zusätzliche Datei comments.xml verschieben (Beziehungen, Zeichnungs-Ids), angleichen */
const angleichen = xml => xml.replace(/rId\d+/g, 'rId').replace(/docPr id="\d+"/g, 'docPr id=""');
const modellVon = (f, cfg = B.cfg) => { const m0 = T.bericht({ cfg, ...f, mitarbeiter: B.mitarbeiter }); return f.entwurf ? T.alsEntwurf(m0) : m0; };

/** Prüft eine Word-Datei: genau ein Kommentar je gelber Lücke außerhalb der Kopfzeilen, Text „Noch ausfüllen: …“, Autor
    BerichtKit/BK; Kopfzeilen ohne Kommentar, jede Kopf-Lücke hat einen Kommentar auf dem Deckblatt oder im Text → Kommentare */
function kommentareGenau(tt, name) {
  const ks = kommentare(tt['word/comments.xml']), { text, zahl } = bereiche(tt), gelb = gelbeLaeufe(tt);
  assert.equal(ks.length, gelb, `${name}: ${gelb} gelbe Lücken (ohne Kopf), ${ks.length} Kommentare`);
  for (const [k, xml] of Object.entries(tt)) if (KOPF.test(k)) assert.ok(!/<w:comment/.test(xml), `${name} ${k}: kein Kommentar in der Kopfzeile`);
  const kommentiert = new Set(ks.map(k => '[' + k.text.slice('Noch ausfüllen: '.length) + ']'));
  for (const g of gelbeTexte(tt, true)) assert.ok(kommentiert.has(g), `${name}: Kopf-Lücke ${g} hat einen Kommentar auf dem Deckblatt oder im Text`);
  assert.deepEqual(ks.map(k => k.id), ks.map((_, i) => i), `${name}: Kommentar-Nummern 0 … n−1`);
  for (const k of ks) {
    assert.equal(k.author, 'BerichtKit'); assert.equal(k.initials, 'BK');
    for (const art of ['start', 'ende', 'ref']) assert.equal(zahl[art][k.id], 1, `${name}: Kommentar ${k.id} – ${art} genau einmal im Dokument`);
    assert.ok(text[k.id], `${name}: Kommentar ${k.id} umschließt eine Lücke`);
    assert.match(text[k.id], /^\[[A-ZÄÖÜ][^\[\]]*\]$/, `${name}: Lückentext bleibt [Großbuchstabe …]`);
    assert.equal(k.text, 'Noch ausfüllen: ' + text[k.id].slice(1, -1), `${name}: Kommentartext zur Lücke ${text[k.id]}`);
  }
  assert.equal(Object.keys(zahl.start).length, ks.length, `${name}: kein Kommentarbereich ohne Kommentar`);
  return ks;
}

/** Vorkommen jeder Lücke im Modell mit Kommentar, in der Reihenfolge, wie bericht-docx.js sie schreibt: Deckblatt, Text,
    Unterschriften, Anlagen (der Kopf der Folgeseiten bekommt keine Kommentare) */
function modellLuecken(m, b = bilder) {
  const out = [], lauf = x => { if (!x) return; if (Array.isArray(x)) x.forEach(lauf); else if (typeof x === 'object') { if (x.gap) out.push(x.gap); else Object.values(x).forEach(lauf); } };
  if (!m.deckblatt.projektnummer) out.push('[Projektnummer]');
  lauf([m.deckblatt.betreff, m.deckblatt.felder.map(f => f[1])]);
  for (const a of m.abschnitte) for (const x of a.inhalt) {
    if (x.t === 'fig') { if (!b.fotos[x.label]) out.push(`[Foto fehlt: ${x.datei}]`); lauf(x.caption); }   // Bildunterschrift (Freitext) kann eine Lücke sein
    else lauf(x.runs || x.zeilen);
  }
  lauf(m.unterschriften.map(u => [u.rolle, u.name])); lauf((m.anlagenTeile || []).map(a => a.zeilen));
  return out;
}

/** Ein Bericht mit Lücken an jeder Stelle: Deckblatt, Kopf, Text, Foto, Unterschrift, Anlagen (erfundene Daten) */
const VIELE = { pj: B.pj({ projektnummer: '', auftragsdatum: '', objekt: '', versicherungsnehmer: '', auftraggeber: '' }),
  lk: B.lk([[1, '', '', '', 'Sonstige'], [2, '', 'Dachboden', 'Dämmstoff Mineralwolle', 'Sonstige']]),
  erg: (e => { e.berichte[0].proben[1].werte = e.berichte[0].proben[1].werte.filter(w => !/Kanzero/.test(w.p)); return e; })(B.erg([[1, 'chrysotil'], [2, 'kmf']])),
  form: { datum: '2026-10-27', mitteilung: 2, variante: 'eigen', probenehmer: '', sv: '', mt: '', labor: '', deckblatt: 'versicherung' },
  fotos: { P2: [{ datei: 'z.jpg' }] } };

(async () => {
  await fall('C_zugestellt_luecken: comments.xml mit einem Kommentar je Lücke, Autor BerichtKit, „Noch ausfüllen: …“', async () => {
    const m = modellVon(faelle.C_zugestellt_luecken), { tt } = await wordVon(m);
    assert.ok(tt['word/comments.xml'], 'word/comments.xml vorhanden');
    assert.match(tt['word/_rels/document.xml.rels'], /relationships\/comments" Target="comments.xml"/);
    const ks = kommentareGenau(tt, 'C');
    assert.deepEqual(ks.map(k => k.text), modellLuecken(m).map(g => 'Noch ausfüllen: ' + g.slice(1, -1)));
    // [Eingangsdatum] steht viermal: Betreff auf dem Deckblatt und 1. Veranlassung mit je einem Kommentar, im Kopf der
    // Folgeseiten (zwei Kopf-Dateien) gelb ohne Kommentar
    const zahl = t => ks.filter(k => k.text === 'Noch ausfüllen: ' + t).length;
    assert.equal(zahl('Eingangsdatum'), 2); assert.equal(zahl('Sachverständige(r)'), 1); assert.equal(ks.length, 3);
    assert.deepEqual(gelbeTexte(tt, true), ['[Eingangsdatum]', '[Eingangsdatum]'], 'Kopf: Lücke gelb, ohne Kommentar');
    // Kommentar in der Unterschriftentabelle
    const sigTab = tt['word/document.xml'].match(/<w:tbl>(?:(?!<\/w:tbl>)[\s\S])*Sachverständige\(r\)\]<\/w:t>(?:(?!<\/w:tbl>)[\s\S])*<\/w:tbl>/);
    assert.ok(sigTab && /<w:commentReference w:id="\d+"\/>/.test(sigTab[0]), 'Kommentar in der Unterschriftentabelle');
  });

  await fall('Lücken an jeder Stelle (Deckblatt, Text, Foto, Unterschrift, Anlagen): Kommentare = Lücken im Modell, gleiche Reihenfolge', async () => {
    const m = modellVon(VIELE, { ...B.cfg, labor: '' }), { tt } = await wordVon(m);
    const ks = kommentareGenau(tt, 'viele');
    const erwartet = modellLuecken(m);
    assert.ok(erwartet.length >= 16, `viele Lücken (${erwartet.length})`);
    // Reihenfolge der Kommentar-Nummern = Reihenfolge, in der bericht-docx.js baut: Deckblatt, Text, Unterschrift, Anlagen
    assert.deepEqual(ks.map(k => k.text), erwartet.map(g => 'Noch ausfüllen: ' + g.slice(1, -1)));
    for (const g of ['[Projektnummer]', '[VN]', '[Labor]', '[Foto fehlt: z.jpg]', '[KI-Wert]', '[Sachverständige(r)]']) assert.ok(erwartet.includes(g), g);
    for (const g of m.luecken) assert.ok(erwartet.includes(g), `Modell-Lücke ${g} im Dokument`);
    // Zähler/Rückfrage (offene mit dem nicht lesbaren Foto) = genau die Lücken in der Word-Datei, Kopf eingeschlossen
    const inWord = new Set([...gelbeTexte(tt, false), ...gelbeTexte(tt, true)]);
    assert.deepEqual([...new Set(BL.offene(m, ['z.jpg']))].sort(), [...inWord].sort());
  });

  await fall('Brandbericht: ein Kommentar je Lücke (Deckblatt „Schaden vom:“, Text, Freitext mit Lücke, Bildunterschrift, Foto fehlt), Kopf-Lücken kommentiert', async () => {
    for (const [name, f] of BRAND) {
      const m = modellVon(f), b = brandBilder(m), { tt } = await wordVon(m, undefined, b);
      const ks = kommentareGenau(tt, name);
      assert.deepEqual(ks.map(k => k.text), modellLuecken(m, b).map(g => 'Noch ausfüllen: ' + g.slice(1, -1)), `${name}: Reihenfolge wie im Modell`);
      const inWord = new Set([...gelbeTexte(tt, false), ...gelbeTexte(tt, true)]);
      assert.deepEqual([...new Set(BL.offene(m, ohneBild(m, b)))].sort(), [...inWord].sort(), `${name}: Zähler = Lücken in Word`);
    }
    // Freitext ab 1.14.0: Lücke im Text, Bildunterschrift ohne Beschreibung und nicht lesbares Foto haben je einen Kommentar
    const br4 = modellVon(BRAND.find(([n]) => n === 'BR4_Gewerbe_Teilnehmerliste_ENTWURF')[1]), k4 = kommentareGenau((await wordVon(br4, undefined, brandBilder(br4))).tt, 'BR4');
    for (const t of ['Foto fehlt: IMG_0201.jpg', 'Bildunterschrift ergänzen', 'Sanierungsmaßnahmen Gebäude beschreiben']) assert.ok(k4.some(k => k.text === 'Noch ausfüllen: ' + t), t);
    const br1 = modellVon(BRAND.find(([n]) => n === 'BR1_voll_Versicherung')[1]), w1 = await wordVon(br1, undefined, brandBilder(br1));
    assert.ok(kommentareGenau(w1.tt, 'BR1').some(k => k.text === 'Noch ausfüllen: Zustand des Bodenbelags prüfen'), 'Lücke im Freitext');
    assert.equal((w1.tt['word/document.xml'].match(/<pic:pic /g) || []).length, 3, 'BR1: drei Fotos (Asbestprobe + zwei aus dem Freitext)');
    // „Schaden vom:⇥[Schadendatum]“ auf dem Deckblatt mit Tab wie die Projektnummer; im Kopf „Brandschaden vom [Schadendatum]“ ohne Kommentar
    const { tt } = await wordVon(modellVon(BRAND.find(([n]) => n === 'BR3_Luecken')[1]));
    const zeile = tt['word/document.xml'].match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Schaden vom:(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)[0];
    assert.match(zeile, /<w:tab w:val="left" w:pos="3960"\/>/); assert.match(zeile, /<w:tab\/>/); assert.match(zeile, /<w:commentRangeStart w:id="0"\/>/);
    assert.deepEqual(gelbeTexte(tt, true).filter(g => g === '[Schadendatum]').length, 2, 'Kopf (zwei Kopfdateien): gelb ohne Kommentar');
  });

  await fall('Ohne Lücken: keine Kommentare', async () => {
    const { tt } = await wordVon(modellVon(faelle.D_ENTWURF_vorlaeufig));
    assert.equal(kommentare(tt['word/comments.xml']).length, 0); assert.equal(gelbeLaeufe(tt), 0);
    assert.ok(!/commentRangeStart|commentReference/.test(Object.values(tt).join('')));
    assert.equal(tt['word/comments.xml'], undefined, 'ohne Kommentare keine comments.xml (wie bis 1.10.0)');
  });

  await fall('Kommentare in Unterüberschrift und Tabellenzelle (Lücken als Runs im Modell)', async () => {
    const m = modellVon(faelle.A_positiv_eine_Probe);
    m.abschnitte.push({ titel: '5. Test', inhalt: [{ t: 'h2', runs: ['5.1 ', { gap: '[Raum eintragen]' }] },
      { t: 'tab', caption: 'Tabelle 9', kopf: ['A', 'B'], zeilen: [[{ gap: '[Wert]' }, 'x']] }] });
    const { tt } = await wordVon(m), ks = kommentareGenau(tt, 'h2/tab');
    for (const t of ['Raum eintragen', 'Wert']) assert.ok(ks.some(k => k.text === 'Noch ausfüllen: ' + t), t);
    const h2 = tt['word/document.xml'].match(/<w:p\b(?:(?!<\/w:p>)[\s\S])*Raum eintragen(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)[0];
    assert.match(h2, /<w:i\/>/, 'Lücke in der Unterüberschrift bleibt kursiv'); assert.match(h2, /<w:commentRangeStart/);
  });

  await fall('Gelber Text und Klammern unverändert – ohne Kommentar-Markup Wort für Wort gleich wie ohne Kommentare (Stand 1.10.0)', async () => {
    for (const [name, f] of [...Object.entries(faelle), ['VIELE', VIELE], ...BRAND]) {
      const m = modellVon(f, name === 'VIELE' ? { ...B.cfg, labor: '' } : B.cfg);
      const { tt } = await wordVon(m), { tt: vorher } = await wordVon(m, { kommentare: false });
      assert.equal(vorher['word/comments.xml'], undefined, `${name}: ohne Kommentare keine comments.xml`);
      for (const [k, xml] of Object.entries(tt)) if (TEXTTEILE.test(k)) {
        const ohne = ohneKommentare(xml);
        assert.ok(!/comment/.test(ohne), `${name} ${k}: Kommentar-Markup vollständig erkannt`);
        assert.equal(angleichen(ohne), angleichen(vorher[k]), `${name} ${k}: außer den Kommentaren nichts geändert`);
        // Jeder Kommentar-Verweis steht in einem eigenen Lauf ohne Text direkt hinter dem Bereichsende
        assert.equal((xml.match(/<w:commentRangeEnd w:id="(\d+)"\/><w:r>(?:<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>)?<w:commentReference w:id="\1"\/><\/w:r>/g) || []).length,
          (xml.match(/<w:commentReference/g) || []).length, `${name} ${k}: Verweis hinter dem Bereich`);
      }
    }
  });

  await fall('Kopf-Lücken: jede steht mit gleichem Namen auch auf dem Deckblatt oder im Text – für alle Kombinationen der Projektdaten', () => {
    const werte = { vn: ['', 'Muster Hausverwaltung GmbH, Hauptstr. 5, 12345 Musterstadt'], ag: ['', 'Beispiel Versicherung AG', 'VN'],
      objekt: ['', 'Musterweg 12, 12345 Musterstadt'], versicherer: ['', 'Andere Versicherung AG'], variante: ['eigen', 'zugestellt'],
      deckblatt: ['', 'versicherung', 'direkt'], projektnummer: ['', '99.9001'], eingang: ['', '2026-10-20'] };
    let k = 0;
    const kombis = Object.entries(werte).reduce((acc, [schl, ws]) => acc.flatMap(a => ws.map(w => ({ ...a, [schl]: w }))), [{}]);
    for (const c of kombis) {
      const pj = B.pj({ versicherungsnehmer: c.vn, auftraggeber: c.ag === 'VN' ? c.vn : c.ag, objekt: c.objekt, versicherer: c.versicherer, projektnummer: c.projektnummer });
      const m = T.bericht({ pj, lk: B.lk([[1, '2026-10-16', 'Keller', 'Putz', 'Putze / Spachtelmassen']]), erg: B.erg([[1, 'kein']]), cfg: B.cfg, mitarbeiter: B.mitarbeiter,
        form: { datum: '2026-10-27', mitteilung: 1, variante: c.variante, probenehmer: 'Mes', sv: 'Tst', deckblatt: c.deckblatt, eingangsdatum: c.eingang } });
      const kopf = [], lauf = (x, out) => { if (Array.isArray(x)) x.forEach(y => lauf(y, out)); else if (x && typeof x === 'object') { if (x.gap) out.push(x.gap); else Object.values(x).forEach(y => lauf(y, out)); } };
      lauf(m.kopf, kopf);
      const rest = new Set(modellLuecken(m));
      for (const g of kopf) assert.ok(rest.has(g), `${JSON.stringify(c)}: Kopf-Lücke ${g} hat keinen Kommentar woanders`);
      // Zähler/Rückfrage (bericht-luecken.js offene) = alle Lücken, die in der Word-Datei stehen (ohne [Foto fehlt], das entsteht beim Speichern)
      assert.deepEqual([...new Set(BL.offene(m))].sort(), [...new Set([...rest, ...kopf])].sort(), `${JSON.stringify(c)}: Zähler = Lücken in Word`);
      k++;
    }
    assert.equal(k, 2 * 3 * 2 * 2 * 2 * 3 * 2 * 2);
  });

  await fall('Brandbericht – Kopf-Lücken: jede steht mit gleichem Namen auch auf dem Deckblatt oder im Text – für alle Kombinationen', () => {
    // Kopf: Titel, „Brandschaden vom [Schadendatum]“ / „Brandschaden“, VN bzw. AG, Risiko bzw. Schadenort ([Objekt] → Satz 1 in 1.)
    const werte = { vn: ['', 'Muster Hausverwaltung GmbH, Hauptstr. 5, 12345 Musterstadt'], ag: ['', 'Beispiel Versicherung AG', 'VN'],
      objekt: ['', 'Brandweg 7, 54321 Beispielstadt'], versicherer: ['', 'Andere Versicherung AG'], deckblatt: ['', 'versicherung', 'direkt'],
      projektnummer: ['', '99.9002'], schadendatum: ['', 'unbekannt', '2026-10-12'], titel: ['Sanierungsvorschlag', 'Untersuchungsbericht'], brandort: ['', 'in der Wohnung'] };
    let k = 0;
    const kombis = Object.entries(werte).reduce((acc, [schl, ws]) => acc.flatMap(a => ws.map(w => ({ ...a, [schl]: w }))), [{}]);
    const f0 = BD.faelle.BR1_voll_Versicherung;
    for (const c of kombis) {
      const pj = BD.pj({ versicherungsnehmer: c.vn, auftraggeber: c.ag === 'VN' ? c.vn : c.ag, objekt: c.objekt, versicherer: c.versicherer, projektnummer: c.projektnummer, schadendatum: c.schadendatum });
      const m = T.bericht({ ...f0, pj, cfg: B.cfg, mitarbeiter: B.mitarbeiter, form: { ...f0.form, deckblatt: c.deckblatt, brand: { ...f0.form.brand, titel: c.titel, brandort: c.brandort } } });
      const kopf = [], lauf = (x, out) => { if (Array.isArray(x)) x.forEach(y => lauf(y, out)); else if (x && typeof x === 'object') { if (x.gap) out.push(x.gap); else Object.values(x).forEach(y => lauf(y, out)); } };
      lauf(m.kopf, kopf);
      const rest = new Set(modellLuecken(m));
      for (const g of kopf) assert.ok(rest.has(g), `${JSON.stringify(c)}: Kopf-Lücke ${g} hat keinen Kommentar woanders`);
      // ab 1.14.0 hat BR1 Fotos – ohne Bilddaten stehen sie als [Foto fehlt: …] in Word, wie beim Speichern mit nicht lesbarer Datei
      assert.deepEqual([...new Set(BL.offene(m, ohneBild(m, bilder)))].sort(), [...new Set([...rest, ...kopf])].sort(), `${JSON.stringify(c)}: Zähler = Lücken in Word`);
      k++;
    }
    assert.equal(k, 2 * 3 * 2 * 2 * 3 * 2 * 3 * 2 * 2);
  });

  if (WL) await fall('Projektzentrale word-luecken.js: dieselben Lücken wie ohne Kommentare; jede hat einen Kommentar', async () => {
    let geprueft = 0;
    for (const [name, f] of [...Object.entries(faelle), ['VIELE', VIELE], ...BRAND]) {
      const { buf, tt } = await wordVon(modellVon(f, name === 'VIELE' ? { ...B.cfg, labor: '' } : B.cfg));
      const befund = await WL.pruefen(buf);
      // gleiche Funde wie in der Datei ohne Kommentar-Markup (= Stand 1.10.0, lokal byte-gleich geprüft)
      const ohne = Object.entries(tt).filter(([k]) => TEXTTEILE.test(k)).sort(([a], [b]) => (a !== 'word/document.xml') - (b !== 'word/document.xml') || a.localeCompare(b, 'en', { numeric: true }))
        .flatMap(([, xml]) => WL.inXml(ohneKommentare(xml)));
      const mit = Object.entries(tt).filter(([k]) => TEXTTEILE.test(k)).sort(([a], [b]) => (a !== 'word/document.xml') - (b !== 'word/document.xml') || a.localeCompare(b, 'en', { numeric: true }))
        .flatMap(([, xml]) => WL.inXml(xml));
      assert.deepEqual(mit, ohne, `${name}: word-luecken findet mit Kommentaren dasselbe`);
      const summe = befund.luecken.reduce((s, x) => s + x.anzahl, 0), imKopf = gelbeTexte(tt, true).length;
      assert.equal(summe, kommentare(tt['word/comments.xml']).length + imKopf, `${name}: Lücken = Kommentare + Lücken im Kopf (ohne Kommentar)`);
      assert.deepEqual([...new Set(befund.luecken.map(x => x.text))].sort(),
        [...new Set(kommentare(tt['word/comments.xml']).map(k => '[' + k.text.slice('Noch ausfüllen: '.length) + ']'))].sort(), `${name}: jede gefundene Lücke hat einen Kommentar`);
      geprueft++;
    }
    // C_zugestellt_luecken: Ergebnis wie mit BerichtKit 1.10.0 (vor den Kommentaren)
    const { buf } = await wordVon(modellVon(faelle.C_zugestellt_luecken));
    assert.deepEqual((await WL.pruefen(buf)).luecken, [{ text: '[Eingangsdatum]', anzahl: 4 }, { text: '[Sachverständige(r)]', anzahl: 1 }]);
    assert.ok(geprueft >= 9);
  });

  console.log(`Lücken-Kommentare: ${n} Fälle ok` + (WL ? ' (mit word-luecken.js der Projektzentrale)' : ' – ../projektzentrale fehlt, word-luecken.js nicht geprüft'));
  if (process.argv.includes('--beispiel')) {
    const ziel = process.argv[process.argv.indexOf('--beispiel') + 1] || 'luecken-beispiel.docx';
    fs.writeFileSync(ziel, (await wordVon(modellVon(VIELE, { ...B.cfg, labor: '' }))).buf); console.log('Beispiel geschrieben:', ziel);
  }
  if (process.argv.includes('--brand')) {   // Brand-Beispiele zum Ansehen (z. B. in LibreOffice): <Ordner>/<Fall>.docx
    const ordner = process.argv[process.argv.indexOf('--brand') + 1] || 'brand-beispiele'; fs.mkdirSync(ordner, { recursive: true });
    for (const [name, f] of BRAND) { const m = modellVon(f); fs.writeFileSync(path.join(ordner, name + '.docx'), (await wordVon(m, undefined, brandBilder(m))).buf); }   // mit Testfoto (außer IMG_0201.jpg)
    console.log('Brand-Beispiele geschrieben:', ordner);
  }
})().catch(e => { console.error(e); process.exit(1); });

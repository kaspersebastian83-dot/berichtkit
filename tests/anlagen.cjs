// Anlagen: erkennen, Hausreihenfolge, veraltet, mehrteilig = eine Anlage, Abgleich Anlagen-Nr. (node tests/anlagen.cjs)
const assert = require('node:assert/strict');
const A = require('../anlagen.js');
const T = require('../bericht-text.js');
const D = require('./daten/beispiel.cjs');
const ORDNER = '99.9001 Musterweg Musterstadt Tst';
const t0 = Date.parse('2026-10-30T10:00:00Z'), min = 60000;
const iso = t => new Date(t).toISOString();
let n = 0; const fall = (name, fn) => { fn(); n++; console.log('ok –', name); };

// FotoKit-Daten wie ab 1.29: vermerkte Bilddoku + letzte Änderung der Doku-Inhalte
const fk = (o = {}) => ({ app: 'Bildumbenenner', format: 1, projekt: { anlage: 'Anlage 2' }, bilder: {},
  bilddoku: { dateien: ['Bilddokumentation_99.9001_Musterstadt_2026-10-30.pdf'], erstellt: iso(t0), anlage: 'Anlage 2' }, dokuGeaendert: iso(t0 - 5 * min), ...o });
const fotos = (...namen) => namen.map(([name, t]) => ({ name, t }));

fall('Bilddoku: vermerkte PDF, aktuell; danach geändert → veraltet', () => {
  const liste = fotos(['Bilddokumentation_99.9001_Musterstadt_2026-10-30.pdf', t0 + 2000], ['01_P1.jpg', t0 - 9e6]);
  let k = A.bilddokuFinden(liste, fk());
  assert.deepEqual(k.dateien, ['Fotos/Bilddokumentation_99.9001_Musterstadt_2026-10-30.pdf']);
  assert.equal(k.veraltet, false); assert.equal(k.nrImDokument, 2);
  k = A.bilddokuFinden(liste, fk({ dokuGeaendert: iso(t0 + 10 * min) }));
  assert.equal(k.veraltet, true); assert.match(k.grund, /nach dem Erstellen in FotoKit geändert/);
});

fall('Bilddoku in Teilen = eine Anlage; fehlender Teil → unvollständig', () => {
  const b = 'Bilddokumentation_99.9001_Musterstadt_2026-10-30';
  const doku = fk({ bilddoku: { dateien: [b + '_Teil_1_von_2.pdf', b + '_Teil_2_von_2.pdf'], erstellt: iso(t0), anlage: 'Anlage 2' } });
  let k = A.bilddokuFinden(fotos([b + '_Teil_2_von_2.pdf', t0], [b + '_Teil_1_von_2.pdf', t0]), doku);
  assert.deepEqual(k.dateien, ['Fotos/' + b + '_Teil_1_von_2.pdf', 'Fotos/' + b + '_Teil_2_von_2.pdf']);
  assert.equal(k.details, '2 Teile'); assert.equal(k.unvollstaendig, false);
  k = A.bilddokuFinden(fotos([b + '_Teil_1_von_2.pdf', t0]), doku);
  assert.equal(k.unvollstaendig, true); assert.match(k.grund, /Teil fehlt/);
  // ältere Benennung „… - Teil 1 von 2.pdf“
  k = A.bilddokuFinden(fotos(['Bilddokumentation 26.0123 Aachen - Teil 1 von 2.pdf', t0], ['Bilddokumentation 26.0123 Aachen - Teil 2 von 2.pdf', t0]), null);
  assert.equal(k.dateien.length, 2); assert.equal(k.veraltet, null); assert.match(k.grund, /vor 1\.29/);
});

fall('Bilddoku über das KI-ZIP erstellt: „<Nr>_<Anlage>_Bilddokumentation.pdf“', () => {
  const k = A.bilddokuFinden(fotos(['99.9001_Anlage 2_Bilddokumentation_Teil_1_von_2.pdf', t0], ['99.9001_Anlage 2_Bilddokumentation_Teil_2_von_2.pdf', t0], ['Bilddokumentationen-Notizen.txt', t0]), fk({ bilddoku: undefined }));
  assert.equal(k.dateien.length, 2); assert.equal(k.unvollstaendig, false); assert.equal(k.veraltet, false);
});

fall('Bilddoku ohne Vermerk: neueste Gruppe, Stand über dokuGeaendert', () => {
  const liste = fotos(['Bilddokumentation_99.9001_Musterstadt_2026-10-20.pdf', t0 - 60 * min], ['Bilddokumentation_99.9001_Musterstadt_2026-10-30.pdf', t0]);
  const k = A.bilddokuFinden(liste, fk({ bilddoku: undefined, dokuGeaendert: iso(t0 + 10 * min) }));
  assert.deepEqual(k.dateien, ['Fotos/Bilddokumentation_99.9001_Musterstadt_2026-10-30.pdf']);
  assert.equal(k.veraltet, true); assert.equal(k.nrImDokument, 2, 'Nr. aus den FotoKit-Projektdaten');
});

fall('Probenplan: alle Geschosse vor Einzelgeschossen; je Geschoss = eine Anlage; „(2)“ = neuere Fassung', () => {
  const plan = { name: `Probenplan ${ORDNER}.probenplan`, t: t0 - 10 * min, sha: 'a'.repeat(64) };
  let k = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER} - EG.pdf`, t0], [`Probenplan ${ORDNER} - OG.pdf`, t0], [`Probenplan ${ORDNER} - Ergebniskarte.pdf`, t0]), plan, ORDNER);
  assert.deepEqual(k.dateien, [`Pläne/Probenplan ${ORDNER} - EG.pdf`, `Pläne/Probenplan ${ORDNER} - OG.pdf`]);
  assert.equal(k.details, 'EG, OG'); assert.equal(k.veraltet, false);
  k = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER} - EG.pdf`, t0 - min], [`Probenplan ${ORDNER}.pdf`, t0]), plan, ORDNER);
  assert.deepEqual(k.dateien, [`Pläne/Probenplan ${ORDNER}.pdf`]); assert.equal(k.details, '');
  k = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER}.pdf`, t0 - 30 * min], [`Probenplan ${ORDNER} (2).pdf`, t0]), plan, ORDNER);
  assert.deepEqual(k.dateien, [`Pläne/Probenplan ${ORDNER} (2).pdf`]);
  k = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER}.pdf`, t0 - 30 * min]), plan, ORDNER);
  assert.equal(k.veraltet, true, 'Plan nach dem Export geändert');
  k = A.planFinden('ergebniskarte', fotos([`Probenplan ${ORDNER} - Ergebniskarte.pdf`, t0], [`Probenplan ${ORDNER} - EG.pdf`, t0]), plan, ORDNER);
  assert.deepEqual(k.dateien, [`Pläne/Probenplan ${ORDNER} - Ergebniskarte.pdf`]);
});

fall('Plan eines anderen Projekts (in „Pläne“ kopiert) wird nie Anlage', () => {
  const plan = { name: `Probenplan ${ORDNER}.probenplan`, t: t0 - 10 * min, sha: 'a'.repeat(64) };
  let k = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER}.pdf`, t0 - 5 * min], ['Probenplan 99.8888 Andere Straße Köln Ben.pdf', t0], ['Probenplan 99.8888 Andere Straße Köln Ben - Ergebniskarte.pdf', t0]), plan, ORDNER);
  assert.deepEqual(k.dateien, [`Pläne/Probenplan ${ORDNER}.pdf`]);
  k = A.planFinden('probenplan', fotos(['Probenplan 99.8888 Andere Straße Köln Ben.pdf', t0]), plan, ORDNER);
  assert.equal(k, null);
  assert.equal(A.planFinden('ergebniskarte', fotos(['Probenplan 99.8888 Andere Straße Köln Ben - Ergebniskarte.pdf', t0]), plan, ORDNER), null);
});

fall('Neu erzeugt unter gleichem Namen: eigene Abwahl gilt nicht mehr', () => {
  const plan = { name: 'x.probenplan', t: t0 - 60 * min };
  const alt = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER}.pdf`, t0 - 30 * min]), plan, ORDNER);
  const neu = A.planFinden('probenplan', fotos([`Probenplan ${ORDNER}.pdf`, t0]), plan, ORDNER);
  assert.notEqual(alt.key, neu.key);
  const wahl = { probenplan: { an: false, key: alt.key } };
  assert.equal(A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], gefunden: { probenplan: alt }, wahl }).nr.probenplan, undefined, 'abgewählt bleibt abgewählt');
  assert.equal(A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], gefunden: { probenplan: neu }, wahl }).nr.probenplan, 2, 'neue Fassung wieder vorgehakt');
});

fall('PlanKit-Word-Anlagen: Protokoll-Prüfsumme genau, sonst Dateizeit', () => {
  const sha = 'b'.repeat(64), plan = { t: t0 - 10 * min, sha };
  const datei = '99.9001_Anlage_Probenahme_2026-10-30.docx';
  const prot = 'Anlagen-Protokoll (Projektzentrale) – je Zeile: …\r\n' + [iso(t0), datei, 'c'.repeat(64), 'Pläne/Probenplan x.probenplan', sha, 'PlanKit 1.30.0'].join(' | ') + '\r\n';
  const mitt = fotos([datei, t0], ['99.9001_Raumbuch_2026-10-30.docx', t0 - 30 * min], ['1._Mitteilung_99.9001.docx', t0]);
  let g = A.erkennen({ ordnerName: ORDNER, mitteilungen: mitt, protokoll: prot, plan });
  assert.equal(g.probenahme.veraltet, false); assert.equal(g.raumbuch.veraltet, true);
  g = A.erkennen({ ordnerName: ORDNER, mitteilungen: mitt, protokoll: prot, plan: { ...plan, sha: 'd'.repeat(64) } });
  assert.equal(g.probenahme.veraltet, true); assert.match(g.probenahme.grund, /nach dem Erstellen geändert/);
  assert.equal(g.wandansichten, undefined);
});

fall('Hausreihenfolge: Prüfberichte, Bilddoku, Probenplan; optionale nicht vorgehakt; Abwählen nummeriert neu', () => {
  const gefunden = {
    bilddoku: { art: 'bilddoku', dateien: ['Fotos/B.pdf'], key: 'Fotos/B.pdf', veraltet: false, nrImDokument: 3, nrQuelle: 'Anlage 3' },
    probenplan: { art: 'probenplan', dateien: ['Pläne/P - EG.pdf', 'Pläne/P - OG.pdf'], key: 'k', veraltet: false, details: 'EG, OG' },
    raumbuch: { art: 'raumbuch', dateien: ['Mitteilungen/R.docx'], key: 'r', veraltet: false },
  };
  const pb = [{ nr: 'AR-1', pdf: 'Laborergebnisse/AR-1.pdf' }, { nr: 'AR-2', pdf: 'Laborergebnisse/AR-2.pdf' }];
  let r = A.zusammenstellen({ pruefberichte: pb, labor: 'Labor', gefunden });
  assert.deepEqual(r.liste.map(a => `${a.nr} ${a.titel}`), ['1 Prüfbericht', '2 Prüfbericht', '3 Bilddokumentation', '4 Probenplan (EG, OG)']);
  assert.deepEqual(r.nr, { pruefbericht: 1, bilddoku: 3, probenplan: 4 });
  assert.equal(r.hinweise.length, 0, 'Bilddoku trägt Anlage 3 – passt');
  assert.deepEqual(r.liste[3].dateien, ['Pläne/P - EG.pdf', 'Pläne/P - OG.pdf'], 'zwei Dateien, eine Anlage');
  const rb = r.zeilen.find(z => z.art === 'raumbuch'); assert.equal(rb.an, false); assert.equal(rb.nr, null);
  // Bilddoku abwählen → Probenplan rückt nach, Raumbuch dazu
  r = A.zusammenstellen({ pruefberichte: pb, gefunden, wahl: { bilddoku: { an: false, key: 'Fotos/B.pdf' }, raumbuch: { an: true, key: 'r' } } });
  assert.deepEqual(r.liste.map(a => `${a.nr} ${a.art}`), ['1 pruefbericht', '2 pruefbericht', '3 probenplan', '4 raumbuch']);
  // Eigene Wahl gilt nur für dieselben Dateien: neue Bilddoku → wieder vorgehakt
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { ...gefunden, bilddoku: { ...gefunden.bilddoku, key: 'Fotos/B2.pdf' } }, wahl: { bilddoku: { an: false, key: 'Fotos/B.pdf' } } });
  assert.equal(r.nr.bilddoku, 3);
  // Bilddoku trägt eine andere Nummer → Hinweis
  r = A.zusammenstellen({ pruefberichte: [pb[0]], gefunden });
  assert.equal(r.nr.bilddoku, 2); assert.match(r.hinweise[0], /trägt „Anlage 3“, im Bericht ist sie Anlage 2/);
});

fall('Veraltet und unvollständig: nicht vorgehakt; angehakt mit Hinweis; fehlende feste Anlagen sichtbar', () => {
  const gefunden = { bilddoku: { art: 'bilddoku', dateien: ['Fotos/B.pdf'], key: 'b', veraltet: true, grund: 'nach dem Erstellen in FotoKit geändert', nrImDokument: 2, nrQuelle: 'Anlage 2' } };
  let r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], gefunden });
  assert.deepEqual(r.liste.map(a => a.art), ['pruefbericht']);
  const z = r.zeilen.find(x => x.art === 'bilddoku'); assert.equal(z.zustand, 'veraltet'); assert.equal(z.an, false);
  const pp = r.zeilen.find(x => x.art === 'probenplan'); assert.equal(pp.zustand, 'fehlt'); assert.match(pp.grund, /in PlanKit erstellen/);
  r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], gefunden, wahl: { bilddoku: { an: true, key: 'b#veraltet' } } });
  assert.equal(r.zeilen.find(x => x.art === 'bilddoku').key, 'b#veraltet');
  const vorher = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], gefunden, wahl: { bilddoku: { an: true, key: 'b' } } });
  assert.equal(vorher.nr.bilddoku, undefined, 'angehakt, als sie noch aktuell war – jetzt veraltet → wieder abgewählt');
  assert.equal(r.nr.bilddoku, 2); assert.ok(r.hinweise.some(h => /angehakt, aber nach dem Erstellen/.test(h)));
  r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], gefunden: {}, ohneEigeneProbenahme: true });
  assert.ok(!r.zeilen.some(x => x.zustand === 'fehlt' && x.art !== 'pruefbericht'), 'zugestellt: kein „nicht gefunden“');
});

fall('Feste Anlage nicht im Bericht: immer ein Hinweis mit Sprung in die App (veraltet, unvollständig, fehlt)', () => {
  const pb = [{ nr: 'AR-1', pdf: '' }];
  const bild = { art: 'bilddoku', dateien: ['Fotos/B.pdf'], key: 'b', veraltet: true, grund: 'nach dem Erstellen in FotoKit geändert', nrImDokument: 2, nrQuelle: 'Anlage 2' };
  // veraltet, nach der Regel abgewählt; Probenplan fehlt
  let r = A.zusammenstellen({ pruefberichte: pb, gefunden: { bilddoku: bild } });
  const veraltet = 'Bilddokumentation veraltet – nicht im Bericht. In FotoKit neu erstellen oder trotzdem anhaken.';
  const fehlt = 'Probenplan nicht gefunden – nicht im Bericht. In PlanKit erstellen.';
  assert.ok(r.hinweise.includes(veraltet)); assert.ok(r.hinweise.includes(fehlt));
  assert.deepEqual(r.aktionen[veraltet], { art: 'bilddoku', was: 'öffnen' });
  assert.deepEqual(r.aktionen[fehlt], { art: 'probenplan', was: 'erstellen' });
  // trotzdem angehakt → anderer Hinweis, kein „nicht im Bericht“
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { bilddoku: bild }, wahl: { bilddoku: { an: true, key: 'b#veraltet' } } });
  assert.ok(!r.hinweise.includes(veraltet)); assert.ok(r.hinweise.some(h => /^Bilddokumentation ist angehakt, aber nach dem Erstellen/.test(h)));
  // selbst wieder abgewählt: bleibt veraltet und nicht im Bericht → Hinweis bleibt
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { bilddoku: bild }, wahl: { bilddoku: { an: false, key: 'b#veraltet' } } });
  assert.ok(r.hinweise.includes(veraltet));
  // unvollständig (Teil fehlt) – abgewählt und angehakt
  const teil = { ...bild, veraltet: false, unvollstaendig: true, grund: 'Teil fehlt – gefunden 1 von 2' };
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { bilddoku: teil } });
  assert.ok(r.hinweise.includes('Bilddokumentation unvollständig (Teil fehlt – gefunden 1 von 2) – nicht im Bericht. In FotoKit neu erstellen oder trotzdem anhaken.'));
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { bilddoku: teil }, wahl: { bilddoku: { an: true, key: 'b' } } });
  assert.ok(r.hinweise.includes('Bilddokumentation ist angehakt, aber unvollständig (Teil fehlt – gefunden 1 von 2) – in FotoKit neu erstellen.'));
  // aktuell und selbst abgewählt: bewusst – kein Hinweis; zugestellt: fehlende feste Anlagen ohne Hinweis
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { bilddoku: { ...bild, veraltet: false, grund: '' } }, wahl: { bilddoku: { an: false, key: 'b' } } });
  assert.ok(!r.hinweise.some(h => /^Bilddokumentation/.test(h)));
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: {}, ohneEigeneProbenahme: true });
  assert.deepEqual(r.hinweise, []);
  // optionale Anlage veraltet und nicht angehakt: nur in der Liste, kein Hinweis
  r = A.zusammenstellen({ pruefberichte: pb, gefunden: { raumbuch: { art: 'raumbuch', dateien: ['Mitteilungen/R.docx'], key: 'r', veraltet: true, grund: 'älter als der Plan in PlanKit' } } });
  assert.ok(!r.hinweise.some(h => /Raumbuch/.test(h)));
});

fall('Im Bericht: Anlagen-Hinweis mit Sprung in die App (hinweisAktionen)', () => {
  const m = T.bericht({ pj: D.pj(), lk: D.lk([[1, '2026-10-16', 'Keller', 'Putz', 'Sonstige']]), erg: D.erg([[1, 'kein']]), cfg: D.cfg, mitarbeiter: D.mitarbeiter,
    form: { datum: '2026-10-27', mitteilung: 1, variante: 'eigen', probenehmer: 'Mes', sv: 'Tst', mt: 'Mes' } });
  const h = 'Bilddokumentation nicht gefunden – nicht im Bericht. In FotoKit erstellen.';
  assert.ok(m.hinweise.includes(h));
  assert.deepEqual(m.hinweisAktionen[h], { app: 'FotoKit', link: '../Bildumbenenner/', ziel: 'bildumbenenner', was: 'erstellen' });
  assert.ok(m.hinweise.includes('Probenplan nicht gefunden – nicht im Bericht. In PlanKit erstellen.'));
});

fall('Weitere Dateien: frei benannt, hinten angehängt; fehlende nicht im Bericht', () => {
  const r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: 'Laborergebnisse/AR-1.pdf' }], gefunden: {},
    extra: [{ pfad: 'Mitteilungen/Messprotokoll Raumluft.pdf', bezeichnung: 'Messprotokoll Raumluft' }, { pfad: 'Fotos/weg.pdf', fehlt: true }] });
  assert.deepEqual(r.liste.map(a => `${a.nr} ${a.titel}`), ['1 Prüfbericht', '2 Messprotokoll Raumluft']);
  assert.ok(r.hinweise.some(h => /weg\.pdf/.test(h)));
});

fall('Im Bericht: Verweis-Satz, Anlagenverzeichnis, Dateien für die Übergabe', () => {
  const basis = { pj: D.pj(), lk: D.lk([[1, '2026-10-16', 'Keller', 'Putz', 'Putze / Spachtelmassen'], [2, '2026-10-16', 'Flur', 'Kleber', 'Bituminöse Proben / Kleber']]),
    erg: D.erg([[1, 'kein'], [2, 'kein']]), cfg: D.cfg, mitarbeiter: D.mitarbeiter,
    form: { datum: '2026-10-27', mitteilung: 1, variante: 'eigen', probenehmer: 'Mes', sv: 'Tst', mt: 'Mes' } };
  const anlagen = { bilddoku: { art: 'bilddoku', dateien: ['Fotos/B.pdf'], key: 'b', veraltet: false, nrImDokument: 2, nrQuelle: 'Anlage 2' },
    probenplan: { art: 'probenplan', dateien: ['Pläne/P.pdf'], key: 'p', veraltet: false, details: '' } };
  let m = T.bericht({ ...basis, anlagen });
  const text = m.abschnitte[1].inhalt.filter(x => x.t === 'p').map(x => T.text(x.runs)).join('\n');
  assert.match(text, /Die Entnahmestellen sind in Tabelle 1 aufgeführt\.\nDie Entnahmestellen sind zusätzlich in der Bilddokumentation \(Anlage 2\) und im Probenplan \(Anlage 3\) dargestellt\.\nDie Proben wurden der/);
  assert.match(text, /dokumentiert \(Anlage 1\)\./);
  assert.deepEqual(m.anlagen.map(T.text), ['Anlage 1: Prüfbericht Nr. AR-999-2026-000001-01 (Eurofins Beispiel-Labor GmbH)', 'Anlage 2: Bilddokumentation', 'Anlage 3: Probenplan']);
  assert.deepEqual(m.anlagenDateien, ['Laborergebnisse/AR-999-2026-000001-01.pdf', 'Fotos/B.pdf', 'Pläne/P.pdf']);
  assert.deepEqual(m.anlagenListe.map(a => a.art), ['pruefbericht', 'bilddoku', 'probenplan']);
  assert.deepEqual(m.luecken, []);
  // nur Probenplan, eine Probe
  m = T.bericht({ ...basis, lk: D.lk([[1, '2026-10-16', 'Keller', 'Putz', 'Putze / Spachtelmassen']]), erg: D.erg([[1, 'kein']]), anlagen: { probenplan: anlagen.probenplan } });
  assert.ok(m.abschnitte[1].inhalt.some(x => x.t === 'p' && T.text(x.runs) === 'Die Lage der Entnahmestelle ist im Probenplan (Anlage 2) dargestellt.'));
  // ohne gefundene Anlagen: wie bisher, kein Verweis-Satz
  m = T.bericht(basis);
  assert.ok(!m.abschnitte[1].inhalt.some(x => x.t === 'p' && /zusätzlich|Probenplan/.test(T.text(x.runs))));
  assert.deepEqual(m.anlagen.map(T.text), ['Anlage 1: Prüfbericht Nr. AR-999-2026-000001-01 (Eurofins Beispiel-Labor GmbH)']);
});

fall('Audit m9: Bilddokumentation eines anderen Projekts nie Anlage; ohne Nummer im Namen nicht vorgehakt', () => {
  const eigene = 'Bilddokumentation_99.9001_Musterstadt_2026-10-30.pdf', fremde = 'Bilddokumentation_26.0123_Aachen_2026-11-02.pdf';
  // fremde PDF ist neuer, keine FotoKit-Aufzeichnung (vor FotoKit 1.29 / KI-ZIP) → früher wurde sie still Anlage 2
  let g = A.erkennen({ projektNr: '99.9001', fotos: fotos([eigene, t0], [fremde, t0 + 60 * min]), fk: null });
  assert.deepEqual(g.bilddoku.dateien, ['Fotos/' + eigene]);
  assert.deepEqual(g.bilddokuFremd, [{ datei: fremde, nr: '26.0123' }]);
  let r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], labor: 'Labor', gefunden: g });
  assert.ok(r.hinweise.includes(`Bilddokumentation „${fremde}“ gehört zu Projekt 26.0123 – nicht im Bericht.`));
  assert.equal(r.nr.bilddoku, 2);
  // nur die fremde da → nicht gefunden + Hinweis
  g = A.erkennen({ projektNr: '99.9001', fotos: fotos([fremde, t0]), fk: null });
  assert.equal(g.bilddoku, undefined);
  r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], labor: 'Labor', gefunden: g });
  assert.equal(r.nr.bilddoku, undefined);
  assert.ok(r.hinweise.some(h => /gehört zu Projekt 26\.0123/.test(h)) && r.hinweise.some(h => /Bilddokumentation nicht gefunden/.test(h)));
  // KI-ZIP-Name eines anderen Projekts: auch mit FotoKit-Vermerk nie (Nummer im Namen geht vor)
  g = A.erkennen({ projektNr: '99.9001', fotos: fotos(['26.0123_Anlage 2_Bilddokumentation.pdf', t0]), fk: fk({ bilddoku: { dateien: ['26.0123_Anlage 2_Bilddokumentation.pdf'], erstellt: iso(t0) } }) });
  assert.equal(g.bilddoku, undefined, 'KI-ZIP-Name eines anderen Projekts');
  // ohne Projektnummer im Namen, ohne Vermerk: gefunden, nicht vorgehakt, Hinweis; selbst angehakt → im Bericht mit Hinweis
  g = A.erkennen({ projektNr: '99.9001', fotos: fotos(['Bilddokumentation.pdf', t0]), fk: null });
  assert.equal(g.bilddoku.ohneNr, true);
  r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], labor: 'Labor', gefunden: g });
  assert.equal(r.nr.bilddoku, undefined);
  assert.equal(r.zeilen.find(z => z.art === 'bilddoku').zustand, 'ohneNr');
  assert.ok(r.hinweise.includes('Bilddokumentation ohne Projektnummer im Namen – nicht prüfbar, ob sie zu diesem Projekt gehört. Nicht im Bericht; in FotoKit neu erstellen oder trotzdem anhaken.'));
  const key = r.zeilen.find(z => z.art === 'bilddoku').key;
  r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: '' }], labor: 'Labor', gefunden: g, wahl: { bilddoku: { an: true, key } } });
  assert.equal(r.nr.bilddoku, 2);
  assert.ok(r.hinweise.some(h => /^Bilddokumentation ist angehakt, aber ohne Projektnummer im Namen/.test(h)));
  // ohne Nummer, aber von FotoKit für dieses Projekt vermerkt → wie bisher
  g = A.erkennen({ projektNr: '99.9001', fotos: fotos(['Bilddokumentation.pdf', t0]), fk: fk({ bilddoku: { dateien: ['Bilddokumentation.pdf'], erstellt: iso(t0) } }) });
  assert.equal(g.bilddoku.ohneNr, undefined);
  // ältere Benennung mit Leerzeichen und Teilen: eigene Nummer erkannt
  g = A.erkennen({ projektNr: '26.0123', fotos: fotos(['Bilddokumentation 26.0123 Aachen - Teil 1 von 2.pdf', t0], ['Bilddokumentation 26.0123 Aachen - Teil 2 von 2.pdf', t0]), fk: null });
  assert.equal(g.bilddoku.dateien.length, 2); assert.equal(g.bilddoku.ohneNr, undefined);
  // ohne projektNr (Tests, alte Aufrufe): unverändert
  assert.deepEqual(A.erkennen({ fotos: fotos([fremde, t0]), fk: null }).bilddoku.dateien, ['Fotos/' + fremde]);
});

console.log(`\n${n} Fälle bestanden.`);

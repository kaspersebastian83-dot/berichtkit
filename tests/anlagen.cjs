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

// ---------- 1.27.0: Plannamen mit Termin (PlanKit 2.7.0; plankit-ortstermine-plan.md F7, T5, T6, T13, T18) ----------
{
  const KA = '26.0999 Teststadt Ka', tag = 86400000, alt = t0 - 8 * tag;
  const plan = { name: `Probenplan ${KA}.probenplan`, t: t0 - min, sha: 'b'.repeat(64) };   // nach PlanKit: Export nach der letzten Änderung
  const lesbar = { frueher: [KA], geschosse: [], nr: '26.0999' }, zweiPlaene = { frueher: [KA], geschosse: ['EG', '1. OG'], nr: '26.0999' };
  const P = (...l) => l.map(([z, t]) => ({ name: `Probenplan ${KA}${z}.pdf`, t }));
  const hakt = (k, wahl) => A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: 'Laborergebnisse/AR-1.pdf' }], labor: 'L', gefunden: { probenplan: k }, wahl }).zeilen.find(z => z.art === 'probenplan');

  fall('1.27 Namensregel: eine Stelle zerlegt Ordner, Plan, Termin, Ergebniskarte, Kopie', () => {
    const z = A.planName(`Probenplan ${KA} - EG - Termin 20.08.2026 - Ergebniskarte (2).pdf`, [KA]);
    assert.deepEqual({ kern: z.kern, ordner: z.ordner, plan: z.plan, termin: z.termin, ergebnis: z.ergebnis, kopie: z.kopie },
      { kern: `Probenplan ${KA} - EG`, ordner: KA, plan: 'EG', termin: '2026-08-20', ergebnis: true, kopie: 2 });
    assert.equal(A.planName(`Probenplan ${KA} - Termin 20.08.2026.pdf`, [KA]).plan, '', 'der Zusatz ist nie ein Plan');
    assert.equal(A.planName(`Probenplan ${KA} - alle Termine.pdf`, [KA]).termin, 'alle');
    assert.equal(A.planName(`Probenplan ${KA}.pdf`, [KA]).termin, '');
    // nur ein gültiges Datum zählt – sonst bleibt es (wie bis 1.26) Teil des Plannamens
    for (const d of ['31.02.2026', '20.13.2026', '2.8.2026']) { const x = A.planName(`Probenplan ${KA} - Termin ${d}.pdf`, [KA]); assert.equal(x.termin, ''); assert.equal(x.plan, 'Termin ' + d); }
    // falsche Reihenfolge (Termin hinter „Ergebniskarte“) ist kein Termin-Zusatz
    assert.equal(A.planName(`Probenplan ${KA} - Ergebniskarte - Termin 20.08.2026.pdf`, [KA]).ergebnis, false);
    assert.equal(A.planName('Probenplanung.pdf'), null); assert.equal(A.planName(`Probenplan ${KA}.png`), null);
  });

  fall('1.27 F7: Termin-1-Plan ohne Zusatz + Termin-2-Plan – mit lesbarer .probenplan nicht vorgehakt, Hinweis nennt beide', () => {
    const k = A.planFinden('probenplan', P(['', alt], [' - Termin 20.08.2026', t0]), plan, KA, lesbar);
    assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - Termin 20.08.2026.pdf`]); assert.equal(k.details, '', 'kein Geschoss „Termin 20.08.2026“');
    assert.equal(k.unklar, true); assert.equal(k.termin, '2026-08-20'); assert.deepEqual(k.termine, ['', '2026-08-20']);
    assert.equal(k.unklarText, `Probenpläne für mehrere Ortstermine: „Probenplan ${KA}.pdf“ (ohne Termin-Zusatz) und „Probenplan ${KA} - Termin 20.08.2026.pdf“ (Termin 20.08.2026) – bitte wählen; angehakt kommt „Probenplan ${KA} - Termin 20.08.2026.pdf“ in den Bericht`);
    const r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: 'x.pdf' }], labor: 'L', gefunden: { probenplan: k } });
    assert.equal(r.nr.probenplan, undefined); assert.equal(r.zeilen.find(z => z.art === 'probenplan').zustand, 'unklar');
    assert.ok(r.hinweise.includes(`Probenplan: ${k.unklarText}. Nicht im Bericht – den Plan für diesen Bericht anhaken.`), r.hinweise.join('\n'));
    assert.deepEqual(r.aktionen[`Probenplan: ${k.unklarText}. Nicht im Bericht – den Plan für diesen Bericht anhaken.`], { art: 'probenplan', was: 'öffnen' });
    // selbst angehakt → im Bericht, Hinweis bleibt
    const z = hakt(k, { probenplan: { an: true, key: hakt(k).key } }); assert.equal(z.an, true); assert.equal(z.nr, 2);
    // Codex-Review #40: kommt danach ein Plan eines anderen Termins dazu (auch mit älterer Dateizeit) oder ändert sich einer, gilt der Haken nicht mehr
    const gemerkt = { probenplan: { an: true, key: hakt(k).key } };
    assert.equal(hakt(A.planFinden('probenplan', P(['', alt], [' - Termin 20.08.2026', t0]), plan, KA, lesbar), gemerkt).an, true, 'gleicher Stand: Haken bleibt');
    for (const dazu of [P([' - Termin 12.08.2026', alt + min]), P([' - alle Termine', alt])]) {
      const k2 = A.planFinden('probenplan', [...P(['', alt], [' - Termin 20.08.2026', t0]), ...dazu], plan, KA, lesbar);
      assert.deepEqual(k2.dateien, k.dateien, 'dieselbe Datei vorgeschlagen'); assert.equal(hakt(k2, gemerkt).an, false, 'neue Gruppe: Haken verfällt');
    }
    assert.equal(hakt(A.planFinden('probenplan', P(['', alt + min], [' - Termin 20.08.2026', t0]), plan, KA, lesbar), gemerkt).an, false, 'andere Gruppe neu exportiert: Haken verfällt');
  });

  fall('1.27 F7: ohne lesbare .probenplan nie als Geschoss „Termin 20.08.2026“ vorgehakt', () => {
    const k = A.planFinden('probenplan', P(['', alt], [' - Termin 20.08.2026', t0]), plan, KA);
    assert.equal(k.details, ''); assert.equal(k.unklar, true); assert.equal(hakt(k).an, false); assert.equal(hakt(k).titel, 'Probenplan');
    // nur ein Termin-Plan da: ebenfalls nicht vorgehakt (BerichtKit kennt den Termin des Berichts erst mit Stufe 4)
    for (const wo of [undefined, lesbar]) {
      const e = A.planFinden('probenplan', P([' - Termin 20.08.2026', t0]), plan, KA, wo);
      assert.equal(e.unklar, true); assert.equal(hakt(e).an, false);
      assert.equal(e.unklarText, `Probenplan für einen Ortstermin: „Probenplan ${KA} - Termin 20.08.2026.pdf“ (Termin 20.08.2026) – bitte prüfen, ob er in diesen Bericht gehört`);
    }
  });

  fall('1.27 F7: EG und 1. OG je Termin – nie gemischt; „alle Termine“ ist eine eigene Gruppe', () => {
    const l = P([' - EG', alt], [' - 1. OG', alt], [' - EG - Termin 20.08.2026', t0], [' - 1. OG - Termin 20.08.2026', t0]);
    for (const wo of [undefined, zweiPlaene]) {
      const k = A.planFinden('probenplan', l, plan, KA, wo);
      assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - 1. OG - Termin 20.08.2026.pdf`, `Pläne/Probenplan ${KA} - EG - Termin 20.08.2026.pdf`]);
      assert.equal(k.details, '1. OG, EG'); assert.equal(k.unklar, true);
      const t1 = A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-08-12', ersterTermin: true });
      assert.deepEqual(t1.dateien, [`Pläne/Probenplan ${KA} - 1. OG.pdf`, `Pläne/Probenplan ${KA} - EG.pdf`]); assert.equal(t1.unklar, wo ? false : undefined);
    }
    const mitAlle = [...l, ...P([' - alle Termine', t0 + min])];
    let k = A.planFinden('probenplan', mitAlle, plan, KA, zweiPlaene);
    assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - alle Termine.pdf`]); assert.deepEqual(k.termine, ['', '2026-08-20', 'alle']);
    assert.match(k.unklarText, /\(ohne Termin-Zusatz\) und .* \(Termin 20\.08\.2026\) und „Probenplan 26\.0999 Teststadt Ka - alle Termine\.pdf“ \(alle Termine\)/);
    k = A.planFinden('probenplan', mitAlle, plan, KA, zweiPlaene, { termin: 'alle' });
    assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - alle Termine.pdf`]); assert.equal(k.unklar, false); assert.equal(k.termin, 'alle');
  });

  fall('1.27 Termin-Angabe: richtiger Tag, Termin 1 ohne Zusatz, nie ein anderer Termin, nichts gefunden → null', () => {
    const l = P(['', alt], [' - Termin 20.08.2026', t0]);
    for (const wo of [undefined, lesbar]) {
      let k = A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-08-20' });
      assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - Termin 20.08.2026.pdf`]); assert.ok(!k.unklar); assert.equal(hakt(k).an, true);
      k = A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-08-12', ersterTermin: true });
      assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA}.pdf`]); assert.equal(k.termin, ''); assert.deepEqual(k.termine, ['', '2026-08-20']);
      // Termin 1 ist nur ohne Zusatz gemeint, wenn es keine PDF mit seinem Datum gibt
      k = A.planFinden('probenplan', [...l, ...P([' - Termin 12.08.2026', t0 + min])], plan, KA, wo, { termin: '2026-08-12', ersterTermin: true });
      assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - Termin 12.08.2026.pdf`]);
      // ohne „ist Termin 1“ nie die PDF ohne Zusatz; ein anderer Tag, „alle“ ohne Datei, ungültige Angabe → null (der Aufrufer zeigt „fehlt“)
      assert.equal(A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-08-12' }), null);
      assert.equal(A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-09-03' }), null);
      assert.equal(A.planFinden('probenplan', l, plan, KA, wo, { termin: 'alle', ersterTermin: true }), null);
      assert.equal(A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-02-31', ersterTermin: true }), null);
      assert.equal(A.planFinden('probenplan', P([' - Termin 20.08.2026', t0]), plan, KA, wo, { termin: '2026-08-12', ersterTermin: true }), null, 'nie den Termin-2-Plan für Termin 1');
      // auch ohne eine einzige Termin-PDF: Termin 1 bekommt den Plan ohne Zusatz, Termin 2 nichts
      assert.deepEqual(A.planFinden('probenplan', P(['', alt]), plan, KA, wo, { termin: '2026-08-12', ersterTermin: true }).dateien, [`Pläne/Probenplan ${KA}.pdf`]);
      assert.equal(A.planFinden('probenplan', P(['', alt]), plan, KA, wo, { termin: '2026-08-20' }), null);
    }
  });

  fall('1.27 Ergebniskarte: dieselbe Regel (Termin vor „ - Ergebniskarte“), getrennt vom Probenplan', () => {
    const l = P(['', alt], [' - Ergebniskarte', alt], [' - Termin 20.08.2026', t0], [' - Termin 20.08.2026 - Ergebniskarte', t0]);
    for (const wo of [undefined, lesbar]) {
      const k = A.planFinden('ergebniskarte', l, plan, KA, wo);
      assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - Termin 20.08.2026 - Ergebniskarte.pdf`]); assert.equal(k.unklar, true); assert.equal(k.details, '');
      assert.match(k.unklarText, /^Ergebniskarten für mehrere Ortstermine: /);
      assert.deepEqual(A.planFinden('ergebniskarte', l, plan, KA, wo, { termin: '2026-08-12', ersterTermin: true }).dateien, [`Pläne/Probenplan ${KA} - Ergebniskarte.pdf`]);
      assert.deepEqual(A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-08-20' }).dateien, [`Pläne/Probenplan ${KA} - Termin 20.08.2026.pdf`]);
    }
  });

  fall('1.27 Kopie „(2)“ einer Termin-PDF = neuere Fassung desselben Termins', () => {
    const l = P(['', alt], [' - Termin 20.08.2026', t0 - 30 * min], [' - Termin 20.08.2026 (2)', t0]);
    for (const wo of [undefined, lesbar]) {
      assert.deepEqual(A.planFinden('probenplan', l, plan, KA, wo, { termin: '2026-08-20' }).dateien, [`Pläne/Probenplan ${KA} - Termin 20.08.2026 (2).pdf`]);
      const k = A.planFinden('probenplan', l, plan, KA, wo); assert.deepEqual(k.termine, ['', '2026-08-20']); assert.equal(k.dateien.length, 1);
    }
  });

  fall('1.27 ungültiges Datum ist kein Termin-Zusatz: alles wie bis 1.26 (ohne Termin-Angaben im Ergebnis)', () => {
    const l = P(['', alt], [' - Termin 31.02.2026', t0]);
    const k = A.planFinden('probenplan', l, plan, KA);
    assert.equal(k.details, 'Termin 31.02.2026'); assert.equal(k.termin, undefined); assert.equal(k.termine, undefined);
    const o = A.planFinden('probenplan', l, plan, KA, lesbar);
    assert.match(o.unklarText, /Plan „Termin 31\.02\.2026“ gibt es in PlanKit nicht/); assert.equal(o.terminUnklar, undefined);
  });

  fall('1.27 Plan eines anderen Projekts mit Termin-Zusatz: nie – weder vorgeschlagen noch für einen Termin', () => {
    const fremd = [{ name: 'Probenplan 99.8888 Andere Straße Köln Ben - Termin 20.08.2026.pdf', t: t0 + min }, { name: 'Probenplan 99.8888 Andere Straße Köln Ben - Termin 20.08.2026 - Ergebniskarte.pdf', t: t0 + min }];
    for (const wo of [undefined, lesbar]) {
      const ohne = A.planFinden('probenplan', P(['', alt]), plan, KA, wo), mit = A.planFinden('probenplan', [...P(['', alt]), ...fremd], plan, KA, wo);
      assert.deepEqual(mit, ohne, 'wie ohne die fremde PDF');
      assert.equal(A.planFinden('probenplan', fremd, plan, KA, wo), null);
      assert.equal(A.planFinden('probenplan', fremd, plan, KA, wo, { termin: '2026-08-20' }), null);
      assert.equal(A.planFinden('ergebniskarte', fremd, plan, KA, wo, { termin: '2026-08-20' }), null);
    }
  });

  fall('1.27 o11 gilt innerhalb jeder Gruppe: früherer Ordnername, unbekannter Plan', () => {
    const neu = '26.0604 Würselen', frueher = '26.0604 Würselen Dr. Ka', wo = { frueher: [neu, frueher], geschosse: [], nr: '26.0604' };
    const l = [{ name: `Probenplan ${frueher}.pdf`, t: alt }, { name: `Probenplan ${frueher} - Termin 20.08.2026.pdf`, t: t0 }];
    let k = A.planFinden('probenplan', l, plan, neu, wo, { termin: '2026-08-20' });
    assert.deepEqual(k.dateien, [`Pläne/Probenplan ${frueher} - Termin 20.08.2026.pdf`]); assert.equal(k.unklar, true);
    assert.equal(k.unklarText, `„Probenplan ${frueher} - Termin 20.08.2026.pdf“ – früherer Ordnername „${frueher}“`);
    k = A.planFinden('probenplan', l, plan, neu, wo);
    assert.match(k.unklarText, /– bitte wählen; angehakt kommt .* in den Bericht; außerdem: „Probenplan 26\.0604 Würselen Dr\. Ka - Termin 20\.08\.2026\.pdf“ – früherer Ordnername/);
    // Plan „OG“ gibt es nicht (nur EG und 1. OG): in der Termin-Gruppe unklar, mit dem o11-Grund
    k = A.planFinden('probenplan', P([' - EG - Termin 20.08.2026', t0], [' - 1. OG - Termin 20.08.2026', t0], [' - OG - Termin 20.08.2026', t0 - min]), plan, KA, zweiPlaene, { termin: '2026-08-20' });
    assert.equal(k.unklar, false); assert.match(k.unklarText, /Plan „OG“ gibt es in PlanKit nicht/);
  });

  fall('1.27 T18: veralteter Termin-Plan – ehrlicher Grund, nur Hinweis; ohne Zusatz der bisherige Text', () => {
    const spaeter = { ...plan, t: t0 + 10 * min }, l = P(['', alt], [' - Termin 20.08.2026', t0]);
    for (const wo of [undefined, lesbar]) {
      const k = A.planFinden('probenplan', l, spaeter, KA, wo, { termin: '2026-08-20' });
      assert.equal(k.veraltet, true); assert.equal(k.grund, 'Plan in PlanKit nach dem Export geändert – prüfen, ob dieser Termin betroffen ist');
      const r = A.zusammenstellen({ pruefberichte: [{ nr: 'AR-1', pdf: 'x.pdf' }], labor: 'L', gefunden: { probenplan: k } });
      assert.ok(r.hinweise.includes('Probenplan veraltet – nicht im Bericht. In PlanKit neu erstellen oder trotzdem anhaken.'));
      const z = hakt(k, { probenplan: { an: true, key: hakt(k).key } }); assert.equal(z.an, true, 'nie gesperrt');
      assert.equal(A.planFinden('probenplan', l, spaeter, KA, wo, { termin: '2026-08-12', ersterTermin: true }).grund, 'Plan in PlanKit nach dem Export geändert');
      assert.equal(A.planFinden('probenplan', P(['', alt]), spaeter, KA, wo).grund, 'Plan in PlanKit nach dem Export geändert');
    }
  });

  fall('1.27 ohne Termin-PDF: erkennen wie bis 1.26 (keine Termin-Angaben im Ergebnis)', () => {
    const g = A.erkennen({ ordnerName: KA, projektNr: '26.0999', plaene: P(['', t0], [' - Ergebniskarte', t0]), plan, planNamen: lesbar });
    for (const art of ['probenplan', 'ergebniskarte']) { assert.equal('termin' in g[art], false); assert.equal('termine' in g[art], false); assert.equal(g[art].unklar, false); }
    assert.equal(hakt(g.probenplan).an, true);
  });

  fall('1.27 Review: Termin-Betrieb nur mit eigenen PDFs (Ordnergrenze), termin-artige Plannamen nie zugeordnet, sondern genannt', () => {
    // anderes Projekt, dessen Ordnername mit unserem beginnt („… Ka Nord“) – im älteren Verfahren hieß das bisher Geschoss „Nord“
    const nord = [{ name: `Probenplan ${KA} Nord - Termin 20.08.2026.pdf`, t: t0 + min }];
    for (const wo of [undefined, lesbar]) {
      assert.equal(A.planFinden('probenplan', [...P([' - Termin 12.08.2026', alt]), ...nord], plan, KA, wo, { termin: '2026-08-20' }), null, 'nie der Plan von „… Ka Nord“');
      const mit = A.planFinden('probenplan', [...P(['', alt]), ...nord], plan, KA, wo);
      if (!wo) assert.deepEqual(mit, A.planFinden('probenplan', P(['', alt]), plan, KA), 'älteres Verfahren: schaltet nichts ein, nie ein Geschoss „Nord“');
      else { assert.deepEqual(mit.dateien, [`Pläne/Probenplan ${KA}.pdf`]); assert.equal(mit.terminUnklar, undefined); assert.match(mit.unklarText, /Ka Nord - Termin 20\.08\.2026\.pdf“ \(Ordnername nicht bekannt\)/, 'o11 wie bisher'); }
    }
    // „- 2. Termin“ (von Hand, vor PlanKit 2.7.0), Datum falsch geschrieben, falsche Reihenfolge: nie als Plan von Termin 1, sondern genannt
    for (const bad of [' - 2. Termin', ' - Termin 20.8.2026', ' - Termin  20.08.2026', ' - Termin 31.02.2026', ' - Termin 20.08.2026 - EG', ' - Ergebniskarte - Termin 20.08.2026']) {
      const liste = [...P(['', alt], [' - Termin 20.08.2026', t0]), ...P([bad, t0 + min])];
      for (const wo of [undefined, lesbar]) {
        const k1 = A.planFinden('probenplan', liste, plan, KA, wo, { termin: '2026-08-12', ersterTermin: true });
        assert.deepEqual(k1.dateien, [`Pläne/Probenplan ${KA}.pdf`], bad); assert.deepEqual(k1.ausgelassen, [`Probenplan ${KA}${bad}.pdf`]);
        const k = A.planFinden('probenplan', liste, plan, KA, wo);
        assert.equal(k.unklar, true); assert.match(k.unklarText, /; nicht zugeordnet: „.*“ \(Termin im Namen nicht lesbar – in PlanKit neu exportieren\)$/);
        assert.ok(!k.dateien.some(d => d.includes(bad)), 'nie vorgeschlagen');
      }
    }
    // Codex #40 Runde 2: „Terminal“ ist ein Plan (ganze Wörter; in der .probenplan bekannte Pläne nie verdächtig) – „Termine …“ bleibt verdächtig
    for (const wo of [undefined, { frueher: [KA], geschosse: ['Terminal', 'EG'], nr: '26.0999' }]) {
      const k = A.planFinden('probenplan', P([' - Terminal - Termin 20.08.2026', t0], [' - EG - Termin 20.08.2026', t0]), plan, KA, wo, { termin: '2026-08-20' });
      assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA} - EG - Termin 20.08.2026.pdf`, `Pläne/Probenplan ${KA} - Terminal - Termin 20.08.2026.pdf`]); assert.equal(k.ausgelassen, undefined);
      assert.deepEqual(A.planFinden('probenplan', [...P(['', alt], [' - Termin 20.08.2026', t0]), ...P([' - Termine 20.08.2026', t0])], plan, KA, wo, { termin: '2026-08-12', ersterTermin: true }).ausgelassen, [`Probenplan ${KA} - Termine 20.08.2026.pdf`]);
    }
    assert.equal(A.planFinden('probenplan', P([' - Termin - Termin 20.08.2026', t0]), plan, KA, { frueher: [KA], geschosse: ['Termin', 'EG'], nr: '26.0999' }, { termin: '2026-08-20' }).dateien.length, 1, 'ein Plan „Termin“ aus der .probenplan zählt');
    // Codex #40 Runde 2: kommt eine ausgelassene Datei dazu, verfällt ein selbst gesetzter Haken
    {
      const basis = [...P(['', alt], [' - Termin 20.08.2026', t0])], k0 = A.planFinden('probenplan', basis, plan, KA, lesbar), gemerkt = { probenplan: { an: true, key: hakt(k0).key } };
      assert.equal(hakt(A.planFinden('probenplan', basis, plan, KA, lesbar), gemerkt).an, true);
      const k1 = A.planFinden('probenplan', [...basis, ...P([' - Termin 20.8.2026', t0 + min])], plan, KA, lesbar);
      assert.deepEqual(k1.dateien, k0.dateien); assert.equal(hakt(k1, gemerkt).an, false, 'neue unlesbare Datei: Haken verfällt');
    }
    // nur der Plan ohne Zusatz bleibt übrig: nicht still, Hinweis nennt die ausgelassene Datei
    const k = A.planFinden('probenplan', [...P(['', alt]), ...P([' - 2. Termin - Termin 20.08.2026', t0])], plan, KA);
    assert.deepEqual(k.dateien, [`Pläne/Probenplan ${KA}.pdf`]); assert.equal(k.unklar, true); assert.match(k.unklarText, /^nicht zugeordnet: /);
    // Ordnername endet selbst auf „ - Termin …“: kein Termin-Zusatz, alles wie bis 1.26
    const OT = '26.0512 Foo - Termin 20.08.2026', alleinig = [{ name: `Probenplan ${OT}.pdf`, t: t0 }];
    assert.deepEqual(A.planFinden('probenplan', alleinig, plan, OT).dateien, [`Pläne/Probenplan ${OT}.pdf`]);
    assert.equal(A.planName(`Probenplan ${OT}.pdf`, [OT]).termin, ''); assert.equal(A.planFinden('probenplan', alleinig, plan, OT).unklar, undefined);
    assert.equal(A.planFinden('probenplan', alleinig, plan, OT, undefined, { termin: '2026-08-20' }), null);
    // ohne Ordnername nie ein Termin-Plan
    assert.equal(A.planFinden('probenplan', [{ name: 'Probenplan 26.9999 Andere - Termin 20.08.2026.pdf', t: t0 }], plan, '', undefined, { termin: '2026-08-20' }), null);
  });

  fall('1.27 Word-Anlage mit Termin im Titelteil wird erkannt (wie schon bis 1.26)', () => {
    const k = A.wordFinden('probenahme', [{ name: '26.0999_Anlage-3_Termin-20-08-2026_Probenahme_2026-08-22.docx', t: t0 }], '', plan);
    assert.deepEqual(k.dateien, ['Mitteilungen/26.0999_Anlage-3_Termin-20-08-2026_Probenahme_2026-08-22.docx']);
    assert.deepEqual(A.wordFinden('raumbuch', [{ name: '26.0999_Termin-20-08-2026_Raumbuch_2026-08-22.docx', t: t0 }], '', plan).dateien, ['Mitteilungen/26.0999_Termin-20-08-2026_Raumbuch_2026-08-22.docx']);
  });
}

console.log(`\n${n} Fälle bestanden.`);

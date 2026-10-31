// Brandbericht, Schritt 3 (Gerüst) und 4 (Befund 5.2–5.7) – node tests/brand.cjs: Regeln aus dem Doc „Textbausteine Brand-Sanierungsvorschlag“ und den
// Entscheidungen in „berichtkit-brand-befunde-mitteilungen.md“ an erfundenen Daten (tests/daten/brand.cjs). Der ganze Bericht ist
// zusätzlich im Golden-Test festgeschrieben (tests/brand-golden.cjs); hier stehen die einzelnen Regeln, damit klar ist, was gewollt ist.
const assert = require('node:assert/strict');
const T = require('../bericht-text.js'), BR = require('../bericht-brand.js'), L = require('../bericht-luecken.js'), A = require('../anlagen.js');
const B = require('./daten/beispiel.cjs'), D = require('./daten/brand.cjs');
let n = 0; const fall = (name, fn) => { fn(); n++; console.log('ok –', name); };
const modell = (f, o = {}) => T.bericht({ cfg: B.cfg, mitarbeiter: B.mitarbeiter, ...f, ...o });
const abschnitt = (m, nr) => m.abschnitte.find(a => a.titel.startsWith(nr + '.'));
const text = (m, nr) => abschnitt(m, nr).inhalt.map(x => T.text(x.runs)).join('\n');
const F = D.faelle;
const mitForm = (f, brand = {}, o = {}) => ({ ...f, form: { ...f.form, ...o, brand: { ...f.form.brand, ...brand } } });

fall('Berichtsart brand: Modell wird gebaut, ist aber noch gesperrt (nur Entwurf) – bereit erst nach Schritt 5', () => {
  assert.deepEqual(T.BERICHTSARTEN.map(a => [a.art, a.bereit, a.modul]), [['asbest', true, true], ['brand', false, true]]);
  const m = modell(F.BR1_voll_Versicherung);
  assert.match(m.sperren[0], /Brandbericht ist noch im Aufbau/);
  assert.equal(m.dateiname, '1._Mitteilung_99.9002.docx');
  assert.deepEqual(m.abschnitte.map(a => a.titel), ['1. Veranlassung', '2. Aufgabenstellung', '3. Ortsbesichtigung', '4. Probenahme', '5. Befund',
    '6. Sanierungsmaßnahmen', '7. Arbeitsschutzmaßnahmen', '8. Zusammenfassung Sanierungsmaßnahmen']);
  // Modul direkt (ohne Fassade) ohne Sperre – die Sperre setzt bericht-text.js, solange brand nicht bereit ist
  assert.deepEqual(BR.bericht({ cfg: B.cfg, mitarbeiter: B.mitarbeiter, ...F.BR1_voll_Versicherung }).sperren, []);
});

fall('Deckblatt und Kopf: Titel wählbar, keine Betreffzeile, „Schaden vom:“ / „Brandschaden“ (Befunde Nr. 4), Schaden-Nr. mehrzeilig', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.equal(m.deckblatt.titel, 'Sanierungsvorschlag vom 27.10.2026');
  assert.deepEqual(m.deckblatt.betreff, ['Schaden vom:', '\t', '12.10.2026']);
  assert.deepEqual(m.kopf.map(T.text), ['Sanierungsvorschlag vom 27.10.2026', 'Brandschaden vom 12.10.2026',
    'VN: Muster Hausverwaltung GmbH, Hauptstr. 5, 12345 Musterstadt', 'Risiko: Erdgeschoss links, Brandweg 7, 54321 Beispielstadt']);
  assert.deepEqual(m.deckblatt.felder.map(f => f[0]), ['VN:', 'Risiko:', 'Versicherer:', 'Schaden-Nr.:']);
  const u = modell(F.BR2_nur_PAK_ohne_Versicherung_GB0);
  assert.equal(u.deckblatt.titel, 'Untersuchungsbericht vom 27.10.2026');
  assert.deepEqual(u.deckblatt.betreff, ['Brandschaden']); assert.equal(T.text(u.kopf[1]), 'Brandschaden');
  assert.deepEqual(u.deckblatt.felder.map(f => f[0]), ['Auftraggeber:', 'Schadenort:'], 'ohne Versicherung und ohne Schaden-Nr.: Zeile entfällt');
  const l = modell(F.BR3_Luecken);
  assert.equal(T.text(l.deckblatt.betreff), 'Schaden vom:\t[Schadendatum]'); assert.equal(T.text(l.kopf[1]), 'Brandschaden vom [Schadendatum]');
  assert.deepEqual(l.deckblatt.felder.at(-1), ['Schaden-Nr.:', [{ gap: '[Schaden-Nr.]' }]], 'mit Versicherung fehlt die Schaden-Nr. als Lücke');
  const mehr = modell({ ...F.BR1_voll_Versicherung, pj: D.pj({ schadennummer: '4711 (Inh.)\n4712 (BU); 4713 (Geb.)' }) });
  assert.deepEqual(mehr.deckblatt.felder.at(-1), ['Schaden-Nr.:', ['4711 (Inh.)', '4712 (BU)', '4713 (Geb.)']]);
  const ja = modell(mitForm(F.BR1_voll_Versicherung, { titel: 'Unsinn' }));
  assert.equal(ja.deckblatt.titel, 'Sanierungsvorschlag vom 27.10.2026', 'unbekannter Titel → Vorbelegung');
});

fall('1. Veranlassung: Objektart nach Nutzung, Brandort im Satz, Variante „unbekannt“, Korrosionsabsätze nur mit Chlorid', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.equal(T.text(abschnitt(m, 1).inhalt[0].runs), 'Am 12.10.2026 kam es in dem Wohngebäude Brandweg 7, 54321 Beispielstadt (Erdgeschoss links) zu einem Brandschaden.');
  assert.equal(abschnitt(m, 1).inhalt.length, 5, 'mit Chlorid: Satz 1 + vier Absätze');
  const u = modell(F.BR2_nur_PAK_ohne_Versicherung_GB0);
  assert.equal(T.text(abschnitt(u, 1).inhalt[0].runs), 'In dem Bürogebäude Brandweg 7, 54321 Beispielstadt (Erdgeschoss links) kam es zu einem Brandschaden. Der genaue Zeitpunkt des Schadens ist nicht bekannt.');
  assert.equal(abschnitt(u, 1).inhalt.length, 3, 'nur PAK: ohne die beiden Korrosionsabsätze (Befunde Nr. 7)');
  assert.doesNotMatch(text(u, 1), /Korrosionsrisiko besteht|Chlorwasserstoff/);
  for (const [nutzung, art] of [['Gewerbe/Industrie', 'in dem Gewerbeobjekt'], ['Landwirtschaft', 'in dem landwirtschaftlichen Objekt'], ['Öffentlich', 'in dem Objekt'], ['', 'in dem Objekt']])
    assert.match(text(modell({ ...F.BR1_voll_Versicherung, pj: D.pj({ nutzung }) }), 1), new RegExp(`kam es ${art} Brandweg`), nutzung);
  assert.match(text(modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF), 1), /^Am 12\.10\.2026 kam es in einer Lagerhalle der Muster Logistik GmbH, Industriestraße 3, 54321 Beispielstadt zu einem Brandschaden\./);
  assert.ok(modell(F.BR3_Luecken).hinweise.some(h => /Nutzung fehlt in der Projektzentrale/.test(h)));
  assert.equal(BR.objektart('Wohnen'), 'in dem Wohngebäude');
});

fall('2. Aufgabenstellung: Umfang aus den Haken, Asbest-Satz, Sanierungskonzept nur beim Sanierungsvorschlag', () => {
  assert.equal(text(modell(F.BR1_voll_Versicherung), 2), 'Am 05.10.2026 wurde unser Büro durch die Beispiel Versicherung AG beauftragt, Art und Ausmaß der Schadstoffbelastung an den Gebäudeoberflächen und an der technischen Einrichtung festzustellen. Zusätzlich waren Materialproben auf Asbest zu untersuchen. Aus den getroffenen Feststellungen ist ein Sanierungskonzept abzuleiten.');
  assert.match(text(modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF), 2), /an den Gebäudeoberflächen, an der technischen Einrichtung und an den Warenvorräten festzustellen\. Aus den/);
  assert.equal(text(modell(F.BR2_nur_PAK_ohne_Versicherung_GB0), 2), 'Am 05.10.2026 wurde unser Büro durch die Muster Hausverwaltung GmbH beauftragt, Art und Ausmaß der Schadstoffbelastung an den Gebäudeoberflächen festzustellen.');
  assert.match(text(modell(F.BR3_Luecken), 2), /^Am \[Auftragsdatum\] .* Schadstoffbelastung \[Umfang wählen\] festzustellen\./);
  // Vorbelegung: nur Gebäude
  assert.deepEqual(BR.vorgabe({ nutzung: 'Wohnen' }).umfang, { gebaeude: true, technik: false, waren: false });
  assert.match(text(modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, form: { ...F.BR2_nur_PAK_ohne_Versicherung_GB0.form, brand: {} } }), 2), /an den Gebäudeoberflächen festzustellen\. Aus den getroffenen/);
});

fall('3. Ortsbesichtigung: Anwesende / nur unser Büro / Teilnehmerliste, zweite Person, Ortstermin oder LabelKit-Datum', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.equal(text(m, 3), 'Am 14.10.2026 fand eine Besichtigung der Schadenstelle mit Probenahme statt.\nBei dem Ortstermin waren Herr Muster (VN) und Herr Beispiel (Sanierungsfirma Muster GmbH) sowie Herr Messer und Herr vom Beispiel (Sachverständigenbüro Dr. Heinz Schiffers & Partner) anwesend.');
  assert.match(text(modell(F.BR2_nur_PAK_ohne_Versicherung_GB0), 3), /Bei dem Ortstermin war Herr Messer \(Sachverständigenbüro/);
  assert.match(text(modell(mitForm(F.BR2_nur_PAK_ohne_Versicherung_GB0, { person2: 'Tst' })), 3), /Bei dem Ortstermin waren Herr Messer und Frau Dr\. Test \(Sach/);
  assert.match(text(modell(mitForm(F.BR2_nur_PAK_ohne_Versicherung_GB0, { person2: 'Mes' })), 3), /war Herr Messer \(/, 'zweite Person = Probenehmer zählt einmal');
  assert.match(text(modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF), 3), /Die bei dem Ortstermin anwesenden Personen sind der vor Ort erstellten Teilnehmerliste zu entnehmen\.$/);
  assert.match(text(modell(F.BR3_Luecken), 3), /^Am \[Ortstermin\] fand .*\nBei dem Ortstermin waren \[Anwesende eintragen\] sowie Herr Messer/);
  assert.match(text(modell(mitForm(F.BR1_voll_Versicherung, { person2: '' }, { probenehmer: '' })), 3), /sowie \[Probenehmer\] \(Sachverständigenbüro/);
  assert.match(text(modell(mitForm(F.BR1_voll_Versicherung, {}, { probenehmer: '' })), 3), /sowie Herr vom Beispiel \(Sach/, 'ohne Probenehmer: die zweite Person allein');
  // mehrere Probenahmetage ohne Ortstermin
  const zwei = modell({ ...F.BR4_Gewerbe_Teilnehmerliste_ENTWURF, pj: D.pj({ ortstermin: '' }), lk: D.lk({ pak: [[1, '2026-10-15', 'A', 'Wischprobe'], [2, '2026-10-14', 'B', 'Wischprobe']] }) });
  assert.match(text(zwei, 3), /^Am 14\.10\.2026 und am 15\.10\.2026 fanden Besichtigungen der Schadenstelle mit Probenahme statt\./);
  // Ortstermin fehlt → Probenahmedatum aus LabelKit + Hinweis; weicht ab → Hinweis
  const ohne = modell({ ...F.BR1_voll_Versicherung, pj: D.pj({ ortstermin: '' }) });
  assert.match(text(ohne, 3), /^Am 14\.10\.2026 fand/); assert.ok(ohne.hinweise.some(h => /Ortstermin fehlt in der Projektzentrale – in 3\. steht das Probenahmedatum aus LabelKit \(14\.10\.2026\)/.test(h)));
  assert.ok(modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF).hinweise.some(h => /Probenahmedatum in LabelKit \(15\.10\.2026\) weicht vom Ortstermin der Projektzentrale \(14\.10\.2026\) ab/.test(h)));
  assert.equal(T.nominativ({ name: 'Ohne Anrede', geschlecht: '', satz: 'Ohne Anrede' }), 'Ohne Anrede');
  assert.equal(T.nominativ({ name: 'Dr. S. Kasper', geschlecht: 'm', satz: 'Herrn Dr. S. Kasper' }), 'Herr Dr. S. Kasper');
  assert.equal(T.nominativ({ name: 'Stefan Cremer', geschlecht: 'm', satz: 'unseren Messtechniker Herrn Cremer' }), 'Herr Cremer', 'eigener Satz im Akkusativ gilt hier nicht');
});

fall('4. Probenahme: Absätze je Gruppe, Zahlwort bis zwölf, Einzahl, gemeinsamer Prüfbericht Chlorid/PAK, mehrere Prüfberichte', () => {
  const m = modell(F.BR1_voll_Versicherung), t = text(m, 4).split('\n');
  assert.equal(t[0], 'Zur Messung der Chloridbelastung wurden drei Wischproben entnommen. Die Proben wurden der Eurofins Beispiel-Labor GmbH zur Untersuchung auf Chlorid übergeben.');
  assert.equal(t[1], 'Zur Messung der PAK-Belastung wurden vier Wischproben entnommen und auf die 16 Einzelkomponenten nach EPA (Environmental Protection Agency) untersucht; zusätzlich wird der Summenwert angegeben. Zusätzlich wurde eine Materialprobe entnommen und auf PAK untersucht. Die Analysenergebnisse sind dem Prüfbericht Nr. AR-999-2026-000101-01 zu entnehmen (Anlage 1).');
  // Asbest vor KMF (Abweichung von der Doc-Reihenfolge: die Dämmstoffprobe ist erst „entnommen“, dann „zusätzlich untersucht“)
  assert.equal(t[2], 'Zusätzlich wurden drei Materialproben (Fliesenkleber, Putz, Dämmstoff Mineralwolle) entnommen und der Eurofins Beispiel-Labor GmbH zur Untersuchung auf Asbest übergeben. Die Ergebnisse sind im Prüfbericht Nr. AR-999-2026-000102-01 dokumentiert (Anlage 2).');
  assert.equal(t[3], 'An einer Materialprobe künstlicher Mineralfaserdämmung wurde zusätzlich untersucht, ob es sich um WHO-Fasern handelt, und der Kanzerogenitätsindex (KI) bestimmt.');
  assert.equal(t[4], 'Zusätzlich wurden zwei Materialproben entnommen und am 20.10.2026 sensorisch auf Brandgeruch geprüft. Das Ergebnis ist in Anlage 5 dargestellt.');
  assert.equal(t[5], 'Die Entnahmestellen sind in der Bilddokumentation (Anlage 3) und im Probenplan (Anlage 4) dargestellt.');
  const l = text(modell(F.BR3_Luecken), 4).split('\n');
  assert.equal(l[0], 'Zur Messung der Chloridbelastung wurde eine Wischprobe entnommen. Die Probe wurde der [Labor] zur Untersuchung auf Chlorid übergeben. Die Analysenergebnisse sind dem Prüfbericht Nr. AR-999-2026-000301-01 zu entnehmen (Anlage 1).');
  assert.match(l[1], /Die Analysenergebnisse sind den Prüfberichten Nr\. AR-999-2026-000302-01 und Nr\. AR-999-2026-000303-01 zu entnehmen \(Anlagen 2 und 3\)\.$/);
  assert.equal(l[2], 'Zusätzlich wurde eine Materialprobe entnommen und am [Prüfdatum Brandgeruch] sensorisch auf Brandgeruch geprüft. Das Ergebnis ist in Anlage [Anlage-Nr. Brandgeruch] dargestellt.');
  assert.equal(l[3], 'Die Entnahmestellen sind in der Bilddokumentation (Anlage 4) dargestellt.');
  // ab 13 als Ziffer; stornierte zählen nicht
  const viele = Array.from({ length: 13 }, (_, i) => [i + 1, '2026-10-14', 'Raum ' + i, 'Wischprobe']);
  const vm = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ pak: [...viele, [20, '2026-10-14', 'storno', 'Wischprobe', B.STORNO]] }) });
  assert.match(text(vm, 4), /^Zur Messung der PAK-Belastung wurden 13 Wischproben entnommen/);
  // nur Asbest: „Es wurden …“ statt „Zusätzlich …“
  const nurAsb = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ asbest: [[1, '2026-10-14', 'Keller', 'Putz', 'Putze / Spachtelmassen']] }), erg: D.erg([{ nr: 'AR-1', proben: [[1, D.W.kein, 'Asbest']] }]) });
  assert.match(text(nurAsb, 4), /^Es wurde eine Materialprobe \(Putz\) entnommen und der .* Das Ergebnis ist im Prüfbericht Nr\. AR-1 dokumentiert \(Anlage 1\)\.\nDie Entnahmestelle ist in der Bilddokumentation/);
  // keine Proben: Lücke + Hinweis
  const leer = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({}), erg: D.erg([]) });
  assert.equal(text(leer, 4), '[Probenahme beschreiben]'); assert.ok(leer.hinweise.some(h => /Keine Proben/.test(h)));
  // Chlorid-Proben ohne Prüfbericht: Lücke + Hinweis; Chlorid-Materialprobe im Chlorid-Absatz, Sonstige ohne Parameter: Lücke
  const ohneB = modell({ ...F.BR1_voll_Versicherung, erg: D.erg([]), lk: D.lk({ chlorid: [[1, '2026-10-14', 'EG', 'Wischprobe'], [2, '2026-10-14', 'EG', 'Material']], sonstige: [[3, '2026-10-14', 'EG', 'Material']] }) });
  const o = text(ohneB, 4).split('\n');
  assert.equal(o[0], 'Zur Messung der Chloridbelastung wurde eine Wischprobe entnommen. Zusätzlich wurde eine Materialprobe entnommen. Die Proben wurden der Eurofins Beispiel-Labor GmbH zur Untersuchung auf Chlorid übergeben. Die Analysenergebnisse sind dem Prüfbericht Nr. [Prüfbericht-Nr.] zu entnehmen.');
  assert.equal(o[1], 'Zusätzlich wurde eine weitere Probe entnommen und auf [Untersuchungsparameter] untersucht. Die Analysenergebnisse sind dem Prüfbericht Nr. [Prüfbericht-Nr.] zu entnehmen.');
  for (const re of [/Chlorid: noch kein Prüfbericht/, /Weitere Proben \(LabelKit „Sonstige“\): noch kein Prüfbericht/, /Untersuchungsparameter fehlt/]) assert.ok(ohneB.hinweise.some(h => re.test(h)), String(re));
  assert.ok(!ohneB.hinweise.some(h => /noch nicht berücksichtigt/.test(h)), 'Chlorid-Material und Sonstige stehen jetzt im Text');
  // Chlorid-Bohrmehl (LabelKit „Sonstige“ mit Haken „Chlorid-Bohrmehl“) und Materialprobe; ohne Wischprobe beginnt der Absatz mit ihnen
  const bm = text(modell(F.BR5_Gewerbe_Bohrmehl_Tabellen), 4).split('\n')[0];
  assert.match(bm, /^Zur Messung der Chloridbelastung wurden fünf Wischproben entnommen\. Zusätzlich wurden eine Materialprobe und zwei Bohrmehlproben entnommen\. Die Proben wurden/);
  const nurBm = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ sonstige: [[1, '2026-10-14', 'Stütze', 'Material (mineralisch)', { notiz: 'Chlorid', tiefe: '0 – 2 mm' }]] }), erg: D.erg([{ nr: 'BM-1', proben: [[1, D.W.clMat('300', 'mg/kg'), 'Sonstige']] }]) });
  assert.match(text(nurBm, 4), /^Zur Messung der Chloridbelastung wurde eine Bohrmehlprobe entnommen\. Die Probe wurde der .* zu entnehmen \(Anlage 1\)\./, 'ohne Haken: Tiefe + „Chlorid“ im Parameter = Bohrmehl');
  assert.equal(abschnitt(nurBm, 1).inhalt.length, 5, 'Chlorid-Bohrmehl bringt die Korrosionsabsätze in 1.');
});

fall('Anlagen: Prüfberichte Chlorid, PAK, Asbest/KMF, dann Bilddokumentation, Probenplan, Brandgeruch – Brandgeruch nur mit Proben', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.deepEqual(m.anlagenListe.map(a => [a.nr, a.art]), [[1, 'pruefbericht'], [2, 'pruefbericht'], [3, 'bilddoku'], [4, 'probenplan'], [5, 'brandgeruch']]);
  assert.deepEqual(m.anlagenTeile.map(a => T.text(a.zeilen[0])), ['Prüfbericht Nr. AR-999-2026-000101-01', 'Prüfbericht Nr. AR-999-2026-000102-01', 'Bilddokumentation', 'Probenplan', 'Sensorische Prüfung auf Brandgeruch']);
  assert.deepEqual(m.anlagenDateien.at(-1), 'Mitteilungen/99-9002_Anlage_Brandgeruch_2026-10-21.docx');
  // ohne Brandgeruch-Proben: keine Zeile, kein Hinweis – auch wenn eine Datei da ist
  const u = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, anlagen: D.anlagen({ bilddokuAnlage: 'Anlage 2' }) });
  assert.ok(!u.anlagenZeilen.some(z => z.art === 'brandgeruch')); assert.ok(!u.hinweise.some(h => /Brandgeruch/.test(h)));
  // mit Proben, Datei fehlt: Hinweis mit Sprung in die Projektzentrale; veraltet (LabelKit danach geändert) → nicht vorgehakt
  const l = modell(F.BR3_Luecken);
  const h = l.hinweise.find(x => /Sensorische Prüfung auf Brandgeruch nicht gefunden/.test(x)); assert.ok(h);
  assert.deepEqual(l.hinweisAktionen[h], { app: 'Projektzentrale', link: '../Projektzentrale/', ziel: 'projektzentrale', was: 'erstellen' });
  const v = modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF);
  assert.ok(!v.anlagenListe.some(a => a.art === 'brandgeruch')); assert.equal(v.anlagenZeilen.find(z => z.art === 'brandgeruch').zustand, 'veraltet');
  assert.ok(v.hinweise.some(x => /Sensorische Prüfung auf Brandgeruch veraltet – nicht im Bericht/.test(x)));
  // trotzdem angehakt: Nummer im Titel („Anlage 7“) passt nicht → Hinweis
  const z = v.anlagenZeilen.find(x => x.art === 'brandgeruch');
  const an = modell(mitForm(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF, {}, { anlagen: { brandgeruch: { an: true, key: z.key } } }));
  // BR4 hat zwei Prüfberichte (Chlorid/PAK, weitere Untersuchungen) → Brandgeruch ist Anlage 5
  assert.equal(an.anlagenListe.find(a => a.art === 'brandgeruch').nr, 5);
  assert.ok(an.hinweise.some(x => x === 'Brandgeruch-Anlage trägt „Anlage 7“, im Bericht ist sie Anlage 5 – in der Projektzentrale mit „Anlage 5“ neu erstellen.'));
  assert.match(text(an, 4), /Das Ergebnis ist in Anlage 5 dargestellt\./);
  assert.match(text(an, 5), /Die Einzelbewertungen der Prüfpersonen sind in Anlage 5 dargestellt\./);
});

fall('5.1, 6., 8.: Lücke (Freitext folgt in Schritt 5); „Untersuchungsbericht“: 6. Schlussfolgerungen, ohne 8.', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.deepEqual(abschnitt(m, 5).inhalt.slice(0, 2), [{ t: 'h2', runs: ['5.1 Brandlast und Schadenbild'] }, { t: 'p', runs: [{ gap: '[Brandlast und Schadenbild beschreiben]' }] }]); assert.equal(text(m, 6), '[Sanierungsmaßnahmen ergänzen]'); assert.equal(text(m, 8), '[Zusammenfassung der Sanierungsmaßnahmen ergänzen]');
  const u = modell(F.BR2_nur_PAK_ohne_Versicherung_GB0);
  assert.equal(abschnitt(u, 6).titel, '6. Schlussfolgerungen'); assert.equal(text(u, 6), '[Schlussfolgerungen ergänzen]'); assert.equal(abschnitt(u, 8), undefined);
});

fall('7. Arbeitsschutzmaßnahmen: GB 0 eigener Satz, GB 1–3 mit Nummer, übrige Bereiche, TRGS 521 (KMF) und TRGS 519 (Asbest)', () => {
  const t = text(modell(F.BR1_voll_Versicherung), 7).split('\n');
  assert.equal(t[0], 'Bei Durchführung der oben angegebenen Sanierungsmaßnahmen sind Arbeitsschutzmaßnahmen für den Gefahrenbereich 2 (GB 2) gemäß Richtlinien zur Brandschadensanierung, VdS Schadenverhütung im Gesamtverband der Deutschen Versicherungswirtschaft e. V. (GDV), VdS 2357:2014-06, vorzunehmen.');
  assert.equal(t[1], 'Bei Arbeiten in den übrigen Wohnungen sind keine über den normalen Arbeitsschutz hinausgehenden Maßnahmen notwendig.');
  assert.match(t[2], /^Das Einbaujahr des Dämmstoffs ist nicht bekannt\. .*TRGS 521/);
  assert.match(t[3], /^Bei dem Material „Fliesenkleber“ \(Probe 9\) handelt es sich um ein asbesthaltiges Material\. .*TRGS 519/);
  assert.match(text(modell(mitForm(F.BR1_voll_Versicherung, {}, { einbau: 'vor1996' })), 7), /Der Dämmstoff wurde vor 1996 eingebaut/);
  const g0 = text(modell(mitForm(F.BR1_voll_Versicherung, { gb: '0' })), 7).split('\n')[0];
  assert.equal(g0, 'Bei Durchführung der oben angegebenen Sanierungsmaßnahmen sind aus chemischer Sicht keine über die üblichen Arbeitsschutzmaßnahmen hinausgehenden besonderen Schutzmaßnahmen gegen brandbedingte Schadstoffe erforderlich. Die untersuchten Bereiche sind gemäß Richtlinien zur Brandschadensanierung, VdS Schadenverhütung im Gesamtverband der Deutschen Versicherungswirtschaft e. V. (GDV), VdS 2357:2014-06, dem Gefahrenbereich 0 (GB 0) zuzuordnen.');
  assert.doesNotMatch(text(modell(mitForm(F.BR1_voll_Versicherung, { gb: '0' })), 7), /übrigen/, 'bei GB 0 kein Satz zu den übrigen Bereichen');
  assert.match(text(modell(mitForm(F.BR1_voll_Versicherung, { gb: '3' })), 7), /für den Gefahrenbereich 3 \(GB 3\) gemäß/);
  assert.match(text(modell(mitForm(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF, { uebrige: true })), 7), /in den übrigen Bereichen sind keine/);
  assert.match(text(modell(F.BR3_Luecken), 7), /für den Gefahrenbereich \[Gefahrenbereich wählen\] gemäß/);
  // Untersuchungsbericht (ohne Sanierungsmaßnahmen): vorläufige Formulierung, bei GB 0 ohne doppeltes „untersuchte Bereiche“
  assert.match(text(modell(F.BR2_nur_PAK_ohne_Versicherung_GB0), 7), /^Bei Sanierungsarbeiten sind aus chemischer Sicht/);
  assert.match(text(modell(mitForm(F.BR2_nur_PAK_ohne_Versicherung_GB0, { gb: '1' })), 7), /^Bei Sanierungsarbeiten in den untersuchten Bereichen sind Arbeitsschutzmaßnahmen für den Gefahrenbereich 1/);
  // Vorbelegung „übrige Wohnungen“ nur bei Nutzung Wohnen
  assert.equal(BR.vorgabe({ nutzung: 'Wohnen' }).uebrige, true); assert.equal(BR.vorgabe({ nutzung: 'Büro' }).uebrige, false);
});

fall('Asbestproben im Brandbericht: Sperren und Hinweise wie im Asbestbericht (ohne Ergebnis, storniert, fremde LabelKit-Datei)', () => {
  const f = F.BR1_voll_Versicherung;
  const offen = modell({ ...f, lk: { ...f.lk, asbestProben: [...f.lk.asbestProben, { id: 12, _nr: 12, datum: '2026-10-14', z2: 'Keller', z3: 'Kitt', matrix: 'Kitte' }] } });
  assert.ok(offen.sperren.some(s => /^P12: in LabelKit als Asbestprobe erfasst, aber noch kein Ergebnis/.test(s)));
  const st = modell({ ...f, lk: { ...f.lk, asbestProben: f.lk.asbestProben.map(p => p._nr === 9 ? { ...p, ...B.STORNO } : p) } });
  assert.ok(st.hinweise.some(h => /^P9 ist in LabelKit storniert/.test(h))); assert.match(text(st, 4), /wurden zwei Materialproben \(Putz, Dämmstoff Mineralwolle\)/);
  assert.doesNotMatch(text(st, 7), /TRGS 519/, 'stornierte positive Probe bringt keinen TRGS-519-Satz');
  const fremd = modell({ ...f, lk: { ...f.lk, projekt: { nr: '11.1111' } } });
  assert.ok(fremd.sperren.some(s => /gehört zu Projekt 11\.1111/.test(s)));
  // abgewählt (Proben-Liste) zählt nicht
  assert.match(text(modell(mitForm(f, {}, { aus: { P10: false } })), 4), /zwei Materialproben \(Fliesenkleber, Dämmstoff Mineralwolle\)/);
});

fall('Lücke → Feld: jede Lücke des Brandberichts steht in FELDER.brand, Felder gibt es im Formular', () => {
  const fs = require('node:fs'), path = require('node:path');
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'bericht-brand.js'), 'utf8');
  const namen = new Set([...quelle.matchAll(/gap: (?:sanierung \? )?'(\[[^'$]+\])'(?: : '(\[[^'$]+\])')?/g)].flatMap(x => [x[1], x[2]]).filter(Boolean));
  for (const x of quelle.matchAll(/\bL\([^;]*?, '([^']+)'\)/g)) namen.add(`[${x[1]}]`);
  for (const k of ['VN', 'Risiko', 'Versicherer', 'Auftraggeber', 'Schadenort', 'Projektnummer', 'Sachverständige(r)', 'Prüfbericht-Nr.']) namen.add(`[${k}]`);
  assert.ok(namen.size >= 25, `Lücken gefunden (${namen.size})`);
  for (const g of namen) assert.ok(L.eintrag(g, 'brand'), `Lücke ${g} fehlt in FELDER.brand`);
  for (const [name, f] of Object.entries(F)) for (const g of L.offene(modell(f))) assert.ok(L.eintrag(g, 'brand'), `${name}: ${g}`);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const e of L.FELDER.brand) for (const id of `${e.feld || ''} ${e.ziel || ''}`.match(/#[\w-]+/g) || []) assert.ok(html.includes(`id="${id.slice(1)}"`), `${id} in index.html`);
  assert.equal(L.zuordnen(['[Gefahrenbereich wählen]'], 'brand')[0].feld, '#fbGb');
  assert.equal(L.zuordnen(['[Brandlast und Schadenbild beschreiben]'], 'brand')[0].wo, 'in Word ergänzen (Formular dafür folgt)');
  assert.equal(L.zuordnen(['[Hintergrundreferenz 10 oder 100 µg/m²]'], 'brand')[0].feld, '#fbReferenz');
  for (const g of ['[Bewertung der Chlorid-Bohrmehlproben ergänzen]', '[Bewertung der PAK-Materialproben ergänzen]', '[Bewertung der weiteren Untersuchungen ergänzen]', '[Schlussfolgerung für nicht eindeutige Ergebnisse ergänzen]'])
    assert.equal(L.zuordnen([g], 'brand')[0].wo, 'in Word ergänzen', g);
});

fall('Anlage Brandgeruch erkennen: Name der Projektzentrale, neueste zuerst, Nummer aus dem Titel, Stand über das Anlagen-Protokoll', () => {
  const t = Date.parse('2026-10-21T10:00:00Z'), lkNeu = { name: 'x_Daten.json', t: t + 3600e3, sha: 'e'.repeat(64) };
  const prot = (datei, sha) => `2026-10-21T10:00:00.000Z | ${datei} | ${'c'.repeat(64)} | LabelKit/x_Daten.json | ${sha} | Projektzentrale 1.39.0`;
  const nurPn98 = A.brandgeruchFinden([{ name: '99-9002_Anlage_PN98_2026-10-21.docx', t }], '', null);
  assert.equal(nurPn98, null, 'nur PN 98 ist keine Brandgeruch-Anlage');
  let k = A.brandgeruchFinden([{ name: '99-9002_Anlage_PN98-Brandgeruch_2026-10-20.docx', t: t - 1 }, { name: '99-9002_Anlage-5_Brandgeruch_2026-10-21_2.docx', t }], prot('99-9002_Anlage-5_Brandgeruch_2026-10-21_2.docx', 'e'.repeat(64)), lkNeu);
  assert.deepEqual(k.dateien, ['Mitteilungen/99-9002_Anlage-5_Brandgeruch_2026-10-21_2.docx']); assert.equal(k.nrImDokument, 5); assert.equal(k.veraltet, false, 'gleiche Prüfsumme = aktuell, auch wenn die Datei älter ist');
  k = A.brandgeruchFinden([{ name: '99-9002_Anlage_Brandgeruch_2026-10-21.docx', t }], prot('99-9002_Anlage_Brandgeruch_2026-10-21.docx', 'f'.repeat(64)), lkNeu);
  assert.equal(k.veraltet, true); assert.equal(k.nrImDokument, null); assert.match(k.grund, /LabelKit-Daten nach dem Erstellen geändert/);
  k = A.brandgeruchFinden([{ name: '99-9002_Anlage_Brandgeruch_2026-10-21.docx', t }], '', lkNeu);
  assert.equal(k.veraltet, true, 'ohne Protokoll: Zeitvergleich'); assert.match(k.grund, /älter als die LabelKit-Daten/);
  k = A.brandgeruchFinden([{ name: '99-9002_Anlage_Brandgeruch_2026-10-21.docx', t }], '', null);
  assert.equal(k.veraltet, null); assert.match(k.grund, /Stand nicht prüfbar/);
  // Asbestbericht kennt die Art nicht (Profil asbest) – eine Brandgeruch-Datei ändert dort nichts
  assert.ok(!A.PROFILE.asbest.fest.includes('brandgeruch') && !A.PROFILE.asbest.optional.includes('brandgeruch'));
});

fall('Prüfberichte erkennen: „Chlorid“ nur als eigener Parameter, stornierte Proben zählen nicht, KMF-Bericht ohne Asbestwerte wird Anlage', () => {
  const f = F.BR2_nur_PAK_ohne_Versicherung_GB0;
  const lhkw = modell({ ...f, erg: D.erg([{ nr: 'LHKW-1', proben: [[3, [{ p: 'Vinylchlorid', r: '< 0,1', u: 'mg/kg' }], 'Sonstige']] }, ...f.erg.berichte.map(b => ({ nr: b.bericht, proben: b.proben.map(p => [+p.label.slice(1), p.werte, p.typ]) }))]) });
  assert.equal(abschnitt(lhkw, 1).inhalt.length, 3, 'Vinylchlorid ist kein Chlorid – keine Korrosionsabsätze');
  assert.deepEqual(lhkw.anlagenListe.filter(a => a.art === 'pruefbericht').map(a => a.titel), ['Prüfbericht']);
  assert.equal(T.text(lhkw.anlagenTeile[0].zeilen[0]), 'Prüfbericht Nr. AR-999-2026-000201-01');
  // Chlorid-Wert nur zu einer stornierten Probe: Bericht ist kein Chlorid-Bericht
  const st = modell({ ...f, lk: D.lk({ pak: [[1, '2026-10-14', 'A', 'Wischprobe']], chlorid: [[2, '2026-10-14', 'B', 'Wischprobe', B.STORNO]] }),
    erg: D.erg([{ nr: 'CL-1', proben: [[2, D.W.cl('9'), 'Chlorid']] }, { nr: 'PAK-1', proben: [[1, D.W.pak('20'), 'PAK']] }]) });
  assert.deepEqual(st.anlagenListe.filter(a => a.art === 'pruefbericht').length, 1); assert.doesNotMatch(text(st, 1), /Korrosionsrisiko besteht/);
  // KMF-Prüfbericht ohne Asbestwerte: eigene Anlage, Verweis im KMF-Absatz
  const kmf = modell({ ...f, lk: D.lk({ pak: [[1, '2026-10-14', 'A', 'Wischprobe']], asbest: [[2, '2026-10-14', 'Dach', 'Dämmstoff Mineralwolle', 'Sonstige']] }),
    erg: D.erg([{ nr: 'PAK-1', proben: [[1, D.W.pak('20'), 'PAK']] }, { nr: 'KMF-1', proben: [[2, [{ p: 'WHO-Fasern', r: 'nachgewiesen', u: '' }, { p: 'Kanzerogenitätsindex KI', r: '30', u: '' }], 'Asbest']] }]) });
  assert.deepEqual(kmf.anlagenTeile.filter(a => /Prüfbericht/.test(T.text(a.zeilen[0]))).map(a => T.text(a.zeilen[0])), ['Prüfbericht Nr. PAK-1', 'Prüfbericht Nr. KMF-1']);
  assert.match(text(kmf, 4), /\nAn einer Materialprobe künstlicher Mineralfaserdämmung wurde untersucht, ob es sich um WHO-Fasern handelt, und der Kanzerogenitätsindex \(KI\) bestimmt\. Das Ergebnis ist im Prüfbericht Nr\. KMF-1 dokumentiert \(Anlage 2\)\.\n/);
  assert.match(text(kmf, 7), /TRGS 521/);
});

fall('Brandgeruch-Anlage: Nummer auch mitten im Titel, gekürzter Name (64 Zeichen), andere LabelKit-Datei → Stand nicht prüfbar', () => {
  const t = Date.parse('2026-10-21T10:00:00Z'), lk = { name: 'alt_Daten.json', t, sha: 'e'.repeat(64) };
  let k = A.brandgeruchFinden([{ name: '26-0512_Anlage-4-Brandgeruch_Brandgeruch_2026-10-21.docx', t }], '', null);
  assert.equal(k.nrImDokument, 4, '„Anlage 4 Brandgeruch“ → Anlage-4-Brandgeruch');
  // Projektzentrale: Titel „Anlage 3 Sensorische Prüfung im Erdgeschoss links Wohnung“ → Name nach 64 Zeichen abgeschnitten
  const lang = ('26-0512_Anlage-3-Sensorische-Pruefung-im-Erdgeschoss-links_PN98-Brandgeruch').slice(0, 64) + '_2026-10-21.docx';
  k = A.brandgeruchFinden([{ name: lang, t }], '', null);
  assert.ok(k, 'gekürzter Name erkannt'); assert.equal(k.nrImDokument, 3); assert.match(k.details, /gekürzt/);
  assert.equal(A.brandgeruchFinden([{ name: ('26-0512_Anlage-3-Sensorische-Pruefung-im-Erdgeschoss-links-Wohnungxx_PN98').slice(0, 64) + '_2026-10-21.docx', t }], '', null), null, 'abgeschnitten vor „B“: kein Brandgeruch erkennbar');
  const prot = `2026-10-21T10:00:00.000Z | 26-0512_Anlage_Brandgeruch_2026-10-21.docx | ${'c'.repeat(64)} | LabelKit/neu_Daten.json | ${'f'.repeat(64)} | Projektzentrale 1.39.0`;
  k = A.brandgeruchFinden([{ name: '26-0512_Anlage_Brandgeruch_2026-10-21.docx', t }], prot, lk);
  assert.equal(k.veraltet, null); assert.match(k.grund, /aus einer anderen LabelKit-Datei erstellt \(neu_Daten\.json\)/);
});

fall('Ohne Laborproben (nur Brandgeruch / gar keine Proben): keine Platzhalter-Anlage „Prüfbericht“, Nummern ab 1 (Codex, PR #14)', () => {
  const f = F.BR1_voll_Versicherung;
  const nurBg = modell({ ...f, lk: D.lk({ brandgeruch: [[1, 'Sofa', 'Stoff', '+', '+', '+', '+', '+']], bgDatum: '2026-10-20', bgBlind: false }), erg: D.erg([]) });
  assert.deepEqual(nurBg.anlagenListe.map(a => [a.nr, a.art]), [[1, 'bilddoku'], [2, 'probenplan'], [3, 'brandgeruch']]);
  assert.ok(!nurBg.luecken.includes('[Prüfbericht-Nr.]')); assert.ok(!nurBg.luecken.includes('[Labor]'));
  assert.equal(text(nurBg, 4), 'Es wurde eine Materialprobe entnommen und am 20.10.2026 sensorisch auf Brandgeruch geprüft. Das Ergebnis ist in Anlage 3 dargestellt.\nDie Entnahmestelle ist in der Bilddokumentation (Anlage 1) und im Probenplan (Anlage 2) dargestellt.');
  const keine = modell({ ...f, lk: D.lk({}), erg: D.erg([]) });
  assert.deepEqual(keine.anlagenListe.map(a => a.art), ['bilddoku', 'probenplan']);
  // Laborproben ohne Prüfbericht: Platzhalter bleibt (Prüfbericht folgt), wie im Asbestbericht
  const ohneBericht = modell({ ...f, lk: D.lk({ pak: [[1, '2026-10-14', 'A', 'Wischprobe']] }), erg: D.erg([]) });
  assert.equal(T.text(ohneBericht.anlagenTeile[0].zeilen[0]), 'Prüfbericht Nr. [Prüfbericht-Nr.]');
  // Asbestbericht ohne Ergebnisse: Platzhalter wie bisher
  assert.equal(A.zusammenstellen({ profil: 'asbest', pruefberichte: [] }).liste[0].art, 'pruefbericht');
  assert.deepEqual(A.zusammenstellen({ profil: 'brand', pruefberichte: [], ohnePruefbericht: true }).nr, {});
});

/* ---------- Schritt 4: Befund 5.2–5.7 ---------- */
const BW = require('../bericht-bewertung.js');
const h2s = m => abschnitt(m, 5).inhalt.filter(x => x.t === 'h2').map(x => x.runs[0]);
const absaetze = m => abschnitt(m, 5).inhalt.filter(x => x.t === 'p').map(x => T.text(x.runs));
const tabellen = m => abschnitt(m, 5).inhalt.filter(x => x.t === 'tab');
const unterabschnitt = (m, titel) => { const i = abschnitt(m, 5).inhalt; const a = i.findIndex(x => x.t === 'h2' && x.runs[0].endsWith(titel)); if (a < 0) return null;
  const b = i.findIndex((x, j) => j > a && x.t === 'h2'); return i.slice(a + 1, b < 0 ? undefined : b); };
const utext = (m, titel) => (unterabschnitt(m, titel) || []).filter(x => x.t === 'p').map(x => T.text(x.runs)).join('\n');

fall('5. Befund: 5.1 immer, dann nur, wozu es Ergebnisse gibt – Chlorid, PAK, KMF, Asbest, Brandgeruch, weitere; fortlaufend nummeriert', () => {
  assert.deepEqual(h2s(modell(F.BR1_voll_Versicherung)), ['5.1 Brandlast und Schadenbild', '5.2 Korrosionsschäden', '5.3 Organische Schadstoffe', '5.4 Künstliche Mineralfaserwolle', '5.5 Asbest', '5.6 Sensorische Prüfung auf Brandgeruch']);
  assert.deepEqual(h2s(modell(F.BR2_nur_PAK_ohne_Versicherung_GB0)), ['5.1 Brandlast und Schadenbild', '5.2 Organische Schadstoffe']);
  assert.deepEqual(h2s(modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF)), ['5.1 Brandlast und Schadenbild', '5.2 Korrosionsschäden', '5.3 Organische Schadstoffe', '5.4 Sensorische Prüfung auf Brandgeruch', '5.5 Weitere Untersuchungen']);
  // Proben ohne Ergebnis: kein 5.2/5.3 (nur Hinweis „noch kein Prüfbericht“)
  assert.deepEqual(h2s(modell({ ...F.BR1_voll_Versicherung, erg: D.erg([]), lk: D.lk({ chlorid: [[1, '2026-10-14', 'EG', 'Wischprobe']], pak: [[2, '2026-10-14', 'EG', 'Wischprobe']] }) })), ['5.1 Brandlast und Schadenbild']);
  // Tabellennummern laufen über 5. (Chlorid 1, PAK 2, Asbest 3); ohne Haken nur die Asbest-Tabelle – dann Tabelle 1
  assert.deepEqual(tabellen(modell(F.BR1_voll_Versicherung)).map(t => t.caption), ['Tabelle 1: Chlorid-Wischproben', 'Tabelle 2: PAK-Wischproben', 'Tabelle 3: Materialproben und Ergebnisse (Asbest)']);
  assert.deepEqual(tabellen(modell(mitForm(F.BR1_voll_Versicherung, { tabellen: false }))).map(t => t.caption), ['Tabelle 1: Materialproben und Ergebnisse (Asbest)']);
  assert.equal(BR.vorgabe({}).tabellen, false, 'Haken „Ergebnistabellen“: Vorbelegung aus');
});

fall('5.2 Chlorid: fester Text, Spanne, Zähl-Absatz Form B, höchster Wert, Referenzprobe eigener Satz, Tabelle oder Verweis, Abschluss A/B', () => {
  const m = modell(F.BR1_voll_Versicherung), t = utext(m, 'Korrosionsschäden').split('\n');
  assert.match(t[0], /^Abhängig von Material und Umgebungsbedingungen ist ab Chloridflächenbelastungen in der Größenordnung von 5 bis 10 µg\/cm² \(korrosionschemisch relevante Größenordnung nach VdS 2357\)/);
  assert.equal(t[1], 'Die ermittelten Chloridflächenbelastungen liegen zwischen 4,1 und 12,3 µg/cm². Von den zwei Chlorid-Wischproben liegt eine oberhalb der korrosionschemisch relevanten Größenordnung (Probe 1) und eine darunter. Die höchste Belastung wurde mit 12,3 µg/cm² in Probe 1 (EG Küche Brandraum Decke) festgestellt. Die Referenzprobe (Probe 3) ergab < 0,5 µg/cm². Die Ergebnisse sind in Tabelle 1 zusammengefasst.');
  assert.equal(t[2], 'Nach fachgerechter Durchführung der unter 6. angegebenen Sanierungsmaßnahmen ist davon auszugehen, dass die nachgewiesenen Chloridflächenbelastungen unter die korrosionschemisch relevante Größenordnung reduziert werden.');
  const tab = tabellen(m)[0];
  assert.deepEqual(tab.kopf, ['Probe', 'Labor-Nr.', 'Entnahmestelle', 'Chlorid [µg/cm²]', 'Einordnung']);
  assert.deepEqual(tab.zeilen.map(z => [z[0], z[3], z[4]]), [['1', '12,3', 'oberhalb'], ['2', '4,1', 'unterhalb'], ['3 (Referenz)', '< 0,5', 'unterhalb']]);
  assert.equal(tab.spalten.reduce((a, b) => a + b), 9070); assert.deepEqual(tab.ohneUmbruch, [1]);
  // ohne Haken: Verweis auf den Prüfbericht mit Anlage
  assert.match(utext(modell(mitForm(F.BR1_voll_Versicherung, { tabellen: false })), 'Korrosionsschäden'), /Die Referenzprobe \(Probe 3\) ergab < 0,5 µg\/cm²\. Die Einzelergebnisse sind dem Prüfbericht \(Anlage 1\) zu entnehmen\.\n/);
  // mg/m² (älterer Bericht): Wert und Einheit wie im Bericht, Einordnung umgerechnet; drei Gruppen, „in diesem Bereich“, < BG-Satz
  const g = modell(F.BR5_Gewerbe_Bohrmehl_Tabellen), gt = utext(g, 'Korrosionsschäden').split('\n');
  assert.equal(gt[1], 'Die oberhalb der Bestimmungsgrenze ermittelten Chloridflächenbelastungen liegen zwischen 20 und 150 mg/m². Von den fünf Chlorid-Wischproben liegt eine oberhalb der korrosionschemisch relevanten Größenordnung (Probe 1), zwei in diesem Bereich (Proben 2 und 3) und zwei darunter. Die höchste Belastung wurde mit 150 mg/m² in Probe 1 (Verkaufsraum Regal 1) festgestellt. Bei Probe 5 lag der Chloridgehalt unterhalb der Bestimmungsgrenze. Die Ergebnisse sind in Tabelle 1 zusammengefasst.');
  assert.deepEqual(tabellen(g)[0].zeilen.map(z => [z[3], z[4]]), [['150', 'oberhalb'], ['70', 'im Bereich'], ['60', 'im Bereich'], ['20', 'unterhalb'], ['< 5', 'unterhalb']]);
  assert.equal(tabellen(g)[0].kopf[3], 'Chlorid [mg/m²]');
  // Untersuchungsbericht: Abschluss B ohne „unter 6. angegebenen Sanierungsmaßnahmen“ (vorläufig wie 7.)
  assert.equal(gt[gt.length - 1], 'Nach fachgerechter Durchführung von Sanierungsarbeiten ist davon auszugehen, dass die nachgewiesenen Chloridflächenbelastungen unter die korrosionschemisch relevante Größenordnung reduziert werden.');
  // Material- und Bohrmehlproben: Werte im Satz (mit Tiefe), Bewertung als Lücke, vor dem Abschluss
  assert.equal(gt[2], 'Zusätzlich wurde an der Materialprobe (Probe 6, Verkaufsraum Kassenband) ein Chloridgehalt von 0,02 M.-% ermittelt. [Bewertung der Chlorid-Materialproben ergänzen]');
  assert.equal(gt[3], 'Zusätzlich wurden an den Bohrmehlproben folgende Chloridgehalte ermittelt: 1.200 mg/kg (Probe 12, Verkaufsraum Stütze, Tiefe 0 – 2 mm) und 450 mg/kg (Probe 13, Verkaufsraum Stütze, Tiefe 2 – 5 mm). [Bewertung der Chlorid-Bohrmehlproben ergänzen]');
  // Abschluss A: alle unterhalb; „Beide“; eine Probe: ein Satz mit Wert und Einordnung
  const unten = c => modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ chlorid: c.map((r, i) => [i + 1, '2026-10-14', 'Raum ' + (i + 1), 'Wischprobe']) }),
    erg: D.erg([{ nr: 'CL-1', proben: c.map((r, i) => [i + 1, D.W.cl(r), 'Chlorid']) }]) });
  const a = utext(unten(['1,2', '3']), 'Korrosionsschäden').split('\n');
  assert.equal(a[1], 'Die ermittelten Chloridflächenbelastungen liegen zwischen 1,2 und 3 µg/cm². Beide Chlorid-Wischproben liegen unterhalb der korrosionschemisch relevanten Größenordnung. Die höchste Belastung wurde mit 3 µg/cm² in Probe 2 (Raum 2) festgestellt. Die Einzelergebnisse sind dem Prüfbericht (Anlage 1) zu entnehmen.');
  assert.equal(a[2], 'Eine korrosionschemisch relevante Chloridbelastung liegt nicht vor.');
  assert.equal(utext(unten(['7,5']), 'Korrosionsschäden').split('\n')[1], 'Die Chlorid-Wischprobe (Probe 1, Raum 1) ergab 7,5 µg/cm² und liegt damit im Bereich der korrosionschemisch relevanten Größenordnung. Die Einzelergebnisse sind dem Prüfbericht (Anlage 1) zu entnehmen.');
  const nn = utext(unten(['< 0,5', 'n. n.', '< 0,5']), 'Korrosionsschäden').split('\n')[1];
  assert.equal(nn, 'Alle drei Chlorid-Wischproben liegen unterhalb der korrosionschemisch relevanten Größenordnung. In keiner der drei Chlorid-Wischproben war Chlorid oberhalb der Bestimmungsgrenze nachweisbar. Die Einzelergebnisse sind dem Prüfbericht (Anlage 1) zu entnehmen.');
  // im Bereich ohne „oberhalb“ zuerst: Größenordnung ausgeschrieben
  assert.match(utext(unten(['6', '2']), 'Korrosionsschäden'), /Von den zwei Chlorid-Wischproben liegt eine im Bereich der korrosionschemisch relevanten Größenordnung \(Probe 1\) und eine darunter\./);
  // nicht einzuordnen (Einheit je Probe, „< 12“ mit BG über 5): Tabelle „–“, nicht gezählt, Hinweis
  const x = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, form: { ...F.BR2_nur_PAK_ohne_Versicherung_GB0.form, brand: { ...F.BR2_nur_PAK_ohne_Versicherung_GB0.form.brand, tabellen: true } },
    lk: D.lk({ chlorid: [[1, '', 'A', 'Wischprobe'], [2, '', 'B', 'Wischprobe'], [3, '', 'C', 'Wischprobe']] }),
    erg: D.erg([{ nr: 'CL-1', proben: [[1, D.W.cl('12', 'µg/Probe'), 'Chlorid'], [2, D.W.cl('< 12'), 'Chlorid'], [3, D.W.cl('22'), 'Chlorid']] }]) });
  assert.deepEqual(tabellen(x)[0].zeilen.map(z => [z[3], z[4]]), [['12 µg/Probe', '–'], ['< 12 µg/cm²', '–'], ['22 µg/cm²', 'oberhalb']]);
  assert.equal(tabellen(x)[0].kopf[3], 'Chlorid', 'gemischte Einheiten: Einheit je Zelle');
  assert.match(utext(x, 'Korrosionsschäden'), /Die Chlorid-Wischprobe \(Probe 3, C\) ergab 22 µg\/cm²/);
  assert.equal(x.hinweise.filter(h => /nicht einzuordnen/.test(h)).length, 2);
  // LabelKit-Probe ohne Ergebnis: Hinweis
  const fehlt = modell({ ...F.BR1_voll_Versicherung, lk: D.lk({ chlorid: [[1, '2026-10-14', 'EG', 'Wischprobe'], [2, '2026-10-14', 'EG', 'Wischprobe']] }), erg: D.erg([{ nr: 'CL-1', proben: [[1, D.W.cl('3'), 'Chlorid']] }]) });
  assert.ok(fehlt.hinweise.includes('Chlorid: noch kein Ergebnis für P2 – in 5.2 nicht berücksichtigt.'));
});

fall('Einordnung wie ResultKit: Chlorid 5/10 µg/cm² (umgerechnet), PAK-Referenz 10/100 µg/m², Zahlen streng lesen', () => {
  const cl = (r, u = 'µg/cm²') => BW.chloridStufe({ r, u });
  assert.deepEqual(['4,99', '5', '9,99', '10', '0'].map(r => cl(r)), [0, 1, 1, 2, 0]);
  assert.deepEqual([cl('50', 'mg/m²'), cl('99', 'mg/m²'), cl('100', 'mg/m2'), cl('49', 'mg/m²')], [1, 1, 2, 0], '1 µg/cm² = 10 mg/m²');
  assert.deepEqual([cl('< 0,5'), cl('n. n.'), cl('unter BG'), cl('< 5'), cl('< 12'), cl('(n. b.)'), cl('12', 'µg/Probe'), cl('> 50')], [0, 0, 0, 0, -1, -1, -1, -1]);
  assert.deepEqual([BW.pakStufe({ r: '9,9', u: 'µg/m²' }, 10), BW.pakStufe({ r: '10', u: 'µg/m²' }, 10), BW.pakStufe({ r: '99', u: 'µg/m²' }, 100), BW.pakStufe({ r: '0,1', u: 'µg/100 cm²' }, 10), BW.pakStufe({ r: '10', u: 'mg/kg' }, 10)], [0, 1, 0, 1, -1]);
  assert.deepEqual(['2300', '2.300', '1.234,5', '12,3', '1 250', '< 0,5', 'n. n.'].map(BW.labNumber).map(v => (Number.isNaN(v) ? 'NaN' : v)), [2300, 'NaN', 1234.5, 12.3, 1250, 'NaN', 'NaN']);
  assert.deepEqual(['< 0,5', 'n. n.', '(n. b.)', 'unter BG', '12', 'abc'].map(BW.labQualifier), ['below', 'notDetected', 'notDetermined', 'below', 'measured', 'unrated']);
  assert.equal(BR.referenzVorgabe('Wohnen'), '10'); assert.equal(BR.referenzVorgabe('Landwirtschaft'), '100'); assert.equal(BR.referenzVorgabe(''), '');
  // Gleich halten mit ResultKit (wenn daneben ausgecheckt): Umrechnungstabellen und Grenzen
  const fs = require('node:fs'), path = require('node:path'), rk = path.join(__dirname, '..', '..', 'resultkit', 'src', 'bewertung.ts');
  if (fs.existsSync(rk)) {
    const q = fs.readFileSync(rk, 'utf8');
    const obj = re => JSON.parse(q.match(re)[1].replace(/'/g, '"').replace(/([{,])\s*([\d.]+)\s*(?=[,}])/g, '$1$2').replace(/:\s*\./g, ':0.'));
    assert.deepEqual(obj(/CHLORID_JE_UG_CM2:Record<string,number>=(\{[^}]*\})/), BW.CHLORID_JE_UG_CM2, 'KORROSION-CHLORID v1 wie ResultKit');
    assert.deepEqual(obj(/const factor=\((\{[^}]*\})/), BW.PAK_JE_UG_M2, 'VdS-Faktor wie ResultKit');
    assert.match(q, /from:5\*f,[^]*from:10\*f/); assert.match(q, /usage==='residential'\?10:100/);
    assert.match(q, /RESIDENTIAL=\['Wohnen','Büro','Öffentlich','Gesundheit & Labor'\],INDUSTRIAL=\['Gewerbe\/Industrie','Landwirtschaft'\]/);
    console.log('   (ResultKit bewertung.ts daneben: Tabellen gleich)');
  }
});

fall('5.3 PAK: fester Text, Referenz aus der Nutzung oder gewählt (mit Begründung), Zähl-Absatz, n. n.-Satz, Referenzprobe/Freimessung, Material, Abschluss', () => {
  const m = modell(F.BR1_voll_Versicherung), t = utext(m, 'Organische Schadstoffe').split('\n');
  assert.equal(t.length, 6);
  assert.match(t[2], /ca\. 100 µg\/m² vorliegen\. Für das vorliegende Objekt wird die Hintergrundreferenz von ca\. 10 µg\/m² herangezogen\.$/);
  assert.equal(t[3], 'Die ermittelten Summenwerte (16 EPA-PAK) liegen zwischen 85 und 2300 µg/m². Beide PAK-Wischproben erreichen oder überschreiten die Hintergrundreferenz von ca. 10 µg/m². Der höchste Summenwert wurde mit 2300 µg/m² in Probe 4 (EG Küche Brandraum Decke) festgestellt. Die Referenzprobe (Probe 6) ergab 9 µg/m². Die Freimessung (Probe 7) ergab 7 µg/m². Die Ergebnisse sind in Tabelle 2 zusammengefasst.');
  assert.equal(t[4], 'Zusätzlich wurde an der Materialprobe (Probe 8, EG Küche Dämmung) ein Summenwert (16 EPA-PAK) von 14 mg/kg ermittelt. [Bewertung der PAK-Materialproben ergänzen]');
  assert.match(t[5], /^Die beim Brand gebildeten organischen Schadstoffe sind adsorptiv sehr stark an den Ruß gebunden\. .* nach ordnungsgemäßer Durchführung der angegebenen Sanierungsmaßnahmen keine Gesundheitsgefährdung durch Brandkondensate gegeben ist\.$/);
  assert.deepEqual(tabellen(m)[1].zeilen.map(z => [z[0], z[4]]), [['4', 'Referenz erreicht/\u200Büberschritten'], ['5', 'Referenz erreicht/\u200Büberschritten'], ['6 (Referenz)', 'unter Referenz'], ['7 (Freimessung)', 'unter Referenz']]);
  // Gewerbe mit 10 µg/m² und Begründung (Befunde Nr. 5); n. n.-Satz; Proben-Liste mit „und“
  const g = utext(modell(F.BR5_Gewerbe_Bohrmehl_Tabellen), 'Organische Schadstoffe').split('\n');
  assert.match(g[2], /Für das vorliegende Objekt wird die Hintergrundreferenz von ca\. 10 µg\/m² herangezogen\. Aufgrund der Nutzung als Lebensmittelverkaufsstätte wird die für Wohn- und Bürobereiche übliche Hintergrundbelastung herangezogen\.$/);
  assert.equal(g[3], 'Die oberhalb der Bestimmungsgrenze ermittelten Summenwerte (16 EPA-PAK) liegen zwischen 4 und 31 µg/m². Von den vier PAK-Wischproben erreichen oder überschreiten zwei die Hintergrundreferenz von ca. 10 µg/m² (Proben 7 und 10); zwei liegen darunter. Der höchste Summenwert wurde mit 31 µg/m² in Probe 10 (Lager Wand) festgestellt. Bei Probe 8 war keine der untersuchten PAK-Einzelverbindungen oberhalb der Bestimmungsgrenze nachweisbar. Die Referenzprobe (Probe 11) ergab 3 µg/m². Die Ergebnisse sind in Tabelle 2 zusammengefasst.');
  assert.match(g[4], /nach ordnungsgemäßer Durchführung von Sanierungsarbeiten keine Gesundheitsgefährdung/, 'Untersuchungsbericht: vorläufig wie 7.');
  assert.ok(!modell(F.BR5_Gewerbe_Bohrmehl_Tabellen).hinweise.some(h => /weicht von der Nutzung/.test(h)), 'mit Begründung kein Hinweis');
  const ohneGrund = modell(mitForm(F.BR5_Gewerbe_Bohrmehl_Tabellen, { referenzGrund: '' }));
  assert.ok(ohneGrund.hinweise.includes('Hintergrundreferenz 10 µg/m² weicht von der Nutzung „Gewerbe/Industrie“ (100 µg/m²) ab – Begründung unter „Brandbericht“ ergänzen?'));
  // Vorbelegung aus der Nutzung (Gewerbe → 100); keine Nutzung → Lücke im Referenzsatz und statt des Zähl-Satzes + Hinweis
  assert.match(utext(modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF), 'Organische Schadstoffe'), /Die PAK-Wischprobe \(Probe 2, Halle Regal 3\) ergab einen Summenwert von 410 µg\/m² und erreicht oder überschreitet damit die Hintergrundreferenz von ca\. 100 µg\/m²\./);
  const l = modell(F.BR3_Luecken), lt = utext(l, 'Organische Schadstoffe').split('\n');
  assert.match(lt[2], /vorliegen\. \[Hintergrundreferenz 10 oder 100 µg\/m²\]$/);
  assert.equal(lt[3], 'Die ermittelten Summenwerte (16 EPA-PAK) liegen zwischen 12 und 140 µg/m². [Hintergrundreferenz 10 oder 100 µg/m²] Der höchste Summenwert wurde mit 140 µg/m² in Probe 2 (EG Küche Decke) festgestellt. Die Einzelergebnisse sind den Prüfberichten (Anlagen 2 und 3) zu entnehmen.');
  assert.ok(l.hinweise.includes('Hintergrundreferenz PAK fehlt (Nutzung in der Projektzentrale nicht eingetragen) – unter „Brandbericht“ 10 oder 100 µg/m² wählen.'));
  assert.equal(L.offene(l).filter(x => x === '[Hintergrundreferenz 10 oder 100 µg/m²]').length, 1, 'im Zähler einmal');
  // „1.250“ (Tausenderpunkt ohne Gebietsschema) bleibt wie ResultKit unbewertet: Tabelle „–“, nicht gezählt, Hinweis
  const amb = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, erg: D.erg([{ nr: 'P-1', proben: [[1, D.W.pak('1.250'), 'PAK'], [2, D.W.pak('8'), 'PAK']] }]) });
  assert.match(utext(amb, 'Organische Schadstoffe'), /Die PAK-Wischprobe \(Probe 2, EG Büro Wand\) ergab einen Summenwert von 8 µg\/m² und liegt damit unterhalb der Hintergrundreferenz von ca\. 10 µg\/m²\./);
  assert.ok(amb.hinweise.includes('Probe 1: Σ 16 EPA-PAK „1.250 µg/m²“ nicht einzuordnen (Wert oder Einheit) – in 5.2 nicht mitgezählt, bitte im Prüfbericht prüfen.'));
  // Probennummern im Satz: ab drei aufeinanderfolgenden „bis“
  assert.equal(BR.nrText([{ nr: 2 }, { nr: 6 }, { nr: 7 }, { nr: 8 }]), '2 und 6 bis 8'); assert.equal(BR.nrText([{ nr: 1 }, { nr: 2 }, { nr: 5 }]), '1, 2 und 5');
});

fall('Referenzprobe und Freimessung: erkannt wie im Datenarchiv der Projektzentrale („REF“/„Referenz“, „F-“ vorn), mehrere in einem Satz', () => {
  assert.deepEqual(['OG Wohnzimmer REF Wand', 'Referenzfläche Büro', 'F-EG Küche Wand', 'EG Küche F-1 Wand', 'Brandraum Decke', 'Refektorium Wand'].map(z => BW.rolleAuto(z, '')),
    ['referenz', 'referenz', 'frei', '', '', '']);
  assert.equal(BW.rolleAuto('', 'Wand nach Sanierung'), 'frei');
  const m = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ pak: [[1, '', 'A', 'Wischprobe'], [2, '', 'B', 'Wischprobe'], [3, '', 'REF Büro 1', 'Wischprobe'], [4, '', 'REF Büro 2', 'Wischprobe'], [5, '', 'F-A', 'Wischprobe'], [6, '', 'F-B', 'Wischprobe']] }),
    erg: D.erg([{ nr: 'P-1', proben: [[1, D.W.pak('50'), 'PAK'], [2, D.W.pak('5'), 'PAK'], [3, D.W.pak('3'), 'PAK'], [4, D.W.pak('2'), 'PAK'], [5, D.W.pak('4'), 'PAK'], [6, D.W.pak('6'), 'PAK']] }]) });
  assert.match(utext(m, 'Organische Schadstoffe'), /Von den zwei PAK-Wischproben erreicht oder überschreitet eine die Hintergrundreferenz von ca\. 10 µg\/m² \(Probe 1\); eine liegt darunter\. .* Die Referenzproben ergaben 3 µg\/m² \(Probe 3\) und 2 µg\/m² \(Probe 4\)\. Die Freimessungen ergaben 4 µg\/m² \(Probe 5\) und 6 µg\/m² \(Probe 6\)\./);
  assert.match(utext(m, 'Organische Schadstoffe'), /zwischen 5 und 50 µg\/m²/, 'Spanne ohne Referenzproben und Freimessungen');
});

fall('5.4 KMF und 5.5 Asbest: Texte wie im Asbestbericht, Methode VDI 3866 Blatt 5 mit Anhang B aus der Nachweisgrenze, Tabelle immer', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.equal(utext(m, 'Künstliche Mineralfaserwolle'), 'In der Dämmstoffprobe 11 (EG Küche Decke) wurden WHO-Fasern (lungengängige Fasern) nachgewiesen. Der Prüfbericht weist einen Kanzerogenitätsindex von KI = 26 aus.\nNach der seit 05.06.2026 geltenden Fassung der TRGS 905 werden WHO-Fasern nicht mehr über den Kanzerogenitätsindex, sondern nach den Kategorien für krebserzeugende Stoffe in Anhang I der CLP-Verordnung bewertet. Der KI-Wert wird daher nur ergänzend angegeben.');
  assert.equal(utext(m, 'Asbest'), 'Die Materialproben wurden gemäß VDI 3866 Blatt 5 auf Asbest untersucht, bei Probe 10 unter Anwendung des Verfahrens nach Anhang B. Die Ergebnisse sind in Tabelle 3 zusammengefasst.\nIn Probe 9 (Material: „Fliesenkleber“) wurde Asbest nachgewiesen: Chrysotil, 5 - 20 %.\nIn den übrigen Proben wurde kein Asbest nachgewiesen.');
  assert.deepEqual(unterabschnitt(m, 'Asbest').at(-1).zeilen[0], ['9', '999-2026-0001109', 'EG Küche Boden', 'Fliesenkleber', 'Chrysotil, 5 - 20 %']);
  assert.ok(!m.hinweise.some(h => /Anhang B/.test(h)), 'positive Probe (1 %-Stufe) braucht kein Anhang B');
  // eine Probe, negativ, Anhang B; keine Probe positiv → „In der Materialprobe …“; ohne Haken trotzdem Tabelle
  const eine = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ asbest: [[1, '2026-10-14', 'Keller', 'Putz', 'Putze / Spachtelmassen']] }), erg: D.erg([{ nr: 'AR-1', proben: [[1, D.W.kein, 'Asbest']] }]) });
  assert.equal(utext(eine, 'Asbest'), 'Die Materialprobe wurde gemäß VDI 3866 Blatt 5 unter Anwendung des Verfahrens nach Anhang B auf Asbest untersucht. Das Ergebnis ist in Tabelle 1 zusammengefasst.\nIn der Materialprobe wurde kein Asbest nachgewiesen.');
  assert.equal(unterabschnitt(eine, 'Asbest').at(-1).caption, 'Tabelle 1: Materialprobe und Ergebnis (Asbest)');
  // negativ, Matrix spricht für Anhang B, Bericht nennt nur 1 %: Hinweis; keine Angabe zur Nachweisgrenze: weder Satz noch Hinweis
  const nurEins = [{ p: 'Asbestart', r: 'Kein Asbest nachgewiesen', u: '', nwg: '1 %' }];
  const p1 = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ asbest: [[1, '2026-10-14', 'Keller', 'Putz', 'Putze / Spachtelmassen'], [2, '2026-10-14', 'Dach', 'Platte', 'Faserzementprodukte (z.B. Eternit)']] }),
    erg: D.erg([{ nr: 'AR-1', proben: [[1, nurEins, 'Asbest'], [2, [{ p: 'Asbestart', r: 'Kein Asbest nachgewiesen', u: '' }], 'Asbest']] }]) });
  assert.match(utext(p1, 'Asbest'), /^Die Materialproben wurden gemäß VDI 3866 Blatt 5 auf Asbest untersucht\. Die Ergebnisse sind in Tabelle 1 zusammengefasst\.\nIn keiner der zwei Materialproben wurde Asbest nachgewiesen\.$/);
  assert.deepEqual(p1.hinweise.filter(h => /Anhang B/.test(h)), ['Probe 1: Matrix „Putze / Spachtelmassen“ wird meist nach VDI 3866 Blatt 5 Anhang B untersucht, der Prüfbericht nennt dafür keine Nachweisgrenze von 0,001 % – bitte prüfen.']);
  assert.equal(BW.anhangB([{ p: 'Asbestart', r: '-', u: '', nwg: '0,001 %' }, { p: 'Asbestart', r: 'Kein Asbest', u: '', nwg: '1 %' }]), false, '„-“ = Stufe nicht untersucht');
  // nicht eindeutig: Satz + Lücke
  const unklar = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ asbest: [[1, '2026-10-14', 'Keller', 'Kitt', 'Kitte']] }), erg: D.erg([{ nr: 'AR-1', proben: [[1, [{ p: 'Asbestart', r: 'Verdacht', u: '' }], 'Asbest']] }]) });
  assert.match(utext(unklar, 'Asbest'), /\nFür Probe 1 \(Material: „Kitt“\) weist der Prüfbericht aus: Verdacht\. \[Schlussfolgerung für nicht eindeutige Ergebnisse ergänzen\]$/);
});

fall('5.6 Brandgeruch: Methode, Ergebnis-Satz je Probe aus p1–p5 (Nr. wie in der Anlage), verdeckt/unvollständig → Lücke, Verweis auf die Anlage', () => {
  const t = utext(modell(F.BR1_voll_Versicherung), 'Sensorische Prüfung auf Brandgeruch').split('\n');
  assert.match(t[0], /^Die zwei Materialproben wurden in einem geschlossenen Luftraum auf 50 °C konditioniert und anschließend durch fünf Prüfpersonen/);
  assert.equal(t[1], 'Bei Probe 1 (Sofa Wohnzimmer, Stoffbezug) wurde von vier Prüfpersonen ein mittelstarker und von einer Prüfperson ein starker Brandgeruch festgestellt. Bei Probe 2 (Teppich Flur, Wolle) wurde von drei Prüfpersonen ein schwacher und von zwei Prüfpersonen kein Brandgeruch festgestellt.');
  assert.equal(t[2], 'Die Einzelbewertungen der Prüfpersonen sind in Anlage 5 dargestellt.');
  const bg = (proben, o = {}) => modell({ ...F.BR1_voll_Versicherung, lk: D.lk({ brandgeruch: proben, bgDatum: '2026-10-20', bgBlind: false, ...o }) });
  assert.match(utext(bg([[1, 'Jacke', '', '++', '++', '++', '++', '++'], [2, '', '', '–', '-', '−', '-', '-']]), 'Brandgeruch'), /Bei Probe 1 \(Jacke\) wurde von allen fünf Prüfpersonen ein starker Brandgeruch festgestellt\. Bei Probe 2 wurde von allen fünf Prüfpersonen kein Brandgeruch festgestellt\./);
  // Gleichstand: die stärkere Bewertung zuerst
  assert.match(utext(bg([[1, 'A', '', '+', '(+)', '+', '(+)', '++']]), 'Brandgeruch'), /von zwei Prüfpersonen ein mittelstarker, von zwei Prüfpersonen ein schwacher und von einer Prüfperson ein starker Brandgeruch/);
  const blind = bg([[1, 'A', '', '+', '+', '+', '+', '+']], { bgBlind: true });
  assert.match(utext(blind, 'Brandgeruch'), /\n\[Ergebnis der Brandgeruchprüfung ergänzen\]\n/);
  const halb = bg([[1, 'A', '', '+', '+', '', '+', '+'], [2, 'B', '', '+', '+', '+', '+', 'x']]);
  assert.match(utext(halb, 'Brandgeruch'), /\n\[Ergebnis der Brandgeruchprüfung ergänzen\]\n/);
  assert.ok(halb.hinweise.includes('Brandgeruch: Bewertungen fehlen oder sind unlesbar (Probe 1, Probe 2) – in LabelKit alle fünf Bewertungen eintragen.'));
  assert.match(utext(modell(F.BR3_Luecken), 'Brandgeruch'), /in Anlage \[Anlage-Nr\. Brandgeruch\] dargestellt\.$/);
});

fall('5.7 weitere Untersuchungen (LabelKit „Sonstige“ ohne Chlorid-Bohrmehl): Verweis auf den Prüfbericht als Anlage, Bewertung als Lücke', () => {
  const m = modell(F.BR4_Gewerbe_Teilnehmerliste_ENTWURF);
  assert.match(text(m, 4), /\nZusätzlich wurde eine weitere Probe entnommen und auf Schwermetalle untersucht\. Die Analysenergebnisse sind dem Prüfbericht Nr\. AR-999-2026-000402-01 zu entnehmen \(Anlage 2\)\.\n/);
  assert.equal(utext(m, 'Weitere Untersuchungen'), 'Die Ergebnisse der weiteren Probe (Probe 3; Schwermetalle) sind dem Prüfbericht Nr. AR-999-2026-000402-01 zu entnehmen (Anlage 2). [Bewertung der weiteren Untersuchungen ergänzen]');
  assert.deepEqual(m.anlagenListe.filter(a => a.art === 'pruefbericht').map(a => a.dateien[0]), ['Laborergebnisse/AR-999-2026-000401-01.pdf', 'Laborergebnisse/AR-999-2026-000402-01.pdf']);
  // Sonstige mit PAK-Wert: in 5.3 (weitere Probe), nicht in 5.7; Chlorid-Bohrmehl nie in 5.7
  const pak = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, lk: D.lk({ pak: [[1, '', 'A', 'Wischprobe']], sonstige: [[2, '', 'Schutt', 'Bauschutt', { notiz: 'PAK' }]] }),
    erg: D.erg([{ nr: 'P-1', proben: [[1, D.W.pak('20'), 'PAK'], [2, D.W.pakMat('3'), 'Sonstige']] }]) });
  assert.ok(!h2s(pak).some(h => /Weitere/.test(h)));
  assert.match(utext(pak, 'Organische Schadstoffe'), /Zusätzlich wurde an der weiteren Probe \(Probe 2, Schutt\) ein Summenwert \(16 EPA-PAK\) von 3 mg\/kg ermittelt\. \[Bewertung der weiteren PAK-Proben ergänzen\]/);
  assert.ok(!h2s(modell(F.BR5_Gewerbe_Bohrmehl_Tabellen)).some(h => /Weitere/.test(h)));
});

fall('Entnahmestelle im Befund: LabelKit Raum/Ort, Raum-Kürzel ausgeschrieben wie im Asbestbericht (mit Hinweis)', () => {
  const m = modell({ ...F.BR2_nur_PAK_ohne_Versicherung_GB0, form: { ...F.BR2_nur_PAK_ohne_Versicherung_GB0.form, brand: { ...F.BR2_nur_PAK_ohne_Versicherung_GB0.form.brand, tabellen: true } },
    lk: D.lk({ pak: [[1, '', 'OG SZ Decke', 'Wischprobe'], [2, '', 'OG WZ Wand', 'Wischprobe']] }) });
  assert.deepEqual(tabellen(m)[0].zeilen.map(z => z[2]), ['OG Schlafzimmer Decke', 'OG Wohnzimmer Wand']);
  assert.ok(m.hinweise.some(h => /Abkürzungen ausgeschrieben \(SZ → Schlafzimmer, WZ → Wohnzimmer\)/.test(h)));
});

/* Zweiter Review (PR #15): Fälle, die vorher falsch oder ungetestet waren */
const B2 = F.BR2_nur_PAK_ohne_Versicherung_GB0;
const clFall = (proben, lkChlorid, o = {}) => modell({ ...B2, lk: D.lk({ chlorid: lkChlorid || proben.map((x, i) => [i + 1, '', 'Raum ' + (i + 1), 'Wischprobe']), ...o.lk }),
  erg: o.erg || D.erg([{ nr: 'CL-1', proben: proben.map((w, i) => [i + 1, Array.isArray(w) ? w : D.W.cl(w), 'Chlorid']) }]) });
const keineDoppelLeer = m => m.abschnitte.forEach(a => a.inhalt.filter(x => x.t === 'p').forEach(x => assert.ok(!/ {2}/.test(T.text(x.runs)), `doppeltes Leerzeichen in ${a.titel}: ${T.text(x.runs)}`)));

fall('Review: Material-/Bohrmehlproben ohne Wischproben – Satz mit „wurde/wurden“, PAK-Bohrmehl mit eigener Lücke', () => {
  const bm = (werte, liste_ = 'sonstige') => modell({ ...B2, lk: D.lk({ ui: { bohrmehlAktiv: true },
    sonstige: werte.map((w, i) => [i + 1, '', 'Stütze', 'Bohrmehl', { tiefe: `${i * 2} – ${i * 2 + 2} mm`, notiz: 'Chlorid' }]) }),
    erg: D.erg([{ nr: 'S-1', proben: werte.map((w, i) => [i + 1, w, 'Sonstige']) }]) });
  assert.equal(utext(bm([D.W.clMat('300', 'mg/kg')]), 'Korrosionsschäden'), 'An der Bohrmehlprobe (Probe 1, Stütze, Tiefe 0 – 2 mm) wurde ein Chloridgehalt von 300 mg/kg ermittelt. [Bewertung der Chlorid-Bohrmehlproben ergänzen]');
  assert.equal(utext(bm([D.W.clMat('300', 'mg/kg'), D.W.clMat('120', 'mg/kg')]), 'Korrosionsschäden'),
    'An den Bohrmehlproben wurden folgende Chloridgehalte ermittelt: 300 mg/kg (Probe 1, Stütze, Tiefe 0 – 2 mm) und 120 mg/kg (Probe 2, Stütze, Tiefe 2 – 4 mm). [Bewertung der Chlorid-Bohrmehlproben ergänzen]');
  assert.match(utext(bm([D.W.pakMat('2')]), 'Organische Schadstoffe'), /^Schädliche[^\n]*\nAn der Bohrmehlprobe \(Probe 1, Stütze, Tiefe 0 – 2 mm\) wurde ein Summenwert \(16 EPA-PAK\) von 2 mg\/kg ermittelt\. \[Bewertung der PAK-Bohrmehlproben ergänzen\]\n/);
  const mat = modell({ ...B2, lk: D.lk({ pak: [[1, '', 'EG Dämmung', 'Dämmstoff']] }), erg: D.erg([{ nr: 'P-1', proben: [[1, D.W.pakMat('14'), 'PAK']] }]) });
  assert.match(utext(mat, 'Organische Schadstoffe'), /\nAn der Materialprobe \(Probe 1, EG Dämmung\) wurde ein Summenwert \(16 EPA-PAK\) von 14 mg\/kg ermittelt\. \[Bewertung der PAK-Materialproben ergänzen\]\n/);
  // 4.: nach dem Chlorid-Absatz (nur Material) beginnt der nächste Absatz mit „Zusätzlich“
  const vor = modell({ ...B2, lk: D.lk({ chlorid: [[1, '', 'EG Putz', 'Putze / Spachtelmassen']], sonstige: [[2, '', 'Schutt', 'Bauschutt', { notiz: 'Schwermetalle' }]] }),
    erg: D.erg([{ nr: 'CL-1', proben: [[1, D.W.clMat('0,02', 'M.-%'), 'Chlorid'], [2, D.W.blei('40'), 'Sonstige']] }]) });
  assert.match(text(vor, 4), /\nZusätzlich wurde eine weitere Probe entnommen und auf Schwermetalle untersucht\./);
});

fall('Review: Spanne und höchster Wert in einer Einheit verglichen, < BG ehrlich benannt, unklare Werte ohne Spanne', () => {
  const t = utext(clFall(['12', D.W.cl('60', 'mg/m²'), '3']), 'Korrosionsschäden').split('\n')[1];
  assert.match(t, /^Die ermittelten Chloridflächenbelastungen liegen zwischen 3 und 12 µg\/cm²\./, '60 mg/m² = 6 µg/cm² liegt dazwischen');
  assert.match(t, /Die höchste Belastung wurde mit 12 µg\/cm² in Probe 1 \(Raum 1\) festgestellt\./);
  const pak = modell({ ...B2, erg: D.erg([{ nr: 'P-1', proben: [[1, [{ p: 'Summe 16 EPA-PAK exkl. BG', r: '0,5', u: 'µg/100 cm²' }], 'PAK'], [2, D.W.pak('20'), 'PAK']] }]) });
  const pt = utext(pak, 'Organische Schadstoffe');
  assert.match(pt, /liegen zwischen 20 µg\/m² und 0,5 µg\/100 cm²\./); assert.match(pt, /Der höchste Summenwert wurde mit 0,5 µg\/100 cm² in Probe 1 /);
  assert.match(utext(clFall(['< 0,5', '4,1', '12,3']), 'Korrosionsschäden'), /^[^\n]*\nDie oberhalb der Bestimmungsgrenze ermittelten Chloridflächenbelastungen liegen zwischen 4,1 und 12,3 µg\/cm²\. [^\n]* Bei Probe 1 lag der Chloridgehalt unterhalb der Bestimmungsgrenze\./);
  // „1.250“ nicht lesbar: keine Spanne (sie könnte falsch sein), Zähl-Absatz über die übrigen
  const amb = utext(clFall(['1.250', '4', '7']), 'Korrosionsschäden').split('\n')[1];
  assert.ok(!/zwischen/.test(amb)); assert.match(amb, /^Von den zwei Chlorid-Wischproben liegt eine im Bereich/);
});

fall('Review: Abschluss 5.2 nur aus regulären, eingeordneten Proben – sonst Lücke; nichts einzuordnen → Lücke statt Zähl-Absatz', () => {
  const ende = m => utext(m, 'Korrosionsschäden').split('\n').at(-1);
  const teil = clFall(['2', D.W.cl('12', 'µg/Probe')]);
  assert.equal(ende(teil), '[Abschluss Chlorid ergänzen]', 'eine nicht einzuordnen, keine darüber: kein Schluss A, auch nicht B');
  assert.ok(teil.hinweise.includes('5.2: nicht alle Chlorid-Wischproben einzuordnen – Abschluss (Variante A/B) bitte in Word ergänzen.'));
  assert.match(ende(clFall(['2', D.W.cl('12', 'µg/Probe'), '7'])), /^Nach fachgerechter Durchführung/, 'eine im Bereich: B gilt trotzdem');
  const keine = clFall([D.W.cl('12', 'µg/Probe'), D.W.cl('13', 'µg/Probe')]), kt = utext(keine, 'Korrosionsschäden').split('\n');
  assert.equal(kt[1], '[Einordnung der Chlorid-Wischproben ergänzen] Die Einzelergebnisse sind dem Prüfbericht (Anlage 1) zu entnehmen.');
  assert.equal(kt.at(-1), '[Abschluss Chlorid ergänzen]');
  const ref = clFall(['8'], [[1, '', 'REF Flur Wand', 'Wischprobe']]), frei = clFall(['6', '2'], [[1, '', 'F-EG Küche Wand', 'Wischprobe'], [2, '', 'F-EG Flur Wand', 'Wischprobe']]);
  for (const m of [ref, frei]) {
    assert.equal(ende(m), '[Abschluss Chlorid ergänzen]', 'nur Referenz/Freimessung: kein „wird reduziert“');
    assert.ok(m.hinweise.includes('5.2: nur Referenzproben/Freimessungen – Abschluss (Variante A/B) bitte in Word ergänzen.'));
  }
  assert.match(utext(frei, 'Korrosionsschäden'), /Die Freimessungen ergaben 6 µg\/cm² \(Probe 1\) und 2 µg\/cm² \(Probe 2\)\./);
  const pak = modell({ ...B2, erg: D.erg([{ nr: 'P-1', proben: [[1, [{ p: 'Summe 16 EPA-PAK exkl. BG', r: '30', u: 'µg/Probe' }], 'PAK'], [2, [{ p: 'Summe 16 EPA-PAK exkl. BG', r: '5', u: 'µg/Probe' }], 'PAK']] }]) });
  assert.match(utext(pak, 'Organische Schadstoffe'), /\n\[Einordnung der PAK-Wischproben ergänzen\] Die Einzelergebnisse/);
  for (const g of ['[Abschluss Chlorid ergänzen]', '[Einordnung der Chlorid-Wischproben ergänzen]', '[Einordnung der PAK-Wischproben ergänzen]']) assert.ok(L.eintrag(g, 'brand'), g);
});

fall('Review: eine Probe in mehreren Prüfberichten – Werte zusammen, Wert je Fläche gewinnt (wie ResultKit uebersicht.ts)', () => {
  const m = modell({ ...mitForm(B2, { tabellen: true }), lk: D.lk({ chlorid: [[1, '', 'A', 'Wischprobe'], [2, '', 'B', 'Wischprobe']] }),
    erg: D.erg([{ nr: 'CL-1', proben: [[1, D.W.cl('7200', 'µg/Probe'), 'Chlorid'], [2, D.W.cl('1800', 'µg/Probe'), 'Chlorid']] },
      { nr: 'CL-2', proben: [[1, D.W.cl('12'), 'Chlorid'], [2, D.W.cl('3'), 'Chlorid']] }]) });
  assert.deepEqual(tabellen(m)[0].zeilen.map(z => [z[3], z[4]]), [['12', 'oberhalb'], ['3', 'unterhalb']]);
  assert.equal(tabellen(m)[0].kopf[3], 'Chlorid [µg/cm²]');
  assert.ok(!m.hinweise.some(h => /nicht einzuordnen/.test(h)));
  assert.equal(tabellen(m)[0].zeilen[0][1], '999-2026-0001101', 'Labor-Nr. aus dem Bericht des gewählten Werts');
});

fall('Review: „n. n.“/„unter BG“ ohne Einheit, keine doppelten Leerzeichen, vorläufiger Bericht „weitere“, Anhang B ohne „%“, PlanKit-Skalen', () => {
  const nn = modell({ ...B2, lk: D.lk({ pak: [[1, '', 'A', 'Wischprobe'], [2, '', 'REF Flur', 'Wischprobe'], [3, '', 'C', 'Wischprobe'], [4, '', 'D', 'Wischprobe']] }),
    erg: D.erg([{ nr: 'P-1', proben: [[1, D.W.pak('20'), 'PAK'], [2, D.W.pakNn(), 'PAK'], [3, D.W.pakNn(), 'PAK'], [4, D.W.pak('4'), 'PAK']] }]) });
  const t = utext(nn, 'Organische Schadstoffe');
  assert.match(t, /Die Referenzprobe \(Probe 2\) ergab n\. n\.\s/); assert.ok(!/n\. n\. µg/.test(t));
  assert.match(t, /festgestellt\. Bei Probe 3 war keine der untersuchten PAK-Einzelverbindungen/);
  for (const m of [nn, ...Object.values(F).map(f => modell(f))]) keineDoppelLeer(m);
  assert.match(utext(clFall(['n. n.']), 'Korrosionsschäden'), /ergab n\. n\. und liegt damit unterhalb/);
  // Prüfbericht nur mit weiteren Proben ist vorläufig → Hinweis nennt ihn
  const v = modell({ ...B2, lk: D.lk({ pak: [[1, '', 'A', 'Wischprobe']], sonstige: [[2, '', 'Schutt', 'Bauschutt', { notiz: 'Schwermetalle' }]] }),
    erg: D.erg([{ nr: 'P-1', proben: [[1, D.W.pak('20'), 'PAK']] }, { nr: 'S-1', vorlaeufig: true, proben: [[2, D.W.blei('40'), 'Sonstige']] }]) });
  assert.ok(v.hinweise.includes('Prüfbericht S-1 ist vorläufig – der Bericht bekommt die Kopfzeile „Vorläufig“.'));
  // Anhang B: bloße Zahl nur bei Einheit %
  assert.equal(BW.anhangB([{ p: 'Asbest', r: 'n. n.', u: '%', nwg: '0,001' }]), true);
  assert.equal(BW.anhangB([{ p: 'Asbest', r: 'n. n.', u: 'Masse-%', nwg: 'NWG 0,1' }]), false);
  assert.equal(BW.anhangB([{ p: 'Asbest', r: 'n. n.', u: '', nwg: '0,001' }]), null);
  assert.equal(BW.anhangB([{ p: 'Asbest', r: 'n. n.', u: '', nwg: '0,001 %' }]), true);
  // PlanKit: eigene Chlorid-/PAK-Skala oder andere Nutzung der Ergebniskarte → Hinweis
  const pl = modell(F.BR5_Gewerbe_Bohrmehl_Tabellen, { planSkalen: { usage: 'industrial', vds: ['Chlorid|mg/m²', 'Summe 16 EPA-PAK exkl. BG|µg/m²'] } });
  assert.ok(pl.hinweise.some(h => /^5\.2: In PlanKit ist für Chlorid eine eigene Skala eingestellt/.test(h)));
  assert.ok(pl.hinweise.some(h => /^5\.3: In PlanKit ist für Σ 16 EPA-PAK eine eigene Skala eingestellt/.test(h)));
  assert.ok(pl.hinweise.includes('5.3: Hintergrundreferenz 10 µg/m², in PlanKit ist für die Ergebniskarte „Gewerbe/Industrie“ (100 µg/m²) eingestellt – Bericht und Karte ordnen sonst verschieden ein.'));
  assert.ok(!modell(F.BR5_Gewerbe_Bohrmehl_Tabellen, { planSkalen: { usage: 'residential', vds: [] } }).hinweise.some(h => /PlanKit/.test(h)));
});

fall('Rolle gleich wie Projektzentrale archiv/auswertung.js (in CI liegt die Projektzentrale daneben; Rollen „quelle“/„brand“ braucht der Bericht nicht)', () => {
  const fs = require('node:fs'), path = require('node:path'), pz = path.join(__dirname, '..', '..', 'projektzentrale', 'archiv', 'auswertung.js');
  if (!fs.existsSync(pz)) { if (process.env.SPEKTRON_ORDNER_PFLICHT) assert.fail('Projektzentrale fehlt daneben'); console.log('   (Projektzentrale nicht daneben – übersprungen)'); return; }
  const P = require(pz), teile = ['', 'F-', 'f_', 'F ', 'REF', 'ref.', 'Referenz', 'unbelastet', 'Nullprobe', 'Hintergrund', 'Freimessung', 'nach Sanierung', 'nach der Sanierung',
    'Sanierungskontrolle', 'Refektorium', 'Prefab', 'EG Küche', 'Kleber', 'Brandraum', 'Ref-3', ' F-1 ', 'Ä-ref'];
  let n_ = 0;
  for (const a of teile) for (const b of teile) for (const c of ['', ' Wand', 'REF']) {
    const ref = a + b + c, desc = b + ' ' + a, pzR = P.rolleAuto(ref, desc);
    assert.equal(BW.rolleAuto(ref, desc), ['quelle', 'brand'].includes(pzR) ? '' : pzR, `${ref} | ${desc}`); n_++;
  }
  console.log(`   (Projektzentrale daneben: rolleAuto gleich, ${n_} Kombinationen)`);
});

console.log(`Brandbericht: ${n} Fälle bestanden.`);

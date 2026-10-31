// Brandbericht, Schritt 3 – Gerüst (node tests/brand.cjs): Regeln aus dem Doc „Textbausteine Brand-Sanierungsvorschlag“ und den
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
  // Chlorid-Proben ohne Prüfbericht: Lücke + Hinweis; andere Matrix und Sonstige: Hinweis (noch nicht im Text)
  const ohneB = modell({ ...F.BR1_voll_Versicherung, erg: D.erg([]), lk: D.lk({ chlorid: [[1, '2026-10-14', 'EG', 'Wischprobe'], [2, '2026-10-14', 'EG', 'Bohrmehl']], sonstige: [[3, '2026-10-14', 'EG', 'Material']] }) });
  assert.match(text(ohneB, 4), /Prüfbericht Nr\. \[Prüfbericht-Nr\.\] zu entnehmen\./);
  for (const re of [/Chlorid: noch kein Prüfbericht/, /1 Chlorid-Probe ohne Matrix „Wischprobe“/, /1 sonstige Probe \(LabelKit\)/]) assert.ok(ohneB.hinweise.some(h => re.test(h)), String(re));
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
  assert.equal(an.anlagenListe.find(a => a.art === 'brandgeruch').nr, 4);
  assert.ok(an.hinweise.some(x => x === 'Brandgeruch-Anlage trägt „Anlage 7“, im Bericht ist sie Anlage 4 – in der Projektzentrale mit „Anlage 4“ neu erstellen.'));
  assert.match(text(an, 4), /Das Ergebnis ist in Anlage 4 dargestellt\./);
});

fall('5., 6., 8.: Überschrift mit Lücke; „Untersuchungsbericht“: 6. Schlussfolgerungen, ohne 8.', () => {
  const m = modell(F.BR1_voll_Versicherung);
  assert.equal(text(m, 5), '[Befund ergänzen]'); assert.equal(text(m, 6), '[Sanierungsmaßnahmen ergänzen]'); assert.equal(text(m, 8), '[Zusammenfassung der Sanierungsmaßnahmen ergänzen]');
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
  assert.equal(L.zuordnen(['[Befund ergänzen]'], 'brand')[0].wo, 'in Word ergänzen (Formular dafür folgt)');
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

console.log(`Brandbericht: ${n} Fälle bestanden.`);

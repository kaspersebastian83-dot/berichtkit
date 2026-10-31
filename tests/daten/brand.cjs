// Erfundene Brand-Testdaten (keine Kundendaten im Repository). Aufbau wie _Projekt.json (Projektzentrale), LabelKit *_Daten.json,
// ResultKit _Ergebnisse.json – mit Chlorid-, PAK-, Asbest-, KMF- und Brandgeruch-Proben, Referenzprobe und Freimessung; ab 1.14.0
// mit Freitext (5.1, 6., 7., 8.) und Fotos aus FotoKit (_Bildumbenenner.json „bilder“, Asbestfotos je Probe wie im Asbestbericht).
// Genutzt von tests/brand.cjs, tests/brand-golden.cjs, tests/luecken-kommentare.cjs und render-beispiele.cjs.
const A = require('../../anlagen.js'), B = require('./beispiel.cjs');
const ORDNER = '99.9002 Brandweg Beispielstadt Tst';
const SHA_LK = 'a'.repeat(64), SHA_ALT = 'b'.repeat(64);
const t0 = Date.parse('2026-10-21T10:00:00Z');

/** Projektdaten mit den Brandfeldern der Projektzentrale (schadendatum, ortstermin, nutzung, schadenereignis, brandgut) */
const pj = (o = {}) => B.pj({ projektnummer: '99.9002', objekt: 'Erdgeschoss links, Brandweg 7, 54321 Beispielstadt', schadenort: 'Beispielstadt',
  schadendatum: '2026-10-12', ortstermin: '2026-10-14', nutzung: 'Wohnen', schadenereignis: 'Brand im Erdgeschoss (Küche)', brandgut: 'Küche/Lebensmittel',
  schadennummer: 'BV-2026-0815', ...o });

/** LabelKit-Datei. Proben je Liste als [nr, datum, z2 (Raum/Ort), matrix, extra]; Brandgeruch [id, z1, z2, p1 … p5] */
function lk({ pak = [], chlorid = [], asbest = [], sonstige = [], brandgeruch = [], bgDatum = '', bgBlind, projektNr = '99.9002', ui = {} } = {}) {
  const probe = ([nr, datum, z2, matrix, extra]) => ({ id: nr, _nr: nr, datum, z1: projektNr, z2, z3: 'verrußt', z4: 'Putz', matrix, cm2: matrix === 'Wischprobe' ? '600' : '', notiz: '', ...extra });
  return { version: '4.51.0', projekt: { nr: projektNr }, ui,
    proben: pak.map(probe), chloridProben: chlorid.map(x => ({ ...probe(x), chloridNr: x[0] })), sonstigeProben: sonstige.map(probe),
    asbestProben: asbest.map(([nr, datum, z2, z3, matrix, extra]) => ({ id: nr, _nr: nr, datum, z1: projektNr, z2, z3, z4: 'fest gebunden', zustand: 'intakt', matrix, cm2: '', notiz: '', ...extra })),
    brandgeruchProben: brandgeruch.map(([id, z1, z2, ...p]) => ({ id, z1, z2, p1: p[0] || '', p2: p[1] || '', p3: p[2] || '', p4: p[3] || '', p5: p[4] || '' })),
    brandgeruchDatum: bgDatum, ...(bgBlind === undefined ? {} : { bgBlind }), pn98Proben: [], feldprotokolle: [] };
}

/** Laborwerte je Art (Wortlaut wie Eurofins/ResultKit) */
const W = {
  cl: (r, u = 'µg/cm²') => [{ p: 'Chlorid', r, u }],
  clMat: (r, u) => [{ p: 'Chlorid', r, u }],
  blei: r => [{ p: 'Blei', r, u: 'mg/kg' }],
  pakNn: () => [{ p: 'Naphthalin', r: '< 0,5', u: 'µg/m²' }, { p: 'Benzo[a]pyren', r: '< 0,5', u: 'µg/m²' }, { p: 'Summe 16 EPA-PAK exkl. BG', r: 'n. n.', u: 'µg/m²' }],
  pak: r => [{ p: 'Naphthalin', r: '< 0,5', u: 'µg/m²' }, { p: 'Benzo[a]pyren', r: '1,2', u: 'µg/m²' }, { p: 'Summe 16 EPA-PAK exkl. BG', r, u: 'µg/m²' }],
  pakMat: r => [{ p: 'Summe 16 EPA-PAK exkl. BG', r, u: 'mg/kg' }],
  ...B.werte,
};
/** ResultKit: berichte = [{ nr, vorlaeufig, proben: [[nr, werte, typ]] }] */
const erg = berichte => ({ format: 'spektron-ergebnisse', version: 1, projekt: '99.9002',
  berichte: berichte.map((b, i) => ({ id: 'b' + (i + 1), bericht: b.nr, labor: 'Eurofins', auftragsreferenz: '99.9002 Beispielstadt', datum: '2026-10-20',
    sources: b.ohnePdf ? { xml: b.nr + '.xml' } : { xml: b.nr + '.xml', pdf: b.nr + '.pdf' }, ...(b.vorlaeufig ? { vorlaeufig: true } : {}),
    proben: b.proben.map(([nr, werte, typ]) => ({ label: 'P' + nr, ref: 'Probe ' + nr, labNr: '999-2026-0001' + String(100 + nr), typ, reportId: 'b' + (i + 1), werte })) })),
  ersetzt: [], offen: [], hinweise: [] });

/** Anlagen im Projektordner: Bilddokumentation (FotoKit, „Anlage n“), Probenplan (PlanKit), Brandgeruch (Projektzentrale) */
function anlagen({ bilddokuAnlage = 'Anlage 3', brandgeruch = '99-9002_Anlage_Brandgeruch_2026-10-21.docx', protokollSha = SHA_LK, plan = true, bilddoku = true } = {}) {
  const doku = 'Bilddokumentation_99.9002_Beispielstadt_2026-10-21.pdf';
  return A.erkennen({ ordnerName: ORDNER,
    fotos: bilddoku ? [{ name: doku, t: t0 }] : [],
    plaene: plan ? [{ name: `Probenplan ${ORDNER}.pdf`, t: t0 }] : [],
    mitteilungen: brandgeruch ? [{ name: brandgeruch, t: t0 }] : [],
    protokoll: brandgeruch ? `2026-10-21T10:00:00.000Z | ${brandgeruch} | ${'c'.repeat(64)} | LabelKit/99.9002_Daten.json | ${protokollSha} | Projektzentrale 1.39.0\n` : null,
    fk: bilddoku ? { bilder: {}, projekt: { anlage: bilddokuAnlage }, bilddoku: { dateien: [doku], erstellt: new Date(t0).toISOString(), anlage: bilddokuAnlage }, dokuGeaendert: new Date(t0 - 60000).toISOString() } : null,
    plan: plan ? { name: `Probenplan ${ORDNER}.probenplan`, t: t0 - 60000, sha: 'd'.repeat(64) } : null,
    labelkit: { name: '99.9002_Daten.json', t: t0 - 60000, sha: SHA_LK } });
}

/** FotoKit _Bildumbenenner.json „bilder“ (Dateiname → Beschreibung, Probe, aussortiert) und daraus die Fotos je Probe (wie app.js fotoListeBauen) */
const FOTOKIT = {
  'P9_Fliesenkleber_Kueche.jpg': { probe: 'P9', beschreibung: 'Fliesenkleber Küche' },
  'IMG_0101.jpg': { beschreibung: 'EG, Küche (Brandraum)' },
  'IMG_0102.jpg': { beschreibung: 'EG, Flur' },
  'IMG_0103.jpg': { beschreibung: 'EG, Wohnzimmer', aussortiert: true },
  'IMG_0201.jpg': { beschreibung: '' },
};
const fotosJeProbe = bilder => { const out = {}; for (const [datei, v] of Object.entries(bilder)) if (v.probe && !v.aussortiert) (out[v.probe] = out[v.probe] || []).push({ datei, beschreibung: v.beschreibung || '' }); return out; };

const form = (brand = {}, o = {}) => ({ art: 'brand', datum: '2026-10-27', mitteilung: 1, probenehmer: 'Mes', sv: 'Tst', mt: 'Mes', brand, ...o });

/* Beispiel-Brandberichte (Golden-Test, Word-Beispiele) */
const faelle = {
  // Alles dabei: Chlorid und PAK im selben Prüfbericht, PAK-Materialprobe, Referenzprobe (Wohnzimmer REF) und Freimessung (F-1),
  // Asbest (eine positiv) und KMF mit WHO-Fasern im zweiten Bericht, Brandgeruch mit Anlage, GB 2, zweite Person vor Ort
  'BR1_voll_Versicherung': {
    pj: pj(),
    lk: lk({ chlorid: [[1, '2026-10-14', 'EG Küche Brandraum Decke', 'Wischprobe'], [2, '2026-10-14', 'EG Flur Wand', 'Wischprobe'], [3, '2026-10-14', 'OG Wohnzimmer REF Wand', 'Wischprobe']],
      pak: [[4, '2026-10-14', 'EG Küche Brandraum Decke', 'Wischprobe'], [5, '2026-10-14', 'EG Flur Wand', 'Wischprobe'], [6, '2026-10-14', 'OG Wohnzimmer REF Wand', 'Wischprobe'],
        [7, '2026-10-14', 'F-EG Küche Wand', 'Wischprobe'], [8, '2026-10-14', 'EG Küche Dämmung', 'Material']],
      asbest: [[9, '2026-10-14', 'EG Küche Boden', 'Fliesenkleber', 'Bituminöse Proben / Kleber'], [10, '2026-10-14', 'EG Küche Wand', 'Putz', 'Putze / Spachtelmassen'],
        [11, '2026-10-14', 'EG Küche Decke', 'Dämmstoff Mineralwolle', 'Sonstige']],
      brandgeruch: [[1, 'Sofa Wohnzimmer', 'Stoffbezug', '+', '+', '++', '+', '+'], [2, 'Teppich Flur', 'Wolle', '(+)', '-', '(+)', '-', '(+)']], bgDatum: '20.10.2026', bgBlind: false }),
    erg: erg([{ nr: 'AR-999-2026-000101-01', proben: [[1, W.cl('12,3'), 'Chlorid'], [2, W.cl('4,1'), 'Chlorid'], [3, W.cl('< 0,5'), 'Chlorid'],
        [4, W.pak('2300'), 'PAK'], [5, W.pak('85'), 'PAK'], [6, W.pak('9'), 'PAK'], [7, W.pak('7'), 'PAK'], [8, W.pakMat('14'), 'PAK']] },
      { nr: 'AR-999-2026-000102-01', proben: [[9, W.chrysotil, 'Asbest'], [10, W.kein, 'Asbest'], [11, W.kmf, 'Asbest']] }]),
    anlagen: anlagen(), fotoKit: FOTOKIT, fotos: fotosJeProbe(FOTOKIT),
    // Freitext mit allem: Absätze, **fett**, ## Zwischentitel, Aufzählung, Lücke im Text, Foto mit Beschreibung aus FotoKit und mit eigener
    // Bildunterschrift; 6.2 leer (Lücke); 7. zwei Bereiche (EG GB 2, OG GB 0) und Zusatz; 8. „Bereich: Maßnahme“ mit Zwischentiteln
    form: form({ umfang: { gebaeude: true, technik: true, waren: false }, anwesende: 'Herr Muster (VN) und Herr Beispiel (Sanierungsfirma Muster GmbH)', person2: 'Vom', gb: '2', uebrige: true, tabellen: true,
      schadenbild: 'Der Brand ereignete sich in der Küche im Erdgeschoss. Brandlast waren im Wesentlichen die Einbauküche und **Kunststoffe** der Elektrogeräte.\n\n## Küche (Brandraum)\nDecke und Wände sind stark verrußt.\n[Abb: IMG_0101.jpg]\n## Flur\n- Wände leicht verrußt\n- Bodenbelag: [Zustand des Bodenbelags prüfen]',
      sanGebaeude: '## Küche (Brandraum)\n- Rückbau der Deckenverkleidung und der Einbauküche\n- Feinreinigung aller Oberflächen, anschließend Freimessung\n[Abb: IMG_0102.jpg | EG, Flur nach der Grobreinigung]\n## Flur\nFeinreinigung der Wand- und Bodenflächen.',
      bereich: 'im Erdgeschoss', bereich2: 'im Obergeschoss', gb2: '0', zusatz: 'Bei Arbeiten an der Mineralwolldämmung sind zusätzlich die Hinweise der **TRGS 521** zu beachten.',
      zusammenfassung: '## Gebäude\nKüche (Brandraum): Rückbau der Deckenverkleidung, Feinreinigung, Freimessung\nFlur: Feinreinigung\n## Technische Einrichtung\nElektroinstallation Küche: Prüfung durch einen Elektrofachbetrieb' }),
  },
  // Nur PAK (wie 26.0513), ohne Versicherung (Hausverwaltung), Schadendatum „unbekannt“, Untersuchungsbericht, nur unser Büro vor Ort, GB 0
  'BR2_nur_PAK_ohne_Versicherung_GB0': {
    pj: pj({ schadendatum: 'unbekannt', versicherungsnehmer: '', auftraggeber: 'Muster Hausverwaltung GmbH, Hauptstr. 5, 12345 Musterstadt', schadennummer: '', nutzung: 'Büro' }),
    lk: lk({ pak: [[1, '2026-10-14', 'EG Büro Decke', 'Wischprobe'], [2, '2026-10-14', 'EG Büro Wand', 'Wischprobe']] }),
    erg: erg([{ nr: 'AR-999-2026-000201-01', proben: [[1, W.pak('16'), 'PAK'], [2, W.pak('8'), 'PAK']] }]),
    anlagen: anlagen({ brandgeruch: '', bilddokuAnlage: 'Anlage 2' }),
    form: form({ titel: 'Untersuchungsbericht', nurBuero: true, gb: '0',
      schlussfolgerungen: 'Die PAK-Belastung liegt im Bereich der Hintergrundbelastung.\n- Eine Sanierung ist aus chemischer Sicht nicht erforderlich.' }, { mt: '' }),
  },
  // Lücken: kein Schadendatum, kein Ortstermin, Proben ohne Datum, kein Umfang, kein Gefahrenbereich, kein Labor, keine Anwesenden;
  // Chlorid und PAK in getrennten Berichten, PAK über zwei Prüfberichte; Brandgeruch ohne Prüfdatum, verdeckt, ohne Anlage
  'BR3_Luecken': {
    pj: pj({ schadendatum: '', ortstermin: '', auftragsdatum: '', objekt: '', nutzung: '', schadennummer: '' }),
    lk: lk({ chlorid: [[1, '', 'EG Küche Decke', 'Wischprobe']], pak: [[2, '', 'EG Küche Decke', 'Wischprobe'], [3, '', 'EG Flur Wand', 'Wischprobe'], [4, '', 'OG Bad Wand', 'Wischprobe']],
      brandgeruch: [[1, 'Jacke', 'Garderobe', '', '', '', '', '']], bgDatum: '' }),
    erg: erg([{ nr: 'AR-999-2026-000301-01', proben: [[1, W.cl('6,2'), 'Chlorid']] },
      { nr: 'AR-999-2026-000302-01', proben: [[2, W.pak('140'), 'PAK'], [3, W.pak('35'), 'PAK']] },
      { nr: 'AR-999-2026-000303-01', ohnePdf: true, proben: [[4, W.pak('12'), 'PAK']] }]),
    anlagen: anlagen({ brandgeruch: '', plan: false }),
    // 7.: zweiter Gefahrenbereich ohne beide Bereichsangaben → Lücken; 5.1 nur mit der Vorbelegung → Lücke
    form: form({ umfang: { gebaeude: false, technik: false, waren: false }, gb2: '1' }, { labor: '', mt: '' }),
    cfg: { ...B.cfg, labor: '' },
  },
  // Gewerbe (Lager) mit Warenvorräten und technischer Einrichtung, eigener Brandort im Satz, Teilnehmerliste, vorläufiger Prüfbericht;
  // Brandgeruch-Anlage mit falscher Nummer im Titel und LabelKit danach geändert (veraltet → nicht vorgehakt) → ENTWURF
  'BR4_Gewerbe_Teilnehmerliste_ENTWURF': {
    pj: pj({ nutzung: 'Gewerbe/Industrie', objekt: 'Industriestraße 3, 54321 Beispielstadt', versicherer: 'Andere Versicherung AG' }),
    lk: lk({ chlorid: [[1, '2026-10-15', 'Halle Regal 3', 'Wischprobe']], pak: [[2, '2026-10-15', 'Halle Regal 3', 'Wischprobe']],
      sonstige: [[3, '2026-10-15', 'Halle Brandschutt', 'Bauschutt', { notiz: 'Schwermetalle' }]],
      brandgeruch: [[1, 'Karton', 'Regal 3', '+', '+', '+', '+', '++']], bgDatum: '2026-10-20', bgBlind: false }),
    erg: erg([{ nr: 'AR-999-2026-000401-01', vorlaeufig: true, proben: [[1, W.cl('22'), 'Chlorid'], [2, W.pak('410'), 'PAK']] },
      { nr: 'AR-999-2026-000402-01', proben: [[3, W.blei('120'), 'Sonstige']] }]),
    anlagen: anlagen({ brandgeruch: '99-9002_Anlage-7_Brandgeruch_2026-10-21.docx', protokollSha: SHA_ALT, bilddokuAnlage: 'Anlage 3' }),
    // Freitext: 6.1 Gebäude leer (Lücke), 6.2/6.3 gefüllt, Foto ohne Beschreibung in FotoKit (Bildunterschrift als Lücke), 8. ohne Zwischentitel
    fotoKit: FOTOKIT,
    form: form({ titel: 'Sanierungsvorschlag', umfang: { gebaeude: true, technik: true, waren: true }, brandort: 'in einer Lagerhalle der Muster Logistik GmbH,', teilnehmerliste: true, gb: '1',
      schadenbild: 'Der Brand ereignete sich im Regal 3 der Lagerhalle.', sanTechnik: 'Reinigung der Regalanlage.',
      sanWaren: '## Regal 3\n- Entsorgung der verrußten Kartonagen\n[Abb: IMG_0201.jpg]', zusammenfassung: 'Halle: Feinreinigung\nWarenvorräte Regal 3: Entsorgung' }, { mt: '' }),
  },
  // Gewerbe (Lebensmittelmarkt) mit Referenz 10 µg/m² und Begründung (Befunde Nr. 5), Ergebnistabellen; Chlorid aus einem älteren
  // Prüfbericht in mg/m² (Einordnung umgerechnet, Wert wie im Bericht), Chlorid-Materialprobe und Chlorid-Bohrmehl (LabelKit „Sonstige“
  // mit Haken „Chlorid-Bohrmehl“), PAK „n. n.“, Referenzprobe; Untersuchungsbericht ohne Asbest/Brandgeruch
  'BR5_Gewerbe_Bohrmehl_Tabellen': {
    pj: pj({ nutzung: 'Gewerbe/Industrie', objekt: 'Marktplatz 1, 54321 Beispielstadt', schadendatum: '2026-10-09' }),
    lk: lk({ chlorid: [[1, '2026-10-14', 'Verkaufsraum Regal 1', 'Wischprobe'], [2, '2026-10-14', 'Verkaufsraum Regal 2', 'Wischprobe'], [3, '2026-10-14', 'Verkaufsraum Regal 3', 'Wischprobe'],
        [4, '2026-10-14', 'Lager Wand', 'Wischprobe'], [5, '2026-10-14', 'Büro Wand', 'Wischprobe'], [6, '2026-10-14', 'Verkaufsraum Kassenband', 'Material']],
      pak: [[7, '2026-10-14', 'Verkaufsraum Regal 1', 'Wischprobe'], [8, '2026-10-14', 'Verkaufsraum Regal 2', 'Wischprobe'], [9, '2026-10-14', 'Verkaufsraum Regal 3', 'Wischprobe'],
        [10, '2026-10-14', 'Lager Wand', 'Wischprobe'], [11, '2026-10-14', 'Büro REF Wand', 'Wischprobe']],
      sonstige: [[12, '2026-10-14', 'Verkaufsraum Stütze', 'Material (mineralisch)', { notiz: 'Chlorid Bohrmehl', tiefe: '0 – 2 mm' }],
        [13, '2026-10-14', 'Verkaufsraum Stütze', 'Material (mineralisch)', { notiz: 'Chlorid Bohrmehl', tiefe: '2 – 5 mm' }]], ui: { bohrmehlAktiv: true } }),
    erg: erg([{ nr: 'AR-999-2026-000501-01', proben: [[1, W.cl('150', 'mg/m²'), 'Chlorid'], [2, W.cl('70', 'mg/m²'), 'Chlorid'], [3, W.cl('60', 'mg/m²'), 'Chlorid'],
        [4, W.cl('20', 'mg/m²'), 'Chlorid'], [5, W.cl('< 5', 'mg/m²'), 'Chlorid'], [6, W.clMat('0,02', 'M.-%'), 'Chlorid']] },
      { nr: 'AR-999-2026-000502-01', proben: [[7, W.pak('25'), 'PAK'], [8, W.pakNn(), 'PAK'], [9, W.pak('4'), 'PAK'], [10, W.pak('31'), 'PAK'], [11, W.pak('3'), 'PAK'],
        [12, W.clMat('1.200', 'mg/kg'), 'Sonstige'], [13, W.clMat('450', 'mg/kg'), 'Sonstige']] }]),
    anlagen: anlagen({ brandgeruch: '', bilddokuAnlage: 'Anlage 3' }),
    form: form({ titel: 'Untersuchungsbericht', nurBuero: true, gb: '1', tabellen: true, referenz: '10',
      referenzGrund: 'Aufgrund der Nutzung als Lebensmittelverkaufsstätte wird die für Wohn- und Bürobereiche übliche Hintergrundbelastung herangezogen.' }, { mt: '' }),
  },
};

module.exports = { ORDNER, SHA_LK, pj, lk, erg, W, anlagen, form, faelle, FOTOKIT, fotosJeProbe };

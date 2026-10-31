/* BerichtKit – Berichtsart „asbest“: Asbest-Untersuchungsbericht („n. Mitteilung“), ohne Browserteile, in Node testbar.
   Grundlage: Doc „Textbausteine Asbest-Untersuchungsbericht“ (Stand 30.10.2026). Bausteine, die jede Berichtsart braucht
   (Deckblatt, Kopf, Personen, Unterschriften, Anlagen, Proben/Befund …), stehen in bericht-gemeinsam.js.
   Regeln wie dort: nichts umrechnen oder umformulieren, fehlende Angaben als [Lücke], nichts erfinden. */
(function (root) {
'use strict';
const ANL = root.BerichtAnlagen || (typeof require === 'function' ? require('./anlagen.js') : null);
const G = root.BerichtGemeinsam || (typeof require === 'function' ? require('./bericht-gemeinsam.js') : null);
const { s, L, datumDE, liste, zahlwort, zeilen, ABGLEICH_SPERRT, IST_KMF, RAUM_KUERZEL, raumAusschreiben, probenSammeln, person,
  pnQuelle, projektSicht, objektImSatz, labelkitProjektPruefen, deckblattFelder, kopfZeilen, auftraggeberImSatz, unterschriftenBlock,
  pruefberichtPdf, anlagenUebernehmen, anlagenAusgabe, kennzeilenVorlaeufig, annahmenAus, luecken } = G;

/** Tabelle 1 (Proben und Ergebnisse): Spaltenbreiten in twips, zusammen 9070 = Textbreite. Labor-Nr. breit genug für
    „777-2026-00445679“ in einer Zeile. */
const SPALTEN_TAB1 = [950, 2080, 2240, 1850, 1950];

/* ---------- Berichtsmodell ----------
   eingabe = { pj, ordner:{name,nr,kuerzel}, lk, erg, cfg, mitarbeiter, fotos:{label:[{datei,...}]}, anlagen: BerichtAnlagen.erkennen(…),
               feldbogen:{ text, kuerzel } (Probenehmer laut LabelKit-Feldbogen, kuerzel nur bei genauem Treffer),
               form:{ datum, mitteilung, variante:'eigen'|'zugestellt', eingangsdatum, auftragsdatum, agSatz, versicherer,
                      deckblatt:'versicherung'|'direkt'|'' (leer = automatisch), versOk (bestätigter Versicherer), probenahmedatum, probenehmer, pnQuelle:'hand'|undefined,
                      sv (1. Unterschrift), svVorschlag (Vorgabe: svVorschlag()), svOk (bestätigtes Kürzel), mt (2. Unterschrift), rolle1, rolle2:'sv'|'mt'|'' (leer = laut Einstellungen), labor, aus:{label:false}, kmf:{label:true},
                      who:{label:true}, ki:{label:'25'}, foto:{label:'datei'|''}, einbau:'vor1996'|'unbekannt',
                      anlagen:{art:{an,key}}, anlagenExtra:[{pfad,bezeichnung,fehlt}] } }
   Ergebnis: { dateiname, deckblatt, kopf, kennzeilen[], abschnitte, unterschriften, anlagen, anlagenTeile, anlagenDateien[], anlagenListe[], anlagenZeilen[], luecken[], hinweise[],
               sperren[], probenehmerQuelle, versichererQuelle, svQuelle, annahmen[{id,text,wert}], hinweisAktionen, offen[], storniert[{label,nr,ref,labNr,bericht}] }
   In LabelKit stornierte Asbestproben (storniert) zählen nirgends: nicht in Tabelle 1, Text, Abgleich, offen oder sperren.
   sperren: Die Daten passen nicht zusammen – dann nicht in „Mitteilungen“ speichern, nur als Entwurf herunterladen (alsEntwurf).
   Lücken sperren nicht: Die füllt der SV in Word aus; ob welche übrig sind, prüft die Übergabe ans Büro. */
function bericht(eingabe) {
  const e = eingabe || {}, f = e.form || {}, P = projektSicht(e.pj, e.ordner);
  const hinweise = [], sperren = [], hinweisAktionen = {};   // hinweisAktionen: { <Hinweistext>: { app, link, ziel, was } | { einstellungen: true } }
  const { proben: alle, offen: offenAlle, storniert, nurStorniert } = probenSammeln(e.erg, e.lk);
  const proben = alle.filter(p => !(f.aus && f.aus[p.label] === false));
  const offen = offenAlle.map(o => ({ ...o, aus: !!(f.aus && f.aus[o.label] === false) }));
  // In LabelKit storniert, aber noch ein Laborwert im Prüfbericht: nicht im Bericht, nicht im Abgleich, sperrt nicht – nur ein Hinweis
  storniert.forEach(x => hinweise.push(`${x.label} ist in LabelKit storniert – der Laborwert${x.bericht ? ` (Prüfbericht ${x.bericht})` : ''} kommt nicht in den Bericht.`));
  // Alle LabelKit-Asbestproben storniert und kein Ergebnis übrig: ein Bericht ohne Proben (0 Materialproben, leere Tabelle 1)
  // wäre falsch – Datenfehler, nur Entwurf. (Mit ResultKit ab 1.13 kommen Werte stornierter Proben gar nicht erst an.)
  const alleStorniert = !alle.length && nurStorniert.length > 0;
  if (alleStorniert) sperren.push(`Alle Asbestproben in LabelKit sind storniert (${liste(nurStorniert)}) – ohne Probe gibt es keinen Bericht. Gilt eine Probe doch, heb das Storno in LabelKit auf und übernimm die Ergebnisse in ResultKit erneut.`);
  // LabelKit-Datei eines anderen Projekts: nichts daraus darf in den Bericht
  labelkitProjektPruefen(e, P, sperren);
  offen.filter(o => !o.aus).forEach(o => sperren.push(`${o.label}: in LabelKit als Asbestprobe erfasst, aber noch kein Ergebnis in ResultKit – Ergebnis übernehmen oder die Probe unter „Proben“ abwählen.`));
  proben.forEach(p => {
    p.istKmf = f.kmf && p.label in f.kmf ? !!f.kmf[p.label] : (IST_KMF.test(p.material + ' ' + p.matrix) || !!p.kmf.ki || !!p.kmf.who);
    p.ki = p.kmf.ki || s(f.ki && f.ki[p.label]);
    p.kiQuelle = p.kmf.ki ? 'labor' : (p.ki ? 'hand' : '');
    p.whoNachgewiesen = f.who && p.label in f.who ? !!f.who[p.label] : !!p.kmf.whoPositiv;
    p.foto = f.foto && p.label in f.foto ? f.foto[p.label] : ((e.fotos && e.fotos[p.label] && e.fotos[p.label][0] && e.fotos[p.label][0].datei) || '');
    if (p.vorlaeufig) hinweise.push(`Prüfbericht ${p.bericht} ist vorläufig – der Bericht bekommt die Kopfzeile „Vorläufig“.`);
    if (p.abgleich.ok === false) (ABGLEICH_SPERRT ? sperren : hinweise).push(`${p.ref || p.label}: Entnahmestelle passt nicht – LabelKit „${p.abgleich.labelkit}“, Prüfbericht ${p.bericht} „${p.abgleich.bericht}“ → in LabelKit oder beim Labor klären.`);
    if (p.befund && !p.befund.eindeutig) hinweise.push(`${p.ref || p.label}: Ergebnis „${p.befund.text}“ nicht eindeutig – bitte im Prüfbericht prüfen.`);
    if (!p.material) hinweise.push(`${p.ref || p.label}: Material fehlt (LabelKit „Bauteil / Material“).`);
    else if (p.materialAusMatrix) hinweise.push(`${p.ref || p.label}: Material „${p.material}“ aus der LabelKit-Matrix übernommen – „Bauteil / Material“ ist leer; genauer wäre z. B. „Fliesenkleber“.`);
    if (p.istKmf && !p.ki) hinweise.push(`${p.ref || p.label}: KI-Wert fehlt in den Labordaten – bitte aus dem Prüfbericht eintragen.`);
  });
  // Raum-Kürzel nur für den Berichtstext ausschreiben (p.stelle bleibt der LabelKit-Text)
  const kuerzel = new Set();
  proben.forEach(p => { const r = raumAusschreiben(p.stelle); p.stelleBericht = r.text; r.ersetzt.forEach(k => kuerzel.add(k)); });
  if (kuerzel.size) hinweise.push(`Entnahmestelle: Abkürzungen ausgeschrieben (${[...kuerzel].map(k => `${k} → ${RAUM_KUERZEL[k]}`).join(', ')}) – im Prüfbericht stehen die Kürzel; bitte prüfen.`);
  const ohneAbgleich = proben.filter(p => p.abgleich.ok === null);
  if (ohneAbgleich.length) hinweise.push(`Entnahmestelle nicht mit dem Prüfbericht abgeglichen (${ohneAbgleich.map(p => p.label).join(', ')}): `
    + (ohneAbgleich.some(p => !p.abgleich.auftrag) ? 'ResultKit hat den LabelKit-Auftrag nicht gespeichert – in ResultKit die Ergebnisse erneut übernehmen.' : 'Beschreibung fehlt (z. B. nur PDF) – bitte selbst vergleichen.'));
  if (!proben.length && !alleStorniert) hinweise.push('Keine Asbestergebnisse gefunden – zuerst in ResultKit die Laborergebnisse übernehmen.');

  const n = proben.length, eine = n === 1;
  const kmfProben = proben.filter(p => p.istKmf);
  const pos = proben.filter(p => p.befund && p.befund.gefunden);
  const neg = proben.filter(p => p.befund && !p.befund.gefunden && p.befund.eindeutig);
  const unklar = proben.filter(p => !p.befund || !p.befund.eindeutig);
  const labor = s(f.labor) || s(e.cfg && e.cfg.labor);
  const berichtNr = [...new Set(proben.map(p => p.bericht).filter(Boolean))];
  const datum = datumDE(f.datum);
  const mitteilung = `${+f.mitteilung || 1}. Mitteilung`;

  const zugestellt = f.variante === 'zugestellt';
  // Personen
  const pn = person(e.cfg, e.mitarbeiter, f.probenehmer), sv = person(e.cfg, e.mitarbeiter, f.sv);
  const probenehmerQuelle = pnQuelle(f, e.feldbogen, zugestellt, pn, P.zustaendig);
  const mt = zugestellt ? null : person(e.cfg, e.mitarbeiter, f.mt);

  // Betreff
  const mitKmf = kmfProben.length > 0;
  let betreff = mitKmf ? 'Untersuchung auf Asbest und künstliche Mineralfasern (KMF)' : 'Untersuchung auf Asbest';
  const betreffRuns = [betreff];
  if (zugestellt) betreffRuns.push(` – zugestellte ${eine ? 'Probe' : 'Proben'} vom `, L(datumDE(f.eingangsdatum), 'Eingangsdatum'));

  // Deckblatt-Feldblock und Kopf der Folgeseiten
  const { vfall, felder, versichererQuelle } = deckblattFelder(P, f, hinweise);
  const titel = `Untersuchungsbericht vom ${datum}`;
  const kopf = kopfZeilen(titel, betreffRuns, P, vfall);

  /* 1. Veranlassung */
  const objekt = L(objektImSatz(P.objekt), 'Objekt');
  const agSatz = auftraggeberImSatz(f, P, hinweise);
  const v = [];
  if (!zugestellt) {
    v.push({ t: 'p', runs: ['Am ', L(datumDE(f.auftragsdatum || P.auftragsdatum), 'Auftragsdatum'), ' wurde unser Büro durch ', agSatz,
      ' beauftragt, im Objekt ', objekt, ' eine Ortsbesichtigung durchzuführen, Materialproben zu entnehmen und diese auf Asbest ',
      mitKmf ? 'sowie künstliche Mineralfasern (KMF) ' : '', 'untersuchen zu lassen.'] });
  } else {
    v.push({ t: 'p', runs: ['Am ', L(datumDE(f.eingangsdatum), 'Eingangsdatum'), ' wurde unserem Büro durch ', agSatz, ' ',
      eine ? 'eine Materialprobe' : `${zahlwort(n)} Materialproben`, ' aus dem Objekt ', objekt,
      ' zugestellt, verbunden mit dem Auftrag, diese auf Asbest ', mitKmf ? 'sowie künstliche Mineralfasern (KMF) ' : '', 'untersuchen zu lassen.'] });
    v.push({ t: 'p', runs: ['Die Probenahme erfolgte nicht durch unser Büro. Angaben zu Material und Entnahmestelle wurden vom Auftraggeber übernommen. ',
      `Die Ergebnisse gelten ausschließlich für die zugestellte${eine ? ' Probe' : 'n Proben'}.`] });
  }

  /* 2. Probenahme und Untersuchung */
  const mitFoto = proben.filter(p => p.foto);
  const abb = new Map(); mitFoto.forEach((p, i) => abb.set(p.label, i + 1));
  const abbVerweis = !mitFoto.length ? '' : mitFoto.length === 1 ? 'Abbildung 1' : `den Abbildungen 1 bis ${mitFoto.length}`;
  const pr = [];
  if (!zugestellt) {
    const daten = s(f.probenahmedatum) ? [datumDE(f.probenahmedatum)] : [...new Set(proben.map(p => datumDE(p.datum)).filter(Boolean))];
    pr.push({ t: 'p', runs: ['Am ', daten.length ? liste(daten) : { gap: '[Probenahmedatum]' }, eine ? ' wurde durch ' : ' wurden durch ',
      pn ? pn.satz : { gap: '[Probenehmer]' }, ' (Sachverständigenbüro Dr. Heinz Schiffers & Partner) im Objekt ',
      eine ? 'eine Materialprobe' : `${zahlwort(n)} Materialproben`, ' entnommen. ',
      eine ? 'Die Entnahmestelle ist in Tabelle 1 aufgeführt' : 'Die Entnahmestellen sind in Tabelle 1 aufgeführt',
      abbVerweis ? ` und in ${abbVerweis} dokumentiert.` : '.'] });
  } else if (abbVerweis) {
    pr.push({ t: 'p', runs: [eine ? `Die zugestellte Probe ist in ${abbVerweis} dargestellt.` : `Die zugestellten Proben sind in ${abbVerweis} dargestellt.`] });
  }
  /* Anlagen (anlagen.js): Prüfbericht(e) zuerst, dann Bilddokumentation und Probenplan, dann was angehakt ist */
  const pdfVon = nr => pruefberichtPdf(e.erg, nr);
  const A = ANL.zusammenstellen({ profil: 'asbest', pruefberichte: berichtNr.map(nr => ({ nr, pdf: pdfVon(nr) })), labor, gefunden: e.anlagen || {},
    wahl: f.anlagen, extra: f.anlagenExtra, ohneEigeneProbenahme: zugestellt });
  anlagenUebernehmen(A, hinweise, hinweisAktionen);
  const verweis = ANL.verweisSatz(A.nr, eine);
  if (verweis) pr.push({ t: 'p', runs: [verweis] });
  const nrText = berichtNr.length ? liste(berichtNr.map(x => 'Nr. ' + x)) : { gap: '[Prüfbericht-Nr.]' };
  const anl = berichtNr.length <= 1 ? '(Anlage 1)' : berichtNr.length === 2 ? '(Anlagen 1 und 2)' : `(Anlagen 1 bis ${berichtNr.length})`;
  pr.push({ t: 'p', runs: [eine ? 'Die Probe wurde der ' : 'Die Proben wurden der ', L(labor, 'Labor'), ' zur Untersuchung auf Asbest übergeben. ',
    berichtNr.length > 1 ? 'Die Ergebnisse sind in den beigefügten Prüfberichten ' : 'Die Ergebnisse sind im beigefügten Prüfbericht ', nrText, ` dokumentiert ${anl}.`] });
  if (mitKmf) pr.push({ t: 'p', runs: [kmfProben.length === 1 ? 'An der Dämmstoffprobe wurde' : 'An den Dämmstoffproben wurde',
    ' zusätzlich untersucht, ob es sich um WHO-Fasern handelt, und der Kanzerogenitätsindex (KI) bestimmt.'] });
  mitFoto.forEach(p => pr.push({ t: 'fig', label: p.label, datei: p.foto,
    caption: `Abb. ${abb.get(p.label)}: ${p.material || p.ref}${p.stelleBericht ? ', ' + p.stelleBericht : ''}.` }));

  /* 3. Befund */
  const tab = { t: 'tab', caption: `Tabelle 1: ${zugestellt ? 'Zugestellte' : 'Entnommene'} ${eine ? 'Probe und Ergebnis' : 'Proben und Ergebnisse'}`,
    kopf: ['Probe', 'Labor-Nr.', 'Entnahmestelle', 'Material', 'Ergebnis'],
    ausrichtung: ['center', 'center', 'left', 'left', 'left'],   // gilt auch für den Spaltenkopf
    spalten: SPALTEN_TAB1, ohneUmbruch: [1],   // Labor-Nr. nicht am Bindestrich umbrechen
    zeilen: proben.map(p => [p.nr ? String(p.nr) : (p.ref || p.label), p.labNr, p.stelleBericht, p.material, p.befund ? p.befund.text : '–']) };
  const bf = [tab];
  if (pos.length === 0 && unklar.length === 0 && n) {
    bf.push({ t: 'p', runs: [eine ? 'In der Probe wurde kein Asbest nachgewiesen (Tabelle 1).' : `In keiner der ${zahlwort(n)} Proben wurde Asbest nachgewiesen (Tabelle 1).`] });
  } else {
    pos.forEach(p => bf.push({ t: 'p', runs: [`In ${p.ref || 'Probe ' + p.nr} (Material: `, L(p.material, 'Material'), `) wurde Asbest nachgewiesen: ${p.befund.text}.`] }));
    unklar.forEach(p => bf.push({ t: 'p', runs: [`Für ${p.ref || 'Probe ' + p.nr} (Material: `, L(p.material, 'Material'), `) weist der Prüfbericht aus: ${p.befund ? p.befund.text : '–'}.`] }));
    if (neg.length) bf.push({ t: 'p', runs: [neg.length === 1 ? 'In der übrigen Probe wurde kein Asbest nachgewiesen.' : 'In den übrigen Proben wurde kein Asbest nachgewiesen.'] });
  }
  kmfProben.forEach(p => {
    const txt = [p.whoNachgewiesen ? `In der Dämmstoffprobe (${p.ref || 'Probe ' + p.nr}) wurden WHO-Fasern nachgewiesen.`
      : `In der Dämmstoffprobe (${p.ref || 'Probe ' + p.nr}) wurden keine WHO-Fasern nachgewiesen.`];
    bf.push({ t: 'p', runs: [...txt, ' Der Prüfbericht weist einen Kanzerogenitätsindex von KI = ', L(p.ki, 'KI-Wert'), ' aus.'] });
  });

  /* 4. Schlussfolgerungen */
  const sf = [];
  const mat = p => ['„', L(p.material, 'Material'), `“ (${p.ref || 'Probe ' + p.nr})`];
  if (pos.length === 0 && n) {
    if (!unklar.length) sf.push({ t: 'p', runs: ['Bei ', eine ? 'dem untersuchten Material handelt es sich nicht um ein asbesthaltiges Material.' : 'den untersuchten Materialien handelt es sich nicht um asbesthaltige Materialien.'] });
  } else if (pos.length) {
    const r = pos.length === 1 ? ['Bei dem Material ', ...mat(pos[0]), ' handelt es sich um ein asbesthaltiges Material. ']
      : ['Bei den Materialien ', ...pos.flatMap((p, i) => [...(i ? [i === pos.length - 1 ? ' und ' : ', '] : []), ...mat(p)]), ' handelt es sich um asbesthaltige Materialien. '];
    r.push(`Bei allen Tätigkeiten, bei denen ${pos.length === 1 ? 'dieses Material' : 'diese Materialien'} bearbeitet, beschädigt oder entfernt ${pos.length === 1 ? 'wird' : 'werden'}, `,
      'sind die Gefahrstoffverordnung (GefStoffV) und die TRGS 519 „Asbest: Abbruch-, Sanierungs- oder Instandhaltungsarbeiten“ einzuhalten. ',
      'Die Arbeiten dürfen nur von Fachbetrieben mit der erforderlichen Sachkunde ausgeführt werden.');
    sf.push({ t: 'p', runs: r });
    if (neg.length) sf.push({ t: 'p', runs: [neg.length === 1 ? 'Bei dem übrigen untersuchten Material handelt es sich nicht um ein asbesthaltiges Material.'
      : 'Bei den übrigen untersuchten Materialien handelt es sich nicht um asbesthaltige Materialien.'] });
  }
  if (unklar.length) sf.push({ t: 'p', runs: [{ gap: '[Schlussfolgerung für nicht eindeutige Ergebnisse ergänzen]' }] });
  const kmfMitWho = kmfProben.filter(p => p.whoNachgewiesen);
  if (kmfMitWho.length) {
    sf.push({ t: 'p', runs: ['Nach der seit 05.06.2026 geltenden Fassung der TRGS 905 werden WHO-Fasern nicht mehr über den Kanzerogenitätsindex, ',
      'sondern nach den Kategorien für krebserzeugende Stoffe in Anhang I der CLP-Verordnung bewertet. Der KI-Wert wird daher nur ergänzend angegeben. ',
      'Maßgeblich für den Umgang mit dem Dämmstoff ist die TRGS 521 „Tätigkeiten mit alter Mineralwolle“.'] });
    if (f.einbau === 'vor1996') sf.push({ t: 'p', runs: ['Der Dämmstoff wurde vor 1996 eingebaut und ist nach TRGS 521 als alte Mineralwolle anzusehen. ',
      'Bei Ausbau, Demontage und Instandhaltung sind die Schutzmaßnahmen der TRGS 521 „Tätigkeiten mit alter Mineralwolle“ einzuhalten.'] });
    else sf.push({ t: 'p', runs: ['Das Einbaujahr des Dämmstoffs ist nicht bekannt. Solange nicht belegt ist, dass es sich um neue Mineralwolle handelt, ',
      'ist er wie alte Mineralwolle im Sinne der TRGS 521 zu behandeln. Bei Ausbau, Demontage und Instandhaltung sind die Schutzmaßnahmen der TRGS 521 einzuhalten.'] });
  }

  /* Unterschriften und Anlagen */
  const { unterschriften, svQuelle } = unterschriftenBlock(e, f, { sv, pn, mt }, zugestellt, hinweise, hinweisAktionen);
  const { anlagenTeile, anlagen, anlagenDateien, anlagenListe } = anlagenAusgabe(A);
  berichtNr.forEach(nr => { if (!pdfVon(nr)) hinweise.push(`Prüfbericht ${nr}: PDF nicht in „Laborergebnisse“ – für die Anlage bitte ablegen.`); });
  const kennzeilen = kennzeilenVorlaeufig(proben.some(p => p.vorlaeufig));

  const abschnitte = [
    { titel: '1. Veranlassung', inhalt: v },
    { titel: '2. Probenahme und Untersuchung', inhalt: pr },
    { titel: '3. Befund', inhalt: bf },
    { titel: '4. Schlussfolgerungen', inhalt: sf },
  ];
  const modell = {
    dateiname: `${+f.mitteilung || 1}._Mitteilung_${P.nr || 'Projekt'}.docx`,
    deckblatt: { titel, mitteilung, projektnummer: P.nr, betreff: betreffRuns, felder },
    kopf, kennzeilen, abschnitte, ortDatum: `Würselen, ${datum}`, unterschriften, versicherungsfall: vfall, anlagen, anlagenTeile, anlagenDateien, anlagenListe, anlagenZeilen: A.zeilen, proben, offen, storniert,
    hinweise: [...new Set(hinweise)], hinweisAktionen, sperren, probenehmerQuelle, versichererQuelle, svQuelle,
    // Annahmen, die mit „✓ stimmt“ bestätigt werden: je eine Meldung (Hinweisliste, am Feld nur „angenommen – bitte prüfen“)
    annahmen: annahmenAus([['probenehmer', probenehmerQuelle], ['versicherer', versichererQuelle], ['sv', svQuelle]]),
  };
  modell.luecken = luecken(modell);
  return modell;
}

const API = { VERSION: 1, art: 'asbest', bericht, SPALTEN_TAB1 };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtAsbest = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* BerichtKit – Berichtsart „brand“: Brandbericht („Sanierungsvorschlag“ / „Untersuchungsbericht“, n. Mitteilung), ohne
   Browserteile, in Node testbar. Grundlage: Doc „Textbausteine Brand-Sanierungsvorschlag“ (freigegeben 31.10.2026) und die
   Entscheidungen aus „berichtkit-brand-befunde-mitteilungen.md“ (gehen vor). Bausteine, die jede Berichtsart braucht (Deckblatt-
   Feldblock, Kopf, Personen, Unterschriften, Anlagen, Asbest-/KMF-Proben …), stehen in bericht-gemeinsam.js.
   Stand Schritt 3 (Gerüst, 1.12.0): Deckblatt, Kopf, 1.–4., 7., Unterschriften, Anlagen. 5. Befund, 6. Sanierungsmaßnahmen /
   Schlussfolgerungen und 8. Zusammenfassung stehen als Überschrift mit Lücke da – Inhalt folgt in Schritt 4/5.
   Regeln wie im Asbestbericht: nichts umrechnen oder umformulieren, fehlende Angaben als [Lücke], nichts erfinden.

   eingabe wie im Asbestbericht (bericht-asbest.js), dazu
     pj: schadendatum (JJJJ-MM-TT | „unbekannt“ | leer), ortstermin, nutzung, schadenereignis, brandgut (Projektzentrale),
     lk: proben[] (PAK), chloridProben[], sonstigeProben[], brandgeruchProben[], brandgeruchDatum, bgBlind (LabelKit),
     form.brand: eigene Angaben der Brand-Seite (vorgabe() = Vorgaben): { titel, umfang:{gebaeude,technik,waren}, anwesende,
       nurBuero, teilnehmerliste, person2 (Kürzel, zweite Person vor Ort), brandort (ersetzt „in dem Wohngebäude“ …),
       gb ('0'–'3'), uebrige (Satz zu den übrigen Bereichen in 7.) }
   Ergebnis wie im Asbestbericht, dazu brand: { titel, objektartVorgabe, nutzung, schadenereignis, brandgut, zahlen:{…} }. */
(function (root) {
'use strict';
const ANL = root.BerichtAnlagen || (typeof require === 'function' ? require('./anlagen.js') : null);
const G = root.BerichtGemeinsam || (typeof require === 'function' ? require('./bericht-gemeinsam.js') : null);
const { s, L, datumDE, liste, zahlwort, ABGLEICH_SPERRT, IST_KMF, istStorniert, probenSammeln, person, nominativ, pnQuelle, projektSicht,
  objektImSatz, labelkitProjektPruefen, deckblattFelder, kopfZeilen, auftraggeberImSatz, unterschriftenBlock, pruefberichtPdf,
  anlagenUebernehmen, anlagenAusgabe, kennzeilenVorlaeufig, annahmenAus, luecken } = G;

const TITEL = ['Sanierungsvorschlag', 'Untersuchungsbericht'];
/** Nutzung (Projektzentrale) → Objektart im ersten Satz von 1. Veranlassung (Tabelle im Doc); sonst „in dem Objekt“ */
const OBJEKTART = { 'Wohnen': 'in dem Wohngebäude', 'Büro': 'in dem Bürogebäude', 'Gewerbe/Industrie': 'in dem Gewerbeobjekt',
  'Landwirtschaft': 'in dem landwirtschaftlichen Objekt' };
const objektart = nutzung => OBJEKTART[s(nutzung)] || 'in dem Objekt';
/** Umfang in 2. Aufgabenstellung – Reihenfolge wie die Haken (und wie 6.1–6.3) */
const UMFANG = [['gebaeude', 'an den Gebäudeoberflächen'], ['technik', 'an der technischen Einrichtung'], ['waren', 'an den Warenvorräten']];
const VDS = 'gemäß Richtlinien zur Brandschadensanierung, VdS Schadenverhütung im Gesamtverband der Deutschen Versicherungswirtschaft e. V. (GDV), VdS 2357:2014-06';
const BUERO = ' (Sachverständigenbüro Dr. Heinz Schiffers & Partner)';
/** Prüfbericht mit Chlorid- bzw. PAK-Werten (Gruppen wie ResultKit src/uebersicht.ts gruppeVon) */
const CHLORID = /^Chlorid\b/i, SUMME_PAK = /^(?:Summe|Σ)\s*16\s*EPA[-– ]?PAK/i;
const GB = ['0', '1', '2', '3'];

/** Vorgaben der Brand-Seite (nie in _BerichtKit.json; eigene Angaben stehen in form.brand) */
function vorgabe(pj) {
  return { titel: 'Sanierungsvorschlag', umfang: { gebaeude: true, technik: false, waren: false }, anwesende: '', nurBuero: false,
    teilnehmerliste: false, person2: '', brandort: '', gb: '', uebrige: s(pj && pj.nutzung) === 'Wohnen' };
}

/** „Schaden vom“: Datum, „unbekannt“ (Knopf „nicht bekannt“ der Projektzentrale) oder leer */
function schaden(v) {
  const t = s(v);
  if (!t) return { art: 'leer', datum: '' };
  if (/^(?:unbekannt|nicht bekannt)$/i.test(t)) return { art: 'unbekannt', datum: '' };
  return { art: 'datum', datum: datumDE(t) };
}
const gross = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const einOderMehr = (n, eins, mehr) => (n === 1 ? eins : `${zahlwort(n)} ${mehr}`);

/** LabelKit-Labels „P<n>“ stornierter Proben aller nummerierten Listen */
function stornierteLabels(lk) {
  const out = new Set();
  for (const k of ['proben', 'chloridProben', 'asbestProben', 'sonstigeProben'])
    for (const p of (lk && Array.isArray(lk[k]) ? lk[k] : [])) if (p && istStorniert(p) && p._nr != null) out.add('P' + p._nr);
  return out;
}
/** LabelKit-Proben je Gruppe, ohne stornierte (LabelKit 4.49.0) */
function lkProben(lk) {
  const liste_ = k => (lk && Array.isArray(lk[k]) ? lk[k] : []).filter(p => p && !istStorniert(p));
  const wisch = p => s(p.matrix).toLowerCase() === 'wischprobe';
  const cl = liste_('chloridProben'), pak = liste_('proben');
  return { clWisch: cl.filter(wisch), clAndere: cl.filter(p => !wisch(p)), pakWisch: pak.filter(wisch), pakMaterial: pak.filter(p => !wisch(p)),
    sonstige: liste_('sonstigeProben'), asbest: liste_('asbestProben'), brandgeruch: liste_('brandgeruchProben'),
    bgDatum: s(lk && lk.brandgeruchDatum), bgBlind: !!lk && Array.isArray(lk.brandgeruchProben) && lk.brandgeruchProben.length > 0 && (lk.bgBlind === undefined ? true : !!lk.bgBlind) };
}
/** Prüfberichte (ResultKit) mit Chlorid- bzw. PAK-Ergebnissen, in Reihenfolge der Berichte; dazu, ob einer davon vorläufig ist.
    Chlorid nur als eigener Parameter („Chlorid“, nicht „Vinylchlorid“); Proben, die in LabelKit storniert sind, zählen nicht. */
function berichteNach(erg, storniertLabels) {
  const cl = [], pak = [], vorlaeufig = new Set(), weg = storniertLabels || new Set();
  for (const b of (erg && Array.isArray(erg.berichte) ? erg.berichte : [])) {
    const nr = s(b && b.bericht); if (!nr) continue;
    const hat = (typ, re) => (b.proben || []).some(p => p && !weg.has(s(p.label)) && (p.typ === typ || (p.werte || []).some(w => w && re.test(s(w.p)) && s(w.r))));
    if (hat('Chlorid', CHLORID) && !cl.includes(nr)) cl.push(nr);
    if (hat('PAK', SUMME_PAK) && !pak.includes(nr)) pak.push(nr);
    if (b.vorlaeufig) vorlaeufig.add(nr);
  }
  return { cl, pak, vorlaeufig };
}
/** „(Anlage 1)“, „(Anlagen 1 und 2)“, „(Anlagen 1 bis 3)“ */
function anlagenVerweis(ns) {
  if (!ns.length) return '';
  if (ns.length === 1) return `(Anlage ${ns[0]})`;
  const fortlaufend = ns.every((n, i) => !i || n === ns[i - 1] + 1);
  return ns.length > 2 && fortlaufend ? `(Anlagen ${ns[0]} bis ${ns[ns.length - 1]})` : `(Anlagen ${liste(ns.map(String))})`;
}
/** Verweis auf Bilddokumentation und Probenplan (Doc: ohne „zusätzlich“, je nach Anlagen gekürzt) */
function verweisSatz(nr, eine) {
  const b = nr.bilddoku, p = nr.probenplan, stelle = eine ? 'Die Entnahmestelle ist' : 'Die Entnahmestellen sind';
  if (b && p) return `${stelle} in der Bilddokumentation (Anlage ${b}) und im Probenplan (Anlage ${p}) dargestellt.`;
  if (b) return `${stelle} in der Bilddokumentation (Anlage ${b}) dargestellt.`;
  if (p) return `${stelle} im Probenplan (Anlage ${p}) dargestellt.`;
  return '';
}

function bericht(eingabe) {
  const e = eingabe || {}, f = e.form || {}, P = projektSicht(e.pj, e.ordner);
  const fb = { ...vorgabe(e.pj), ...(f.brand && typeof f.brand === 'object' ? f.brand : {}) };
  const hinweise = [], sperren = [], hinweisAktionen = {};
  const sanierung = fb.titel !== 'Untersuchungsbericht';
  const titelArt = TITEL.includes(fb.titel) ? fb.titel : TITEL[0];
  const datum = datumDE(f.datum), mitteilung = `${+f.mitteilung || 1}. Mitteilung`, titel = `${titelArt} vom ${datum}`;
  const labor = s(f.labor) || s(e.cfg && e.cfg.labor);
  const lk = lkProben(e.lk), rk = berichteNach(e.erg, stornierteLabels(e.lk));

  /* Asbest-/KMF-Proben (ResultKit + LabelKit wie im Asbestbericht): im Brandbericht Abschnitt 5.5 bzw. 5.4 – hier zählen sie in 4.
     und bringen die Sätze in 7. (TRGS 519/521). Stornierte zählen nicht; ohne Ergebnis sperren sie wie im Asbestbericht. */
  const { proben: alle, offen: offenAlle, storniert } = probenSammeln(e.erg, e.lk);
  const proben = alle.filter(p => !(f.aus && f.aus[p.label] === false));
  const offen = offenAlle.map(o => ({ ...o, aus: !!(f.aus && f.aus[o.label] === false) }));
  storniert.forEach(x => hinweise.push(`${x.label} ist in LabelKit storniert – der Laborwert${x.bericht ? ` (Prüfbericht ${x.bericht})` : ''} kommt nicht in den Bericht.`));
  labelkitProjektPruefen(e, P, sperren);
  offen.filter(o => !o.aus).forEach(o => sperren.push(`${o.label}: in LabelKit als Asbestprobe erfasst, aber noch kein Ergebnis in ResultKit – Ergebnis übernehmen oder die Probe unter „Proben“ abwählen.`));
  proben.forEach(p => {
    p.istKmf = f.kmf && p.label in f.kmf ? !!f.kmf[p.label] : (IST_KMF.test(p.material + ' ' + p.matrix) || !!p.kmf.ki || !!p.kmf.who);
    p.ki = p.kmf.ki || s(f.ki && f.ki[p.label]);
    p.kiQuelle = p.kmf.ki ? 'labor' : (p.ki ? 'hand' : '');
    p.whoNachgewiesen = f.who && p.label in f.who ? !!f.who[p.label] : !!p.kmf.whoPositiv;
    p.foto = '';   // Fotos im Brandbericht kommen mit den Freitextfeldern (Schritt 5)
    if (p.vorlaeufig) hinweise.push(`Prüfbericht ${p.bericht} ist vorläufig – der Bericht bekommt die Kopfzeile „Vorläufig“.`);
    if (p.abgleich.ok === false) (ABGLEICH_SPERRT ? sperren : hinweise).push(`${p.ref || p.label}: Entnahmestelle passt nicht – LabelKit „${p.abgleich.labelkit}“, Prüfbericht ${p.bericht} „${p.abgleich.bericht}“ → in LabelKit oder beim Labor klären.`);
    if (p.befund && !p.befund.eindeutig) hinweise.push(`${p.ref || p.label}: Ergebnis „${p.befund.text}“ nicht eindeutig – bitte im Prüfbericht prüfen.`);
    if (!p.material) hinweise.push(`${p.ref || p.label}: Material fehlt (LabelKit „Bauteil / Material“).`);
    else if (p.materialAusMatrix) hinweise.push(`${p.ref || p.label}: Material „${p.material}“ aus der LabelKit-Matrix übernommen – „Bauteil / Material“ ist leer; genauer wäre z. B. „Fliesenkleber“.`);
    if (p.istKmf && !p.ki) hinweise.push(`${p.ref || p.label}: KI-Wert fehlt in den Labordaten – bitte aus dem Prüfbericht eintragen.`);
  });
  const asb = proben.filter(p => p.befund), kmf = proben.filter(p => p.istKmf), asbNr = [...new Set(asb.map(p => p.bericht).filter(Boolean))];
  // Prüfberichte nur mit KMF-Werten (keine Asbestwerte): eigene Anlage und eigener Verweis im KMF-Absatz
  const kmfNr = [...new Set(kmf.map(p => p.bericht).filter(Boolean))].filter(nr => !asbNr.includes(nr));
  const pos = asb.filter(p => p.befund.gefunden);

  // Personen
  const pn = person(e.cfg, e.mitarbeiter, f.probenehmer), sv = person(e.cfg, e.mitarbeiter, f.sv), mt = person(e.cfg, e.mitarbeiter, f.mt);
  const probenehmerQuelle = pnQuelle(f, e.feldbogen, false, pn, P.zustaendig);
  const p2 = s(fb.person2) && (!pn || s(fb.person2) !== pn.kuerzel) ? person(e.cfg, e.mitarbeiter, fb.person2) : null;

  /* Deckblatt und Kopf: keine Betreffzeile; unter der Projektnummer „Schaden vom: «Datum»“ bzw. bei unbekanntem Datum nur
     „Brandschaden“ (Befunde Nr. 4), Kopfzeile 2 „Brandschaden vom «Datum»“ bzw. „Brandschaden“. */
  const sd = schaden(P.schadendatum);
  const schadenZeile = sd.art === 'unbekannt' ? ['Brandschaden'] : ['Schaden vom:', '\t', L(sd.datum, 'Schadendatum')];
  const kopf2 = sd.art === 'unbekannt' ? ['Brandschaden'] : ['Brandschaden vom ', L(sd.datum, 'Schadendatum')];
  const { vfall, felder: felder0, versichererQuelle } = deckblattFelder(P, f, hinweise);
  // Schaden-Nr.: mehrzeilig wie der VN (z. B. „(Inh.) / (BU) / (Geb.)“ untereinander); mit Versicherung fehlt sie als Lücke
  const felder = felder0.filter(([k]) => k !== 'Schaden-Nr.:');
  const snr = s(P.schadennummer).split(/\s*[\n;]\s*/).map(x => x.trim()).filter(Boolean);
  if (snr.length) felder.push(['Schaden-Nr.:', snr]); else if (vfall) felder.push(['Schaden-Nr.:', [{ gap: '[Schaden-Nr.]' }]]);
  const kopf = kopfZeilen(titel, kopf2, P, vfall);

  /* 1. Veranlassung */
  const brandort = s(fb.brandort) || objektart(P.nutzung);
  if (!s(fb.brandort) && !P.nutzung) hinweise.push('Nutzung fehlt in der Projektzentrale – in 1. steht „in dem Objekt“. Nutzung eintragen oder unter „Brandbericht“ den Brandort im Satz angeben.');
  const objekt = L(objektImSatz(P.objekt), 'Objekt');
  const v = [];
  if (sd.art === 'unbekannt') v.push({ t: 'p', runs: [gross(brandort), ' ', objekt, ' kam es zu einem Brandschaden. Der genaue Zeitpunkt des Schadens ist nicht bekannt.'] });
  else v.push({ t: 'p', runs: ['Am ', L(sd.datum, 'Schadendatum'), ` kam es ${brandort} `, objekt, ' zu einem Brandschaden.'] });
  v.push({ t: 'p', runs: ['Schadenbedingt kann es auch zur Bildung und Freisetzung von Schadstoffen sowie deren räumlicher Verteilung kommen. Im Wesentlichen können Schadstoffe eine Gefährdung von Mensch und Umwelt und ein erhöhtes Korrosionsrisiko bedingen.'] });
  v.push({ t: 'p', runs: ['Die Gefährdung von menschlicher Gesundheit und Umwelt ergibt sich meist aus den bei der unvollständigen Zersetzung organischer Materialien auftretenden Pyrolyseprodukten. Zur Beurteilung der Belastung mit organischen Schadstoffen stellt die Konzentration an polycyclischen aromatischen Kohlenwasserstoffen (PAK) in der Regel die geeignete Leitmessgröße dar.'] });
  // Korrosionsabsätze nur mit Chlorid-Proben (Befunde Nr. 7)
  const mitChlorid = lk.clWisch.length + lk.clAndere.length > 0 || rk.cl.length > 0;
  if (mitChlorid) {
    v.push({ t: 'p', runs: ['Ein Korrosionsrisiko besteht für metallische Bauteile und mineralische Bausubstanz, insbesondere für Stahlbeton.'] });
    v.push({ t: 'p', runs: ['Aus halogenorganischen Materialien (meist PVC) wird beim Abbrand Halogenwasserstoffsäure freigesetzt. Auch beim Verschmoren von PVC wird bei Temperaturen oberhalb 200 °C bereits in merklichem Umfang Chlorwasserstoff abgespalten. Somit wird als Leitmessgröße für ein erhöhtes Korrosionsrisiko die Konzentration an Chloriden herangezogen.'] });
  }

  /* 2. Aufgabenstellung */
  const umfang = UMFANG.filter(([k]) => fb.umfang && fb.umfang[k]).map(([, t]) => t);
  const agSatz = auftraggeberImSatz(f, P, hinweise);
  const auf = ['Am ', L(datumDE(f.auftragsdatum || P.auftragsdatum), 'Auftragsdatum'), ' wurde unser Büro durch ', agSatz,
    ' beauftragt, Art und Ausmaß der Schadstoffbelastung ', umfang.length ? liste(umfang) : { gap: '[Umfang wählen]' }, ' festzustellen.'];
  if (asb.length) auf.push(' Zusätzlich waren Materialproben auf Asbest zu untersuchen.');
  if (sanierung) auf.push(' Aus den getroffenen Feststellungen ist ein Sanierungskonzept abzuleiten.');

  /* 3. Ortsbesichtigung: Ortstermin aus der Projektzentrale, sonst Probenahmedatum aus LabelKit */
  const lkDaten = [...new Set([...lk.pakWisch, ...lk.pakMaterial, ...lk.clWisch, ...lk.clAndere, ...lk.asbest, ...lk.sonstige]
    .map(p => datumDE(p.datum)).filter(Boolean))].sort((a, b) => a.split('.').reverse().join('').localeCompare(b.split('.').reverse().join('')));
  const ortstermin = datumDE(P.ortstermin);
  if (ortstermin && lkDaten.length && lkDaten.some(d => d !== ortstermin)) hinweise.push(`Probenahmedatum in LabelKit (${liste(lkDaten)}) weicht vom Ortstermin der Projektzentrale (${ortstermin}) ab – bitte prüfen.`);
  if (!ortstermin && lkDaten.length) hinweise.push(`Ortstermin fehlt in der Projektzentrale – in 3. steht das Probenahmedatum aus LabelKit (${liste(lkDaten)}).`);
  const wir = [pn, p2].filter(Boolean);
  const wirSatz = wir.length ? liste(wir.map(nominativ)) : { gap: '[Probenehmer]' };
  const ob = [{ t: 'p', runs: !ortstermin && lkDaten.length > 1
    ? [`Am ${liste(lkDaten.map((d, i) => (i ? 'am ' : '') + d))} fanden Besichtigungen der Schadenstelle mit Probenahme statt.`]
    : ['Am ', ortstermin ? ortstermin : lkDaten.length ? lkDaten[0] : { gap: '[Ortstermin]' }, ' fand eine Besichtigung der Schadenstelle mit Probenahme statt.'] }];
  if (fb.teilnehmerliste) ob.push({ t: 'p', runs: ['Die bei dem Ortstermin anwesenden Personen sind der vor Ort erstellten Teilnehmerliste zu entnehmen.'] });
  else if (fb.nurBuero) ob.push({ t: 'p', runs: [`Bei dem Ortstermin ${wir.length > 1 ? 'waren' : 'war'} `, wirSatz, BUERO + ' anwesend.'] });
  else ob.push({ t: 'p', runs: ['Bei dem Ortstermin waren ', L(fb.anwesende, 'Anwesende eintragen'), ' sowie ', wirSatz, BUERO + ' anwesend.'] });

  /* Anlagen: Prüfberichte Chlorid, PAK, Asbest/KMF (ein Bericht für mehrere Parameter = eine Anlage), dann Bilddokumentation,
     Probenplan, Brandgeruch (nur mit Brandgeruch-Proben) */
  const prb = [];
  for (const nr of [...rk.cl, ...rk.pak, ...asbNr, ...kmfNr]) if (!prb.includes(nr)) prb.push(nr);
  const pdfVon = nr => pruefberichtPdf(e.erg, nr);
  const A = ANL.zusammenstellen({ profil: 'brand', pruefberichte: prb.map(nr => ({ nr, pdf: pdfVon(nr) })), labor, gefunden: e.anlagen || {},
    wahl: f.anlagen, extra: f.anlagenExtra, ohne: lk.brandgeruch.length ? [] : ['brandgeruch'] });
  anlagenUebernehmen(A, hinweise, hinweisAktionen);
  const anlNr = nrs => anlagenVerweis(nrs.map(nr => prb.indexOf(nr) + 1).filter(n => n > 0));
  const nrListe = nrs => liste(nrs.map(x => 'Nr. ' + x));
  const analysen = nrs => !nrs.length ? ['Die Analysenergebnisse sind dem Prüfbericht Nr. ', { gap: '[Prüfbericht-Nr.]' }, ' zu entnehmen.']
    : [nrs.length > 1 ? 'Die Analysenergebnisse sind den Prüfberichten ' : 'Die Analysenergebnisse sind dem Prüfbericht ', nrListe(nrs), ` zu entnehmen ${anlNr(nrs)}.`];

  /* 4. Probenahme: je Untersuchung ein Absatz, nur mit Proben (stornierte zählen nicht) */
  const pr = [];
  const nCl = lk.clWisch.length, nPak = lk.pakWisch.length, nPakM = lk.pakMaterial.length, nBg = lk.brandgeruch.length;
  const gemeinsam = nCl && (nPak || nPakM) && rk.cl.length && rk.cl.length === rk.pak.length && rk.cl.every(x => rk.pak.includes(x));
  if (nCl) {
    pr.push({ t: 'p', runs: [`Zur Messung der Chloridbelastung ${nCl === 1 ? 'wurde eine Wischprobe' : `wurden ${zahlwort(nCl)} Wischproben`} entnommen. `,
      nCl === 1 ? 'Die Probe wurde der ' : 'Die Proben wurden der ', L(labor, 'Labor'), ' zur Untersuchung auf Chlorid übergeben.',
      ...(gemeinsam ? [] : [' ', ...analysen(rk.cl)])] });
    if (!rk.cl.length) hinweise.push('Chlorid: noch kein Prüfbericht mit Chlorid-Werten in ResultKit – Ergebnisse übernehmen.');
  }
  if (nPak || nPakM) {
    const r = [];
    if (nPak) r.push(`Zur Messung der PAK-Belastung ${nPak === 1 ? 'wurde eine Wischprobe' : `wurden ${zahlwort(nPak)} Wischproben`} entnommen und auf die 16 Einzelkomponenten nach EPA (Environmental Protection Agency) untersucht; zusätzlich wird der Summenwert angegeben.`);
    if (nPakM) r.push(`${nPak ? ' Zusätzlich' : 'Zur Messung der PAK-Belastung'} ${nPakM === 1 ? 'wurde eine Materialprobe' : `wurden ${zahlwort(nPakM)} Materialproben`} entnommen und auf PAK untersucht.`);
    r.push(' ', ...analysen(gemeinsam ? rk.cl : rk.pak));
    pr.push({ t: 'p', runs: r });
    if (!rk.pak.length) hinweise.push('PAK: noch kein Prüfbericht mit Σ 16 EPA-PAK in ResultKit – Ergebnisse übernehmen.');
  }
  let vorher = nCl + nPak + nPakM > 0;
  const zusatz = () => { const z = vorher ? 'Zusätzlich' : 'Es'; vorher = true; return z; };
  if (asb.length) {
    const mats = [...new Set(asb.map(p => p.material))];
    const matRuns = mats.flatMap((m, i) => [...(i ? [', '] : []), L(m, 'Material')]);
    pr.push({ t: 'p', runs: [`${zusatz()} ${asb.length === 1 ? 'wurde eine Materialprobe' : `wurden ${zahlwort(asb.length)} Materialproben`} (`, ...matRuns, ') entnommen und der ',
      L(labor, 'Labor'), ' zur Untersuchung auf Asbest übergeben. ',
      asbNr.length > 1 ? 'Die Ergebnisse sind in den Prüfberichten ' : asb.length === 1 ? 'Das Ergebnis ist im Prüfbericht ' : 'Die Ergebnisse sind im Prüfbericht ',
      asbNr.length ? nrListe(asbNr) : { gap: '[Prüfbericht-Nr.]' }, asbNr.length ? ` dokumentiert ${anlNr(asbNr)}.` : ' dokumentiert.'] });
  }
  // KMF nach Asbest: die Dämmstoffprobe ist dann schon „entnommen“ (Doc-Reihenfolge KMF vor Asbest – geändert, siehe PR #14)
  if (kmf.length) {
    const r = [`An ${kmf.length === 1 ? 'einer Materialprobe' : `${zahlwort(kmf.length)} Materialproben`} künstlicher Mineralfaserdämmung wurde ${asb.length ? 'zusätzlich ' : ''}untersucht, ob es sich um WHO-Fasern handelt, und der Kanzerogenitätsindex (KI) bestimmt.`];
    if (kmfNr.length) r.push(kmfNr.length > 1 ? ' Die Ergebnisse sind in den Prüfberichten ' : kmf.length === 1 ? ' Das Ergebnis ist im Prüfbericht ' : ' Die Ergebnisse sind im Prüfbericht ', nrListe(kmfNr), ` dokumentiert ${anlNr(kmfNr)}.`);
    pr.push({ t: 'p', runs: r }); vorher = true;
  }
  if (nBg) {
    pr.push({ t: 'p', runs: [`${zusatz()} ${nBg === 1 ? 'wurde eine Materialprobe' : `wurden ${zahlwort(nBg)} Materialproben`} entnommen und am `,
      L(datumDE(lk.bgDatum), 'Prüfdatum Brandgeruch'), ' sensorisch auf Brandgeruch geprüft. Das Ergebnis ist in Anlage ',
      A.nr.brandgeruch ? String(A.nr.brandgeruch) : { gap: '[Anlage-Nr. Brandgeruch]' }, ' dargestellt.'] });
    if (lk.bgBlind) hinweise.push('Brandgeruch: Die Bewertungen sind in LabelKit noch verdeckt (Blind-Modus) – für die Anlage in LabelKit „Ergebnisse aufdecken“ und speichern.');
  }
  const nGesamt = nCl + nPak + nPakM + nBg + new Set([...asb, ...kmf]).size;
  const verweis = verweisSatz(A.nr, nGesamt === 1);
  if (verweis && nGesamt) pr.push({ t: 'p', runs: [verweis] });
  if (!nGesamt) { pr.push({ t: 'p', runs: [{ gap: '[Probenahme beschreiben]' }] }); hinweise.push('Keine Proben in LabelKit/ResultKit gefunden – 4. Probenahme bleibt eine Lücke.'); }
  if (lk.clAndere.length) hinweise.push(`${lk.clAndere.length} Chlorid-${lk.clAndere.length === 1 ? 'Probe' : 'Proben'} ohne Matrix „Wischprobe“ (z. B. Bohrmehl) – im Brandbericht noch nicht berücksichtigt, bitte in Word ergänzen.`);
  if (lk.sonstige.length) hinweise.push(`${lk.sonstige.length} sonstige ${lk.sonstige.length === 1 ? 'Probe' : 'Proben'} (LabelKit) – im Brandbericht noch nicht berücksichtigt, bitte in Word ergänzen.`);

  /* 5., 6., 8.: Überschrift und Lücke (Inhalt folgt in Schritt 4/5) */
  const befund = [{ t: 'p', runs: [{ gap: '[Befund ergänzen]' }] }];
  const massnahmen = [{ t: 'p', runs: [{ gap: sanierung ? '[Sanierungsmaßnahmen ergänzen]' : '[Schlussfolgerungen ergänzen]' }] }];

  /* 7. Arbeitsschutzmaßnahmen: GB 0 eigener Satz (Befunde Nr. 10), GB 1–3 ein Satz mit der Nummer; KMF (TRGS 521) und Asbest (TRGS 519) */
  const gb = GB.includes(s(fb.gb)) ? s(fb.gb) : '';
  // „Untersuchungsbericht“ hat keine Sanierungsmaßnahmen – vorläufige Formulierung, bis Basti einen Wortlaut gibt (PR #14)
  const bei = sanierung ? 'Bei Durchführung der oben angegebenen Sanierungsmaßnahmen' : gb === '0' ? 'Bei Sanierungsarbeiten' : 'Bei Sanierungsarbeiten in den untersuchten Bereichen';
  const as = [];
  if (gb === '0') as.push({ t: 'p', runs: [`${bei} sind aus chemischer Sicht keine über die üblichen Arbeitsschutzmaßnahmen hinausgehenden besonderen Schutzmaßnahmen gegen brandbedingte Schadstoffe erforderlich. Die untersuchten Bereiche sind ${VDS}, dem Gefahrenbereich 0 (GB 0) zuzuordnen.`] });
  else as.push({ t: 'p', runs: [`${bei} sind Arbeitsschutzmaßnahmen für den Gefahrenbereich `, gb ? `${gb} (GB ${gb})` : { gap: '[Gefahrenbereich wählen]' }, ` ${VDS}, vorzunehmen.`] });
  if (gb && gb !== '0' && fb.uebrige) as.push({ t: 'p', runs: [`Bei Arbeiten in den übrigen ${P.nutzung === 'Wohnen' ? 'Wohnungen' : 'Bereichen'} sind keine über den normalen Arbeitsschutz hinausgehenden Maßnahmen notwendig.`] });
  if (kmf.some(p => p.whoNachgewiesen)) {
    if (f.einbau === 'vor1996') as.push({ t: 'p', runs: ['Der Dämmstoff wurde vor 1996 eingebaut und ist nach TRGS 521 als alte Mineralwolle anzusehen. ',
      'Bei Ausbau, Demontage und Instandhaltung sind die Schutzmaßnahmen der TRGS 521 „Tätigkeiten mit alter Mineralwolle“ einzuhalten.'] });
    else as.push({ t: 'p', runs: ['Das Einbaujahr des Dämmstoffs ist nicht bekannt. Solange nicht belegt ist, dass es sich um neue Mineralwolle handelt, ',
      'ist er wie alte Mineralwolle im Sinne der TRGS 521 „Tätigkeiten mit alter Mineralwolle“ zu behandeln. Bei Ausbau, Demontage und Instandhaltung sind die Schutzmaßnahmen der TRGS 521 einzuhalten.'] });
  }
  if (pos.length) {
    const mat = p => ['„', L(p.material, 'Material'), `“ (${p.ref || 'Probe ' + p.nr})`];
    const r = pos.length === 1 ? ['Bei dem Material ', ...mat(pos[0]), ' handelt es sich um ein asbesthaltiges Material. ']
      : ['Bei den Materialien ', ...pos.flatMap((p, i) => [...(i ? [i === pos.length - 1 ? ' und ' : ', '] : []), ...mat(p)]), ' handelt es sich um asbesthaltige Materialien. '];
    r.push(`Bei allen Tätigkeiten, bei denen ${pos.length === 1 ? 'dieses Material' : 'diese Materialien'} bearbeitet, beschädigt oder entfernt ${pos.length === 1 ? 'wird' : 'werden'}, `,
      'sind die Gefahrstoffverordnung (GefStoffV) und die TRGS 519 „Asbest: Abbruch-, Sanierungs- oder Instandhaltungsarbeiten“ einzuhalten. ',
      'Die Arbeiten dürfen nur von Fachbetrieben mit der erforderlichen Sachkunde ausgeführt werden.');
    as.push({ t: 'p', runs: r });
  }

  /* Unterschriften und Anlagen */
  const { unterschriften, svQuelle } = unterschriftenBlock(e, f, { sv, pn, mt }, false, hinweise, hinweisAktionen);
  const { anlagenTeile, anlagen, anlagenDateien, anlagenListe } = anlagenAusgabe(A);
  prb.forEach(nr => { if (!pdfVon(nr)) hinweise.push(`Prüfbericht ${nr}: PDF nicht in „Laborergebnisse“ – für die Anlage bitte ablegen.`); });
  [...rk.vorlaeufig].filter(nr => (rk.cl.includes(nr) || rk.pak.includes(nr)) && !asbNr.includes(nr))
    .forEach(nr => hinweise.push(`Prüfbericht ${nr} ist vorläufig – der Bericht bekommt die Kopfzeile „Vorläufig“.`));
  const kennzeilen = kennzeilenVorlaeufig(proben.some(p => p.vorlaeufig) || [...rk.vorlaeufig].some(nr => prb.includes(nr)));

  const abschnitte = [
    { titel: '1. Veranlassung', inhalt: v },
    { titel: '2. Aufgabenstellung', inhalt: [{ t: 'p', runs: auf }] },
    { titel: '3. Ortsbesichtigung', inhalt: ob },
    { titel: '4. Probenahme', inhalt: pr },
    { titel: '5. Befund', inhalt: befund },
    { titel: sanierung ? '6. Sanierungsmaßnahmen' : '6. Schlussfolgerungen', inhalt: massnahmen },
    { titel: '7. Arbeitsschutzmaßnahmen', inhalt: as },
    ...(sanierung ? [{ titel: '8. Zusammenfassung Sanierungsmaßnahmen', inhalt: [{ t: 'p', runs: [{ gap: '[Zusammenfassung der Sanierungsmaßnahmen ergänzen]' }] }] }] : []),
  ];
  const modell = {
    dateiname: `${+f.mitteilung || 1}._Mitteilung_${P.nr || 'Projekt'}.docx`,
    deckblatt: { titel, mitteilung, projektnummer: P.nr, betreff: schadenZeile, felder },
    kopf, kennzeilen, abschnitte, ortDatum: `Würselen, ${datum}`, unterschriften, versicherungsfall: vfall, anlagen, anlagenTeile, anlagenDateien, anlagenListe, anlagenZeilen: A.zeilen, proben, offen, storniert,
    hinweise: [...new Set(hinweise)], hinweisAktionen, sperren, probenehmerQuelle, versichererQuelle, svQuelle,
    annahmen: annahmenAus([['probenehmer', probenehmerQuelle], ['versicherer', versichererQuelle], ['sv', svQuelle]]),
    brand: { titel: titelArt, objektartVorgabe: objektart(P.nutzung), nutzung: P.nutzung, schadenereignis: P.schadenereignis, brandgut: P.brandgut,
      schadendatum: sd.art, ortstermin: ortstermin || '', probenahme: lkDaten,
      zahlen: { chlorid: nCl, pak: nPak, pakMaterial: nPakM, kmf: kmf.length, asbest: asb.length, brandgeruch: nBg, chloridAndere: lk.clAndere.length, sonstige: lk.sonstige.length } },
  };
  modell.luecken = luecken(modell);
  return modell;
}

const API = { VERSION: 1, art: 'brand', bericht, vorgabe, objektart, OBJEKTART, TITEL };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtBrand = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

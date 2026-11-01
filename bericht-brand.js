/* BerichtKit – Berichtsart „brand“: Brandbericht („Sanierungsvorschlag“ / „Untersuchungsbericht“, n. Mitteilung), ohne
   Browserteile, in Node testbar. Grundlage: Doc „Textbausteine Brand-Sanierungsvorschlag“ (freigegeben 31.10.2026) und die
   Entscheidungen aus „berichtkit-brand-befunde-mitteilungen.md“ (gehen vor). Bausteine, die jede Berichtsart braucht (Deckblatt-
   Feldblock, Kopf, Personen, Unterschriften, Anlagen, Asbest-/KMF-Proben …), stehen in bericht-gemeinsam.js.
   Stand Schritt 5 (1.14.0): Deckblatt, Kopf, 1.–4. (Asbest-/KMF-Fotos wie im Asbestbericht), 5. Befund (5.1 Brandlast und
   Schadenbild als Freitext, 5.2 Chlorid, 5.3 PAK, 5.4 KMF, 5.5 Asbest, 5.6 Brandgeruch, 5.7 weitere Untersuchungen – nur, was es
   gibt, fortlaufend nummeriert), 6. Sanierungsmaßnahmen (6.1–6.3 nach den Umfang-Haken) bzw. Schlussfolgerungen, 7. (zweiter
   Bereich, Zusatz), 8. Zusammenfassung (nur Sanierungsvorschlag), Unterschriften, Anlagen. Freitext-Schreibweise (Absätze,
   „- “, „## Titel“, „[Abb: Datei]“, **fett**) siehe bericht-gemeinsam.js freitext(); leeres Feld → Lücke mit Anweisung.
   Regeln wie im Asbestbericht: Laborwerte unverändert wie im Prüfbericht (umgerechnet wird nur für die Einordnung, siehe
   bericht-bewertung.js), fehlende Angaben als [Lücke], nichts erfinden.

   eingabe wie im Asbestbericht (bericht-asbest.js), dazu
     pj: schadendatum (JJJJ-MM-TT | „unbekannt“ | leer), ortstermin, nutzung, schadenereignis, brandgut (Projektzentrale),
     fotoKit: FotoKit-Bilder (_Bildumbenenner.json bilder: { Datei: { beschreibung, aussortiert } }) für „[Abb: Datei]“ im Freitext,
     lk: proben[] (PAK), chloridProben[], sonstigeProben[] (im Modus „Chlorid-Bohrmehl“ = ui.bohrmehlAktiv: Bohrmehlproben auf
       Chlorid, sonst weitere Untersuchungen mit notiz = Untersuchungsparameter), brandgeruchProben[], brandgeruchDatum, bgBlind (LabelKit),
     form.brand: eigene Angaben der Brand-Seite (vorgabe() = Vorgaben): { titel, umfang:{gebaeude,technik,waren}, anwesende,
       nurBuero, teilnehmerliste, person2 (Kürzel, zweite Person vor Ort), brandort (ersetzt „in dem Wohngebäude“ …),
       gb ('0'–'3'), uebrige (Satz zu den übrigen Bereichen in 7.), tabellen (Ergebnistabellen Chlorid/PAK in 5., Vorbelegung aus),
       referenz ('10' | '100' µg/m², Vorbelegung aus der Nutzung), referenzGrund (optionaler Begründungssatz in 5.3),
       Freitext (ab 1.14.0): schadenbild (5.1, vorbelegt „Der Brand ereignete sich “), sanGebaeude / sanTechnik / sanWaren (6.1–6.3),
       schlussfolgerungen (6. beim Untersuchungsbericht), zusammenfassung (8.), bereich / bereich2 / gb2 (7., zweiter Bereich mit
       eigenem Gefahrenbereich), zusatz (7., optional) }
   Ergebnis wie im Asbestbericht, dazu brand: { titel, objektartVorgabe, nutzung, schadenereignis, brandgut, zahlen:{…} }. */
(function (root) {
'use strict';
const ANL = root.BerichtAnlagen || (typeof require === 'function' ? require('./anlagen.js') : null);
const G = root.BerichtGemeinsam || (typeof require === 'function' ? require('./bericht-gemeinsam.js') : null);
const BW = root.BerichtBewertung || (typeof require === 'function' ? require('./bericht-bewertung.js') : null);
const { s, L, datumDE, liste, zahlwort, PNR, tidy, ABGLEICH_SPERRT, IST_KMF, RAUM_KUERZEL, raumAusschreiben, istStorniert, probenSammeln,
  person, nominativ, pnQuelle, projektSicht, objektImSatz, labelkitProjektPruefen, deckblattFelder, kopfZeilen, auftraggeberImSatz,
  unterschriftenBlock, pruefberichtPdf, anlagenUebernehmen, anlagenAusgabe, kennzeilenVorlaeufig, annahmenAus, luecken } = G;

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
/** 5.1: Vorbelegung im Formular (Doc) – steht nur sie da, ist das Feld noch leer (→ Lücke) */
const SCHADENBILD_START = 'Der Brand ereignete sich ';
/** 6. Sanierungsmaßnahmen: Einleitungssatz (Befunde-Doc, „Kleinere Abweichungen – entschieden“) und Unterabschnitte in der
    Reihenfolge der Umfang-Haken: [Haken, Formularfeld, Titel, Lücke] */
const EINLEITUNG_6 = 'Auf Grundlage der vorliegenden Befunde und der analytischen Untersuchungsergebnisse werden folgende Sanierungsmaßnahmen empfohlen:';
const SAN = [['gebaeude', 'sanGebaeude', 'Gebäude', '[Sanierungsmaßnahmen Gebäude beschreiben]'],
  ['technik', 'sanTechnik', 'Technische Einrichtung', '[Sanierungsmaßnahmen technische Einrichtung beschreiben]'],
  ['waren', 'sanWaren', 'Warenvorräte', '[Sanierungsmaßnahmen Warenvorräte beschreiben]']];
/** Freitextfelder der Brand-Seite (form.brand) – je Feld eine eigene Angabe */
/** Formularfeld (index.html) je Sanierungsfeld */
const SAN_FELD = { sanGebaeude: 'fbSanGebaeude', sanTechnik: 'fbSanTechnik', sanWaren: 'fbSanWaren' };
const FREITEXT = ['schadenbild', 'sanGebaeude', 'sanTechnik', 'sanWaren', 'schlussfolgerungen', 'zusammenfassung', 'zusatz'];
/** Hintergrundreferenz PAK nach der Nutzung (wie ResultKit usageFromNutzung): Wohn-/Bürobereiche 10, Gewerbe/Industrie 100 µg/m² */
const REFERENZ_NUTZUNG = { 'Wohnen': '10', 'Büro': '10', 'Öffentlich': '10', 'Gesundheit & Labor': '10', 'Gewerbe/Industrie': '100', 'Landwirtschaft': '100' };
const referenzVorgabe = nutzung => REFERENZ_NUTZUNG[s(nutzung)] || '';
/** Ergebnistabellen 5.2/5.3 (zusammen 9070 twips): Probe (breit genug für „(Freimessung)“), Labor-Nr. (eine Zeile wie in Tabelle 1
    des Asbestberichts), Entnahmestelle, Wert („Σ 16 EPA-PAK“ ohne Umbruch am Bindestrich), Einordnung – in LibreOffice geprüft */
const SPALTEN_ERG = [1600, 2080, 2040, 1700, 1650];
/** Asbest-Tabelle in 5.5: Spalten wie Tabelle 1 im Asbestbericht (bericht-asbest.js SPALTEN_TAB1) */
const SPALTEN_TAB1 = [950, 2080, 2240, 1850, 1950];
/** Einordnung wie im Doc; nach „/“ darf die Zeile umbrechen (breitenloses Leerzeichen U+200B) */
const CL_STUFE = ['unterhalb', 'im Bereich', 'oberhalb'], PAK_STUFE = ['unter Referenz', 'Referenz erreicht/\u200Büberschritten'];
const CL_GROESSE = 'der korrosionschemisch relevanten Größenordnung';
/** Brandgeruch-Bewertung je Prüfperson (LabelKit p1–p5, Legende der Projektzentrale-Anlage) → Wort im Ergebnis-Satz */
const BG_STUFEN = [['++', 'ein starker'], ['+', 'ein mittelstarker'], ['(+)', 'ein schwacher'], ['-', 'kein']];
const BG_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5'];
const bgWert = v => { const t = s(v).replace(/[–−—]/g, '-').replace(/\s+/g, ''); return BG_STUFEN.some(([k]) => k === t) ? t : ''; };

/** Vorgaben der Brand-Seite (nie in _BerichtKit.json; eigene Angaben stehen in form.brand) */
function vorgabe(pj) {
  return { titel: 'Sanierungsvorschlag', umfang: { gebaeude: true, technik: false, waren: false }, anwesende: '', nurBuero: false,
    teilnehmerliste: false, person2: '', brandort: '', gb: '', uebrige: s(pj && pj.nutzung) === 'Wohnen',
    tabellen: false, referenz: referenzVorgabe(pj && pj.nutzung), referenzGrund: '',
    schadenbild: SCHADENBILD_START, sanGebaeude: '', sanTechnik: '', sanWaren: '', schlussfolgerungen: '', zusammenfassung: '',
    bereich: '', bereich2: '', gb2: '', zusatz: '' };
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
/** Sonstige Probe = Chlorid-Bohrmehl? LabelKit schaltet die ganze Liste „Sonstige“ mit dem Haken „Chlorid-Bohrmehl“ um
    (ui.bohrmehlAktiv, ältere Dateien oben im Objekt); ohne den Haken zählt eine Probe mit Tiefe und „Chlorid“ im Untersuchungsparameter. */
const istBohrmehl = (lk, p) => !!(lk && ((lk.ui && lk.ui.bohrmehlAktiv) || lk.bohrmehlAktiv)) || (!!s(p.tiefe) && /chlorid/i.test(s(p.notiz)));
/** LabelKit-Proben je Gruppe, ohne stornierte (LabelKit 4.49.0) */
function lkProben(lk) {
  const liste_ = k => (lk && Array.isArray(lk[k]) ? lk[k] : []).filter(p => p && !istStorniert(p));
  const wisch = p => s(p.matrix).toLowerCase() === 'wischprobe';
  const cl = liste_('chloridProben'), pak = liste_('proben'), so = liste_('sonstigeProben');
  return { clWisch: cl.filter(wisch), clAndere: cl.filter(p => !wisch(p)), pakWisch: pak.filter(wisch), pakMaterial: pak.filter(p => !wisch(p)),
    bohrmehl: so.filter(p => istBohrmehl(lk, p)), sonstige: so.filter(p => !istBohrmehl(lk, p)), asbest: liste_('asbestProben'), brandgeruch: liste_('brandgeruchProben'),
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
/** LabelKit-Proben der nummerierten Listen nach Label „P<n>“ (Nummern sind über alle Listen eindeutig), ohne stornierte:
    { liste: 'pak'|'chlorid'|'asbest'|'sonstige', nr, matrix, z2 (Raum/Ort), notiz (Untersuchungsparameter), tiefe, bohrmehl } */
function lkKarte(lk) {
  const out = new Map();
  for (const [k, liste_] of [['proben', 'pak'], ['chloridProben', 'chlorid'], ['asbestProben', 'asbest'], ['sonstigeProben', 'sonstige']])
    for (const p of (lk && Array.isArray(lk[k]) ? lk[k] : [])) {
      if (!p || istStorniert(p)) continue;
      const nr = p._nr != null && p._nr !== '' ? +p._nr : +p.id; if (!nr) continue;
      out.set('P' + nr, { liste: liste_, nr, matrix: s(p.matrix), z2: s(p.z2), notiz: s(p.notiz).replace(/\s*\n\s*/g, ', '), tiefe: s(p.tiefe),
        bohrmehl: liste_ === 'sonstige' && istBohrmehl(lk, p) });
    }
  return out;
}
/** Proben aus den Prüfberichten (ResultKit), ohne stornierte: [{ label, ref, labNr, bericht, desc, raum, werte }] in Berichtsreihenfolge */
function laborProben(erg, weg) {
  const out = [];
  for (const b of (erg && Array.isArray(erg.berichte) ? erg.berichte : [])) for (const p of (b && b.proben) || []) {
    if (!p) continue;
    const label = s(p.label) || (PNR(p.ref) ? 'P' + PNR(p.ref) : s(p.ref));
    if (!label || weg.has(label)) continue;
    out.push({ label, ref: s(p.ref), labNr: s(p.labNr), bericht: s(b.bericht || p.bericht), desc: s(p.desc), raum: s(p.raum), werte: p.werte || [] });
  }
  return out;
}
/** Ergebnisse eines Parameters (re) je Probe. Wie ResultKit uebersicht.ts: erst alle Werte einer Probe über alle Prüfberichte
    sammeln (ResultKit hat ersetzte Werte schon entfernt), dann der bevorzugte Wert (je Fläche vor „je Probe“); Labor-Nr. und
    Prüfbericht kommen aus dem Bericht dieses Werts.
    wisch: Wischprobe laut LabelKit (Liste und Matrix), ohne LabelKit-Eintrag nach der Einheit (je Fläche).
    rolle: 'referenz' | 'frei' | '' (Projektzentrale-Datenarchiv) */
function ergebnisse(proben, re, karte, liste_) {
  const je = new Map();
  for (const p of proben) {
    if (!je.has(p.label)) je.set(p.label, []);
    for (const w of p.werte || []) if (w && !/^[-–—]?$/.test(s(w.r))) je.get(p.label).push({ w, p });
  }
  const out = [];
  for (const [label, ws] of je) {
    const w = BW.bevorzugt(ws.map(x => x.w), re); if (!w) continue;
    const p = ws.find(x => x.w === w).p, l = karte.get(label) || null;
    const wisch = l ? l.liste === liste_ && l.matrix.toLowerCase() === 'wischprobe' : BW.FLAECHE.test(s(w.u));
    out.push({ label, nr: (l && l.nr) || PNR(p.ref) || PNR(label), ref: p.ref, labNr: p.labNr, bericht: p.bericht,
      w: { r: s(w.r), u: s(w.u) }, wisch, lk: l, roh: (l && l.z2) || p.raum || tidy(p.desc), rolle: BW.rolleAuto(l ? l.z2 : '', p.desc) });
  }
  return out.sort((a, b) => (a.nr || 0) - (b.nr || 0));
}
/** Laborwerte einer Asbest-/KMF-Probe aus probenSammeln() (dort ohne werte) – für die Nachweisgrenze (Anhang B) */
function werteVon(erg, p) {
  for (const b of (erg && Array.isArray(erg.berichte) ? erg.berichte : [])) if (s(b && b.bericht) === p.bericht)
    for (const x of (b.proben || [])) if (x && (s(x.label) || (PNR(x.ref) ? 'P' + PNR(x.ref) : s(x.ref))) === p.label) return x.werte || [];
  return [];
}
/** Probennummern im Satz: „1“, „1 und 4“, „1 bis 3 und 5“ (ab drei aufeinanderfolgenden Nummern „bis“) */
function nrText(xs) {
  const nrs = [...new Set(xs.map(x => x.nr).filter(n => n != null))].sort((a, b) => a - b), teile = [];
  for (let i = 0; i < nrs.length;) {
    let j = i; while (j + 1 < nrs.length && nrs[j + 1] === nrs[j] + 1) j++;
    if (j - i >= 2) teile.push(`${nrs[i]} bis ${nrs[j]}`); else for (let k = i; k <= j; k++) teile.push(String(nrs[k]));
    i = j + 1;
  }
  xs.filter(x => x.nr == null).forEach(x => teile.push(x.ref || x.label));
  return liste(teile);
}
/** „Beide“ / „Alle drei“ / „Alle 13“ */
const alleN = n => (n === 2 ? 'Beide' : `Alle ${zahlwort(n)}`);
const probe = xs => `${xs.length === 1 ? 'Probe' : 'Proben'} ${nrText(xs)}`;
/** Wert mit Einheit wie im Prüfbericht – „n. n.“, „n. b.“, „unter BG“ ohne Einheit (keine Zahl, zu der sie gehört) */
const wertText = w => { const q = BW.labQualifier(w.r), ohne = q === 'notDetected' || q === 'notDetermined' || (q === 'below' && !/^\(?\s*</.test(w.r)); return `${w.r}${w.u && !ohne ? ' ' + w.u : ''}`; };
/** „(Probe 4, EG Küche Decke)“ – mit Tiefe bei Bohrmehl */
const ortKlammer = x => `(Probe ${x.nr != null ? x.nr : x.ref || x.label}${x.stelle ? ', ' + x.stelle : ''}${x.lk && x.lk.tiefe ? ', Tiefe ' + x.lk.tiefe : ''})`;
/** Zahl zum Vergleichen (Spanne, höchster Wert), umgerechnet über faktor(u) in eine gemeinsame Einheit – Chlorid µg/cm², PAK µg/m².
    „1.250“, „n. b.“, < BG oder unbekannte Einheit → NaN (nicht vergleichbar). */
const zahl = (x, faktor) => { const f = faktor(x.w.u); return f && BW.labQualifier(x.w.r) === 'measured' ? BW.labNumber(x.w.r) / f : NaN; };
/** Laufende Texte zusammenfügen: benachbarte Zeichenketten verbinden, doppelte Leerzeichen weg, vorn/hinten trimmen */
function fuegen(runs) {
  const out = [];
  for (const r of runs) { if (r === '' || r == null) continue; if (typeof r === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += r; else out.push(r); }
  const t = out.map(r => (typeof r === 'string' ? r.replace(/ {2,}/g, ' ') : r));
  if (typeof t[0] === 'string') t[0] = t[0].replace(/^\s+/, '');
  if (typeof t[t.length - 1] === 'string') t[t.length - 1] = t[t.length - 1].replace(/\s+$/, '');
  return t.filter(r => r !== '');
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
  /* Abbildungen laufen durch den ganzen Bericht: Asbest-/KMF-Fotos in 4., dann die Fotos der Freitextfelder (5.1, 6., 7., 8.) */
  const abb = { n: 0 }, lueckenFelder = {};
  /** Freitextfeld → Blöcke; feldId = Formularfeld (für selbst geschriebene Lücken: Zähler springt dorthin) */
  const ftx = (text, feld, feldId, o = {}) => G.freitext(text, { abb, fotoKit: e.fotoKit, hinweise, feld, feldId, lueckenFelder, ...o });
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
    // Foto wie im Asbestbericht: eigene Wahl in der Probenliste, sonst das erste FotoKit-Foto der Probe (ab 1.14.0)
    p.foto = f.foto && p.label in f.foto ? f.foto[p.label] : ((e.fotos && e.fotos[p.label] && e.fotos[p.label][0] && e.fotos[p.label][0].datei) || '');
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
  // Laborwerte Chlorid/PAK je Probe (für 5.2/5.3) und weitere Untersuchungen (LabelKit „Sonstige“ ohne Chlorid-Bohrmehl)
  const karte = lkKarte(e.lk), lp = laborProben(e.erg, stornierteLabels(e.lk));
  const clErg = ergebnisse(lp, CHLORID, karte, 'chlorid'), pakErg = ergebnisse(lp, SUMME_PAK, karte, 'pak');
  const mitWert = new Set([...clErg, ...pakErg].map(x => x.label));
  const weitereLabels = new Set([...karte].filter(([, l]) => l.liste === 'sonstige' && !l.bohrmehl).map(([k]) => k));
  const weitereErg = [...new Set(lp.filter(p => weitereLabels.has(p.label) && !mitWert.has(p.label) && p.werte.length).map(p => p.label))]
    .map(label => ({ label, nr: karte.get(label).nr, lk: karte.get(label) })).sort((a, b) => a.nr - b.nr);
  // Prüfberichte mit Proben aus „Sonstige“ (ohne Bohrmehl), die nicht schon als Chlorid/PAK/Asbest-Bericht eine Anlage sind
  const weitereNr = [...new Set(lp.filter(p => weitereLabels.has(p.label) && p.werte.length).map(p => p.bericht).filter(Boolean))];

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
  if (!s(fb.brandort) && !P.nutzung) hinweise.push('Nutzung fehlt in der Projektzentrale – in 1. steht „in dem Objekt“. Nutzung eintragen oder unter „Vor Ort & Proben“ den Brandort im Satz angeben.');
  const objekt = L(objektImSatz(P.objekt), 'Objekt');
  const v = [];
  if (sd.art === 'unbekannt') v.push({ t: 'p', runs: [gross(brandort), ' ', objekt, ' kam es zu einem Brandschaden. Der genaue Zeitpunkt des Schadens ist nicht bekannt.'] });
  else v.push({ t: 'p', runs: ['Am ', L(sd.datum, 'Schadendatum'), ` kam es ${brandort} `, objekt, ' zu einem Brandschaden.'] });
  v.push({ t: 'p', runs: ['Schadenbedingt kann es auch zur Bildung und Freisetzung von Schadstoffen sowie deren räumlicher Verteilung kommen. Im Wesentlichen können Schadstoffe eine Gefährdung von Mensch und Umwelt und ein erhöhtes Korrosionsrisiko bedingen.'] });
  v.push({ t: 'p', runs: ['Die Gefährdung von menschlicher Gesundheit und Umwelt ergibt sich meist aus den bei der unvollständigen Zersetzung organischer Materialien auftretenden Pyrolyseprodukten. Zur Beurteilung der Belastung mit organischen Schadstoffen stellt die Konzentration an polycyclischen aromatischen Kohlenwasserstoffen (PAK) in der Regel die geeignete Leitmessgröße dar.'] });
  // Korrosionsabsätze nur mit Chlorid-Proben (Befunde Nr. 7)
  const mitChlorid = lk.clWisch.length + lk.clAndere.length + lk.bohrmehl.length > 0 || rk.cl.length > 0;
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
  const lkDaten = [...new Set([...lk.pakWisch, ...lk.pakMaterial, ...lk.clWisch, ...lk.clAndere, ...lk.asbest, ...lk.bohrmehl, ...lk.sonstige]
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
  for (const nr of [...rk.cl, ...rk.pak, ...asbNr, ...kmfNr, ...weitereNr]) if (!prb.includes(nr)) prb.push(nr);
  const pdfVon = nr => pruefberichtPdf(e.erg, nr);
  const A = ANL.zusammenstellen({ profil: 'brand', pruefberichte: prb.map(nr => ({ nr, pdf: pdfVon(nr) })), labor, gefunden: e.anlagen || {},
    wahl: f.anlagen, extra: f.anlagenExtra, ohne: lk.brandgeruch.length ? [] : ['brandgeruch'],
    // Nur Brandgeruch (oder gar keine Proben): kein Laborbericht zu erwarten – keine Platzhalter-Anlage „Prüfbericht Nr. […]“ (Codex, PR #14)
    ohnePruefbericht: !(lk.clWisch.length + lk.clAndere.length + lk.bohrmehl.length + lk.pakWisch.length + lk.pakMaterial.length + lk.sonstige.length
      + asb.length + kmf.length + offen.filter(o => !o.aus).length) });
  anlagenUebernehmen(A, hinweise, hinweisAktionen);
  const anlNr = nrs => anlagenVerweis(nrs.map(nr => prb.indexOf(nr) + 1).filter(n => n > 0));
  const nrListe = nrs => liste(nrs.map(x => 'Nr. ' + x));
  const analysen = nrs => !nrs.length ? ['Die Analysenergebnisse sind dem Prüfbericht Nr. ', { gap: '[Prüfbericht-Nr.]' }, ' zu entnehmen.']
    : [nrs.length > 1 ? 'Die Analysenergebnisse sind den Prüfberichten ' : 'Die Analysenergebnisse sind dem Prüfbericht ', nrListe(nrs), ` zu entnehmen ${anlNr(nrs)}.`];

  /* 4. Probenahme: je Untersuchung ein Absatz, nur mit Proben (stornierte zählen nicht) */
  const pr = [];
  const nCl = lk.clWisch.length, nPak = lk.pakWisch.length, nPakM = lk.pakMaterial.length, nBg = lk.brandgeruch.length;
  const nClM = lk.clAndere.length, nBm = lk.bohrmehl.length, nClAlle = nCl + nClM + nBm;
  const gemeinsam = nClAlle && (nPak || nPakM) && rk.cl.length && rk.cl.length === rk.pak.length && rk.cl.every(x => rk.pak.includes(x));
  if (nClAlle) {
    // Chlorid-Materialproben (LabelKit Chlorid, Matrix nicht „Wischprobe“) und Chlorid-Bohrmehl (LabelKit „Sonstige“) im selben Absatz
    const andere = [nClM && einOderMehr(nClM, 'eine Materialprobe', 'Materialproben'), nBm && einOderMehr(nBm, 'eine Bohrmehlprobe', 'Bohrmehlproben')].filter(Boolean);
    const r = [];
    if (nCl) r.push(`Zur Messung der Chloridbelastung ${nCl === 1 ? 'wurde eine Wischprobe' : `wurden ${zahlwort(nCl)} Wischproben`} entnommen. `);
    if (andere.length) r.push(`${nCl ? 'Zusätzlich' : 'Zur Messung der Chloridbelastung'} ${nClM + nBm === 1 ? 'wurde' : 'wurden'} ${liste(andere)} entnommen. `);
    r.push(nClAlle === 1 ? 'Die Probe wurde der ' : 'Die Proben wurden der ', L(labor, 'Labor'), ' zur Untersuchung auf Chlorid übergeben.',
      ...(gemeinsam ? [] : [' ', ...analysen(rk.cl)]));
    pr.push({ t: 'p', runs: r });
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
  let vorher = nClAlle + nPak + nPakM > 0;
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
  /* Fotos der Asbest-/KMF-Proben wie im Asbestbericht (ab 1.14.0): Satz mit den Probennummern und die Abbildungen am Ende von 4.
     (nach dem Verweis auf Bilddokumentation/Probenplan) – mit Nummern, weil auch Brandgeruch-Proben „Materialproben“ heißen */
  const imBericht = proben.filter(p => p.befund || p.istKmf), mitFoto = imBericht.filter(p => p.foto);
  mitFoto.forEach(p => { p.abb = ++abb.n; });
  const fotoSatz = !mitFoto.length ? '' : (() => {
    const a0 = mitFoto[0].abb, a1 = mitFoto[mitFoto.length - 1].abb;
    const wo = mitFoto.length === 1 ? `Abbildung ${a0}` : `den Abbildungen ${a0} ${mitFoto.length === 2 ? 'und' : 'bis'} ${a1}`;
    return `${mitFoto.length === 1 ? '' : 'Die '}${probe(mitFoto.map(p => ({ nr: p.nr, ref: p.ref, label: p.label })))} ${mitFoto.length === 1 ? 'ist' : 'sind'} in ${wo} dargestellt.`;
  })();
  if (nBg) {
    pr.push({ t: 'p', runs: [`${zusatz()} ${nBg === 1 ? 'wurde eine Materialprobe' : `wurden ${zahlwort(nBg)} Materialproben`} entnommen und am `,
      L(datumDE(lk.bgDatum), 'Prüfdatum Brandgeruch'), ' sensorisch auf Brandgeruch geprüft. Das Ergebnis ist in Anlage ',
      A.nr.brandgeruch ? String(A.nr.brandgeruch) : { gap: '[Anlage-Nr. Brandgeruch]' }, ' dargestellt.'] });
    if (lk.bgBlind) hinweise.push('Brandgeruch: Die Bewertungen sind in LabelKit noch verdeckt (Blind-Modus) – für die Anlage in LabelKit „Ergebnisse aufdecken“ und speichern.');
  }
  // Weitere Untersuchungen (LabelKit „Sonstige“ ohne Chlorid-Bohrmehl): je Untersuchungsparameter ein Satz, dazu der Prüfbericht
  if (lk.sonstige.length) {
    const gruppen = new Map();
    lk.sonstige.forEach(p => { const k = s(p.notiz).replace(/\s*\n\s*/g, ', '); gruppen.set(k, (gruppen.get(k) || 0) + 1); });
    const r = [];
    [...gruppen].forEach(([param, n], i) => {
      const z = zusatz(), weitere = z === 'Zusätzlich' ? 'weitere ' : '';
      r.push(...(i ? [' '] : []), `${z} ${n === 1 ? `wurde eine ${weitere}Probe` : `wurden ${zahlwort(n)} ${weitere}Proben`} entnommen und auf `,
        param ? param : { gap: '[Untersuchungsparameter]' }, ' untersucht.');
    });
    r.push(' ', ...analysen(weitereNr));
    pr.push({ t: 'p', runs: r });
    if (!weitereNr.length) hinweise.push('Weitere Proben (LabelKit „Sonstige“): noch kein Prüfbericht in ResultKit – Ergebnisse übernehmen.');
    if ([...gruppen.keys()].some(k => !k)) hinweise.push('Weitere Proben (LabelKit „Sonstige“): Untersuchungsparameter fehlt – in LabelKit eintragen.');
  }
  const nGesamt = nClAlle + nPak + nPakM + nBg + lk.sonstige.length + new Set([...asb, ...kmf]).size;
  const verweis = verweisSatz(A.nr, nGesamt === 1);
  if (verweis && nGesamt) pr.push({ t: 'p', runs: [verweis] });
  if (!nGesamt) { pr.push({ t: 'p', runs: [{ gap: '[Probenahme beschreiben]' }] }); hinweise.push('Keine Proben in LabelKit/ResultKit gefunden – 4. Probenahme bleibt eine Lücke.'); }

  /* 5. Befund: 5.1 immer (Freitext, leer bzw. nur die Vorbelegung → Lücke), dann nur, wozu es Ergebnisse gibt, fortlaufend nummeriert:
     Chlorid, PAK, KMF, Asbest (Reihenfolge wie im Doc), Brandgeruch, weitere Untersuchungen. Laborwerte wie im Prüfbericht;
     eingeordnet wird mit den Grenzen aus ResultKit (bericht-bewertung.js). Referenzproben und Freimessungen stehen in der
     Tabelle gekennzeichnet und in eigenen Sätzen, im Zähl-Absatz zählen sie nicht. */
  const sb = s(fb.schadenbild), sbBloecke = sb.replace(/\s+/g, ' ') === SCHADENBILD_START.trim() ? [] : ftx(sb, '5.1', '#fbSchadenbild');
  // Vorbelegung stehen gelassen, darunter weitergeschrieben (z. B. nur ein Foto): der halbe Satz wird die Lücke
  if (sbBloecke[0] && sbBloecke[0].t === 'p' && G.text(sbBloecke[0].runs).trim() === SCHADENBILD_START.trim())
    sbBloecke[0] = { t: 'p', runs: [{ gap: '[Brandlast und Schadenbild beschreiben]' }] };
  const befund = [{ t: 'h2', runs: ['5.1 Brandlast und Schadenbild'] }, ...(sbBloecke.length ? sbBloecke : [{ t: 'p', runs: [{ gap: '[Brandlast und Schadenbild beschreiben]' }] }])];
  let unter = 1, tabNr = 0;
  const h2 = titel_ => befund.push({ t: 'h2', runs: [`5.${++unter} ${titel_}`] });
  const kuerzel = new Set();
  // Ergebniskarte in PlanKit (wie ResultKit planEinstellungen): Nutzung und angepasste VdS-Skalen – nur für Hinweise
  const planUsage = s(e.planSkalen && e.planSkalen.usage), planVds = (e.planSkalen && Array.isArray(e.planSkalen.vds) ? e.planSkalen.vds : []).map(s);
  const stelle = roh => { const r = raumAusschreiben(roh); r.ersetzt.forEach(k => kuerzel.add(k)); return r.text; };
  [...clErg, ...pakErg].forEach(x => { x.stelle = stelle(x.roh); });
  proben.forEach(p => { p.stelleBericht = stelle(p.stelle); });
  // Bildunterschrift ohne Punkt am Ende – wie die Fotos der Freitextfelder und die echten Brandberichte („Abb. 2: EG, Küche“)
  if (fotoSatz) pr.push({ t: 'p', runs: [fotoSatz] });
  mitFoto.forEach(p => pr.push({ t: 'fig', label: p.label, datei: p.foto,
    caption: `Abb. ${p.abb}: ${p.material || p.ref}${p.stelleBericht ? ', ' + p.stelleBericht : ''}` }));
  const mitTabellen = !!fb.tabellen;
  const rolleZusatz = x => (x.rolle === 'referenz' ? ' (Referenz)' : x.rolle === 'frei' ? ' (Freimessung)' : '');
  /** Einzelergebnisse: Tabelle (Haken) oder Verweis auf den Prüfbericht */
  const tabelleOderVerweis = (xs, runs, tab) => {
    if (mitTabellen) { tab.caption = `Tabelle ${++tabNr}: ${tab.caption}`; runs.push(` Die Ergebnisse sind in Tabelle ${tabNr} zusammengefasst.`); return tab; }
    const nrs = [...new Set(xs.map(x => x.bericht).filter(Boolean))], anl = anlNr(nrs);
    runs.push(` Die Einzelergebnisse sind ${nrs.length > 1 ? 'den Prüfberichten' : 'dem Prüfbericht'}${anl ? ' ' + anl : ''} zu entnehmen.`);
    return null;
  };
  /** Wert-Spalte: Einheit im Kopf, wenn alle gleich – sonst je Zelle */
  const einheitVon = xs => { const u = [...new Set(xs.map(x => x.w.u))]; return u.length === 1 ? u[0] : ''; };
  /** Referenzproben / Freimessungen: eigener Satz je Rolle */
  const rollenSaetze = xs => [['referenz', 'Die Referenzprobe', 'Die Referenzproben'], ['frei', 'Die Freimessung', 'Die Freimessungen']].flatMap(([r, eins, mehr]) => {
    const ys = xs.filter(x => x.rolle === r); if (!ys.length) return [];
    return [ys.length === 1 ? ` ${eins} (Probe ${nrText(ys)}) ergab ${wertText(ys[0].w).replace(/\.$/, '')}.` : ` ${mehr} ergaben ${liste(ys.map(y => `${wertText(y.w)} (Probe ${nrText([y])})`))}.`];
  });
  /** Spanne „zwischen … und …“ über die gemessenen Werte, verglichen in einer gemeinsamen Einheit (faktor), genannt wie im
      Prüfbericht. Gibt es Werte < BG / n. n., heißt es „Die oberhalb der Bestimmungsgrenze ermittelten …“ (der < BG-Satz folgt).
      Ist ein Wert weder vergleichbar noch < BG (z. B. „1.250“), entfällt der Satz – sonst stimmte die Spanne womöglich nicht. */
  const spanne = (xs, nomen, faktor) => {
    if (xs.some(x => !Number.isFinite(zahl(x, faktor)) && !BW.ohneNachweis(x.w.r))) return '';
    const g = xs.filter(x => Number.isFinite(zahl(x, faktor))); if (g.length < 2) return '';
    const lo = g.reduce((a, b) => (zahl(b, faktor) < zahl(a, faktor) ? b : a)), hi = g.reduce((a, b) => (zahl(b, faktor) > zahl(a, faktor) ? b : a));
    if (zahl(lo, faktor) === zahl(hi, faktor)) return '';
    const wer = `${g.length < xs.length ? 'Die oberhalb der Bestimmungsgrenze ermittelten' : 'Die ermittelten'} ${nomen}`;
    return lo.w.u === hi.w.u ? `${wer} liegen zwischen ${lo.w.r} und ${hi.w.r}${hi.w.u ? ' ' + hi.w.u : ''}. ` : `${wer} liegen zwischen ${wertText(lo.w)} und ${wertText(hi.w)}. `;
  };
  const hoechster = (xs, faktor) => { const g = xs.filter(x => Number.isFinite(zahl(x, faktor))); return g.length ? g.reduce((a, b) => (zahl(b, faktor) > zahl(a, faktor) ? b : a)) : null; };
  /** Material-, Bohrmehl- oder weitere Proben mit Chlorid- bzw. PAK-Wert: je Art ein Satz mit den Werten, Bewertung als Lücke
      (das Doc nennt dafür keine Einordnung). luecken = { material, bohrmehl, probe } → Lückentext je Art */
  const materialSaetze = (xs, zus, groesse, groessen, luecken_) => {
    const art = x => (x.lk && x.lk.bohrmehl ? 'bohrmehl' : x.lk && x.lk.liste !== 'sonstige' ? 'material' : 'probe');
    return ['material', 'bohrmehl', 'probe'].map(a => [a, xs.filter(x => art(x) === a)]).filter(([, ys]) => ys.length).map(([a, ys], i) => {
      const [eins, mehr] = { bohrmehl: ['Bohrmehlprobe', 'Bohrmehlproben'], material: ['Materialprobe', 'Materialproben'], probe: ['weiteren Probe', 'weiteren Proben'] }[a];
      const z = zus || i > 0;
      const r = ys.length === 1 ? (z ? `Zusätzlich wurde an der ${eins} ${ortKlammer(ys[0])} ein ${groesse} von ${wertText(ys[0].w)} ermittelt.`
        : `An der ${eins} ${ortKlammer(ys[0])} wurde ein ${groesse} von ${wertText(ys[0].w)} ermittelt.`)
        : `${z ? `Zusätzlich wurden an den ${mehr}` : `An den ${mehr} wurden`} folgende ${groessen} ermittelt: ${liste(ys.map(x => `${wertText(x.w)} ${ortKlammer(x)}`))}.`;
      return { t: 'p', runs: [r, ' ', { gap: luecken_[a] }] };
    });
  };
  const nichtBewertbar = (x, was, wo) => hinweise.push(`Probe ${x.nr != null ? x.nr : x.label}: ${was} „${wertText(x.w)}“ nicht einzuordnen (Wert oder Einheit) – in ${wo} nicht mitgezählt, bitte im Prüfbericht prüfen.`);
  const ohneErgebnis = (lkListe, erg, was, wo) => {
    const fehlt = lkListe.filter(p => !erg.some(x => x.label === 'P' + (p._nr != null && p._nr !== '' ? +p._nr : +p.id)));
    if (fehlt.length && erg.length) hinweise.push(`${was}: noch kein Ergebnis für ${fehlt.map(p => 'P' + (p._nr != null && p._nr !== '' ? p._nr : p.id)).join(', ')} – in ${wo} nicht berücksichtigt.`);
  };

  /* 5.2 Korrosionsschäden (Chlorid) */
  const clW = clErg.filter(x => x.wisch), clM = clErg.filter(x => !x.wisch);
  if (clErg.length) {
    h2('Korrosionsschäden');
    let abschluss = null;   // A/B steht am Ende von 5.2, hinter den Material-/Bohrmehlproben
    const nr52 = `5.${unter}`;
    ohneErgebnis(lk.clWisch, clW, 'Chlorid', nr52);
    if (clW.length) {
      befund.push({ t: 'p', runs: ['Abhängig von Material und Umgebungsbedingungen ist ab Chloridflächenbelastungen in der Größenordnung von 5 bis 10 µg/cm² (korrosionschemisch relevante Größenordnung nach VdS 2357) davon auszugehen, dass beschleunigte Korrosionsvorgänge einsetzen und fortschreiten.'] });
      clW.forEach(x => { x.stufe = BW.chloridStufe(x.w); });
      if (planVds.some(k => CHLORID.test(k))) hinweise.push(`${nr52}: In PlanKit ist für Chlorid eine eigene Skala eingestellt – der Bericht ordnet nach VdS 2357 (5–10 µg/cm²) ein, die Ergebniskarte nach der PlanKit-Skala. Bitte prüfen.`);
      const reg = clW.filter(x => !x.rolle), bew = reg.filter(x => x.stufe >= 0);
      reg.filter(x => x.stufe < 0).forEach(x => nichtBewertbar(x, 'Chlorid', nr52));
      const r = [];
      const CLF = BW.chloridEinheit;
      // regulär, aber keine einzige einzuordnen (Einheit je Probe, „1.250“ …): Zähl-Absatz und höchster Wert fehlen sonst still
      if (reg.length && !bew.length) r.push({ gap: '[Einordnung der Chlorid-Wischproben ergänzen]' });
      if (bew.length === 1) {
        const x = bew[0];
        r.push(`Die Chlorid-Wischprobe ${ortKlammer(x)} ergab ${wertText(x.w)} und liegt damit ${CL_STUFE[x.stufe]} ${CL_GROESSE}.`);
      } else if (bew.length > 1) {
        r.push(spanne(reg, 'Chloridflächenbelastungen', CLF));   // alle regulären: ein unklarer Wert („1.250“) kann außerhalb liegen
        const gr = [2, 1, 0].map(i => bew.filter(x => x.stufe === i));
        const voll = gr.filter(g => g.length);
        if (voll.length === 1) r.push(`${alleN(bew.length)} Chlorid-Wischproben liegen ${CL_STUFE[voll[0][0].stufe]} ${CL_GROESSE}.`);
        else {
          const teile = []; let genannt = false;
          if (gr[0].length) { teile.push(`${zahlwort(gr[0].length)} oberhalb ${CL_GROESSE} (${probe(gr[0])})`); genannt = true; }
          if (gr[1].length) teile.push(`${zahlwort(gr[1].length)} ${genannt ? 'in diesem Bereich' : `im Bereich ${CL_GROESSE}`} (${probe(gr[1])})`);
          if (gr[2].length) teile.push(`${zahlwort(gr[2].length)} darunter`);
          r.push(`Von den ${zahlwort(bew.length)} Chlorid-Wischproben ${voll[0].length === 1 ? 'liegt' : 'liegen'} ${liste(teile)}.`);
        }
        const hi = hoechster(bew, CLF);
        if (hi) r.push(` Die höchste Belastung wurde mit ${wertText(hi.w)} in Probe ${nrText([hi])}${hi.stelle ? ` (${hi.stelle})` : ''} festgestellt.`);
        const nn = bew.filter(x => BW.ohneNachweis(x.w.r));
        if (nn.length === bew.length) r.push(` In keiner der ${zahlwort(bew.length)} Chlorid-Wischproben war Chlorid oberhalb der Bestimmungsgrenze nachweisbar.`);
        else if (nn.length) r.push(` Bei ${nn.length === 1 ? 'Probe' : 'den Proben'} ${nrText(nn)} lag der Chloridgehalt unterhalb der Bestimmungsgrenze.`);
      }
      r.push(...rollenSaetze(clW));
      const u = einheitVon(clW);
      const tab = tabelleOderVerweis(clW, r, { t: 'tab', caption: clW.length === 1 ? 'Chlorid-Wischprobe' : 'Chlorid-Wischproben',
        kopf: ['Probe', 'Labor-Nr.', 'Entnahmestelle', u ? `Chlorid [${u}]` : 'Chlorid', 'Einordnung'], ausrichtung: ['center', 'center', 'left', 'center', 'left'],
        spalten: SPALTEN_ERG, ohneUmbruch: [1],
        zeilen: clW.map(x => [`${x.nr != null ? x.nr : x.label}${rolleZusatz(x)}`, x.labNr, x.stelle, u ? x.w.r : wertText(x.w), x.stufe >= 0 ? CL_STUFE[x.stufe] : '–']) });
      const runs = fuegen(r); if (runs.length) befund.push({ t: 'p', runs });
      if (tab) befund.push(tab);
      /* Abschluss nur aus den regulären, eingeordneten Proben (ohne Referenz/Freimessung):
         B, sobald eine im Bereich oder darüber liegt · A, wenn alle regulären eingeordnet und unterhalb sind ·
         sonst (keine regulären, oder eine nicht einzuordnen und keine darüber) → Lücke, statt einen Schluss zu behaupten */
      const varianteB = bew.some(x => x.stufe > 0), varianteA = !varianteB && reg.length > 0 && bew.length === reg.length;
      if (varianteA) abschluss = { t: 'p', runs: ['Eine korrosionschemisch relevante Chloridbelastung liegt nicht vor.'] };
      // „Untersuchungsbericht“ hat keine Sanierungsmaßnahmen – vorläufige Formulierung wie in 7. (bis Basti einen Wortlaut gibt)
      else if (varianteB) abschluss = ({ t: 'p', runs: [sanierung ? 'Nach fachgerechter Durchführung der unter 6. angegebenen Sanierungsmaßnahmen ist davon auszugehen, dass die nachgewiesenen Chloridflächenbelastungen unter die korrosionschemisch relevante Größenordnung reduziert werden.'
        : 'Nach fachgerechter Durchführung von Sanierungsarbeiten ist davon auszugehen, dass die nachgewiesenen Chloridflächenbelastungen unter die korrosionschemisch relevante Größenordnung reduziert werden.'] });
      else {
        abschluss = { t: 'p', runs: [{ gap: '[Abschluss Chlorid ergänzen]' }] };
        hinweise.push(`${nr52}: ${reg.length ? 'nicht alle Chlorid-Wischproben einzuordnen' : 'nur Referenzproben/Freimessungen'} – Abschluss (Variante A/B) bitte in Word ergänzen.`);
      }
    }
    if (clM.length) befund.push(...materialSaetze(clM, clW.length > 0, 'Chloridgehalt', 'Chloridgehalte', { material: '[Bewertung der Chlorid-Materialproben ergänzen]',
      bohrmehl: '[Bewertung der Chlorid-Bohrmehlproben ergänzen]', probe: '[Bewertung der weiteren Chlorid-Proben ergänzen]' }));
    if (abschluss) befund.push(abschluss);
  }

  /* 5.3 Organische Schadstoffe (PAK) */
  const pakW = pakErg.filter(x => x.wisch), pakM = pakErg.filter(x => !x.wisch);
  const R = fb.referenz === '10' ? 10 : fb.referenz === '100' ? 100 : 0;
  if (pakErg.length) {
    h2('Organische Schadstoffe');
    const nr53 = `5.${unter}`;
    ohneErgebnis(lk.pakWisch, pakW, 'PAK', nr53);
    befund.push({ t: 'p', runs: ['Schädliche organische Verbindungen können als Nebenprodukte bei der unvollständigen Verbrennung aller organischen Materialien, wie z. B. Kunststoffe, Textilien, insbesondere Holz oder Papier, gebildet werden. Einige Vertreter dieser Verbindungsklasse sind als gesundheitsgefährdend einzustufen. Erfahrungsgemäß ist die Untersuchung auf polycyclische aromatische Kohlenwasserstoffe (PAK) geeignet, das gesamte organische Schadstoffpotential abzuschätzen.'] });
    if (pakW.length) {
      befund.push({ t: 'p', runs: [`Gemäß Richtlinien zur Brandschadensanierung, VdS Schadenverhütung im Gesamtverband der Deutschen Versicherungswirtschaft e. V. (GDV), VdS 2357:2014-06, ist die Größenordnung der Hintergrundbelastung bei brandgasbeaufschlagten Oberflächen als Sanierungszielwert anzustreben bzw. zu unterschreiten.`] });
      const refLuecke = { gap: '[Hintergrundreferenz 10 oder 100 µg/m²]' };
      befund.push({ t: 'p', runs: ['Erfahrungsgemäß liegt die Hintergrundbelastung in Wohn- und Bürobereichen, die einer turnusgemäßen Reinigung unterzogen werden, in einer Größenordnung von ca. 10 µg/m² für die Summe der 16 PAK nach EPA; in Gewerbe- und Industriebereichen können auch höhere Werte von ca. 100 µg/m² vorliegen. ',
        R ? `Für das vorliegende Objekt wird die Hintergrundreferenz von ca. ${R} µg/m² herangezogen.` : refLuecke, ...(s(fb.referenzGrund) ? [' ' + s(fb.referenzGrund)] : [])] });
      if (!R) hinweise.push(`Hintergrundreferenz PAK fehlt (Nutzung ${P.nutzung ? `„${P.nutzung}“ ohne Zuordnung` : 'in der Projektzentrale nicht eingetragen'}) – unter „Befund & Texte“ 10 oder 100 µg/m² wählen.`);
      const rv = referenzVorgabe(P.nutzung);
      if (R && rv && String(R) !== rv && !s(fb.referenzGrund)) hinweise.push(`Hintergrundreferenz ${R} µg/m² weicht von der Nutzung „${P.nutzung}“ (${rv} µg/m²) ab – Begründung unter „Befund & Texte“ ergänzen?`);
      pakW.forEach(x => { x.stufe = R ? BW.pakStufe(x.w, R) : -1; });
      if (planVds.some(k => SUMME_PAK.test(k))) hinweise.push(`${nr53}: In PlanKit ist für Σ 16 EPA-PAK eine eigene Skala eingestellt – der Bericht ordnet nach der Hintergrundreferenz ein, die Ergebniskarte nach der PlanKit-Skala. Bitte prüfen.`);
      const planR = planUsage === 'residential' ? 10 : planUsage === 'industrial' ? 100 : 0;
      if (R && planR && R !== planR) hinweise.push(`${nr53}: Hintergrundreferenz ${R} µg/m², in PlanKit ist für die Ergebniskarte „${planR === 10 ? 'Wohnen/Büro' : 'Gewerbe/Industrie'}“ (${planR} µg/m²) eingestellt – Bericht und Karte ordnen sonst verschieden ein.`);
      const reg = pakW.filter(x => !x.rolle), bew = R ? reg.filter(x => x.stufe >= 0) : reg;
      if (R) reg.filter(x => x.stufe < 0).forEach(x => nichtBewertbar(x, 'Σ 16 EPA-PAK', nr53));
      const r = [];
      const ref = `die Hintergrundreferenz von ca. ${R} µg/m²`, PF = BW.pakEinheit;
      if (R && reg.length && !bew.length) r.push({ gap: '[Einordnung der PAK-Wischproben ergänzen]' });
      if (bew.length === 1 && R) {
        const x = bew[0];
        r.push(`Die PAK-Wischprobe ${ortKlammer(x)} ergab einen Summenwert von ${wertText(x.w)} und ${x.stufe ? `erreicht oder überschreitet damit ${ref}` : `liegt damit unterhalb der Hintergrundreferenz von ca. ${R} µg/m²`}.`);
      } else if (bew.length) {
        r.push(spanne(reg, 'Summenwerte (16 EPA-PAK)', PF));
        if (!R) r.push(refLuecke, ' ');
        else {
          const ueber = bew.filter(x => x.stufe === 1), drunter = bew.filter(x => x.stufe === 0);
          if (!drunter.length) r.push(`${alleN(bew.length)} PAK-Wischproben erreichen oder überschreiten ${ref}. `);
          else if (!ueber.length) r.push(`${alleN(bew.length)} PAK-Wischproben liegen unterhalb der Hintergrundreferenz von ca. ${R} µg/m². `);
          else r.push(`Von den ${zahlwort(bew.length)} PAK-Wischproben ${ueber.length === 1 ? 'erreicht oder überschreitet eine' : `erreichen oder überschreiten ${zahlwort(ueber.length)}`} ${ref} (${probe(ueber)}); ${drunter.length === 1 ? 'eine liegt' : `${zahlwort(drunter.length)} liegen`} darunter. `);
        }
        const hi = hoechster(bew, PF);
        if (hi && bew.length > 1) r.push(`Der höchste Summenwert wurde mit ${wertText(hi.w)} in Probe ${nrText([hi])}${hi.stelle ? ` (${hi.stelle})` : ''} festgestellt.`);
        else if (hi) r.push(`Die PAK-Wischprobe ${ortKlammer(hi)} ergab einen Summenwert von ${wertText(hi.w)}.`);
        const nn = bew.filter(x => BW.ohneNachweis(x.w.r));
        // Befunde Nr. 6 (26.0527): „Bei den übrigen Proben (P2, P6 bis P8) waren keine …“ – hier ohne „übrigen“, weil nicht alle anderen vorher genannt sind
        if (bew.length > 1 && nn.length === bew.length) r.push(` In keiner der ${zahlwort(bew.length)} PAK-Wischproben war eine der untersuchten PAK-Einzelverbindungen oberhalb der Bestimmungsgrenze nachweisbar.`);
        else if (bew.length > 1 && nn.length) r.push(` Bei ${nn.length === 1 ? 'Probe' : 'den Proben'} ${nrText(nn)} ${nn.length === 1 ? 'war keine' : 'waren keine'} der untersuchten PAK-Einzelverbindungen oberhalb der Bestimmungsgrenze nachweisbar.`);
      }
      r.push(...rollenSaetze(pakW));
      const u = einheitVon(pakW);
      const tab = tabelleOderVerweis(pakW, r, { t: 'tab', caption: pakW.length === 1 ? 'PAK-Wischprobe' : 'PAK-Wischproben',
        kopf: ['Probe', 'Labor-Nr.', 'Entnahmestelle', u ? `Σ 16 EPA-PAK [${u}]` : 'Σ 16 EPA-PAK', 'Einordnung'], ausrichtung: ['center', 'center', 'left', 'center', 'left'],
        spalten: SPALTEN_ERG, ohneUmbruch: [1],
        zeilen: pakW.map(x => [`${x.nr != null ? x.nr : x.label}${rolleZusatz(x)}`, x.labNr, x.stelle, u ? x.w.r : wertText(x.w), x.stufe >= 0 ? PAK_STUFE[x.stufe] : '–']) });
      const runs = fuegen(r); if (runs.length) befund.push({ t: 'p', runs });
      if (tab) befund.push(tab);
    }
    if (pakM.length) befund.push(...materialSaetze(pakM, pakW.length > 0, 'Summenwert (16 EPA-PAK)', 'Summenwerte (16 EPA-PAK)', { material: '[Bewertung der PAK-Materialproben ergänzen]',
      bohrmehl: '[Bewertung der PAK-Bohrmehlproben ergänzen]', probe: '[Bewertung der weiteren PAK-Proben ergänzen]' }));
    befund.push({ t: 'p', runs: [`Die beim Brand gebildeten organischen Schadstoffe sind adsorptiv sehr stark an den Ruß gebunden. Mit Entfernung der schadensbedingten Verunreinigungen werden somit auch zwangsläufig die gebildeten Schadstoffe entfernt, so dass nach ordnungsgemäßer Durchführung ${sanierung ? 'der angegebenen Sanierungsmaßnahmen' : 'von Sanierungsarbeiten'} keine Gesundheitsgefährdung durch Brandkondensate gegeben ist.`] });
  }

  /* 5.4 Künstliche Mineralfaserwolle – Texte wie im Asbestbericht (TRGS 905, Fassung 2026) */
  if (kmf.length) {
    h2('Künstliche Mineralfaserwolle');
    kmf.forEach(p => befund.push({ t: 'p', runs: [`In der Dämmstoffprobe ${p.nr || PNR(p.ref) || p.ref || p.label}${p.stelleBericht ? ` (${p.stelleBericht})` : ''} wurden ${p.whoNachgewiesen ? '' : 'keine '}WHO-Fasern${p.whoNachgewiesen ? ' (lungengängige Fasern)' : ''} nachgewiesen. `,
      'Der Prüfbericht weist einen Kanzerogenitätsindex von KI = ', L(p.ki, 'KI-Wert'), ' aus.'] }));
    if (kmf.some(p => p.whoNachgewiesen)) befund.push({ t: 'p', runs: ['Nach der seit 05.06.2026 geltenden Fassung der TRGS 905 werden WHO-Fasern nicht mehr über den Kanzerogenitätsindex, ',
      'sondern nach den Kategorien für krebserzeugende Stoffe in Anhang I der CLP-Verordnung bewertet. Der KI-Wert wird daher nur ergänzend angegeben.'] });
  }

  /* 5.5 Asbest – Befund-Logik wie im Asbestbericht, Methode VDI 3866 Blatt 5 (Anhang B aus der Nachweisgrenze), Tabelle immer */
  if (asb.length) {
    h2('Asbest');
    const anB = asb.filter(p => BW.anhangB(werteVon(e.erg, p)) === true);
    asb.forEach(p => {
      const b = BW.anhangB(werteVon(e.erg, p));
      // positiv schon bei 1 % / 0,1 %: Anhang B ist dann nicht nötig – nur negative Ergebnisse prüfen
      const nwgRoh = werteVon(e.erg, p).filter(w => w && BW.ASBEST.test(s(w.p)) && !/^[-–—]?$/.test(s(w.r))).map(w => s(w.nwg)).filter(Boolean);
      if (b === null && nwgRoh.length) hinweise.push(`${p.ref || p.label}: Nachweisgrenze „${nwgRoh[0]}“ nicht lesbar – ob Anhang B angewendet wurde, bitte im Prüfbericht prüfen.`);
      if (b === false && !p.befund.gefunden && BW.matrixErwartetAnhangB(p.matrix)) hinweise.push(`${p.ref || p.label}: Matrix „${p.matrix}“ wird meist nach VDI 3866 Blatt 5 Anhang B untersucht, der Prüfbericht nennt dafür keine Nachweisgrenze von 0,001 % – bitte prüfen.`);
    });
    const eine = asb.length === 1, rPos = asb.filter(p => p.befund.gefunden), rNeg = asb.filter(p => !p.befund.gefunden && p.befund.eindeutig), rUnklar = asb.filter(p => !p.befund.eindeutig);
    const methode = eine ? `Die Materialprobe wurde gemäß VDI 3866 Blatt 5${anB.length ? ' unter Anwendung des Verfahrens nach Anhang B' : ''} auf Asbest untersucht.`
      : anB.length === asb.length ? 'Die Materialproben wurden gemäß VDI 3866 Blatt 5 unter Anwendung des Verfahrens nach Anhang B auf Asbest untersucht.'
      : `Die Materialproben wurden gemäß VDI 3866 Blatt 5 auf Asbest untersucht${anB.length ? `, bei ${probe(anB.map(p => ({ nr: p.nr, ref: p.ref, label: p.label })))} unter Anwendung des Verfahrens nach Anhang B` : ''}.`;
    tabNr++;
    befund.push({ t: 'p', runs: [methode, ` ${eine ? 'Das Ergebnis ist' : 'Die Ergebnisse sind'} in Tabelle ${tabNr} zusammengefasst.`] });
    const mat = p => ['„', L(p.material, 'Material'), '“'];
    if (!rPos.length && !rUnklar.length) befund.push({ t: 'p', runs: [eine ? 'In der Materialprobe wurde kein Asbest nachgewiesen.' : `In keiner der ${zahlwort(asb.length)} Materialproben wurde Asbest nachgewiesen.`] });
    else {
      rPos.forEach(p => befund.push({ t: 'p', runs: [`In ${p.ref || 'Probe ' + p.nr} (Material: `, ...mat(p), `) wurde Asbest nachgewiesen: ${p.befund.text}.`] }));
      rUnklar.forEach(p => befund.push({ t: 'p', runs: [`Für ${p.ref || 'Probe ' + p.nr} (Material: `, ...mat(p), `) weist der Prüfbericht aus: ${p.befund.text}. `, { gap: '[Schlussfolgerung für nicht eindeutige Ergebnisse ergänzen]' }] }));
      if (rNeg.length) befund.push({ t: 'p', runs: [rNeg.length === 1 ? 'In der übrigen Probe wurde kein Asbest nachgewiesen.' : 'In den übrigen Proben wurde kein Asbest nachgewiesen.'] });
    }
    befund.push({ t: 'tab', caption: `Tabelle ${tabNr}: ${eine ? 'Materialprobe und Ergebnis' : 'Materialproben und Ergebnisse'} (Asbest)`,
      kopf: ['Probe', 'Labor-Nr.', 'Entnahmestelle', 'Material', 'Ergebnis'], ausrichtung: ['center', 'center', 'left', 'left', 'left'],
      spalten: SPALTEN_TAB1, ohneUmbruch: [1],
      zeilen: asb.map(p => [p.nr ? String(p.nr) : (p.ref || p.label), p.labNr, p.stelleBericht, p.material, p.befund.text]) });
  }

  /* 5.6 Sensorische Prüfung auf Brandgeruch – Ergebnis-Satz je Probe aus den Bewertungen p1–p5 (Nr. wie in der Anlage der
     Projektzentrale: Reihenfolge der LabelKit-Liste). Verdeckt (Blind-Modus) oder Bewertungen unvollständig → Lücke. */
  if (nBg) {
    h2('Sensorische Prüfung auf Brandgeruch');
    const alleBg = (e.lk && Array.isArray(e.lk.brandgeruchProben) ? e.lk.brandgeruchProben : []).map((p, i) => ({ p, nr: i + 1 })).filter(x => x.p && !istStorniert(x.p));
    // Wortlaut Methode/Schluss vorläufig (nur Bruchstücke aus 26.0527 bekannt) – Basti bestätigt beim Testlauf
    befund.push({ t: 'p', runs: [`${nBg === 1 ? 'Die Materialprobe wurde' : `Die ${zahlwort(nBg)} Materialproben wurden`} in einem geschlossenen Luftraum auf 50 °C konditioniert und anschließend durch fünf Prüfpersonen unabhängig voneinander sensorisch auf Brandgeruch geprüft. Bewertet wurde in den Stufen stark (++), mittel (+), schwach ((+)) und ohne Brandgeruch (–).`] });
    const unvollstaendig = alleBg.filter(x => BG_KEYS.some(k => !bgWert(x.p[k])));
    if (lk.bgBlind || unvollstaendig.length) {
      befund.push({ t: 'p', runs: [{ gap: '[Ergebnis der Brandgeruchprüfung ergänzen]' }] });
      if (!lk.bgBlind) hinweise.push(`Brandgeruch: Bewertungen fehlen oder sind unlesbar (${unvollstaendig.map(x => 'Probe ' + x.nr).join(', ')}) – in LabelKit alle fünf Bewertungen eintragen.`);
    } else {
      const saetze = alleBg.map(({ p, nr }) => {
        const n = BG_STUFEN.map(([k, wort]) => ({ wort, n: BG_KEYS.filter(key => bgWert(p[key]) === k).length })).filter(x => x.n);
        n.sort((a, b) => b.n - a.n);   // häufigste Bewertung zuerst, bei Gleichstand die stärkere (Reihenfolge BG_STUFEN, sort ist stabil)
        const teile = n.map(x => `von ${x.n === 5 ? 'allen fünf Prüfpersonen' : x.n === 1 ? 'einer Prüfperson' : `${zahlwort(x.n)} Prüfpersonen`} ${x.wort}`);
        const beschr = [s(p.z1), s(p.z2)].filter(Boolean).join(', ');
        return `Bei Probe ${nr}${beschr ? ` (${beschr})` : ''} wurde ${liste(teile)} Brandgeruch festgestellt.`;
      });
      befund.push({ t: 'p', runs: [saetze.join(' ')] });
    }
    befund.push({ t: 'p', runs: ['Die Einzelbewertungen der Prüfpersonen sind in Anlage ', A.nr.brandgeruch ? String(A.nr.brandgeruch) : { gap: '[Anlage-Nr. Brandgeruch]' }, ' dargestellt.'] });
  }

  /* 5.7 Weitere Untersuchungen (LabelKit „Sonstige“ ohne Chlorid-Bohrmehl): keine Einordnung im Doc – Verweis und Lücke */
  if (weitereErg.length) {
    h2('Weitere Untersuchungen');
    const params = [...new Set(weitereErg.map(x => x.lk.notiz).filter(Boolean))];
    const nrs = [...new Set(lp.filter(p => weitereErg.some(x => x.label === p.label)).map(p => p.bericht).filter(Boolean))];
    befund.push({ t: 'p', runs: [`Die Ergebnisse ${weitereErg.length === 1 ? 'der weiteren Probe' : 'der weiteren Proben'} (${probe(weitereErg)}${params.length ? '; ' + params.join('; ') : ''}) sind `,
      nrs.length > 1 ? 'den Prüfberichten ' : 'dem Prüfbericht ', nrListe(nrs), ` zu entnehmen ${anlNr(nrs)}. `, { gap: '[Bewertung der weiteren Untersuchungen ergänzen]' }] });
  }
  if (kuerzel.size) hinweise.push(`Entnahmestelle: Abkürzungen ausgeschrieben (${[...kuerzel].map(k => `${k} → ${RAUM_KUERZEL[k]}`).join(', ')}) – im Prüfbericht stehen die Kürzel; bitte prüfen.`);

  /* 6. Sanierungsmaßnahmen: Einleitungssatz, darunter je angehaktem Umfang ein Freitext – mehrere Haken → 6.1, 6.2 … (fortlaufend,
     feste Titel), ein Haken → ohne Unterabschnitt direkt unter dem Satz. Untersuchungsbericht: „6. Schlussfolgerungen“, ein Feld. */
  const leerOder = (bloecke, luecke) => (bloecke.length ? bloecke : [{ t: 'p', runs: [{ gap: luecke }] }]);
  const massnahmen = [];
  if (sanierung) {
    massnahmen.push({ t: 'p', runs: [EINLEITUNG_6] });
    const teile = SAN.filter(([k]) => fb.umfang && fb.umfang[k]);
    if (!teile.length) massnahmen.push({ t: 'p', runs: [{ gap: '[Sanierungsmaßnahmen ergänzen]' }] });
    teile.forEach(([, feld, titel_, luecke], i) => {
      if (teile.length > 1) massnahmen.push({ t: 'h2', runs: [`6.${i + 1} ${titel_}`] });
      massnahmen.push(...leerOder(ftx(fb[feld], `6. ${titel_}`, '#' + SAN_FELD[feld]), luecke));
    });
    SAN.filter(([k, feld]) => !(fb.umfang && fb.umfang[k]) && s(fb[feld])).forEach(([, , titel_]) =>
      hinweise.push(`Sanierungsmaßnahmen ${titel_}: Text eingetragen, aber „${titel_}“ ist unter Umfang nicht angehakt – steht nicht im Bericht.`));
  } else massnahmen.push(...leerOder(ftx(fb.schlussfolgerungen, '6. Schlussfolgerungen', '#fbSchluss'), '[Schlussfolgerungen ergänzen]'));
  // Titel umgestellt: Texte des anderen Titels bleiben gespeichert, stehen aber nicht im Bericht – sagen, statt still wegzulassen
  const fremd = sanierung ? (s(fb.schlussfolgerungen) ? ['6. Schlussfolgerungen'] : [])
    : [...SAN.filter(([, feld]) => s(fb[feld])).map(([, , t]) => `6. Sanierungsmaßnahmen ${t}`), ...(s(fb.zusammenfassung) ? ['8. Zusammenfassung'] : [])];
  if (fremd.length) hinweise.push(`${liste(fremd)}: Text eingetragen, gehört aber zum Titel „${sanierung ? 'Untersuchungsbericht' : 'Sanierungsvorschlag'}“ – steht nicht im Bericht.`);

  /* 7. Arbeitsschutzmaßnahmen: GB 0 eigener Satz (Befunde Nr. 10), GB 1–3 ein Satz mit der Nummer; KMF (TRGS 521) und Asbest (TRGS 519) */
  const gb = GB.includes(s(fb.gb)) ? s(fb.gb) : '', gb2 = GB.includes(s(fb.gb2)) ? s(fb.gb2) : '';
  /* Bereich (optional, z. B. „im Obergeschoss“) hinter „Sanierungsmaßnahmen“; ein zweiter Bereich mit eigenem Gefahrenbereich
     (26.0517: OG GB 1, EG GB 0) braucht beide Bereichsangaben – fehlt eine, steht sie als Lücke da. */
  const b1 = s(fb.bereich), b2 = s(fb.bereich2), zweiter = !!(b2 || gb2);
  const anhaengen = (runs, t) => { if (typeof runs[runs.length - 1] === 'string') runs[runs.length - 1] += t; else runs.push(t); return runs; };
  const gbSatz = (g, bereich, gbLuecke) => {
    // „Untersuchungsbericht“ hat keine Sanierungsmaßnahmen – vorläufige Formulierung, bis Basti einen Wortlaut gibt (PR #14)
    const bei = sanierung ? 'Bei Durchführung der oben angegebenen Sanierungsmaßnahmen' : bereich ? 'Bei Sanierungsarbeiten'
      : g === '0' ? 'Bei Sanierungsarbeiten' : 'Bei Sanierungsarbeiten in den untersuchten Bereichen';
    const runs = typeof bereich === 'string' ? [bereich ? `${bei} ${bereich}` : bei] : [bei + ' ', bereich];
    if (g === '0') {
      // mit Bereich „Die untersuchten Bereiche im Obergeschoss sind …“ – sonst widerspräche der Satz einem zweiten Bereich mit GB 1–3
      anhaengen(runs, ' sind aus chemischer Sicht keine über die üblichen Arbeitsschutzmaßnahmen hinausgehenden besonderen Schutzmaßnahmen gegen brandbedingte Schadstoffe erforderlich. Die untersuchten Bereiche');
      if (typeof bereich === 'string') anhaengen(runs, bereich ? ' ' + bereich : ''); else runs.push(' ', bereich);
      return { t: 'p', runs: anhaengen(runs, ` sind ${VDS}, dem Gefahrenbereich 0 (GB 0) zuzuordnen.`) };
    }
    anhaengen(runs, ' sind Arbeitsschutzmaßnahmen für den Gefahrenbereich ');
    if (g) anhaengen(runs, `${g} (GB ${g})`); else runs.push({ gap: gbLuecke });
    runs.push(` ${VDS}, vorzunehmen.`);
    return { t: 'p', runs };
  };
  const as = [gbSatz(gb, zweiter && !b1 ? { gap: '[Bereich eintragen]' } : b1, '[Gefahrenbereich wählen]')];
  if (zweiter) as.push(gbSatz(gb2, b2 || { gap: '[Zweiten Bereich eintragen]' }, '[Gefahrenbereich zweiter Bereich wählen]'));
  if (((gb && gb !== '0') || (gb2 && gb2 !== '0')) && fb.uebrige) as.push({ t: 'p', runs: [`Bei Arbeiten in den übrigen ${P.nutzung === 'Wohnen' ? 'Wohnungen' : 'Bereichen'} sind keine über den normalen Arbeitsschutz hinausgehenden Maßnahmen notwendig.`] });
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
  // Zusatz (optional, Befunde Nr. 10 – z. B. Belgien, TRGS 524) am Ende von 7.; leer → nichts
  as.push(...ftx(fb.zusatz, '7. Zusatz', '#fbZusatz'));
  /* 8. Zusammenfassung Sanierungsmaßnahmen (nur Sanierungsvorschlag): je Zeile „Bereich: Maßnahme“ → Aufzählung mit fettem Bereich */
  const zusammenfassung = sanierung ? leerOder(ftx(fb.zusammenfassung, '8. Zusammenfassung', '#fbZusammenfassung', { label: true }), '[Zusammenfassung der Sanierungsmaßnahmen ergänzen]') : [];

  /* Unterschriften und Anlagen */
  const { unterschriften, svQuelle } = unterschriftenBlock(e, f, { sv, pn, mt }, false, hinweise, hinweisAktionen);
  const { anlagenTeile, anlagen, anlagenDateien, anlagenListe } = anlagenAusgabe(A);
  prb.forEach(nr => { if (!pdfVon(nr)) hinweise.push(`Prüfbericht ${nr}: PDF nicht in „Laborergebnisse“ – für die Anlage bitte ablegen.`); });
  [...rk.vorlaeufig].filter(nr => (rk.cl.includes(nr) || rk.pak.includes(nr) || weitereNr.includes(nr)) && !asbNr.includes(nr))
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
    ...(sanierung ? [{ titel: '8. Zusammenfassung Sanierungsmaßnahmen', inhalt: zusammenfassung }] : []),
  ];
  const modell = {
    dateiname: `${+f.mitteilung || 1}._Mitteilung_${P.nr || 'Projekt'}.docx`,
    deckblatt: { titel, mitteilung, projektnummer: P.nr, betreff: schadenZeile, felder },
    kopf, kennzeilen, abschnitte, ortDatum: `Würselen, ${datum}`, unterschriften, versicherungsfall: vfall, anlagen, anlagenTeile, anlagenDateien, anlagenListe, anlagenZeilen: A.zeilen, proben, offen, storniert,
    hinweise: [...new Set(hinweise)], hinweisAktionen, sperren, probenehmerQuelle, versichererQuelle, svQuelle,
    annahmen: annahmenAus([['probenehmer', probenehmerQuelle], ['versicherer', versichererQuelle], ['sv', svQuelle]]),
    brand: { titel: titelArt, objektartVorgabe: objektart(P.nutzung), nutzung: P.nutzung, schadenereignis: P.schadenereignis, brandgut: P.brandgut,
      schadendatum: sd.art, ortstermin: ortstermin || '', probenahme: lkDaten,
      zahlen: { chlorid: nCl, pak: nPak, pakMaterial: nPakM, kmf: kmf.length, asbest: asb.length, brandgeruch: nBg, chloridAndere: nClM, bohrmehl: nBm, sonstige: lk.sonstige.length },
      // Formular: Ergebnistabellen nur mit Chlorid-/PAK-Wischproben, Hintergrundreferenz nur mit PAK-Wischproben (Ergebnisse oder LabelKit)
      mitWischErgebnis: clW.length + pakW.length > 0, mitPakWisch: pakW.length > 0 || nPak > 0, referenzVorgabe: referenzVorgabe(P.nutzung) },
  };
  modell.luecken = luecken(modell);
  // selbst geschriebene Lücken der Freitextfelder → Feld (bericht-luecken.js zuordnen); nur, was noch im Bericht steht
  modell.lueckenFelder = Object.fromEntries(Object.entries(lueckenFelder).filter(([g]) => modell.luecken.includes(g)));
  return modell;
}

const API = { VERSION: 1, art: 'brand', bericht, vorgabe, objektart, OBJEKTART, TITEL, referenzVorgabe, SPALTEN_ERG, nrText, SAN, FREITEXT, SCHADENBILD_START };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtBrand = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

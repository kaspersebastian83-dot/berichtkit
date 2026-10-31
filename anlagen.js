/* BerichtKit – Anlagen zum Bericht: erkennen, was im Projektordner liegt, und in fester Hausreihenfolge nummerieren.
   Ohne Browserteile (in Node testbar). Kennt nur Arten von Anlagen und wo die Apps sie ablegen – nichts über Asbest;
   welche Arten ein Bericht erwartet, sagt das Profil (PROFILE).
   Hausreihenfolge (Basti, 30.10.2026): Anlage 1 = Prüfbericht(e) (mehrere zählen hoch), dann Bilddokumentation, dann Probenplan.
   Ergebniskarte, Raumbuch, Wandansichten und die Word-„Anlage Probenahme“ aus PlanKit sind optional: gefunden und angeboten,
   aber nicht vorgehakt; angehakt bekommen sie die Nummern danach. Eine Anlage aus mehreren Dateien (Bilddoku in Teilen,
   Probenplan je Geschoss) ist eine Anlage. Veraltete Anlagen: Hinweis und nicht vorgehakt.
   Brandbericht (Profil „brand“, ab 1.12.0): nach dem Probenplan die Anlage „Sensorische Prüfung auf Brandgeruch“ aus der
   Projektzentrale (Anlage PN 98 / Brandgeruch in „Mitteilungen“) – fest nur, wenn LabelKit Brandgeruch-Proben hat. */
(function (root) {
'use strict';

const s = v => (v == null ? '' : String(v)).trim();
const nfc = v => s(v).normalize('NFC');
const TOLERANZ = 5000;   // ms – Dateizeiten verschiedener Programme/Rechner

/** Arten: titel = Zeile im Anlagenverzeichnis, app/link = wo sie entsteht */
const ARTEN = Object.freeze({
  pruefbericht:  { titel: 'Prüfbericht', app: 'ResultKit' },
  bilddoku:      { titel: 'Bilddokumentation', app: 'FotoKit', link: '../Bildumbenenner/', ziel: 'bildumbenenner' },
  probenplan:    { titel: 'Probenplan', app: 'PlanKit', link: '../Probenplan/', ziel: 'plankit' },
  ergebniskarte: { titel: 'Ergebniskarte', app: 'PlanKit', link: '../Probenplan/', ziel: 'plankit' },
  raumbuch:      { titel: 'Raumbuch', app: 'PlanKit', link: '../Probenplan/', ziel: 'plankit' },
  wandansichten: { titel: 'Wandansichten (Bohrkerne)', app: 'PlanKit', link: '../Probenplan/', ziel: 'plankit' },
  probenahme:    { titel: 'Probenahme und Laborergebnisse (PlanKit)', app: 'PlanKit', link: '../Probenplan/', ziel: 'plankit' },
  brandgeruch:   { titel: 'Sensorische Prüfung auf Brandgeruch', app: 'Projektzentrale', link: '../Projektzentrale/', ziel: 'projektzentrale' },
  sonstiges:     { titel: 'Anlage' },
});
/** fest: in dieser Reihenfolge nach den Prüfberichten, vorgehakt wenn gefunden und aktuell; optional: danach, nie vorgehakt */
const PROFILE = Object.freeze({
  asbest: { fest: ['bilddoku', 'probenplan'], optional: ['ergebniskarte', 'raumbuch', 'wandansichten', 'probenahme'] },
  // Brandbericht: Prüfberichte (Chlorid, PAK, Asbest/KMF – Reihenfolge gibt der Bericht vor), Bilddokumentation, Probenplan, Brandgeruch
  brand: { fest: ['bilddoku', 'probenplan', 'brandgeruch'], optional: ['ergebniskarte', 'raumbuch', 'wandansichten', 'probenahme'] },
});

/* ---------- Erkennen ----------
   eingabe = { ordnerName, fotos:[{name,t}] (Fotos/), plaene:[{name,t}] (Pläne/), mitteilungen:[{name,t}] (Mitteilungen/),
               protokoll: Text von _Anlagen-Protokoll.txt | null, fk: _Bildumbenenner.json | null, plan: {name,t,sha} | null (.probenplan),
               labelkit: {name,t,sha} | null (LabelKit-Datei des Berichts – Stand der Brandgeruch-Anlage) }
   Ergebnis: { <art>: { art, dateien:['Fotos/…'], t, key, veraltet:true|false|null, grund, unvollstaendig, nrImDokument, nrQuelle, details } } */
const TEIL = /[_ -]+Teil[_ ](\d+)[_ ]von[_ ](\d+)(?=\.pdf$)/i;
const KOPIE = / \((\d+)\)(?=\.[a-z]+$)/i;
const zeit = v => { const t = Date.parse(s(v)); return Number.isFinite(t) ? t : null; };
/** Schlüssel für die eigene Wahl: Dateien + Stand – eine neu erzeugte Fassung unter gleichem Namen gilt als neue Anlage */
const schluessel = (dateien, t) => dateien.join('|') + '@' + (+t || 0);
const anlageNr = v => { const m = /(\d+)/.exec(s(v)); return m ? +m[1] : null; };

/** Bilddokumentation aus FotoKit: Fotos/Bilddokumentation_<Nr>_<Ort>_<Datum>[ (k)][_Teil_i_von_n].pdf (ältere: „… - Teil 1 von 2.pdf“);
    über das ZIP für eine KI erstellt: <Projektnummer>_<Anlage>_Bilddokumentation[_Teil_i_von_n].pdf */
const BILDDOKU = /^Bilddokumentation(?![a-zäöüß]).*\.pdf$|[_ ]Bilddokumentation(?:[_ -]+Teil[_ ]\d+[_ ]von[_ ]\d+)?\.pdf$/i;
function bilddokuFinden(fotos, fk) {
  const gruppen = new Map();
  for (const f of fotos || []) {
    const name = nfc(f.name); if (!BILDDOKU.test(name)) continue;
    const m = TEIL.exec(name), key = name.replace(TEIL, '').toLowerCase();
    const g = gruppen.get(key) || { teile: new Map(), n: 0, t: 0 }; gruppen.set(key, g);
    const i = m ? +m[1] : 1, n = m ? +m[2] : 1;
    g.n = Math.max(g.n, n); g.teile.set(i, name); g.t = Math.max(g.t, +f.t || 0);
  }
  if (!gruppen.size) return null;
  const vollstaendig = g => g.teile.size === g.n && [...Array(g.n)].every((_, k) => g.teile.has(k + 1));
  const dateienVon = g => [...g.teile.entries()].sort((a, b) => a[0] - b[0]).map(x => 'Fotos/' + x[1]);
  const vermerkt = fk && fk.bilddoku && Array.isArray(fk.bilddoku.dateien) ? fk.bilddoku.dateien.map(nfc) : [];
  const vorhanden = new Set((fotos || []).map(f => nfc(f.name).toLowerCase()));
  let g = null, aufgezeichnet = false;
  if (vermerkt.length && vermerkt.every(n => vorhanden.has(n.toLowerCase()))) {
    g = gruppen.get(vermerkt[0].replace(TEIL, '').toLowerCase()) || null; aufgezeichnet = !!g;
  }
  if (!g) g = [...gruppen.values()].sort((a, b) => b.t - a.t)[0];
  const dateien = dateienVon(g), k = { art: 'bilddoku', dateien, t: g.t, key: schluessel(dateien, g.t), veraltet: null, grund: '', unvollstaendig: false, nrImDokument: null, nrQuelle: '', details: g.n > 1 ? `${g.n} Teile` : '' };
  if (!vollstaendig(g)) { k.unvollstaendig = true; k.grund = `Teil fehlt – gefunden ${g.teile.size} von ${g.n}`; }
  // Stand: FotoKit (ab 1.29) vermerkt die erzeugte PDF (bilddoku.erstellt) und wann sich die Inhalte der Doku zuletzt geändert haben (dokuGeaendert)
  const geaendert = zeit(fk && fk.dokuGeaendert);
  if (aufgezeichnet) {
    const erstellt = zeit(fk.bilddoku.erstellt) || g.t;
    if (geaendert != null) { k.veraltet = geaendert > erstellt; if (k.veraltet) k.grund = k.grund || 'nach dem Erstellen in FotoKit geändert (Beschreibungen, Auswahl, Reihenfolge oder Projektdaten)'; }
    if (s(fk.bilddoku.anlage)) { k.nrImDokument = anlageNr(fk.bilddoku.anlage); k.nrQuelle = s(fk.bilddoku.anlage); }
  } else if (geaendert != null) {
    k.veraltet = geaendert > g.t + TOLERANZ; if (k.veraltet) k.grund = k.grund || 'älter als die letzte Änderung in FotoKit';
  } else if (!k.unvollstaendig) k.grund = 'Stand nicht prüfbar (mit FotoKit vor 1.29 erstellt)';
  if (k.nrImDokument == null && fk && fk.projekt && s(fk.projekt.anlage)) { k.nrImDokument = anlageNr(fk.projekt.anlage); k.nrQuelle = s(fk.projekt.anlage); }
  return k;
}

/** Plan-PDFs aus PlanKit: Pläne/Probenplan <Ordner>[ - <Geschoss>][ - Ergebniskarte][ (k)].pdf – „alle Geschosse“ ohne Geschoss-Zusatz.
    Nur Dateien mit dem Namen dieses Projektordners: ein hineinkopierter Plan eines anderen Projekts wird nie Anlage. */
function planFinden(art, plaene, plan, ordnerName) {
  const ergebnis = art === 'ergebniskarte', praefix = ('Probenplan ' + nfc(ordnerName)).toLowerCase();
  const neueste = new Map();   // Name ohne „ (k)“ → neueste Datei
  for (const f of plaene || []) {
    const name = nfc(f.name); if (!/^Probenplan\b.*\.pdf$/i.test(name)) continue;
    const ohne = name.replace(KOPIE, ''), istErg = / - Ergebniskarte\.pdf$/i.test(ohne);
    if (s(ordnerName) && !ohne.toLowerCase().startsWith(praefix)) continue;   // Plan eines anderen Projekts (kopiert) – nie als Anlage
    if (istErg !== ergebnis) continue;
    const key = ohne.toLowerCase(), alt = neueste.get(key);
    if (!alt || (+f.t || 0) > alt.t) neueste.set(key, { name, ohne, t: +f.t || 0 });
  }
  if (!neueste.size) return null;
  const geschoss = x => {
    let rest = x.ohne.replace(/\.pdf$/i, '').replace(/ - Ergebniskarte$/i, '');
    if (rest.toLowerCase().startsWith(praefix)) rest = rest.slice(praefix.length);
    else { const i = rest.lastIndexOf(' - '); rest = i > 0 ? rest.slice(i) : ''; }
    return rest.replace(/^ - /, '').trim();
  };
  const alle = [...neueste.values()].map(x => ({ ...x, geschoss: geschoss(x) }));
  const gesamt = alle.filter(x => !x.geschoss).sort((a, b) => b.t - a.t)[0];
  const je = alle.filter(x => x.geschoss).sort((a, b) => a.geschoss.localeCompare(b.geschoss, 'de', { numeric: true }));
  const nimm = gesamt && (!je.length || gesamt.t >= Math.max(...je.map(x => x.t))) ? [gesamt] : je;
  const t = Math.max(...nimm.map(x => x.t)), dateien = nimm.map(x => 'Pläne/' + x.name);
  const k = { art, dateien, t, key: schluessel(dateien, Math.max(...nimm.map(x => x.t))), veraltet: null, grund: '', unvollstaendig: false, nrImDokument: null, nrQuelle: '',
    details: nimm.length > 1 || nimm[0].geschoss ? nimm.map(x => x.geschoss).join(', ') : '' };
  if (plan && plan.t) { k.veraltet = plan.t > Math.min(...nimm.map(x => x.t)) + TOLERANZ; if (k.veraltet) k.grund = 'Plan in PlanKit nach dem Export geändert'; }
  else k.grund = 'PlanKit-Datei (.probenplan) nicht gefunden – Stand nicht prüfbar';
  return k;
}

/** Zeilen von _Anlagen-Protokoll.txt: Zeit (UTC) | Anlage | SHA-256 | Quelle | SHA-256 der Quelle | Programm */
function protokollLesen(text) {
  const out = [];
  for (const z of s(text).split(/\r?\n/)) {
    const t = z.split(' | '); if (t.length < 6 || !zeit(t[0])) continue;
    out.push({ zeit: t[0].trim(), datei: nfc(t[1]), sha: s(t[2]), quelle: s(t[3]), quellSha: s(t[4]), programm: t.slice(5).join(' | ').trim() });
  }
  return out;
}
/** Word-Anlagen aus PlanKit in Mitteilungen/: <Nr>_<Titel>_Probenahme_<Datum>.docx, <Nr>_Raumbuch_<Datum>.docx, <Nr>_Wandansichten_<Datum>.docx */
const WORD = { probenahme: /_Probenahme_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i, raumbuch: /_Raumbuch_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i, wandansichten: /_Wandansichten_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i };
function wordFinden(art, mitteilungen, protokoll, plan) {
  const kand = (mitteilungen || []).filter(f => WORD[art].test(nfc(f.name))).sort((a, b) => (+b.t || 0) - (+a.t || 0) || nfc(b.name).localeCompare(nfc(a.name), 'de', { numeric: true }));
  if (!kand.length) return null;
  const f = kand[0], name = nfc(f.name), dateien = ['Mitteilungen/' + name];
  const k = { art, dateien, t: +f.t || 0, key: schluessel(dateien, f.t), veraltet: null, grund: '', unvollstaendig: false, nrImDokument: null, nrQuelle: '', details: '' };
  const z = protokollLesen(protokoll).filter(x => x.datei.toLowerCase() === name.toLowerCase()).pop();
  if (z && /^[0-9a-f]{64}$/i.test(z.quellSha) && plan && plan.sha) {   // genau: Prüfsumme der Quelle beim Erstellen ↔ jetzt
    k.veraltet = z.quellSha.toLowerCase() !== plan.sha.toLowerCase(); if (k.veraltet) k.grund = 'Plan in PlanKit nach dem Erstellen geändert';
  } else if (plan && plan.t) {
    k.veraltet = plan.t > k.t + TOLERANZ; if (k.veraltet) k.grund = 'älter als der Plan in PlanKit';
  } else k.grund = 'PlanKit-Datei (.probenplan) nicht gefunden – Stand nicht prüfbar';
  return k;
}

/** Anlage „Sensorische Prüfung auf Brandgeruch“ aus der Projektzentrale (Anlage PN 98 / Brandgeruch, ANLAGE.dateiname):
    Mitteilungen/<Projektnr>_<Titel>_<Art>_<JJJJ-MM-TT>[_n].docx mit <Art> = Brandgeruch oder PN98-Brandgeruch (nur PN 98 zählt
    hier nicht), neueste zuerst – erkannt wie in der Projektzentrale (/_PN98|_Brandgeruch/i). Anlagen-Nr.: aus dem Titel, wenn dort
    eine Nummer steht („Anlage 4“ → „…_Anlage_4_Brandgeruch_…“). Stand: Das Anlagen-Protokoll vermerkt die Prüfsumme der
    LabelKit-Datei beim Erstellen – weicht die heutige ab (oder ist die LabelKit-Datei neuer als die Anlage), gilt sie als veraltet. */
const BRANDGERUCH = /_(?:PN98-)?Brandgeruch_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i;
/* Die Projektzentrale kürzt „<Nr>_<Titel>_<Art>“ auf 64 Zeichen (ANLAGE.dateiname) – bei langem Titel fehlt dann ein Teil von
   „_Brandgeruch“. Erkannt, wenn genau 64 Zeichen vor dem Datum stehen und das letzte Stück der Anfang von „Brandgeruch“ bzw.
   „PN98-Brandgeruch“ ist (mindestens „PN98-“ – den Bindestrich gibt es nur mit Brandgeruch – bzw. „Bra“). */
const GEKUERZT = /^(.{64})_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i;
function brandgeruchGekuerzt(name) {
  const m = GEKUERZT.exec(name); if (!m) return false;
  const rest = m[1].slice(m[1].lastIndexOf('_') + 1).toLowerCase();
  return (rest.length >= 3 && 'brandgeruch'.startsWith(rest)) || (rest.length >= 5 && 'pn98-brandgeruch'.startsWith(rest));
}
function brandgeruchFinden(mitteilungen, protokoll, labelkit) {
  const kand = (mitteilungen || []).filter(f => (BRANDGERUCH.test(nfc(f.name)) || brandgeruchGekuerzt(nfc(f.name))) && !/^~\$/.test(nfc(f.name)))
    .sort((a, b) => (+b.t || 0) - (+a.t || 0) || nfc(b.name).localeCompare(nfc(a.name), 'de', { numeric: true }));
  if (!kand.length) return null;
  const f = kand[0], name = nfc(f.name), dateien = ['Mitteilungen/' + name];
  const k = { art: 'brandgeruch', dateien, t: +f.t || 0, key: schluessel(dateien, f.t), veraltet: null, grund: '', unvollstaendig: false, nrImDokument: null, nrQuelle: '', details: '' };
  const titel = /^[^_]*_(.*)_(?:PN98-)?Brandgeruch_/i.exec(name) || /^[^_]*_(.*)_[^_]*_\d{4}-\d{2}-\d{2}/.exec(name);
  const nr = titel && /(?:^|[_-])Anlage[_-]?(\d+)(?=[_-]|$)/i.exec(titel[1]);
  if (!BRANDGERUCH.test(name)) k.details = 'Name in der Projektzentrale gekürzt (langer Titel)';
  if (nr) { k.nrImDokument = +nr[1]; k.nrQuelle = `Anlage ${nr[1]}`; }
  const z = protokollLesen(protokoll).filter(x => x.datei.toLowerCase() === name.toLowerCase()).pop();
  const quelleName = z ? nfc(z.quelle).split('/').pop() : '';
  if (z && labelkit && s(labelkit.name) && quelleName && quelleName.toLowerCase() !== nfc(labelkit.name).toLowerCase()) {
    // Projektzentrale nimmt die neueste LabelKit-Datei, BerichtKit die von ResultKit übernommene – andere Datei: Stand nicht vergleichbar
    k.grund = `aus einer anderen LabelKit-Datei erstellt (${quelleName}) – Stand nicht prüfbar`;
  } else if (z && /^[0-9a-f]{64}$/i.test(z.quellSha) && labelkit && /^[0-9a-f]{64}$/i.test(s(labelkit.sha))) {
    k.veraltet = z.quellSha.toLowerCase() !== labelkit.sha.toLowerCase();
    if (k.veraltet) k.grund = 'LabelKit-Daten nach dem Erstellen geändert';
  } else if (labelkit && labelkit.t) {
    k.veraltet = labelkit.t > k.t + TOLERANZ; if (k.veraltet) k.grund = 'älter als die LabelKit-Daten';
  } else k.grund = 'LabelKit-Datei nicht gefunden – Stand nicht prüfbar';
  return k;
}

function erkennen(e) {
  e = e || {};
  const out = {};
  const b = bilddokuFinden(e.fotos, e.fk); if (b) out.bilddoku = b;
  for (const art of ['probenplan', 'ergebniskarte']) { const k = planFinden(art, e.plaene, e.plan, e.ordnerName); if (k) out[art] = k; }
  for (const art of Object.keys(WORD)) { const k = wordFinden(art, e.mitteilungen, e.protokoll, e.plan); if (k) out[art] = k; }
  const bg = brandgeruchFinden(e.mitteilungen, e.protokoll, e.labelkit); if (bg) out.brandgeruch = bg;
  return out;
}

/* ---------- Zusammenstellen und nummerieren ----------
   pruefberichte: [{ nr, pdf }] (pdf: Pfad oder ''), labor, gefunden: erkennen(), wahl: form.anlagen { <art>: { an, key } }
   (eigene Wahl gilt nur, solange dieselben Dateien im selben Stand gefunden werden), extra: form.anlagenExtra [{ pfad, bezeichnung, fehlt }],
   ohneEigeneProbenahme: zugestellte Probe – fehlende feste Anlagen nicht als „nicht gefunden“ anzeigen;
   ohnePruefbericht: keine Laborproben im Bericht (Brandbericht nur mit Brandgeruch oder ohne Proben) – keine Platzhalter-Anlage
   „Prüfbericht Nr. [Prüfbericht-Nr.]“; sonst steht bei leerer Liste der Platzhalter als Anlage 1 (Prüfbericht folgt);
   ohne: feste Anlagen, die dieser Bericht nicht braucht (Brandbericht ohne Brandgeruch-Proben: ['brandgeruch']) – weder Zeile noch Hinweis.
   Ergebnis: { liste:[{ nr, art, titel, zeilen, dateien }], zeilen:[für die Oberfläche], nr:{ <art>: n }, hinweise:[],
               aktionen:{ <Hinweistext>: { art, was:'erstellen'|'öffnen' } } (Sprung in die App, die die Anlage erzeugt) }
   Feste Anlagen bekommen immer einen Hinweis, wenn sie nicht (oder nicht so) im Bericht sind: fehlt, veraltet, unvollständig –
   ob nach der Regel abgewählt oder angehakt trotz Mangel. Nichts fällt still aus dem Bericht. */
function zusammenstellen(o) {
  o = o || {};
  const profil = PROFILE[o.profil || 'asbest'], gefunden = o.gefunden || {}, wahl = o.wahl || {}, hinweise = [], aktionen = {}, ohne = new Set(o.ohne || []);
  const hinweis = (text, art, was) => { hinweise.push(text); if (art && ARTEN[art] && ARTEN[art].link) aktionen[text] = { art, was }; };
  const liste = [], zeilen = [], nr = {};
  const prb = o.pruefberichte && o.pruefberichte.length ? o.pruefberichte : o.ohnePruefbericht ? [] : [{ nr: '', pdf: '' }];
  prb.forEach(p => {
    const n = liste.length + 1;
    liste.push({ nr: n, art: 'pruefbericht', titel: 'Prüfbericht', dateien: p.pdf ? [p.pdf] : [],
      zeilen: [['Prüfbericht Nr. ', p.nr ? p.nr : { gap: '[Prüfbericht-Nr.]' }], ['(', s(o.labor) ? s(o.labor) : { gap: '[Labor]' }, ')']] });
    zeilen.push({ art: 'pruefbericht', titel: 'Prüfbericht' + (p.nr ? ' ' + p.nr : ''), nr: n, an: true, fest: true, dateien: p.pdf ? [p.pdf] : [], zustand: p.pdf ? 'ok' : 'fehlt',
      grund: p.pdf ? '' : 'PDF nicht in „Laborergebnisse“' });
  });
  if (prb.length) nr.pruefbericht = 1;
  // Eigene Wahl gilt nur für denselben Stand: andere Dateien oder inzwischen veraltet → wieder nach der Regel
  const wahlKey = k => k.key + (k.veraltet ? '#veraltet' : '');
  const anHaken = (art, k, fest) => {
    const w = wahl[art];
    if (w && typeof w === 'object' && w.key === wahlKey(k)) return !!w.an;
    return fest && k.veraltet !== true && !k.unvollstaendig;
  };
  const zeile = (art, fest) => {
    const k = gefunden[art], A = ARTEN[art];
    if (!k) {
      if (fest && !o.ohneEigeneProbenahme) {
        zeilen.push({ art, titel: A.titel, nr: null, an: false, fest, dateien: [], zustand: 'fehlt', grund: `nicht gefunden – in ${A.app} erstellen`, app: A });
        hinweis(`${A.titel} nicht gefunden – nicht im Bericht. In ${A.app} erstellen.`, art, 'erstellen');
      }
      return;
    }
    const an = anHaken(art, k, fest), n = an ? liste.length + 1 : null;
    const titel = A.titel + (art === 'probenplan' || art === 'ergebniskarte' ? (k.details ? ` (${k.details})` : '') : '');
    if (an) { liste.push({ nr: n, art, titel, dateien: k.dateien, zeilen: [[titel]] }); nr[art] = n; }
    zeilen.push({ art, titel, nr: n, an, fest, dateien: k.dateien, t: k.t, key: wahlKey(k), details: k.details,
      zustand: k.unvollstaendig ? 'unvollstaendig' : k.veraltet ? 'veraltet' : k.veraltet === null ? 'unbekannt' : 'ok', grund: k.grund, app: A });
    if (art === 'bilddoku' && an) {
      if (k.nrImDokument == null) hinweise.push(`Bilddokumentation: keine Anlagen-Nr. in FotoKit eingetragen – im Bericht ist sie Anlage ${n}.`);
      else if (k.nrImDokument !== n) hinweise.push(`Bilddokumentation trägt „${k.nrQuelle}“, im Bericht ist sie Anlage ${n} – in FotoKit die Anlagen-Nr. ändern und die PDF neu erstellen.`);
    }
    // Brandgeruch: Die Nummer steht nur im Titel, wenn sie beim Erstellen eingetragen wurde („Anlage 4“) – dann muss sie passen
    if (art === 'brandgeruch' && an && k.nrImDokument != null && k.nrImDokument !== n)
      hinweis(`Brandgeruch-Anlage trägt „${k.nrQuelle}“, im Bericht ist sie Anlage ${n} – in der Projektzentrale mit „Anlage ${n}“ neu erstellen.`, art, 'öffnen');
    const mangel = k.unvollstaendig ? 'unvollständig' : k.veraltet ? 'veraltet' : '';
    if (mangel && an) hinweis(`${A.titel} ist angehakt, aber ${k.unvollstaendig ? `unvollständig (${k.grund})` : k.grund} – in ${A.app} neu erstellen.`, art, 'öffnen');
    else if (mangel && fest) hinweis(`${A.titel} ${mangel}${k.unvollstaendig ? ` (${k.grund})` : ''} – nicht im Bericht. In ${A.app} neu erstellen oder trotzdem anhaken.`, art, 'öffnen');
  };
  profil.fest.filter(a => !ohne.has(a)).forEach(a => zeile(a, true));
  profil.optional.forEach(a => zeile(a, false));
  (o.extra || []).forEach((x, i) => {
    if (!x || !s(x.pfad)) return;
    const an = !x.fehlt, n = an ? liste.length + 1 : null, titel = s(x.bezeichnung) || s(x.pfad).split('/').pop().replace(/\.[^.]+$/, '');
    if (an) liste.push({ nr: n, art: 'sonstiges', titel, dateien: [s(x.pfad)], zeilen: [[titel]] });
    zeilen.push({ art: 'sonstiges', index: i, titel, bezeichnung: s(x.bezeichnung), nr: n, an, fest: false, dateien: [s(x.pfad)], zustand: x.fehlt ? 'fehlt' : 'ok', grund: x.fehlt ? 'Datei nicht mehr im Projektordner' : '' });
    if (x.fehlt) hinweise.push(`Weitere Anlage „${s(x.pfad)}“ liegt nicht mehr im Projektordner – nicht im Bericht.`);
  });
  return { liste, zeilen, nr, hinweise, aktionen };
}

/** Satz für „Probenahme und Untersuchung“: verweist auf Bilddokumentation und Probenplan, soweit angehakt. */
function verweisSatz(nr, eine) {
  const b = nr.bilddoku, p = nr.probenplan, stelle = eine ? 'Die Entnahmestelle ist' : 'Die Entnahmestellen sind';
  if (b && p) return `${stelle} zusätzlich in der Bilddokumentation (Anlage ${b}) und im Probenplan (Anlage ${p}) dargestellt.`;
  if (b) return `${stelle} zusätzlich in der Bilddokumentation (Anlage ${b}) dargestellt.`;
  if (p) return `Die Lage ${eine ? 'der Entnahmestelle' : 'der Entnahmestellen'} ist im Probenplan (Anlage ${p}) dargestellt.`;
  return '';
}

const API = { VERSION: 1, ARTEN, PROFILE, erkennen, zusammenstellen, verweisSatz, protokollLesen, bilddokuFinden, planFinden, wordFinden, brandgeruchFinden };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtAnlagen = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

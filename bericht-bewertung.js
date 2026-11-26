/* BerichtKit – Einordnung von Laborwerten für den Brandbericht (5.2 Chlorid, 5.3 PAK), ohne Browserteile, in Node testbar.
   Die Regeln sind aus ResultKit übernommen und dort gleich zu halten – geändert wird nur in ResultKit, dann hier nachgezogen:
     · labNumber, labQualifier  ← ResultKit src/bewertung.ts (Zahlen lesen, BG / n. n. / n. b.; nichts erraten)
     · KORROSION-CHLORID v1     ← ResultKit src/bewertung.ts (5–10 µg/cm² nach VdS 2357, Einheit umgerechnet, 1 µg/cm² = 10 mg/m²)
     · VdS-Faktor Σ16 EPA-PAK   ← ResultKit src/bewertung.ts vdsScale (Hintergrundreferenz 10 / 100 µg/m², Einheit umgerechnet)
     · FLAECHE, bevorzugt       ← ResultKit src/uebersicht.ts (Wert je Fläche geht vor „je Probe“)
     · rolleAuto                ← Projektzentrale archiv/auswertung.js (Referenzprobe „REF“/„Referenz“, Freimessung „F-…“)
   Der Bericht nennt die Werte wie im Prüfbericht (Zahl und Einheit unverändert) – mit einer Ausnahme: Chlorid-Wischproben in mg/m²
   stehen im Bericht in µg/cm² (chloridAnzeige, Komma eine Stelle verschoben; Entscheidung Basti 26.11.2026). Eingeordnet wird
   immer mit dem Rohwert des Prüfberichts. */
(function (root) {
'use strict';

/* ---------- ResultKit src/bewertung.ts: labNumber / labQualifier (gleich halten) ---------- */
/** Strict locale-independent parsing. A single separator followed by three digits (1.234 / 1,234) is ambiguous without a
    declared locale: leave it unrated. */
function labNumber(raw) {
  const t = String(raw == null ? '' : raw).trim().replace(/−/g, '-');
  const match = t.match(/^([+-]?)([\d.,   ]+)([eE][+-]?\d+)?$/); if (!match) return NaN;
  let body = match[2].trim(); const exponent = match[3] || '';
  if (/[   ]/.test(body)) {
    if (!/^\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?$/.test(body)) return NaN;
    body = body.replace(/[   ]/g, '').replace(',', '.');
  } else if (body.includes('.') && body.includes(',')) {
    const decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',', group = decimal === '.' ? ',' : '.';
    const parts = body.split(decimal); if (parts.length !== 2 || !/^\d+$/.test(parts[1]) || !new RegExp('^\\d{1,3}(?:\\' + group + '\\d{3})+$').test(parts[0])) return NaN;
    body = parts[0].split(group).join('') + '.' + parts[1];
  } else if (/[.,]/.test(body)) {
    const parts = body.split(/[.,]/);
    if (parts.length === 2) { if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || (parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]))) return NaN; body = parts.join('.'); }
    else { if (!/^\d{1,3}([.,])\d{3}(?:\1\d{3})+$/.test(body)) return NaN; body = parts.join(''); }
  }
  const v = Number(match[1] + body + exponent); return Number.isFinite(v) ? v : NaN;
}
/** 'measured' | 'below' | 'notDetected' | 'notDetermined' | 'unrated' – Qualifier nie in eine Zahl verwandeln */
function labQualifier(raw) {
  let t = String(raw == null ? '' : raw).trim(); if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
  if (/^unter\s+BG$/i.test(t)) return 'below';
  if (/^n\.\s*n\.$/i.test(t)) return 'notDetected';
  if (/^n\.\s*b\.$/i.test(t)) return 'notDetermined';
  if (t.startsWith('<')) { const limit = labNumber(t.slice(1)); return Number.isFinite(limit) && limit >= 0 ? 'below' : 'unrated'; }
  return Number.isFinite(labNumber(raw)) ? 'measured' : 'unrated';
}

/* ===== KORROSION-CHLORID v2 – in ResultKit, PlanKit (TypeScript), FotoKit und BerichtKit (JavaScript) gleich halten =====
   Chlorid auf Oberflächen: VdS 2357 nennt 5–10 µg/cm² als korrosionschemisch relevante Größenordnung (Vorgabe des Büros).
   Gilt unabhängig von der Nutzung. Die Grenzen werden in die Einheit des Berichts umgerechnet (1 µg/cm² = 10 mg/m²),
   damit ältere Berichte in mg/m² gleich bewertet werden.
   v2 (Audit m7, Entscheidung 4): genau 10 µg/cm² liegt noch „im Bereich“, „oberhalb“ erst über 10; genau 5 bleibt „im Bereich“.
   Keine neue Zahl: die Stufe „oberhalb“ trägt `ueber: true` (zählt erst über ihrem Wert), jede andere Stufe zählt ab ihrem Wert.
   (BerichtKit ordnet nur nach der Referenz ein; angepasste PlanKit-Skalen ergeben einen Hinweis.) */
const CHLORID_JE_UG_CM2 = { 'µg/cm2': 1, 'mg/m2': 10, 'µg/m2': 10000, 'mg/cm2': .001, 'µg/100cm2': 100, 'mg/dm2': .1 };
const einheitKey = unit => String(unit == null ? '' : unit).replace(/μ/g, 'µ').replace(/²/g, '2').replace(/\s+/g, '').toLowerCase();
const chloridEinheit = unit => CHLORID_JE_UG_CM2[einheitKey(unit)];
/** Stufen über „unterhalb“ in der Einheit des Berichts: [im Bereich, oberhalb] */
const chloridGrenzen = f => [{ from: 5 * f }, { from: 10 * f, ueber: true }];
/** Wert in dieser Stufe? `ueber`: erst über dem Wert, sonst ab dem Wert. */
const stufeErreicht = (c, v) => c.ueber ? v > c.from : v >= c.from;
/* ===== Ende KORROSION-CHLORID v2 ===== */

/** VdS 2357 Hintergrundreferenz Σ16 EPA-PAK: Faktor von µg/m² in die Einheit des Berichts (ResultKit vdsScale) */
const PAK_JE_UG_M2 = { 'µg/m2': 1, 'µg/100cm2': .01, 'mg/m2': .001, 'ng/m2': 1000 };
const pakEinheit = unit => PAK_JE_UG_M2[einheitKey(unit)];

/** Flächenbezogene Einheit (µg/m², µg/cm², µg/100 cm² …) – ResultKit src/uebersicht.ts */
const FLAECHE = /\/\s*(?:\d+\s*)?(?:c|d)?m\s*(?:2|²)\s*$/i;
/** Wert eines Parameters: der Wert je Fläche geht vor (Labor liefert z. B. Chlorid „µg/Probe“ und „µg/cm² berechnet“) */
function bevorzugt(werte, re) { const c = (werte || []).filter(x => x && re.test(String(x.p || ''))); return c.find(x => FLAECHE.test(String(x.u || ''))) || c[0] || null; }

/** Einordnung eines Werts gegen Grenzen (in der Einheit des Berichts, aufsteigend; Zahl = ab dem Wert, { from, ueber } wie
    KORROSION-CHLORID v2) → Index der Gruppe oder -1 (nicht bewertbar).
    Gemessen: letzte Grenze, die erreicht ist (wie ResultKit rate). „< BG“: nur dann die unterste Gruppe, wenn die BG selbst unter der
    ersten Grenze liegt – sonst ist nichts sicher. „n. n.“, „unter BG“ (ohne Zahl): unterste Gruppe. „n. b.“, „1.250“, „> 500“: nicht bewertbar. */
function einordnen(r, grenzen) {
  const q = labQualifier(r);
  if (q === 'measured') { const v = labNumber(r); if (!(v >= 0)) return -1; let i = 0; grenzen.forEach((g, j) => { if (stufeErreicht(typeof g === 'number' ? { from: g } : g, v)) i = j + 1; }); return i; }
  if (q === 'notDetected') return 0;
  if (q === 'below') { const t = String(r).trim().replace(/^\(|\)$/g, '').trim(); if (!t.startsWith('<')) return 0; const bg = labNumber(t.slice(1)); return bg <= (typeof grenzen[0] === 'number' ? grenzen[0] : grenzen[0].from) ? 0 : -1; }
  return -1;
}
/** Chlorid-Wischprobe: 0 unterhalb (< 5 µg/cm²) · 1 im Bereich (5 bis einschließlich 10) · 2 oberhalb (> 10) · -1 nicht bewertbar (Einheit unbekannt, Wert unklar) */
function chloridStufe(w) { const f = w && chloridEinheit(w.u); return f ? einordnen(w.r, chloridGrenzen(f)) : -1; }
/** Zahl im Text des Prüfberichts durch 10 teilen, indem das Komma eine Stelle nach links rückt – keine Rundung, keine Gleitkomma-Rechnung.
    „47“ → „4,7“ · „120“ → „12“ · „100,1“ → „10,01“ · „5“ → „0,5“ · „< 5“ → „< 0,5“ · „1 250“ → „125“. Das Dezimalzeichen des Prüfberichts
    bleibt (ohne eins: Komma); eine Null, die nur aus einer ganzen Zahl nachrückt („120“), wird nicht geschrieben. Vorzeichen „<“ und
    Klammern bleiben stehen. Was labNumber nicht eindeutig liest („1.250“, „2,5e3“, „> 50“, Text) → null. */
function kommaVerschieben(t) {
  const m = /^(\(?\s*(?:<\s*)?)([\d.,\u00a0\u202f\u2009 ]*\d)(\s*\)?)$/.exec(String(t == null ? '' : t).trim());
  if (!m || !Number.isFinite(labNumber(m[2]))) return null;
  const body = m[2];
  let ganz = body, rest = '', komma = ',';
  if (/[\u00a0\u202f\u2009 ]/.test(body)) { const d = /([.,])(\d+)$/.exec(body); if (d) { ganz = body.slice(0, d.index); komma = d[1]; rest = d[2]; } ganz = ganz.replace(/[^\d]/g, ''); }
  else if (body.includes('.') && body.includes(',')) { komma = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ','; const i = body.lastIndexOf(komma); ganz = body.slice(0, i).replace(/[.,]/g, ''); rest = body.slice(i + 1); }
  else if (/[.,]/.test(body)) { const teile = body.split(/[.,]/); if (teile.length === 2) { komma = /[.,]/.exec(body)[0]; [ganz, rest] = teile; } else ganz = teile.join(''); }
  ganz = ganz.replace(/^0+(?=\d)/, '');
  const vorn = ganz.length > 1 ? ganz.slice(0, -1) : '0', ruecktNach = ganz.slice(-1);
  const nachkomma = rest ? ruecktNach + rest : ruecktNach === '0' ? '' : ruecktNach;
  return m[1] + vorn + (nachkomma ? komma + nachkomma : '') + m[3];
}
const UG_CM2 = 'µg/cm²';
/** Anzeige einer Chlorid-Wischprobe im Bericht: Wert in mg/m², der sich einordnen lässt (chloridStufe ≥ 0) → { r, u: 'µg/cm²' } mit
    verschobenem Komma; „n. n.“ / „unter BG“ (ohne Zahl) behalten ihren Text, nur die Einheit wechselt. Sonst null = bleibt wie im
    Prüfbericht: schon µg/cm² oder eine andere Einheit, nicht einzuordnen („1.250“, „µg/Probe“, „n. b.“, „< 60“ mit BG über der Grenze),
    oder eine Zahl, die sich nicht als Text verschieben lässt (Exponent – dann mit Hinweis, siehe bericht-brand.js). */
function chloridAnzeige(w) {
  if (!w || einheitKey(w.u) !== 'mg/m2' || chloridStufe(w) < 0) return null;
  const q = labQualifier(w.r);
  if (q === 'notDetected' || (q === 'below' && !/^\(?\s*</.test(String(w.r).trim()))) return { r: String(w.r), u: UG_CM2 };
  const r = kommaVerschieben(w.r);
  return r == null ? null : { r, u: UG_CM2 };
}
/** PAK-Wischprobe (Σ16 EPA-PAK) gegen die Hintergrundreferenz R (10 oder 100 µg/m²): 0 unter Referenz · 1 erreicht/überschritten · -1 */
function pakStufe(w, R) { const f = w && pakEinheit(w.u); return f && R > 0 ? einordnen(w.r, [R * f]) : -1; }
/** Kein Nachweis über der BG (für den Satz „… keine … oberhalb der Bestimmungsgrenze nachweisbar“) */
const ohneNachweis = r => ['below', 'notDetected'].includes(labQualifier(r));

/* ---------- Projektzentrale archiv/auswertung.js: Rolle einer Probe (gleich halten) ----------
   Gelesen aus Probenbezeichnung und Probenbeschreibung. Reihenfolge: Freimessung vor Referenz. Konvention des Handbuchs:
   „F-“ vor der alten ID = Freimessung, „REF“ = Referenz aus unbelasteter Stelle. Nichts erkannt → ''. (Verdachtsquelle und
   Brandbereich aus dem Datenarchiv braucht der Bericht nicht.) */
const tidy = v => String(v == null ? '' : v).normalize('NFC').replace(/\s+/g, ' ').trim();
const istFrei = id => /^F[-_ ]/i.test(tidy(id));
function rolleAuto(ref, desc) {
  const t = (tidy(ref) + ' | ' + tidy(desc)).toLocaleLowerCase('de');
  if (istFrei(ref) || istFrei(desc) || /freimessung|sanierungskontrolle|nach (der )?sanierung/.test(t)) return 'frei';
  if (/(^|[^a-zäöüß])ref([^a-zäöüß]|$)|referenz|unbelastet|nullprobe|hintergrund/.test(t)) return 'referenz';
  return '';
}

/* ---------- Asbest: Verfahren nach VDI 3866 Blatt 5 Anhang B (geringe Gehalte, Nachweisgrenze ca. 0,001 %) ----------
   Aus ResultKit werte[].nwg: ein Asbest-Wert mit Inhalt (nicht „-“) und NWG ≤ 0,005 % → Anhang B. Eurofins führt die nicht
   untersuchten Stufen mit „-“. Die LabelKit-Matrix dient nur zur Plausibilität (Labore wenden Anhang B auf Putze, Spachtelmassen,
   Kleber, Farben, Kitte, Estriche, Ausgleichsmassen, Dichtungen, Bitumen, Vinyl-/Flexbeläge an). */
const ASBEST = /asbest|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
/** NWG in % – „0,001 %“, „NWG 0,001 %“; eine bloße Zahl („0,001“) nur, wenn die Einheit des Werts selbst % ist (u = „%“, „Masse-%“).
    ResultKit nachweisgrenze() hängt „%“ nur an, wenn es im Prüfbericht steht. */
const nwgProzent = (v, u) => {
  const t = String(v == null ? '' : v), m = /([\d.,]+)\s*%/.exec(t); if (m) return labNumber(m[1]);
  const b = /^\s*(?:NWG\s*)?([\d.,]+)\s*$/i.exec(t); return b && /%/.test(String(u == null ? '' : u)) ? labNumber(b[1]) : NaN;
};
/** true = Anhang B angewendet, false = andere Stufe, null = keine Angabe zur Nachweisgrenze */
function anhangB(werte) {
  const a = (werte || []).filter(w => w && ASBEST.test(String(w.p || '')) && !/^[-–—]?$/.test(String(w.r || '').trim()));
  const mit = a.filter(w => Number.isFinite(nwgProzent(w.nwg, w.u)));
  if (!mit.length) return null;
  return mit.some(w => nwgProzent(w.nwg, w.u) <= 0.005);
}
const MATRIX_ANHANG_B = new Set(['Putze / Spachtelmassen', 'Bituminöse Proben / Kleber', 'Kitte', 'Farben', 'Estriche', 'Ausgleichsmassen',
  'Dichtungen', 'Cushion-Vinyl (Bodenbelag)', 'Fußbodenplatten (Flexplatten)']);
const matrixErwartetAnhangB = m => MATRIX_ANHANG_B.has(String(m == null ? '' : m).normalize('NFC').trim());

const API = { VERSION: 1, labNumber, labQualifier, CHLORID_JE_UG_CM2, chloridEinheit, PAK_JE_UG_M2, pakEinheit, FLAECHE, bevorzugt,
  einordnen, chloridStufe, kommaVerschieben, chloridAnzeige, pakStufe, ohneNachweis, istFrei, rolleAuto, ASBEST, anhangB, nwgProzent, matrixErwartetAnhangB };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtBewertung = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

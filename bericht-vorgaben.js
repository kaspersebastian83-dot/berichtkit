/* BerichtKit – eigene Angaben und berechnete Vorgaben (ohne Browserteile, in Node testbar).

   Das Formular ist immer: Vorgaben (bei jedem Öffnen neu berechnet – heutiges Datum, nächste freie Mitteilung,
   Auftragsdatum und Auftraggeber aus der Projektzentrale, Probenehmer aus LabelKit, Labor aus den Einstellungen …)
   + eigene Angaben (was jemand im Formular selbst geändert hat). In `_BerichtKit.json` stehen nur die eigenen Angaben
   (Kennzeichen `nurEigene: true`). Bis 1.6.1 stand dort das ganze Formular – samt Vorgaben vom Tag der ersten Bearbeitung.

   formBereinigen – beim Öffnen und für Dateien ohne Kennzeichen:
   1. Mitteilung Nr. n gibt es schon (n < nächste freie) → die Nummer fällt weg, vorgeschlagen ist die nächste freie.
      Ausnahme: Die Nummer wurde bewusst gesetzt (mitteilungAm) und seitdem kein Bericht mit dieser Nummer gespeichert –
      z. B. hat ein Kollege die Nummer zurückgestellt, um die Mitteilung zu ersetzen. Dann bleibt sie (beim Speichern fragt der Dialog).
   2. Berichtsdatum fällt weg, wenn es zu einer schon gespeicherten Mitteilung mit anderer Nummer gehört (berichte[]),
      bei einer Datei ohne Kennzeichen auch, wenn es vor heute liegt (eingefroren beim ersten Bearbeiten).
   3. Datei ohne Kennzeichen: leere Werte und Werte gleich der heutigen Vorgabe sind keine eigenen Angaben (fallen weg);
      alles andere bleibt als eigene Angabe – lieber eine Angabe zu viel behalten als eine echte Eingabe verlieren. Was bleibt
      und von einer Vorgabe aus den Projektdaten abweicht, nennt ein Hinweis (es könnte eine alte, eingefrorene Vorgabe sein). */
const FELD_NAME = { auftragsdatum: 'Auftragsdatum', agSatz: 'Auftraggeber im Satz', probenehmer: 'Probenahme durch', sv: 'Unterschrift',
  mt: 'Zweite Unterschrift', labor: 'Labor' };   // nur Vorgaben aus Projektzentrale, LabelKit und Einstellungen
(function (root) {
'use strict';

/** Nummer einer Mitteilung aus dem Dateinamen: „2._Mitteilung_26.0512.docx“, „1. Mitteilung ….docx“, „1__Mitteilung.docx“ → 2, 1, 1 */
function mitteilungNr(name) {
  const m = /^(\d+)[._\s]*Mitteilung(?![a-zäöüß])/i.exec(String(name == null ? '' : name).normalize('NFC'));
  return m ? +m[1] : 0;
}
/** Nächste freie Mitteilung zu den Dateinamen in „Mitteilungen“ */
function naechsteNr(namen) { return (namen || []).reduce((max, n) => Math.max(max, mitteilungNr(n)), 0) + 1; }

/** JSON mit sortierten Schlüsseln – Vergleich unabhängig von der Reihenfolge der Felder */
function stabil(v) {
  return JSON.stringify(v === undefined ? null : v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, s) => { o[s] = x[s]; return o; }, {}) : x);
}
const gleich = (a, b) => stabil(a) === stabil(b);
const leer = v => v == null || v === '' || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v).length);
const datumDE = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v || ''); };

/** ctx: { vorgabe, naechste, heute ('JJJJ-MM-TT'), alt (Datei ohne Kennzeichen), berichte[] }
    → { form (nur eigene Angaben), entfernt: [Feld], hinweise: [Text] } */
function formBereinigen(form, ctx) {
  const c = ctx || {}, vorgabe = c.vorgabe || {}, naechste = +c.naechste || 1, heute = String(c.heute || '');
  const out = JSON.parse(JSON.stringify(form && typeof form === 'object' ? form : {})), entfernt = [], hinweise = [];
  const weg = k => { delete out[k]; entfernt.push(k); };
  // 1. Nummer schon vergeben
  if (out.mitteilung != null && out.mitteilung !== '') {
    const n = +out.mitteilung, am = Date.parse(out.mitteilungAm || '');
    const bewusst = n >= 1 && Number.isFinite(am) && !(c.berichte || []).some(b => b && +b.mitteilung === n && !(Date.parse(b.am) < am));
    if (!(n >= 1) || (n < naechste && !bewusst)) {
      weg('mitteilung'); if ('mitteilungAm' in out) weg('mitteilungAm');
      if (n >= 1) hinweise.push(`Die ${n}. Mitteilung gibt es schon in „Mitteilungen“ – vorgeschlagen ist jetzt die ${naechste}. Mitteilung. Willst du die ${n}. ersetzen, stell die Nummer wieder auf ${n}.`);
    }
  }
  const nr = out.mitteilung != null ? +out.mitteilung : naechste;
  // 2. Datum gehört zu einer gespeicherten Mitteilung oder ist (alte Datei) beim ersten Bearbeiten stehen geblieben
  if (out.datum) {
    const zu = (c.berichte || []).filter(b => b && b.datum === out.datum && +b.mitteilung >= 1 && +b.mitteilung !== nr).pop();
    if (zu) { hinweise.push(`Das Berichtsdatum ${datumDE(out.datum)} gehörte zur ${+zu.mitteilung}. Mitteilung – jetzt steht das heutige Datum da.`); weg('datum'); }
    else if (c.alt && heute && out.datum < heute) {
      hinweise.push(`Das Berichtsdatum war seit dem ersten Bearbeiten auf dem ${datumDE(out.datum)} stehen geblieben – jetzt steht das heutige Datum da. Brauchst du ein anderes, trag es ein.`);
      weg('datum');
    }
  }
  // 3. Alte Datei: Vorgaben und leere Werte sind keine eigenen Angaben
  if (c.alt) {
    for (const k of Object.keys(out)) if (leer(out[k]) || (k in vorgabe && gleich(out[k], vorgabe[k]))) weg(k);
    const abweichend = Object.keys(FELD_NAME).filter(k => k in out && k in vorgabe);
    if (abweichend.length) hinweise.push(`Aus den früheren Angaben übernommen, weicht von den Projektdaten ab: ${abweichend.map(k => FELD_NAME[k]).join(', ')} – bitte prüfen.`);
  }
  return { form: out, entfernt, hinweise };
}

/** Ist die Datei schon beim Büro? Ja, wenn eine nicht zurückgezogene Büroaufgabe (Gutachten) genau diese Datei nennt
    (wie stufen.js in der Projektzentrale; Vergleich nur über den Dateinamen, ohne Groß-/Kleinschreibung).
    aufgaben: [{ id, art, word, erstellt }], vermerke: [{ id, aufgabe, schritt, wert, zeit }] (BUEROKIT-AUFGABEN v1) → Aufgabe oder null */
function beimBuero(aufgaben, vermerke, datei) {
  const name = v => String(v == null ? '' : v).split(/[\\/]/).pop().normalize('NFC').toLowerCase();
  const ziel = name(datei); if (!ziel) return null;
  const zurueckgezogen = id => {
    const v = (vermerke || []).filter(x => x && x.aufgabe === id && x.schritt === 'geloescht')
      .sort((a, b) => String(a.zeit).localeCompare(String(b.zeit)) || String(a.id).localeCompare(String(b.id))).pop();
    return !!(v && v.wert !== false);
  };
  return (aufgaben || []).filter(a => a && a.art === 'gutachten' && name(a.word) === ziel && !zurueckgezogen(a.id))
    .sort((a, b) => String(a.erstellt).localeCompare(String(b.erstellt)))[0] || null;
}

/* ---------- Berichtsart ohne Angabe in der Adresse (ab 1.15.0) ----------
   Reihenfolge: (1) gemerkte Berichtsart des Projekts (_BerichtKit.json, Feld „art“ – gemerkt bei #…&art=, Umschalten und
   Speichern; Dateien bis 1.14.0 haben kein Feld: dann die Art des zuletzt gespeicherten Berichts aus berichte[], ohne „art“ =
   asbest) → (2) die LabelKit-Proben wie Projektzentrale Stufen.berichtsart (Chlorid inkl. Bohrmehl, PAK oder Brandgeruch →
   brand, nur Asbest → asbest; storniert zählt nicht) → (3) asbest. Die Wahl nach (2)/(3) wird nicht gemerkt.
   Gleiche Regel in der Spektron-Leiste (mosaik-leiste.js, nur Schritt 1 – die Leiste liest keine LabelKit-Proben). */
const ARTEN = ['asbest', 'brand'];
const artOk = a => { const x = String(a == null ? '' : a).trim().toLowerCase(); return ARTEN.includes(x) ? x : ''; };
/** Gemerkte Berichtsart aus dem Inhalt von _BerichtKit.json ({ art, berichte }) → 'asbest' | 'brand' | '' */
function artGemerkt(datei) {
  if (!datei || typeof datei !== 'object') return '';
  const a = artOk(datei.art); if (a) return a;
  const b = (Array.isArray(datei.berichte) ? datei.berichte : []).filter(x => x && x.datei).pop();
  return b ? (artOk(b.art) || (b.art ? '' : 'asbest')) : '';
}
/** Wie Projektzentrale stufen.js berichtsart(lk) – dort ändern, hier nachziehen. → { art: 'brand'|'asbest'|'', grund } */
function artAusProben(lk) {
  const liste = k => (lk && Array.isArray(lk[k]) ? lk[k] : []).filter(p => p && typeof p === 'object' && !p.storniert);
  const txt = v => String(v == null ? '' : v).trim();
  const anz = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
  const bohrAn = !!(lk && ((lk.ui && lk.ui.bohrmehlAktiv) || lk.bohrmehlAktiv));
  const bohrmehl = liste('sonstigeProben').filter(p => bohrAn || (!!txt(p.tiefe) && /chlorid/i.test(txt(p.notiz)))).length;
  const n = { cl: liste('chloridProben').length + bohrmehl, pak: liste('proben').length, bg: liste('brandgeruchProben').length, as: liste('asbestProben').length };
  const teile = [[n.cl, 'Chlorid-Probe', 'Chlorid-Proben'], [n.pak, 'PAK-Probe', 'PAK-Proben'], [n.bg, 'Brandgeruch-Probe', 'Brandgeruch-Proben']]
    .filter(([z]) => z).map(([z, e, v]) => anz(z, e, v));
  if (teile.length) return { art: 'brand', grund: teile.join(', ') + (n.as ? ` und ${anz(n.as, 'Asbestprobe', 'Asbestproben')}` : '') };
  if (n.as) return { art: 'asbest', grund: anz(n.as, 'Asbestprobe', 'Asbestproben') };
  return { art: '', grund: '' };
}
/** Berichtsart beim Öffnen. adresse: Wert aus #…&art= ('' = keine Angabe), datei: _BerichtKit.json oder null, lk: LabelKit-Daten.
    → { art, quelle: 'adresse'|'gemerkt'|'proben'|'standard', merken: nur bei 'adresse', grund } */
function artWaehlen({ adresse, datei, lk } = {}) {
  const a = String(adresse == null ? '' : adresse).trim().toLowerCase();
  if (a) return { art: a, quelle: 'adresse', merken: !!artOk(a), grund: '' };
  const g = artGemerkt(datei); if (g) return { art: g, quelle: 'gemerkt', merken: false, grund: '' };
  const p = artAusProben(lk); if (p.art) return { art: p.art, quelle: 'proben', merken: false, grund: p.grund };
  return { art: 'asbest', quelle: 'standard', merken: false, grund: '' };
}

const API = { VERSION: 1, mitteilungNr, naechsteNr, formBereinigen, beimBuero, stabil, gleich, artGemerkt, artAusProben, artWaehlen };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtVorgaben = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* BerichtKit – Berichtsmodell: Fassade über die Berichtsarten (ohne Browserteile, in Node testbar).
   Die Bausteine stehen in bericht-gemeinsam.js, die Texte je Berichtsart in bericht-asbest.js und bericht-brand.js.
   app.js und die Tests sprechen nur mit dieser Datei (globalThis.BerichtText); bericht() wählt die Berichtsart nach form.art. */
(function (root) {
'use strict';
const lade = (name, datei) => root[name] || (typeof require === 'function' ? require(datei) : null);
const G = lade('BerichtGemeinsam', './bericht-gemeinsam.js');
const ARTEN = { asbest: lade('BerichtAsbest', './bericht-asbest.js'), brand: lade('BerichtBrand', './bericht-brand.js') };
if (!G || !ARTEN.asbest || !ARTEN.brand) throw new Error('BerichtKit: bericht-gemeinsam.js/bericht-asbest.js/bericht-brand.js nicht geladen (Reihenfolge der Skripte in index.html).');

/** Alle Berichtsarten, die es geben soll (Reihenfolge = Auswahl). bereit = fertig für Berichte in „Mitteilungen“. Eine Berichtsart
    mit Modul, die noch nicht bereit ist (brand bis Schritt 5), baut trotzdem ihr Modell – für Tests und die Vorschau
    (#…&art=brand&vorschau=1) –, aber immer mit Sperre: nur als Entwurf herunterladen, nie in „Mitteilungen“. */
const BEREIT = { asbest: true, brand: false };
const BERICHTSARTEN = [
  { art: 'asbest', name: 'Asbestbericht' },
  { art: 'brand', name: 'Brandbericht' },
].map(a => ({ ...a, bereit: !!ARTEN[a.art] && !!BEREIT[a.art], modul: !!ARTEN[a.art] }));
const IM_AUFBAU = { brand: 'Der Brandbericht ist noch im Aufbau (5.1, 6. und 8. folgen) – nur als Entwurf herunterladen, nicht in „Mitteilungen“ speichern.' };
/** form.art → Berichtsart; leer oder fehlend = 'asbest' (alle Berichte bis 1.9.0). Unbekannte Werte bleiben unbekannt. */
const berichtsart = form => G.s(form && form.art).toLowerCase() || 'asbest';

/** Berichtsmodell für eingabe.form.art (siehe Modellbeschreibung in bericht-asbest.js / bericht-brand.js). Eine Berichtsart ohne
    Modul wirft – die App bietet sie dann gar nicht erst an („kommt bald“). Nicht bereit → Sperre (siehe BEREIT). */
function bericht(eingabe) {
  const art = berichtsart(eingabe && eingabe.form), modul = ARTEN[art];
  if (!modul) throw new Error(`Berichtsart „${art}“ gibt es in BerichtKit noch nicht.`);
  const m = modul.bericht(eingabe);
  if (!BEREIT[art]) m.sperren.unshift(IM_AUFBAU[art] || `Die Berichtsart „${art}“ ist noch im Aufbau – nur als Entwurf herunterladen.`);
  return m;
}

const API = { VERSION: 1, BERICHTSARTEN, berichtsart, bericht,
  // Brandbericht: Vorgaben der Brand-Seite (app.js) und Objektart je Nutzung
  brandVorgabe: ARTEN.brand.vorgabe, brandObjektart: ARTEN.brand.objektart, nominativ: G.nominativ,
  // unverändert wie bis 1.9.0 (app.js, Tests)
  istStorniert: G.istStorniert, istVersicherer: G.istVersicherer, svVorschlag: G.svVorschlag, rolleFestgelegt: G.rolleFestgelegt,
  alsEntwurf: G.alsEntwurf, beschreibungKey: G.beschreibungKey, beschreibungWeichtAb: G.beschreibungWeichtAb, asbestBefund: G.asbestBefund,
  kmfWerte: G.kmfWerte, person: G.person, anredeStandard: G.anredeStandard, rollentext: G.rollentext, namensteile: G.namensteile,
  matrixMaterial: G.matrixMaterial, raumAusschreiben: G.raumAusschreiben, datumDE: G.datumDE, zeilen: G.zeilen, liste: G.liste,
  zahlwort: G.zahlwort, probenSammeln: G.probenSammeln, projektSicht: G.projektSicht, projektNummer: G.projektNummer,
  gleichesProjekt: G.gleichesProjekt, text: G.text, mitArtikel: G.mitArtikel, objektImSatz: G.objektImSatz };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtText = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

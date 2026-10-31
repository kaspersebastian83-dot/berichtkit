/* BerichtKit – Berichtsmodell: Fassade über die Berichtsarten (ohne Browserteile, in Node testbar).
   Die Bausteine stehen in bericht-gemeinsam.js, die Texte je Berichtsart in bericht-asbest.js (später bericht-brand.js).
   app.js und die Tests sprechen nur mit dieser Datei (globalThis.BerichtText); bericht() wählt die Berichtsart nach form.art. */
(function (root) {
'use strict';
const lade = (name, datei) => root[name] || (typeof require === 'function' ? require(datei) : null);
const G = lade('BerichtGemeinsam', './bericht-gemeinsam.js');
const ARTEN = { asbest: lade('BerichtAsbest', './bericht-asbest.js') };

/** Alle Berichtsarten, die es geben soll (Reihenfolge = Auswahl); bereit sind die mit eigenem Modul (ARTEN). */
const BERICHTSARTEN = [
  { art: 'asbest', name: 'Asbestbericht' },
  { art: 'brand', name: 'Brandbericht' },
].map(a => ({ ...a, bereit: !!ARTEN[a.art] }));
/** form.art → Berichtsart; leer oder fehlend = 'asbest' (alle Berichte bis 1.9.0). Unbekannte Werte bleiben unbekannt. */
const berichtsart = form => G.s(form && form.art).toLowerCase() || 'asbest';

/** Berichtsmodell für eingabe.form.art (siehe Modellbeschreibung in bericht-asbest.js). Eine Berichtsart ohne Modul wirft –
    die App bietet sie dann gar nicht erst an („kommt bald“). */
function bericht(eingabe) {
  const art = berichtsart(eingabe && eingabe.form), modul = ARTEN[art];
  if (!modul) throw new Error(`Berichtsart „${art}“ gibt es in BerichtKit noch nicht.`);
  return modul.bericht(eingabe);
}

const API = { VERSION: 1, BERICHTSARTEN, berichtsart, bericht,
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

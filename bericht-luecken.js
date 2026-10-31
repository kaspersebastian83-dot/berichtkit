/* BerichtKit – welche Lücke im Bericht füllt welches Feld im Formular (je Berichtsart). Nur diese Tabelle kennt die
   Zuordnung; app.js zeigt daraus den Zähler „n Stellen noch offen“, springt per Klick zum Feld und umrandet leere
   Pflichtfelder gelb. Lücken, die nicht in BerichtKit gefüllt werden (Projektzentrale, LabelKit, ResultKit, in Word),
   zählen mit und nennen, wo sie zu füllen sind.
   Eintrag: { luecke: '[Text]' oder /Muster/, feld: CSS-Auswahl der Eingabe(n), ziel: CSS-Auswahl zum Hinscrollen
   (wenn es kein Feld gibt), wo: kurze Angabe für Tooltip und Hinweisliste }.
   Eine Lücke, die hier fehlt, gilt als „in Word ausfüllen“ – tests/berichtsart.cjs prüft, dass jede Lücke der Beispielberichte
   einen Eintrag hat. */
(function (root) {
'use strict';

const PZ = 'in der Projektzentrale eintragen';
const FELDER = {
  asbest: [
    { luecke: '[Auftragsdatum]', feld: '#fAuftrag', wo: 'Auftrag › Auftragsdatum' },
    { luecke: '[Eingangsdatum]', feld: '#fEingang', wo: 'Bericht › Eingangsdatum' },
    { luecke: '[Auftraggeber]', feld: '#fAg', wo: 'Auftrag › Auftraggeber im Satz (Deckblatt: Projektzentrale)' },
    { luecke: '[Versicherer]', feld: '#fVers', wo: 'Auftrag › Versicherer' },
    { luecke: '[Probenehmer]', feld: '#fPn', wo: 'Personen › Probenahme durch' },
    { luecke: '[Sachverständige(r)]', feld: '#fSv', wo: 'Personen › Unterschrift' },
    { luecke: '[Labor]', feld: '#fLabor', wo: 'Personen › Labor' },
    { luecke: '[KI-Wert]', feld: '#probenListe input[data-art="ki"]', wo: 'Proben › KI (aus dem Prüfbericht)' },
    { luecke: '[Material]', ziel: '#probenListe', wo: 'LabelKit › Bauteil / Material' },
    { luecke: '[Probenahmedatum]', ziel: '#probenListe', wo: 'LabelKit › Datum der Probenahme' },
    { luecke: '[Prüfbericht-Nr.]', ziel: '#probenListe', wo: 'ResultKit › Laborergebnisse übernehmen' },
    { luecke: '[Projektnummer]', wo: PZ },
    { luecke: '[VN]', wo: PZ },
    { luecke: '[Risiko]', wo: PZ },
    { luecke: '[Schadenort]', wo: PZ },
    { luecke: '[Objekt]', wo: PZ },
    { luecke: /^\[Foto fehlt/, ziel: '#probenListe', wo: 'Proben › Foto – Datei nicht lesbar: in FotoKit prüfen, anderes Foto wählen oder in Word einfügen' },
    { luecke: /^\[Schlussfolgerung/, wo: 'in Word ergänzen' },
  ],
};
const IN_WORD = 'in Word ausfüllen';

/** Eintrag zu einer Lücke (oder null) */
function eintrag(luecke, art) {
  return (FELDER[art || 'asbest'] || []).find(e => (e.luecke instanceof RegExp ? e.luecke.test(luecke) : e.luecke === luecke)) || null;
}
/** Lücken (modell.luecken, je Text einmal, in Berichtsreihenfolge) → [{ luecke, feld, ziel, wo, bekannt }] */
function zuordnen(luecken, art) {
  return (luecken || []).map(l => {
    const e = eintrag(l, art);
    return { luecke: l, feld: (e && e.feld) || '', ziel: (e && e.ziel) || '', wo: (e && e.wo) || IN_WORD, bekannt: !!e };
  });
}
/** Offene Lücken eines Berichtsmodells, wie sie in der Word-Datei stehen: modell.luecken plus die Lücken, die erst
    bericht-docx.js einsetzt – fehlende Projektnummer auf dem Deckblatt und [Foto fehlt: …] für jedes Foto im Bericht, dessen
    Datei nicht lesbar ist (fotosFehlen = Dateinamen, z. B. aus der Vorschau oder beim Speichern geladen). Für Zähler, Hinweise,
    Rückfrage vor dem Speichern und Protokoll – das Modell selbst bleibt unverändert. */
function offene(m, fotosFehlen) {
  const l = [...((m && m.luecken) || [])];
  if (m && m.deckblatt && !m.deckblatt.projektnummer && !l.includes('[Projektnummer]')) l.unshift('[Projektnummer]');
  const fehlt = new Set(fotosFehlen || []);
  if (fehlt.size) for (const a of (m && m.abschnitte) || []) for (const x of a.inhalt || [])
    if (x.t === 'fig' && fehlt.has(x.datei) && !l.includes(`[Foto fehlt: ${x.datei}]`)) l.push(`[Foto fehlt: ${x.datei}]`);
  return l;
}
/** „1 Stelle noch offen“ / „3 Stellen noch offen“ / '' */
const zaehlerText = n => (n === 1 ? '1 Stelle noch offen' : n > 1 ? `${n} Stellen noch offen` : '');

const API = { FELDER, IN_WORD, eintrag, zuordnen, offene, zaehlerText };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtLuecken = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
    // Freitext-Schreibweise (bericht-gemeinsam.js freitext) – der Asbestbericht hat noch keine Freitextfelder
    { luecke: '[Bildunterschrift ergänzen]', wo: 'FotoKit › Beschreibung des Fotos – oder im Freitext „[Abb: Datei | Bildunterschrift]“' },
  ],
  // Brandbericht (bericht-brand.js, ab 1.12.0; 5.2–5.7 ab 1.13.0; Freitextfelder 5.1, 6., 7., 8. ab 1.14.0)
  brand: [
    { luecke: '[Auftragsdatum]', feld: '#fAuftrag', wo: 'Auftrag › Auftragsdatum' },
    { luecke: '[Auftraggeber]', feld: '#fAg', wo: 'Auftrag › Auftraggeber im Satz (Deckblatt: Projektzentrale)' },
    { luecke: '[Versicherer]', feld: '#fVers', wo: 'Auftrag › Versicherer' },
    { luecke: '[Umfang wählen]', ziel: '#fbUmfang', wo: 'Brandbericht › Umfang (Gebäude, technische Einrichtung, Warenvorräte)' },
    { luecke: '[Anwesende eintragen]', feld: '#fbAnwesende', wo: 'Brandbericht › Weitere Anwesende (oder „nur unser Büro“ / „Teilnehmerliste“)' },
    { luecke: '[Gefahrenbereich wählen]', feld: '#fbGb', wo: 'Brandbericht › Gefahrenbereich' },
    { luecke: '[Probenehmer]', feld: '#fPn', wo: 'Personen › Vor Ort / Probenahme' },
    { luecke: '[Sachverständige(r)]', feld: '#fSv', wo: 'Personen › Unterschrift' },
    { luecke: '[Labor]', feld: '#fLabor', wo: 'Personen › Labor' },
    { luecke: '[KI-Wert]', feld: '#probenListe input[data-art="ki"]', wo: 'Proben › KI (aus dem Prüfbericht)' },
    { luecke: '[Material]', ziel: '#probenListe', wo: 'LabelKit › Bauteil / Material' },
    { luecke: '[Prüfbericht-Nr.]', ziel: '#anlagenListe', wo: 'ResultKit › Laborergebnisse übernehmen' },
    { luecke: '[Prüfdatum Brandgeruch]', wo: 'LabelKit › Brandgeruch › Prüfdatum' },
    { luecke: '[Anlage-Nr. Brandgeruch]', ziel: '#anlagenListe', wo: 'Projektzentrale › Anlage PN 98 / Brandgeruch erstellen (dann anhaken)' },
    { luecke: '[Probenahme beschreiben]', wo: 'LabelKit › Proben erfassen, sonst in Word ergänzen' },
    { luecke: '[Untersuchungsparameter]', wo: 'LabelKit › Sonstige Proben › Untersuchungsparameter' },
    { luecke: '[Hintergrundreferenz 10 oder 100 µg/m²]', feld: '#fbReferenz', wo: 'Brandbericht › Hintergrundreferenz PAK (Vorbelegung aus der Nutzung der Projektzentrale)' },
    { luecke: '[Ergebnis der Brandgeruchprüfung ergänzen]', wo: 'LabelKit › Brandgeruch: Ergebnisse aufdecken und alle fünf Bewertungen eintragen' },
    { luecke: /^\[Bewertung der .+ ergänzen\]$/, wo: 'in Word ergänzen' },
    { luecke: /^\[Einordnung der (?:Chlorid|PAK)-Wischproben ergänzen\]$/, wo: 'ResultKit › Werte prüfen (Einheit je Fläche), sonst in Word ergänzen' },
    { luecke: '[Abschluss Chlorid ergänzen]', wo: 'in Word ergänzen (Variante A oder B, siehe Hinweise)' },
    { luecke: /^\[Schlussfolgerung für /, wo: 'in Word ergänzen' },   // nicht eindeutiges Asbestergebnis – „[Schlussfolgerungen ergänzen]“ hat ein Feld
    { luecke: '[Projektnummer]', wo: PZ },
    { luecke: '[Schadendatum]', wo: PZ + ' (Schadendatum oder „nicht bekannt“)' },
    { luecke: '[Ortstermin]', wo: PZ + ' (Ortstermin)' },
    { luecke: '[VN]', wo: PZ },
    { luecke: '[Risiko]', wo: PZ },
    { luecke: '[Schadenort]', wo: PZ },
    { luecke: '[Objekt]', wo: PZ },
    { luecke: '[Schaden-Nr.]', wo: PZ },
    { luecke: /^\[Foto fehlt/, wo: 'Foto – Datei nicht lesbar: in FotoKit prüfen, im Freitext den Dateinamen prüfen, anderes Foto wählen oder in Word einfügen' },
    // Freitextfelder (ab 1.14.0): feld = leeres Feld gelb umrandet, ziel = Sprung auch dann, wenn nur die Vorbelegung drinsteht
    { luecke: '[Brandlast und Schadenbild beschreiben]', feld: '#fbSchadenbild', ziel: '#fbSchadenbild', wo: 'Brandbericht › 5.1 Brandlast und Schadenbild' },
    { luecke: '[Sanierungsmaßnahmen Gebäude beschreiben]', feld: '#fbSanGebaeude', ziel: '#fbSanGebaeude', wo: 'Brandbericht › 6. Sanierungsmaßnahmen Gebäude' },
    { luecke: '[Sanierungsmaßnahmen technische Einrichtung beschreiben]', feld: '#fbSanTechnik', ziel: '#fbSanTechnik', wo: 'Brandbericht › 6. Sanierungsmaßnahmen technische Einrichtung' },
    { luecke: '[Sanierungsmaßnahmen Warenvorräte beschreiben]', feld: '#fbSanWaren', ziel: '#fbSanWaren', wo: 'Brandbericht › 6. Sanierungsmaßnahmen Warenvorräte' },
    { luecke: '[Sanierungsmaßnahmen ergänzen]', ziel: '#fbUmfang', wo: 'Brandbericht › Umfang anhaken, dann die Sanierungsmaßnahmen dazu eintragen' },
    { luecke: '[Schlussfolgerungen ergänzen]', feld: '#fbSchluss', ziel: '#fbSchluss', wo: 'Brandbericht › 6. Schlussfolgerungen' },
    { luecke: '[Zusammenfassung der Sanierungsmaßnahmen ergänzen]', feld: '#fbZusammenfassung', ziel: '#fbZusammenfassung', wo: 'Brandbericht › 8. Zusammenfassung' },
    { luecke: '[Bereich eintragen]', feld: '#fbBereich', wo: 'Brandbericht › 7. Bereich (bei zwei Bereichen nötig)' },
    { luecke: '[Zweiten Bereich eintragen]', feld: '#fbBereich2', wo: 'Brandbericht › 7. Zweiter Bereich' },
    { luecke: '[Gefahrenbereich zweiter Bereich wählen]', feld: '#fbGb2', wo: 'Brandbericht › 7. Gefahrenbereich zweiter Bereich' },
    { luecke: '[Bildunterschrift ergänzen]', wo: 'FotoKit › Beschreibung des Fotos – oder im Freitext „[Abb: Datei | Bildunterschrift]“' },
  ],
};
const IN_WORD = 'in Word ausfüllen';

/** Eintrag zu einer Lücke (oder null) */
function eintrag(luecke, art) {
  return (FELDER[art || 'asbest'] || []).find(e => (e.luecke instanceof RegExp ? e.luecke.test(luecke) : e.luecke === luecke)) || null;
}
/** Lücken (modell.luecken, je Text einmal, in Berichtsreihenfolge) → [{ luecke, feld, ziel, wo, bekannt }].
    eigene = modell.lueckenFelder: Lücken, die jemand selbst in ein Freitextfeld geschrieben hat ({ '[Text]': { feld: '#id', wo } }) –
    sie springen zu ihrem Feld; die Tabelle oben geht vor (gleicher Text wie eine Lücke von BerichtKit). */
function zuordnen(luecken, art, eigene) {
  return (luecken || []).map(l => {
    const x = eigene && Object.prototype.hasOwnProperty.call(eigene, l) ? eigene[l] : null;
    const e = eintrag(l, art) || (x && x.feld ? { feld: x.feld, ziel: x.feld, wo: `Brandbericht › ${x.wo || 'Freitext'} (selbst eingetragene Lücke – im Feld oder in Word ausfüllen)` } : null);
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

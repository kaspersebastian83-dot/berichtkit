# BerichtKit (Spektron)

Erstellt den **Asbest-Untersuchungsbericht** („1. Mitteilung“) als Word-Datei im Format des Büros – aus den Daten, die
die anderen Spektron-Apps schon im Projektordner abgelegt haben. Läuft im Browser (Edge/Chrome), ohne Server, ohne Installation.
Der **Brandbericht** („Sanierungsvorschlag“ / „Untersuchungsbericht“) ist im Aufbau: ab 1.12.0 als Vorschau mit
`#projekt=<Ordner>&art=brand&vorschau=1` (Deckblatt, Kopf, 1.–4., ab 1.13.0 5. Befund mit 5.2–5.7, 7., Unterschriften, Anlagen;
5.1, 6., 8. als Lücke) –
Speichern in „Mitteilungen“ ist gesperrt, „Entwurf herunterladen“ geht.

Adresse: `https://kaspersebastian83-dot.github.io/berichtkit/` · aus der Projektzentrale: `…/berichtkit/#projekt=<Ordnername>`

## Was woher kommt

| Im Bericht | Quelle | Datei |
|---|---|---|
| Deckblatt (VN/Auftraggeber, Risiko/Schadenort, Versicherer, Schaden-Nr.), Auftragsdatum | Projektzentrale | `_Projekt.json` – „mit Versicherung“, wenn `versicherer` eingetragen ist oder (bei eingetragenem VN) der Auftraggeber eine Versicherung ist, sonst „ohne“; im Bericht unter „Auftrag“ umstellbar. Versicherer: `versicherer`, sonst der Auftraggeber (als „angenommen“ angezeigt, mit „✓ stimmt“ bestätigt – `versOk` gilt nur für diesen Auftraggeber) |
| Proben: Entnahmestelle, Material (`z3`, leer → aus der Matrix), Probenahmedatum; Probenehmer (Feldbogen, nur genauer Name) | LabelKit (Asbest-Tabelle) | `*_Daten.json` – die Datei, die ResultKit übernommen hat (`auftrag.quelle`), sonst die neueste |
| Ergebnis, Labor-Nr., Prüfbericht-Nr., KI-Wert (falls im XML) | ResultKit | `_Ergebnisse.json` |
| Fotos zu den Proben (Probe-Nr. in FotoKit) | FotoKit | `_Bildumbenenner.json` + `Fotos/` |
| Anlagen (Bilddokumentation, Probenplan, optional Ergebniskarte/Raumbuch/Wandansichten/Anlage Probenahme) | FotoKit, PlanKit | `Fotos/Bilddokumentation_*.pdf`, `Pläne/Probenplan *.pdf`, `Mitteilungen/*_Raumbuch_*.docx` … – siehe „Anlagen“ |
| Namen | Projektzentrale | `<Archiv>/_Spektron-Mitarbeiter.json` |
| Rollen, Frau/Herr (ohne Eintrag: Büro-Standard nach Nachname), Labor | BerichtKit „Einstellungen“ | `<Archiv>/_Spektron-BerichtKit.json` – die Rolle („als Sachverständige(r)“/„als Messtechniker(in)“) ist je Unterschrift vorgewählt und im Bericht änderbar. Ab 1.8.0 wird auch `rolle: 'sv'` gespeichert; ohne `rolle` gilt die Person als SV, die Rolle aber als „nicht festgelegt“ (Hinweis, wenn sie selbst Proben genommen hat) |
| Unterschriften | von Hand abgelegt | `<Archiv>/_Spektron-Unterschriften/<Kürzel>.png` |
| Angaben zum Bericht (Variante, Daten, Personen, Auswahl der Proben und Fotos) | BerichtKit, gemeinsam für alle | `_Spektron/BerichtKit/_BerichtKit.json` (Vor Spektron: `Mitteilungen/`) |

Die Ablageorte im Projekt bestimmt das gemeinsame Modul `spektron-ordner.js` (Bereich `berichtkit`; byte-gleich mit der Projektzentrale, in CI geprüft).

## In der Suite

- **Projektzentrale:** Knopf „Asbestbericht“ in Stufe 4 (Gutachten) öffnet BerichtKit mit dem Projekt (`#projekt=<Ordnername>`).
- **Spektron-Leiste** oben (`mosaik-leiste.js`, Block byte-gleich mit LabelKit, FotoKit, ResultKit, PlanKit, BelegKit): BerichtKit ist der Schritt nach PlanKit; Haken, sobald ein Bericht `<n>._Mitteilung_<Nr>.docx` in „Mitteilungen“ liegt.
- **Gemeinsame Angaben:** Was im Formular selbst geändert wird, liegt in `_BerichtKit.json` im Projekt und gilt für alle Kollegen. Hat jemand inzwischen gespeichert, lädt BerichtKit dessen Stand und meldet es – nichts wird stumm überschrieben. Dazu die Liste der gespeicherten Berichte (Datei, Zeit, Kürzel aus „Ich bin …“, Mitteilung-Nr., Berichtsdatum).
- **Vorgaben werden nicht eingefroren** (`bericht-vorgaben.js`): Heutiges Datum, nächste freie Mitteilung, Auftragsdatum und Auftraggeber
  (Projektzentrale), Probenehmer (LabelKit), Labor (Einstellungen) werden bei jedem Öffnen neu berechnet; in der Datei stehen nur selbst
  geänderte Felder (`nurEigene: true`). Gibt es die gespeicherte Mitteilung-Nr. schon in „Mitteilungen“, wird die nächste freie vorgeschlagen
  (außer die Nummer wurde bewusst zurückgestellt – `mitteilungAm` – und seitdem kein Bericht mit ihr gespeichert);
  ein Datum, das zu einer schon gespeicherten Mitteilung gehört, weicht dem heutigen – beides mit Hinweis. Ältere Dateien (bis 1.6.1, ganzes
  Formular) werden beim Öffnen bereinigt: leere Werte, Werte gleich der heutigen Vorgabe und ein Datum vor heute fallen weg, alles andere bleibt
  (Hinweis nennt die Felder, die von den Projektdaten abweichen).
- **Daten neu lesen:** `_Projekt.json`, die LabelKit-Datei und `_Ergebnisse.json` werden beim Zurückkommen ins Fenster (z. B. nach „Übernehmen“
  in ResultKit) und vor dem Speichern/Herunterladen verglichen (Name, Größe, Änderungszeit) und bei Änderung neu gelesen – mit bleibendem Hinweis
  „Daten neu gelesen: …“. Vor dem Speichern hält BerichtKit dann an: erst die neue Vorschau ansehen, dann noch einmal klicken.
- **Offline:** Service Worker „Netz zuerst“ wie in der Projektzentrale (`sw.js`).
- **Handbuch:** Knopf „📘 Handbuch“ öffnet AidKit, Kapitel `#app-berichtkit` („BerichtKit Schritt für Schritt“).

## Regeln

- **Nur lesen** – BerichtKit ändert keine Projektdatei der anderen Apps (Anlagen werden nur gefunden, nie verschoben oder umbenannt). Es schreibt nur die Word-Datei nach `Mitteilungen/`
  (vorhandene Datei: Dialog „Ersetzen“ / „Daneben als (2) speichern“ / „Abbrechen“ – Abbrechen ist der Standard; nennt eine Büroaufgabe die Datei
  schon, gibt es statt „Ersetzen“ nur „Als nächste Mitteilung speichern“), seine eigenen Angaben (`_BerichtKit.json`) und die Einstellungen in den Archivordner.
  Die Büroaufgaben (`_Spektron/Buero`, bzw. `_Buero`) werden dafür nur gelesen.
- **Laborwerte und Probenbezeichnungen werden nie bearbeitet.** Ergebnistexte kommen wörtlich aus dem Prüfbericht (über ResultKit).
  Einzige Ausnahme: ein KI-Wert, der nicht in den Labordaten steht, kann aus dem PDF eingetragen werden (im Formular markiert).
- **Nichts wird erfunden.** Fehlt eine Angabe, steht sie im Bericht als gelb markierte Lücke, z. B. `[Auftragsdatum]`, mit einem
  Word-Kommentar am Rand („Noch ausfüllen: Auftragsdatum“, Autor „BerichtKit“) – in Word mit Überprüfen › Nächster Kommentar von
  Lücke zu Lücke; ist die Stelle gefüllt, den Kommentar löschen. Ausnahme: Lücken in der Kopfzeile der Folgeseiten bleiben nur gelb
  (einen Kommentar dort lädt LibreOffice nicht) – sie stehen immer auch auf dem Deckblatt oder im Text und haben dort ihren Kommentar.
- **Offene Stellen im Formular:** oben „n Stellen noch offen“; Klick springt zum Feld, das die nächste Lücke füllt (Zuordnung in
  `bericht-luecken.js`), leere Pflichtfelder sind gelb umrandet. Lücken ohne Feld in BerichtKit (Projektzentrale, LabelKit, in Word)
  nennen in den Hinweisen, wo sie zu füllen sind.
- **Keine Namen, Unterschriften oder Kundendaten im Repository** – Namen kommen aus der Mitarbeiterliste, Unterschriften aus dem Archivordner.
  Die Testdaten sind erfunden.

## Prüfungen vor dem Speichern

- **Gesperrt** (nur „Entwurf herunterladen“ mit Kopfzeile „ENTWURF – nicht versenden“ und `_ENTWURF` im Dateinamen):
  LabelKit-Datei eines anderen Projekts; LabelKit-Asbestprobe ohne Ergebnis in ResultKit (unter „Proben“ abwählbar).
- **Hinweis:** Entnahmestelle LabelKit ↔ Prüfbericht weicht ab (Vergleich wie ResultKit `beschreibungWeichtAb`; wird nach dem
  Gegentest mit echten Projekten zur Sperre, Schalter `ABGLEICH_SPERRT` in `bericht-gemeinsam.js`); vorläufiger Prüfbericht (dazu Kopfzeile
  „Vorläufig“); Versicherer, Probenehmer oder Unterschrift nur angenommen – je eine Meldung mit „✓ stimmt“ (`pnQuelle`, `versOk`, `svOk`).
  Unterschrift angenommen heißt: Der Zuständige ist Messtechniker(in) oder fehlt, vorgeschlagen ist die erste Sachverständige der Liste (`svVorschlag`).
- **Stornierte Proben** (LabelKit ab 4.49.0, `storniert: {am, kuerzel, grund}` an der Asbestprobe): keine Probe mehr – nicht in Tabelle 1, nicht im Text
  (Probenzahl, Aufzählungen, Sätze je Probe), nicht in der Probenliste, nicht im Abgleich; sie sperrt nie. Die übrigen Proben behalten ihre
  LabelKit-Nummer (kein Neu-Durchnummerieren, Tabelle 1 z. B. 1, 2, 4). Hat der Prüfbericht trotzdem einen Wert für sie, kommt er nicht in den
  Bericht – nur Hinweis „P3 ist in LabelKit storniert – der Laborwert (Prüfbericht …) kommt nicht in den Bericht.“
  Ausnahme: Sind **alle** Asbestproben in LabelKit storniert und bleibt kein Ergebnis übrig, sperrt das (Datenfehler, nur Entwurf) –
  „Alle Asbestproben in LabelKit sind storniert (P3 und P7) – ohne Probe gibt es keinen Bericht. …“; ein Bericht mit 0 Proben wäre falsch.
- **Lücken** sperren nicht – Rückfrage vor dem Speichern; die Übergabe ans Büro prüft, ob noch welche in der Word-Datei stehen.
- Nach dem Speichern: `_BerichtKit.json` → `berichte[]` mit `anlagen` (alle Anlage-Dateien, z. B. `Laborergebnisse/<Prüfbericht>.pdf`, `Fotos/Bilddokumentation_….pdf`), `anlagenListe` und `luecken`; Knopf
  „Ans Büro übergeben →“ öffnet `../Projektzentrale/#projekt=<Ordner>&uebergabe=Mitteilungen/<Datei>`.

## Anlagen

`anlagen.js` (ohne Browserteile, `node tests/anlagen.cjs`) erkennt, was im Projektordner liegt, und nummeriert in der **festen
Hausreihenfolge**: Anlage 1 = Prüfbericht(e) (mehrere zählen hoch), dann **Bilddokumentation**, dann **Probenplan**. Das Modul kennt
nur Arten von Anlagen; welche ein Bericht erwartet, sagt das Profil (`PROFILE.asbest`, `PROFILE.brand`). Brandbericht: Prüfberichte
in der Reihenfolge Chlorid, PAK, Asbest/KMF (ein Bericht für mehrere Parameter = eine Anlage), dann Bilddokumentation, Probenplan und
– nur mit Brandgeruch-Proben in LabelKit – die **Sensorische Prüfung auf Brandgeruch** aus der Projektzentrale.

| Art | Wo | Erkannt an | Veraltet, wenn … |
|---|---|---|---|
| Bilddokumentation | `Fotos/` | `Bilddokumentation_…pdf`, Teile `…_Teil_1_von_2.pdf` = **eine** Anlage; FotoKit ab 1.29 vermerkt die erzeugte PDF (`bilddoku`) | FotoKit: `dokuGeaendert` nach `bilddoku.erstellt` (Beschreibungen, Auswahl, Reihenfolge, Projektdaten geändert) |
| Probenplan | `Pläne/` | `Probenplan <Ordner>.pdf` (alle Geschosse) oder `… - EG.pdf`, `… - OG.pdf` (= eine Anlage), „ (2)“ = neuere Fassung | `.probenplan` nach dem PDF gespeichert |
| Ergebniskarte | `Pläne/` | `Probenplan … - Ergebniskarte.pdf` | wie Probenplan |
| Raumbuch, Wandansichten, Anlage Probenahme | `Mitteilungen/` | PlanKit-Namen `<Nr>_Raumbuch_<Datum>.docx` usw. | Prüfsumme der `.probenplan` laut `_Anlagen-Protokoll.txt` ≠ jetzt; sonst Dateizeit |
| Brandgeruch (nur Brandbericht) | `Mitteilungen/` | Projektzentrale `<Nr>_<Titel>_Brandgeruch_<Datum>.docx` bzw. `…_PN98-Brandgeruch_…` (neueste); Anlagen-Nr. aus dem Titel („Anlage-4“) | Prüfsumme der LabelKit-Datei laut `_Anlagen-Protokoll.txt` ≠ jetzt; sonst LabelKit-Datei neuer als die Anlage |

- Gefunden und aktuell → angehakt. **Veraltet oder unvollständig → Hinweis und nicht angehakt** (selbst anhaken geht, mit Hinweis).
  Feste Anlagen, die fehlen, stehen grau da mit Link in die App. Jede feste Anlage, die nicht oder mit Mangel im Bericht ist (fehlt,
  veraltet, unvollständig), bekommt zusätzlich einen Hinweis mit Sprung in die App – nichts fällt still heraus. Ergebniskarte, Raumbuch, Wandansichten und Anlage Probenahme
  sind optional: angeboten, nie vorgehakt, angehakt hinter dem Probenplan. „+ Weitere Datei …“ für eigene Anlagen aus dem Projektordner.
- Die eigene Wahl gilt nur für denselben Stand (`form.anlagen[art].key`): eine neu erstellte oder inzwischen veraltete Anlage wird wieder nach der Regel vorgehakt.
- Text: In „2. Probenahme und Untersuchung“ ein Satz „Die Entnahmestellen sind zusätzlich in der Bilddokumentation (Anlage 2) und im Probenplan (Anlage 3) dargestellt.“ – je nach Auswahl gekürzt.
- Trägt die Bilddokumentation eine andere Anlagen-Nr. als im Bericht (FotoKit „Anlagen-Nr.“), erscheint ein Hinweis.
- Neu gelesen beim Öffnen, wenn das Fenster wieder nach vorn kommt (z. B. aus FotoKit) und vor dem Speichern.
- Beim Speichern: `berichte[].anlagen` = Pfade **aller** Anlage-Dateien (die Übergabe in der Projektzentrale hakt sie vor), `anlagenListe` = `{ nr, art, titel, dateien }`.

## Texte

Aufbau (ab 1.10.0, Vorbereitung für weitere Berichtsarten):

| Datei | Inhalt |
|---|---|
| `bericht-text.js` | Fassade für `app.js` und Tests (`BerichtText`): wählt die Berichtsart nach `form.art` (leer = `asbest`), `BERICHTSARTEN` mit `bereit` |
| `bericht-gemeinsam.js` | Bausteine jeder Berichtsart: Helfer, Lücken, Personen/Rollen, Proben aus LabelKit/ResultKit mit Asbest-/KMF-Befund und Abgleich, Projektsicht, Deckblatt mit/ohne Versicherung, Kopfzeilen, Auftraggeber mit Artikel, Unterschriften, Anlagen |
| `bericht-asbest.js` | Berichtsart `asbest` – die Texte unten |
| `bericht-brand.js` | Berichtsart `brand` (Doc „Textbausteine Brand-Sanierungsvorschlag“ + Entscheidungen aus fünf echten Mitteilungen) – ab 1.12.0 das Gerüst: Deckblatt („Schaden vom:“ / „Brandschaden“), Kopf, 1. Veranlassung, 2. Aufgabenstellung, 3. Ortsbesichtigung, 4. Probenahme (ab 1.13.0 mit Chlorid-Material/-Bohrmehl und weiteren Proben aus LabelKit „Sonstige“), 7. Arbeitsschutzmaßnahmen, Unterschriften, Anlagen; ab 1.13.0 5. Befund: 5.2 Chlorid, 5.3 PAK, 5.4 KMF, 5.5 Asbest, 5.6 Brandgeruch, 5.7 weitere Untersuchungen (nur, was es gibt; Spanne, Zähl-Absatz, höchster Wert, < BG, Referenzprobe/Freimessung, Ergebnistabellen hinter dem Haken, Asbest-Tabelle immer); 5.1, 6., 8. als Überschrift mit Lücke. Eigene Angaben der Brand-Seite stehen in `form.brand` (in `_BerichtKit.json` unter `brand`, feldweise gemerkt) |
| `bericht-bewertung.js` | ab 1.13.0: Einordnung der Laborwerte für 5.2/5.3 – Zahlen lesen, BG/n. n., KORROSION-CHLORID v1 (5–10 µg/cm², Einheit umgerechnet) und VdS-Faktor Σ16 EPA-PAK **aus ResultKit `bewertung.ts`/`uebersicht.ts`**, Rolle Referenzprobe/Freimessung aus dem Datenarchiv der Projektzentrale, Anhang B (VDI 3866 Blatt 5) aus `nwg` – dort ändern, hier nachziehen (`tests/brand.cjs` vergleicht die Tabellen, wenn `../resultkit` daneben liegt) |
| `bericht-luecken.js` | je Berichtsart: welche Lücke welches Formularfeld füllt (Zähler, Sprung, gelbe Umrandung) bzw. wo sie sonst zu füllen ist |

Berichtsart aus der Projektzentrale: `#projekt=<Ordner>&art=asbest|brand`. Eine Berichtsart, die noch nicht bereit ist, zeigt
„kommt bald“ mit Knopf „Asbestbericht öffnen“ – nie einen Bericht der falschen Art; hat sie schon ein Modul (Brand), daneben
„Vorschau ansehen (noch nicht fertig)“ (`&vorschau=1`): Formular und Vorschau wie sonst, das Modell trägt aber immer die Sperre
„noch im Aufbau“ (`bericht-text.js` `BEREIT`). `form.art` ist eine Vorgabe und steht nicht in `_BerichtKit.json`.

Die Asbest-Texte folgen dem Doc „Textbausteine Asbest-Untersuchungsbericht“ (Stand 30.10.2026):
Veranlassung (Probenahme durch uns / zugestellte Probe mit Gewährleistungssatz), Probenahme und Untersuchung, Befund mit Tabelle 1
(immer, auch bei einer Probe), Schlussfolgerungen (TRGS 519; KMF nach TRGS 905 Fassung 2026 und TRGS 521), Unterschriften
(Sachverständige(r) allein oder mit Messtechniker; zugestellt: nur Sachverständige(r)), Anlagenverzeichnis je Prüfbericht.
Die Formatierung (A4, Arial 12, 1,5-zeilig, Deckblatt mit Logo, Kopfzeilen, „Seite X von Y“) baut `bericht-docx.js` – für jede
Berichtsart gleich; alle Texte (auch der Titel) kommen aus dem Modell. Blöcke: Absatz `p`, Unterüberschrift `h2` (kursiv, z. B. „5.1 …“),
Foto `fig`, Tabelle `tab` mit `spalten` (Breiten in twips, zusammen 9070; ohne Angabe gleich breit) und `ohneUmbruch` (z. B. Labor-Nr.).
Jede Lücke (`{ gap }`) wird gelb und bekommt ihren Kommentar in `bericht-docx.js` (außer in der Kopfzeile der Folgeseiten) – das
Modell kennt keine Kommentare.

## Tests

```
node tests/text.cjs              # alle Berichtsvarianten (Textbausteine)
node tests/anlagen.cjs           # Anlagen: erkennen, Hausreihenfolge, veraltet, mehrteilig
node tests/berichtsart.cjs       # Berichtsart wählen, Bausteine, Word: Spaltenbreiten je Tabelle, Unterüberschrift
node tests/asbest-golden.cjs     # Asbestbericht festgeschrieben (Beispielberichte); gewollte Änderung: --neu, Diff ansehen
node tests/brand.cjs             # Brandbericht: Regeln aus den Textbausteinen (erfundene Daten tests/daten/brand.cjs); mit ../resultkit: Einordnung gleich
node tests/brand-golden.cjs      # Brandbericht festgeschrieben (fünf Beispiele); gewollte Änderung: --neu, Diff ansehen
node tests/luecken-kommentare.cjs  # Word-Kommentar je Lücke (Asbest und Brand, Kopf-Lücken über alle Kombinationen); mit ../projektzentrale: word-luecken.js findet dieselben Lücken
                                   # --beispiel <datei.docx> / --brand <Ordner>: Dateien zum Ansehen (z. B. in LibreOffice)
                                   # (--beispiel <datei.docx> schreibt eine Datei mit vielen Lücken zum Ansehen)
node tests/sw.cjs                # Offline-Dateien vollständig; Leiste gleich wie LabelKit (falls ../labelkit daneben)
node tests/spektron-ordner.cjs   # gemeinsames Modul (mit ../projektzentrale byte-gleich)
node tests/browser.cjs           # im Browser: öffnen, Vorschau, Einstellungen, Word-Datei (Playwright)
node tests/render-beispiele.cjs <Ordner>   # Beispielberichte als .docx zum Ansehen (nicht in CI)
```

## Drittanbieter

- `vendor/docx.iife.js` – [docx](https://github.com/dolanmiu/docx) 9.8.1, MIT-Lizenz (`vendor/docx-LICENSE.txt`)
- `fonts.css` – IBM Plex Sans/Mono, SIL Open Font License 1.1

## Versionen

Version und Änderungen stehen in `app.js` (`APP_VERSION`, `CHANGELOG`) und erscheinen oben rechts in der App.

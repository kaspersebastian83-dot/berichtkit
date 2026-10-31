/* BerichtKit – Untersuchungsbericht (Word) aus den Spektron-Projektdaten; Berichtsart über #…&art= (bisher: Asbest).
   Liest nur: _Projekt.json (Projektzentrale), *_Daten.json (LabelKit), _Ergebnisse.json (ResultKit), _Bildumbenenner.json + Fotos (FotoKit).
   Schreibt nur: die Word-Datei in „Mitteilungen“ und – über „Einstellungen“ – _Spektron-BerichtKit.json im Archivordner.
   Laborwerte und Probenbezeichnungen werden nie bearbeitet; fehlende Angaben erscheinen im Bericht gelb markiert. */
'use strict';
const APP_VERSION = '1.10.0';
const APP_DATE = '31.10.2026';
const CHANGELOG = [
  ['1.10.0', '31.10.2026', 'Vorbereitung Brandbericht (Schritt 1, am Asbestbericht ändert sich nichts): Die Berichtstexte sind aufgeteilt in gemeinsame Bausteine (bericht-gemeinsam.js: Deckblatt mit/ohne Versicherung, Kopfzeilen, Personen, Unterschriften, Anlagen, Proben und Asbest-Befund) und den Asbestbericht (bericht-asbest.js); bericht-text.js wählt die Berichtsart. Die Projektzentrale kann die Berichtsart mitgeben (#…&art=asbest|brand) – „Brandbericht“ zeigt vorerst „kommt bald“ mit Knopf zum Asbestbericht. Word-Ausgabe: Spaltenbreiten je Tabelle und Unterüberschriften (kursiv) für spätere Berichtsarten. Geprüft: alle Beispielberichte als Modell und Word-Datei vorher/nachher gleich.'],
  ['1.9.0', '31.10.2026', 'Stornierte Proben (Folge zu LabelKit 4.49.0 „Proben stornieren“): Eine in LabelKit stornierte Asbestprobe ist keine Probe mehr – sie fehlt in Tabelle 1, im Text (Probenzahl, Aufzählungen, Sätze je Probe), in der Probenliste und im Abgleich der Entnahmestelle und sperrt das Speichern nie („… noch kein Ergebnis in ResultKit“ kommt für sie nicht mehr). Die übrigen Proben behalten ihre LabelKit-Nummer, es wird nicht neu durchnummeriert (z. B. 1, 2, 4). Steht im Prüfbericht trotzdem ein Wert für die stornierte Probe, kommt er nicht in den Bericht; ein Hinweis sagt es („P3 ist in LabelKit storniert – der Laborwert (Prüfbericht …) kommt nicht in den Bericht.“). Sind alle Asbestproben storniert, gibt es keinen Bericht ohne Proben: Speichern in „Mitteilungen“ ist dann gesperrt (nur Entwurf).'],
  ['1.8.0', '30.10.2026', 'Anlagen fallen nicht mehr still aus dem Bericht: Fehlt die Bilddokumentation oder der Probenplan, ist eine davon veraltet oder unvollständig, steht immer ein Hinweis da („… veraltet – nicht im Bericht. In FotoKit neu erstellen oder trotzdem anhaken.“) – mit Sprung in FotoKit bzw. PlanKit. Annahmen bestätigen: „Versicherer angenommen“ steht nur noch einmal in den Hinweisen, mit „✓ stimmt“ wie beim Probenehmer; ändert sich der Auftraggeber, fragt BerichtKit wieder. Ist der Zuständige Messtechniker (oder fehlt), schlägt BerichtKit für die Unterschrift die erste Sachverständige der Liste vor – jetzt sichtbar als „angenommen – bitte prüfen“ mit „✓ stimmt“. Einstellungen: Die Rolle „Sachverständige(r)“ wird jetzt ausdrücklich gespeichert („nicht festgelegt“ ist eine eigene Wahl) – der Hinweis „… hat die Proben genommen … Rolle nicht festgelegt“ ist nach einmaligem Festlegen weg und hat einen Knopf „Einstellungen öffnen“.'],
  ['1.7.0', '30.10.2026', 'Berichtsdatum und Mitteilung-Nr. bleiben nicht mehr stehen: Vorgaben (heutiges Datum, nächste freie Mitteilung, Auftragsdatum, Auftraggeber, Probenehmer, Labor) werden bei jedem Öffnen neu berechnet; in „_BerichtKit.json“ stehen nur noch Felder, die jemand selbst geändert hat. Gibt es die gespeicherte Mitteilung schon, schlägt BerichtKit die nächste freie vor (außer jemand hat die Nummer bewusst zurückgestellt und noch nicht gespeichert); ein Datum, das zu einer schon gespeicherten Mitteilung gehört, weicht dem heutigen – beides mit Hinweis. Ältere Angaben (bis 1.6.1) werden beim Öffnen einmal bereinigt; was davon bleibt und von den Projektdaten abweicht, nennt ein Hinweis. „Datei gibt es schon“: eigener Dialog mit „Ersetzen“, „Daneben als (2) speichern“ und „Abbrechen“ (Standard, auch Esc) – ist die Mitteilung schon beim Büro, gibt es kein „Ersetzen“, sondern „Als nächste Mitteilung speichern“. Projektdaten, LabelKit und ResultKit werden beim Zurückkommen ins Fenster und vor dem Speichern/Herunterladen neu gelesen, wenn sie sich geändert haben – mit bleibendem Hinweis „Daten neu gelesen“; vor dem Speichern hält BerichtKit dann an, damit du die neue Vorschau erst ansehen kannst.'],
  ['1.6.1', '30.10.2026', 'Entnahmestelle: Raum-Kürzel aus LabelKit (SZ, WZ, KiZ, GZ, HWR, TRH; AZ nicht – im Asbestbericht steht AZ für Asbestzement) werden in Tabelle 1 und in den Bildunterschriften ausgeschrieben, z. B. „Bodenaufbau SZ“ → „Bodenaufbau Schlafzimmer“. Nur ganze Wörter in genau dieser Schreibweise; Geschosse (OG, EG …) bleiben. Ein Hinweis nennt jede Ersetzung. LabelKit, der Abgleich mit dem Prüfbericht und die Laborübergabe bleiben unverändert. Unterschriften: Die PNG in „_Spektron-Unterschriften“ wird jetzt auch gefunden, wenn das Kürzel anders geschrieben ist (Leerzeichen, Punkte, Groß/klein – „Dr. Ka.png“ passt zu „Dr.Ka“).'],
  ['1.6.0', '30.10.2026', 'Anlagen: BerichtKit sucht im Projektordner, was als Anlage beiliegt, und nummeriert in der festen Hausreihenfolge – Anlage 1 Prüfbericht(e), dann Bilddokumentation (FotoKit, „Fotos“), dann Probenplan (PlanKit, „Pläne“). Gefunden und aktuell = angehakt; veraltet (nach dem Erstellen in FotoKit/PlanKit geändert) = Hinweis und nicht angehakt; fehlt = graue Zeile mit Link in die App. Eine Anlage aus mehreren Dateien (Bilddoku in Teilen, Plan je Geschoss) ist eine Anlage. Ergebniskarte, Raumbuch, Wandansichten und die Word-Anlage „Probenahme“ aus PlanKit werden angeboten, aber nur angehakt mitgenommen. „+ Weitere Datei …“ für eigene Anlagen. In „2. Probenahme und Untersuchung“ ein Satz mit Verweis auf Bilddokumentation und Probenplan; Hinweis, wenn die Bilddoku eine andere Anlagen-Nr. trägt. Alle Anlagen-Dateien gehen in die Übergabe ans Büro.'],
  ['1.5.0', '30.10.2026', 'Frau/Herr im Text ohne Einstellungen: Frau Dr. Pütt und Frau Jung, alle anderen aus dem Büro Herr (Einstellung geht vor; in der Unterschrift weiterhin ohne Anrede). Tabelle 1: Spalte „Probe“ nur mit der Nummer, Nummer und Labor-Nr. zentriert (samt Spaltenkopf), Textspalten linksbündig. Material: ist „Bauteil / Material“ in LabelKit leer, kommt es aus der Matrix (z. B. „Putz / Spachtelmasse“) – mit Hinweis.'],
  ['1.4.1', '30.10.2026', 'Projektprüfung vergleicht nur noch die Projektnummer: Steht im LabelKit-Feld „Projektnummer“ zusätzlich die Adresse (ältere Projekte, z. B. „26.0512 Stegerwaldstraße Leverkusen“), wird das Speichern nicht mehr fälschlich gesperrt. Eine andere Nummer sperrt weiter.'],
  ['1.4.0', '30.10.2026', 'Deckblatt „mit Versicherung“ (VN · Risiko · Versicherer) oder „ohne Versicherung“ (Auftraggeber · Schadenort) unter „Auftrag“ umstellbar – z. B. für Hausverwaltung, Sanierer oder Privatauftrag. Ohne Wahl entscheiden die Projektdaten: Versicherer eingetragen → mit; kein VN → ohne; VN da, aber der Auftraggeber ist keine Versicherung → ohne (mit Hinweis). Unterschriften: Jede Unterschrift kann jede Person sein, mit „als Sachverständige(r)“ oder „als Messtechniker(in)“ – vorgewählt nach den Einstellungen, für diesen Bericht änderbar (z. B. Messtechniker allein).'],
  ['1.3.0', '30.10.2026', 'Prüfungen vor dem Speichern: Versicherer aus der Projektzentrale (Feld „Versicherer“), sonst sichtbar „angenommen“; Probenehmer nur bei genauem Namen aus dem LabelKit-Feldbogen, sonst Hinweis „angenommen – bitte prüfen“ mit „✓ stimmt“; es zählt die LabelKit-Datei, die ResultKit übernommen hat; Entnahmestelle LabelKit ↔ Prüfbericht wird verglichen (vorerst Hinweis). Gesperrt wird „In Mitteilungen speichern“, wenn die LabelKit-Datei zu einem anderen Projekt gehört oder eine LabelKit-Probe noch kein Ergebnis hat (abwählbar) – dann gibt es nur „Entwurf herunterladen“ mit Kopfzeile „ENTWURF – nicht versenden“ und „_ENTWURF“ im Namen. Vorläufiger Prüfbericht: Hinweis und Kopfzeile „Vorläufig“. Gespeicherte Berichte merken sich die Prüfbericht-PDFs (Anlagen) und die Zahl der Lücken; danach „Ans Büro übergeben →“ in der Projektzentrale.'],
  ['1.2.0', '30.10.2026', 'Feinschliff nach dem ersten echten Bericht (26.0512): Versicherer als eigenes Feld – ist der Auftraggeber der VN selbst, erscheint er nicht mehr als Versicherer, sondern als Lücke; Auftraggeber im Satz mit Artikel („durch die … eG“); Lage wie „2. OG rechts“ im Text hinter der Adresse in Klammern; Labor-Nr. in Tabelle 1 ohne Umbruch; Hinweis, wenn der Probenehmer ohne festgelegte Rolle als Sachverständige(r) unterschreibt; Anlagen zweizeilig mit hängendem Einzug (Laborname bündig unter der Prüfbericht-Nr.); über jeder Überschrift zwei Leerzeilen, darunter eine, „1. Veranlassung“ ohne Abstand oben.'],
  ['1.1.0', '30.10.2026', 'Teil der Spektron-Suite: Spektron-Leiste oben (Projekt, Arbeitsschritte, Weiter), Knopf „📘 Handbuch“ (AidKit-Kapitel „BerichtKit Schritt für Schritt“), Angaben zum Bericht gemeinsam für alle im Projektordner („_Spektron/BerichtKit/_BerichtKit.json“, ältere Projekte „Mitteilungen“), offline nutzbar.'],
  ['1.0.0', '30.10.2026', 'Erste Fassung: Asbest-Untersuchungsbericht (Mitteilung) aus Projektzentrale, LabelKit, ResultKit und FotoKit – Vorschau, Lücken gelb, Word-Datei in „Mitteilungen“.'],
];
const SO = globalThis.SpektronOrdner, T = globalThis.BerichtText, V = globalThis.BerichtVorgaben;
const CFG_DATEI = '_Spektron-BerichtKit.json', MA_DATEI = '_Spektron-Mitarbeiter.json', SIG_ORDNER = '_Spektron-Unterschriften';
/** Unterschrift-Datei ↔ Kürzel ohne Groß-/Kleinschreibung, Leerzeichen und Punkte (wie SPEKTRON-ORDNERNAME): „Dr. Ka.png“ = „Dr.Ka“ = „DrKa“ */
const sigKey = k => String(k == null ? '' : k).normalize('NFC').toLowerCase().replace(/[\s.]/g, '');
const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- gemeinsamer Speicher der Suite (wie Projektzentrale): DB „mosaik-suite“, Schlüssel „archiv“ ---------- */
const SUITE = {
  db: null,
  open() {
    return this.db || (this.db = new Promise((res, rej) => {
      const r = indexedDB.open('mosaik-suite', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
};
/* ---------- Projektübergabe: #projekt=<Ordnername> (wie ResultKit/FotoKit) ---------- */
const PROJEKT_URL = {
  lesen: () => new URLSearchParams(location.hash.slice(1)).get('projekt') ?? new URLSearchParams(location.search).get('projekt'),
  setzen(name) {
    const url = new URL(location.href);
    const teile = url.hash.slice(1).split('&').filter(t => t && !new URLSearchParams(t).has('projekt'));
    if (name) teile.push('projekt=' + encodeURIComponent(name));
    url.searchParams.delete('projekt'); url.hash = teile.join('&');
    if (url.href !== location.href) try { history.replaceState(history.state, '', url); } catch (e) { /* file:// */ }
  },
};
/* ---------- Berichtsart: #…&art=asbest|brand (Projektzentrale) ----------
   Ohne Angabe: Asbestbericht. Eine Berichtsart, die es noch nicht gibt (T.BERICHTSARTEN, bereit:false), zeigt „kommt bald“
   statt eines Berichts der falschen Art. Die Berichtsart steht als Vorgabe im Formular (form.art), nie in den eigenen Angaben. */
const ART_URL = {
  lesen: () => String(new URLSearchParams(location.hash.slice(1)).get('art') ?? new URLSearchParams(location.search).get('art') ?? '').trim().toLowerCase(),
  /** art='' entfernt die Angabe */
  setzen(art) {
    const url = new URL(location.href);
    const teile = url.hash.slice(1).split('&').filter(t => t && !new URLSearchParams(t).has('art'));
    if (art) teile.push('art=' + encodeURIComponent(art));
    url.searchParams.delete('art'); url.hash = teile.join('&');
    if (url.href !== location.href) try { history.replaceState(history.state, '', url); } catch (e) { /* file:// */ }
  },
};
/** Berichtsart laut Adresse → { art, name, bereit } oder { art, unbekannt: true } */
function artAusAdresse() {
  const art = ART_URL.lesen() || 'asbest';
  return T.BERICHTSARTEN.find(a => a.art === art) || { art, name: '', bereit: false, unbekannt: true };
}

const S = { art: 'asbest', archiv: null, archivOk: false, dir: null, ordner: null, pj: null, lk: null, erg: null, fk: null, fotosDir: null, feldbogen: null,
  mitarbeiter: [], cfg: { personen: {} }, cfgText: null, cfgOrt: 'archiv', sig: {}, form: {}, fotoListe: {}, quellen: [], thumbs: {}, logo: null, laedt: false,
  // Formular = Vorgaben (bei jedem Öffnen neu berechnet) + eigene Angaben (nur die stehen in _BerichtKit.json) – siehe bericht-vorgaben.js
  vorgabe: {}, eigen: {}, naechste: 1,
  // Projektdaten, LabelKit, ResultKit: Stempel (Name|Größe|Zeit) vom letzten Lesen und deren Quellen-Hinweise
  stempel: null, quellenDaten: [], meldungen: [] };

/* ---------- Dateien ---------- */
async function leseJson(dir, name) {
  let fh; try { fh = await dir.getFileHandle(name); } catch (e) { if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError') return null; throw e; }
  const file = await fh.getFile(), text = await file.text();
  try { return { data: JSON.parse(text), text, file }; } catch (e) { throw new Error(`${name} ist keine lesbare JSON-Datei.`); }
}
async function erlaubt(h, fragen) {
  const o = { mode: 'readwrite' };
  try { if (await h.queryPermission(o) === 'granted') return true; return fragen ? (await h.requestPermission(o)) === 'granted' : false; } catch (e) { return false; }
}
const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- Start ---------- */
async function start() {
  $('version').textContent = 'v' + APP_VERSION;
  if (!start.einmal) {
    start.einmal = true;
    if (window.MosaikLeiste) MosaikLeiste.start('bericht', { version: APP_VERSION });
    // offline nutzbar wie die Projektzentrale; nicht beim lokalen Testserver (127.0.0.1), damit Tests immer die aktuelle Fassung laden
    if (/^https?:$/.test(location.protocol) && location.hostname !== '127.0.0.1' && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  $('version').title = CHANGELOG.map(c => `${c[0]} (${c[1]}): ${c[2]}`).join('\n');
  document.title = `BerichtKit ${APP_VERSION} · Spektron`;
  if (!('showDirectoryPicker' in window)) { zeigeStart('BerichtKit braucht Edge oder Chrome (Zugriff auf Ordner).', false); $('btnWaehlen').disabled = true; return; }
  const art = artAusAdresse();
  if (!art.bereit) { zeigeBald(art); return; }
  S.art = art.art;
  S.archiv = await SUITE.get('archiv').catch(() => null) || null;
  const name = PROJEKT_URL.lesen();
  if (name && S.archiv) {
    if (await erlaubt(S.archiv, false)) return projektAusArchiv(name);
    zeigeStart(`Für „${name}“ braucht BerichtKit Zugriff auf den Archivordner.`, true);
    $('btnZugriff').onclick = async () => { if (await erlaubt(S.archiv, true)) projektAusArchiv(name); };
    return;
  }
  zeigeStart(name ? 'Archivordner unbekannt – bitte einmal die Projektzentrale öffnen oder den Projektordner wählen.' : null, false);
}
const START = { titel: $('startTitel').textContent, text: $('startText').textContent };
function zeigeStart(text, zugriff) {
  $('start').hidden = false; $('app').hidden = true; $('leiste').hidden = true;
  $('startTitel').textContent = START.titel; $('startText').textContent = text || START.text;
  $('btnZugriff').hidden = !zugriff; $('btnWaehlen').hidden = false; $('btnAsbest').hidden = true;
}
/** Berichtsart aus der Adresse gibt es (noch) nicht: „kommt bald“ und ein Knopf zum Asbestbericht – nie ein Bericht der falschen Art */
function zeigeBald(a) {
  zeigeStart(a.unbekannt ? `Die Berichtsart „${a.art}“ kennt BerichtKit nicht – bisher gibt es den Asbestbericht.`
    : `Der ${a.name} kommt bald. Bisher erstellt BerichtKit den Asbestbericht.`, false);
  $('startTitel').textContent = a.unbekannt ? 'Bericht' : a.name;
  $('btnWaehlen').hidden = true; $('btnAsbest').hidden = false;
}
/** „Asbestbericht öffnen“: Angabe aus der Adresse nehmen; ein schon offenes Projekt wieder zeigen, sonst wie beim Start öffnen */
function zumAsbestbericht() {
  ART_URL.setzen(''); S.art = 'asbest';
  const name = PROJEKT_URL.lesen();
  if (S.dir && (!name || name === S.dir.name)) { $('start').hidden = true; $('app').hidden = false; $('leiste').hidden = false; return; }
  start();
}
async function projektAusArchiv(name) {
  let dir = null;
  try { dir = await S.archiv.getDirectoryHandle(name); } catch (e) { zeigeStart(`Projektordner „${name}“ nicht im Archivordner gefunden.`, false); return; }
  S.archivOk = true;
  await oeffnen(dir);
}
async function waehlen() {
  let dir;
  try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'berichtkit-projekt', startIn: S.archiv || undefined }); } catch (e) { return; }
  S.archivOk = false;
  if (S.archiv && await erlaubt(S.archiv, false)) {
    const pfad = await S.archiv.resolve(dir).catch(() => null);
    if (pfad && pfad.length) { S.archivOk = true; if (pfad.length > 1) dir = await S.archiv.getDirectoryHandle(pfad[0]); }
    else if (await dir.isSameEntry(S.archiv)) { alert('Das ist der Archivordner – bitte einen Projektordner darin wählen.'); return; }
  }
  PROJEKT_URL.setzen(dir.name);
  if (!artAusAdresse().bereit) { ART_URL.setzen(''); S.art = 'asbest'; }   // selbst gewählt aus „kommt bald“: Asbestbericht
  await oeffnen(dir);
}

/* ---------- Projekt lesen ---------- */
async function oeffnen(dir) {
  await zustandAbschliessen();
  S.laedt = true;
  S.dir = dir; $('kopfProjekt').textContent = dir.name; $('kopfProjekt').title = dir.name;
  $('start').hidden = true; $('app').hidden = false; $('leiste').hidden = false;
  fehler('');
  const nr = (/^(\d{2})\.(\d{4})/.exec(dir.name) || []).slice(1).join('.');
  S.ordner = { name: dir.name, nr, kuerzel: '' };
  S.quellen = []; S.thumbs = {}; S.feldbogen = null; S.anlagen = {}; S.anlagenVorhanden = null; uebergabeZeigen('');
  S.pj = null; S.erg = null; S.lk = null; S.stempel = null; S.quellenDaten = []; S.meldungen = []; S.quellenLauf = (S.quellenLauf || 0) + 1;
  const q = (ok, text) => S.quellen.push({ ok, text });
  try {
    await archivLesen();
    S.ordner.kuerzel = ordnerKuerzel(dir.name);
    // Projektdaten, ResultKit, LabelKit – später beim Zurückkommen ins Fenster und vor dem Speichern erneut verglichen (quellenAuffrischen)
    S.stempel = await quellenStempel(dir).catch(() => null);
    quellenUebernehmen(await quellenLesen(dir));
    // FotoKit
    S.fk = null; S.fotosDir = await SO.unter(dir, ['Fotos']).catch(() => null);
    const of = await SO.ort(dir, 'fotokit');
    const rf = of.dir ? await leseJson(of.dir, '_Bildumbenenner.json').catch(() => null) : null;
    if (rf && rf.data) { S.fk = rf.data; q(true, 'Fotos mit Probennummer aus FotoKit'); } else q(false, 'Keine FotoKit-Daten – der Bericht kommt ohne Fotos.');
    fotoListeBauen();
    await formStart();
    await anlagenLesen().catch(e => q(false, 'Anlagen nicht vollständig lesbar: ' + (e && e.message || e)));
  } catch (e) {
    fehler('Projekt konnte nicht gelesen werden: ' + (e && e.message || e));
  }
  S.laedt = false;
  render();
  if (window.MosaikLeiste) MosaikLeiste.aktualisieren();
}
async function archivLesen() {
  S.mitarbeiter = []; S.cfg = { personen: {} }; S.cfgText = null; S.sig = {};
  if (S.archivOk && S.archiv) {
    const ma = await leseJson(S.archiv, MA_DATEI).catch(() => null);
    if (ma && ma.data && ma.data.format === 'spektron-mitarbeiter' && Array.isArray(ma.data.personen)) S.mitarbeiter = ma.data.personen.filter(p => p && p.ordnerKuerzel && p.aktiv !== false);
    const c = await leseJson(S.archiv, CFG_DATEI).catch(e => { fehler(e.message); return null; });
    if (c && c.data && c.data.format === 'spektron-berichtkit') S.cfg = { personen: {}, ...c.data };
    S.cfgText = c ? c.text : null; S.cfgOrt = 'archiv';
    const sd = await SO.unter(S.archiv, [SIG_ORDNER]).catch(() => null);
    if (sd) for await (const h of sd.values()) {
      if (h.kind !== 'file' || !/\.png$/i.test(h.name)) continue;
      try {
        const f = await h.getFile(), data = new Uint8Array(await f.arrayBuffer()), bmp = await createImageBitmap(f);
        S.sig[sigKey(h.name.replace(/\.png$/i, ''))] = { data, w: bmp.width, h: bmp.height, url: URL.createObjectURL(f) }; bmp.close();
      } catch (e) { /* unlesbares Bild: ohne Unterschrift */ }
    }
  } else {
    S.cfgOrt = 'lokal';
    try { const c = JSON.parse(localStorage.getItem('berichtkit:cfg') || 'null'); if (c && c.format === 'spektron-berichtkit') S.cfg = { personen: {}, ...c }; } catch (e) { /* leer */ }
  }
}
/* ---------- Projektdaten, ResultKit, LabelKit lesen ----------
   Gelesen beim Öffnen – und erneut, wenn sich eine der Dateien geändert hat (Stempel Name|Größe|Zeit): beim Zurückkommen ins
   Fenster (z. B. nach „Übernehmen“ in ResultKit) und vor dem Speichern/Herunterladen. Sonst landen alte Laborwerte im Word. */
const QUELLE_NAME = { projekt: 'Projektdaten (Projektzentrale)', ergebnisse: 'Laborergebnisse (ResultKit)', labelkit: 'Proben (LabelKit)' };
async function quellenLesen(dir) {
  const r = { pj: null, erg: null, lk: null, feldbogen: null, quellen: [] }, q = (ok, text) => r.quellen.push({ ok, text });
  // Projektdaten (Projektzentrale)
  const op = await SO.ort(dir, 'projekt');
  const rp = op.dir ? await leseJson(op.dir, '_Projekt.json') : null;
  if (rp && rp.data && rp.data.format === 'mosaik-projekt') { r.pj = rp.data; q(true, 'Projektdaten aus der Projektzentrale'); }
  else q(false, 'Keine Projektdaten (_Projekt.json) – in der Projektzentrale Objekt, Auftraggeber usw. eintragen.');
  // ResultKit
  const or = await SO.ort(dir, 'resultkit');
  const re = or.dir ? await leseJson(or.dir, '_Ergebnisse.json') : null;
  if (re && re.data && re.data.format === 'spektron-ergebnisse' && re.data.version === 1 && Array.isArray(re.data.berichte)) {
    r.erg = re.data; const am = T.datumDE(String(re.data.uebernommen || '').slice(0, 10)); q(true, 'Laborergebnisse aus ResultKit' + (am ? ` (übernommen ${am})` : ''));
    if (re.data.vollstaendig === false) q(false, 'ResultKit: noch nicht alle Ergebnisse da.');
  } else q(false, 'Keine Laborergebnisse – zuerst in ResultKit die Prüfberichte übernehmen.');
  // LabelKit: die Datei, aus der ResultKit den Auftrag übernommen hat (auftrag.quelle) – sonst die neueste *_Daten.json.
  // Fremde Projektnummer prüft das Berichtsmodell (sperrt das Speichern).
  const ol = await SO.ort(dir, 'labelkit'), quelle = String((r.erg && r.erg.auftrag && r.erg.auftrag.quelle) || '').trim();
  if (ol.dir) {
    let neu = null, genau = null;
    for await (const h of ol.dir.values()) if (h.kind === 'file' && /_Daten\.json$/i.test(h.name)) {
      const f = await h.getFile(); if (h.name === quelle) genau = f; if (!neu || f.lastModified > neu.lastModified) neu = f;
    }
    const datei = genau || neu;
    if (datei) {
      try {
        r.lk = JSON.parse(await datei.text());
        if (genau) q(true, `LabelKit: ${datei.name} (wie in ResultKit übernommen)`);
        else q(false, quelle ? `LabelKit-Datei „${quelle}“ aus ResultKit nicht gefunden – genommen: ${datei.name} (neueste).`
          : `LabelKit: ${datei.name} (neueste) – ResultKit nennt keine LabelKit-Datei; dort die Ergebnisse erneut übernehmen.`);
      } catch (e) { q(false, `LabelKit-Datei ${datei.name} nicht lesbar.`); }
    }
  }
  if (!r.lk) q(false, 'Keine LabelKit-Daten – Material und Entnahmestelle fehlen dann.');
  // Probenehmer laut Feldbogen (asbestmat) – zugeordnet nur bei genauem Namen oder Kürzel
  const fp = ((r.lk && r.lk.feldprotokolle) || []).find(x => x && x.typ === 'asbestmat' && x.kopf && x.kopf.probenehmer);
  r.feldbogen = fp ? { text: String(fp.kopf.probenehmer).trim(), kuerzel: personFinden(fp.kopf.probenehmer) } : null;
  return r;
}
function quellenUebernehmen(r) { S.pj = r.pj; S.erg = r.erg; S.lk = r.lk; S.feldbogen = r.feldbogen; S.quellenDaten = r.quellen; }
/** Stempel der drei Quellen: { projekt, ergebnisse, labelkit } – je „Name|Größe|Zeit“, LabelKit alle *_Daten.json */
async function quellenStempel(dir) {
  const st = f => `${f.name}|${f.size}|${f.lastModified}`;
  const datei = async (bereich, name) => {
    const o = await SO.ort(dir, bereich); if (!o.dir) return '';
    try { return st(await (await o.dir.getFileHandle(name)).getFile()); } catch (e) { return ''; }
  };
  const lk = async () => {
    const o = await SO.ort(dir, 'labelkit'), l = []; if (!o.dir) return '';
    for await (const h of o.dir.values()) if (h.kind === 'file' && /_Daten\.json$/i.test(h.name)) try { l.push(st(await h.getFile())); } catch (e) { /* gerade in Arbeit */ }
    return l.sort().join('\n');
  };
  return { projekt: await datei('projekt', '_Projekt.json'), ergebnisse: await datei('resultkit', '_Ergebnisse.json'), labelkit: await lk() };
}
/** Haben sich Projektdaten, LabelKit oder ResultKit seit dem Lesen geändert? Dann neu lesen, Vorgaben neu berechnen und bleibend melden.
    → Liste der geänderten Quellen (leer = nichts geändert) */
async function quellenAuffrischen(anlass) {
  const dir = S.dir; if (!dir || S.laedt || !S.stempel) return [];
  const lauf = S.quellenLauf;
  const jetzt = await quellenStempel(dir).catch(() => null);
  if (!jetzt || dir !== S.dir || lauf !== S.quellenLauf) return [];
  const geaendert = Object.keys(QUELLE_NAME).filter(k => jetzt[k] !== S.stempel[k]);
  if (!geaendert.length) return [];
  const uhr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  let r;
  try { r = await quellenLesen(dir); }
  catch (e) {
    // Nicht lesbar (z. B. gerade in Arbeit): diesen Stand nicht immer wieder versuchen – der Bericht bleibt beim zuletzt gelesenen,
    // das wird bleibend gemeldet; ändert sich die Datei erneut, wird wieder gelesen.
    if (dir !== S.dir || lauf !== S.quellenLauf) return [];
    S.stempel = jetzt;
    meldung(`${geaendert.map(k => QUELLE_NAME[k]).join(', ')} geändert, aber nicht lesbar (${uhr}): ${e && e.message || e} – der Bericht nutzt weiter den vorher gelesenen Stand.`);
    S.ungesehen = Date.now();
    return geaendert;
  }
  if (dir !== S.dir || lauf !== S.quellenLauf) return [];
  S.stempel = jetzt; quellenUebernehmen(r);
  vorgabenNeu();
  S.ungesehen = Date.now();
  meldung(`Daten neu gelesen${anlass === 'speichern' ? ' vor dem Speichern' : ''} (${uhr}): ${geaendert.map(k => QUELLE_NAME[k]).join(', ')} – die Vorschau zeigt jetzt den neuen Stand.`);
  if (window.MosaikLeiste) MosaikLeiste.aktualisieren();
  return geaendert;
}
/** Bleibender Hinweis oben im Formular (bis „Ausblenden“ oder Projektwechsel) – nicht nur in der Statuszeile. */
function meldung(text) { S.meldungen.push(text); meldungenZeigen(); }
function meldungenZeigen() {
  const box = $('meldungen'); if (!box) return;
  box.hidden = !S.meldungen.length;
  $('meldungenListe').innerHTML = S.meldungen.map(t => `<li>${esc(t)}</li>`).join('');
}
function ordnerKuerzel(name) {
  const rest = name.replace(/^\d{2}\.\d{4}\s*/, '').normalize('NFC');
  const norm = v => String(v || '').toLowerCase().replace(/[\s.]/g, '');
  const w = rest.split(/[\s_]+/).filter(Boolean);
  for (let n = Math.min(3, w.length); n >= 1; n--) {
    const ende = norm(w.slice(-n).join(''));
    const p = S.mitarbeiter.find(x => norm(x.ordnerKuerzel) === ende); if (p) return p.ordnerKuerzel;
  }
  return '';
}
function fotoListeBauen() {
  S.fotoListe = {};
  const b = S.fk && S.fk.bilder; if (!b) return;
  const reihe = [...(Array.isArray(S.fk.reihenfolge) ? S.fk.reihenfolge : []), ...Object.keys(b)].filter((x, i, a) => a.indexOf(x) === i && b[x]);
  for (const datei of reihe) {
    const v = b[datei]; if (!v || v.aussortiert || !v.probe) continue;
    for (const teil of String(v.probe).split(/[,;/+]/)) {
      const m = /^\s*(?:P|Probe)\s*0*(\d+)\s*$/i.exec(teil); if (!m) continue;
      (S.fotoListe['P' + m[1]] = S.fotoListe['P' + m[1]] || []).push({ datei, beschreibung: v.beschreibung || '', drehung: +v.drehung || 0 });
    }
  }
}
/* ---------- Anlagen: was liegt im Projektordner? (anlagen.js erkennt und nummeriert) ----------
   Gelesen werden nur Namen und Dateizeiten in Fotos/, Pläne/ und Mitteilungen/, das Anlagen-Protokoll und die PlanKit-Datei
   (Prüfsumme). Neu gelesen beim Öffnen, wenn das Fenster wieder in den Vordergrund kommt (z. B. nach FotoKit) und vor dem Speichern. */
const PLAN_KOPIE = / \((vorher|Wiederherstellung|Speicherkandidat|Kopie)\b[^)]*\)\.probenplan$/i;   // wie mosaik-leiste.js
async function dateienIn(dir, muster) {
  const out = []; if (!dir) return out;
  for await (const h of dir.values()) {
    if (h.kind !== 'file' || /^(~\$|\.)/.test(h.name) || !muster.test(h.name)) continue;
    try { out.push({ name: h.name, t: (await h.getFile()).lastModified }); } catch (e) { /* gerade in Arbeit */ }
  }
  return out;
}
const sha256 = async buf => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('');
async function pfadDa(dir, pfad) {
  const teile = String(pfad || '').split('/').filter(Boolean); if (!teile.length) return false;
  try { let d = dir; for (const t of teile.slice(0, -1)) d = await d.getDirectoryHandle(t); await d.getFileHandle(teile.at(-1)); return true; } catch (e) { return false; }
}
async function anlagenLesen() {
  const dir = S.dir; if (!dir) return;
  const lauf = S.anlagenLauf = (S.anlagenLauf || 0) + 1;
  const [fo, pl, mi] = await Promise.all(['Fotos', 'Pläne', 'Mitteilungen'].map(n => SO.unter(dir, [n]).catch(() => null)));
  const fotos = await dateienIn(fo, /\.pdf$/i), plaene = await dateienIn(pl, /\.pdf$/i), mitteilungen = await dateienIn(mi, /\.(docx?|pdf)$/i);
  let protokoll = null;
  const op = await SO.ort(dir, 'anlagenProtokoll').catch(() => ({}));
  if (op.dir) try { protokoll = await (await (await op.dir.getFileHandle('_Anlagen-Protokoll.txt')).getFile()).text(); } catch (e) { /* ohne Protokoll */ }
  let plan = null;
  const ok = await SO.ort(dir, 'plankit').catch(() => ({}));
  if (ok.dir) {
    const soll = `Probenplan ${dir.name}.probenplan`.normalize('NFC'); let best = null;
    for await (const h of ok.dir.values()) {
      if (h.kind !== 'file' || !/\.probenplan$/i.test(h.name) || PLAN_KOPIE.test(h.name)) continue;
      const f = await h.getFile().catch(() => null); if (!f) continue;
      if (h.name.normalize('NFC') === soll) { best = f; break; }
      if (!best || f.lastModified > best.lastModified) best = f;
    }
    if (best) plan = { name: best.name, t: best.lastModified, sha: await sha256(await best.arrayBuffer()) };
  }
  // FotoKit-Daten frisch: dort steht, welche Bilddoku zuletzt erstellt wurde und wann sich ihre Inhalte geändert haben
  const of = await SO.ort(dir, 'fotokit').catch(() => ({}));
  const rf = of.dir ? await leseJson(of.dir, '_Bildumbenenner.json').catch(() => null) : null;
  const vorhanden = new Set();
  for (const x of S.form.anlagenExtra || []) if (x && await pfadDa(dir, x.pfad)) vorhanden.add(x.pfad);
  if (lauf !== S.anlagenLauf || dir !== S.dir) return;
  if (rf && rf.data) { S.fk = rf.data; fotoListeBauen(); }
  S.anlagen = BerichtAnlagen.erkennen({ ordnerName: dir.name, fotos, plaene, mitteilungen, protokoll, fk: S.fk, plan });
  S.anlagenVorhanden = vorhanden;
}
async function anlageHinzufuegen() {
  if (!S.dir || !window.showOpenFilePicker) return;
  let hs; try { hs = await window.showOpenFilePicker({ multiple: true, startIn: S.dir, id: 'berichtkit-anlage' }); } catch (e) { return; }
  const neu = [...(S.form.anlagenExtra || [])], ausserhalb = [];
  for (const h of hs) {
    const pfad = await S.dir.resolve(h).catch(() => null);
    if (!pfad || !pfad.length) { ausserhalb.push(h.name); continue; }
    const p = pfad.join('/'); if (neu.some(x => x.pfad === p)) continue;
    neu.push({ pfad: p, bezeichnung: h.name.replace(/\.[^.]+$/, '') });
    S.anlagenVorhanden = new Set([...(S.anlagenVorhanden || []), p]);
  }
  if (ausserhalb.length) alert(`Nicht im Projektordner – bitte zuerst dorthin kopieren (z. B. nach „Mitteilungen“):\n${ausserhalb.join('\n')}`);
  setze('anlagenExtra', neu);
}
/** Person zu einem Namen aus dem Feldbogen – nur bei genauem Treffer (Name, Kürzel; Leerraum und Groß-/Kleinschreibung egal).
    LabelKit schlägt die Namen der Mitarbeiterliste vor; ungefähre Treffer wären geraten. */
function personFinden(text) {
  const n = v => String(v || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase(), t = n(text); if (!t) return '';
  const p = S.mitarbeiter.find(x => [x.ordnerKuerzel, x.appKuerzel, x.name, ((S.cfg.personen || {})[x.ordnerKuerzel] || {}).name].some(v => n(v) === t));
  return p ? p.ordnerKuerzel : '';
}
const rolle = k => ((S.cfg.personen || {})[k] || {}).rolle === 'mt' ? 'mt' : 'sv';
async function naechsteMitteilung() {
  const m = await SO.unter(S.dir, ['Mitteilungen']).catch(() => null), namen = [];
  if (m) for await (const h of m.values()) if (h.kind === 'file') namen.push(h.name);
  return V.naechsteNr(namen);
}
/** Vorgaben – bei jedem Öffnen neu berechnet, nie in _BerichtKit.json geschrieben (S.naechste bleibt bis zum nächsten Öffnen). */
function vorgabenBerechnen() {
  const P = T.projektSicht(S.pj, S.ordner);
  const pn = (S.feldbogen && S.feldbogen.kuerzel) || P.zustaendig;
  // Unterschrift: Zuständiger, wenn Sachverständige(r) – sonst erste(r) SV der Liste, als Annahme sichtbar (bericht-text.js svVorschlag)
  const svV = T.svVorschlag(S.cfg, S.mitarbeiter, P.zustaendig);
  return { art: S.art, datum: heute(), mitteilung: S.naechste, variante: 'eigen', eingangsdatum: '', auftragsdatum: P.auftragsdatum,
    agSatz: T.mitArtikel(T.zeilen(P.ag)[0] || '').text, probenehmer: pn, sv: svV.kuerzel, svVorschlag: svV, mt: pn && rolle(pn) === 'mt' ? pn : '', labor: S.cfg.labor || '', einbau: 'unbekannt',
    aus: {}, kmf: {}, who: {}, ki: {}, foto: {} };
}
const formNeu = () => { S.form = { ...S.vorgabe, ...S.eigen }; };
/** Projektdaten oder Einstellungen neu: Vorgaben neu, eigene Angaben bleiben. */
function vorgabenNeu() { S.vorgabe = vorgabenBerechnen(); formNeu(); }
const bereinigenCtx = (alt, berichte) => ({ vorgabe: S.vorgabe, naechste: S.naechste, heute: heute(), alt, berichte: berichte || [] });
async function formStart() {
  const key = 'berichtkit:form:' + (S.ordner.nr || S.ordner.name);
  let lokal = null; try { lokal = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* leer */ }
  S.naechste = await naechsteMitteilung();
  S.vorgabe = vorgabenBerechnen();
  S.formKey = key; S.zustand = { text: null, geplant: 0, pruef: 0, berichte: [], offen: new Set() };
  const geteilt = await zustandLesen().catch(e => { S.quellen.push({ ok: false, text: 'Angaben zum Bericht nicht lesbar: ' + (e && e.message || e) }); return null; });
  if (geteilt) S.quellen.push({ ok: true, text: 'Angaben zum Bericht aus dem Projektordner' + (geteilt.von ? ` (zuletzt ${geteilt.von})` : '') });
  // Eigene Angaben: aus dem Projektordner, sonst aus diesem Browser. Bis 1.6.1 stand dort das ganze Formular (alt) – siehe bericht-vorgaben.js.
  const lokalNeu = !!(lokal && lokal.v === 2 && lokal.form && typeof lokal.form === 'object');
  const roh = geteilt ? geteilt.form : lokalNeu ? lokal.form : (lokal && typeof lokal === 'object' ? lokal : {});
  const r = V.formBereinigen(roh, bereinigenCtx(geteilt ? geteilt.alt : !lokalNeu, S.zustand.berichte));
  S.eigen = r.form; formNeu();
  for (const h of r.hinweise) S.meldungen.push(h);
  if (geteilt) {
    // Weggefallenes auch aus der Datei nehmen; eine Datei ohne Kennzeichen „nurEigene“ einmal neu schreiben
    for (const k of r.entfernt) S.zustand.offen.add(k);
    formLokal(); if (r.entfernt.length || geteilt.alt) zustandPlanen();
  } else if (Object.keys(S.eigen).length) formMerken(...Object.keys(S.eigen));   // frühere Angaben aus diesem Browser einmal in den Projektordner übernehmen
  else formLokal();
}
/* ---------- Angaben zum Bericht – gemeinsam im Projektordner (Bereich „berichtkit“ in spektron-ordner.js) ----------
   { format:'spektron-bericht', version:1, nurEigene:true, projekt, form:{…}, berichte:[{datei, am, von, mitteilung, datum, …}], geaendert, geaendertVon, geaendertMit }
   form enthält nur eigene Angaben (selbst geändert) – Vorgaben wie heutiges Datum und nächste Mitteilung werden bei jedem Öffnen neu
   berechnet. Dateien ohne „nurEigene“ (bis 1.6.1, oder von einem Rechner mit alter Fassung) werden beim Lesen bereinigt (bericht-vorgaben.js).
   Mehrere Rechner, ein Projektordner – ohne Sperre über Rechner hinweg. Darum:
   1. Jede eigene Änderung wird als „offen“ vermerkt (Feld, bei Probenangaben Feld + Probe).
   2. Schreiben: frisch lesen, nur die offenen Felder über den Stand der Datei legen (Änderungen der Kollegen bleiben), schreiben, zurücklesen.
   3. Kurz danach noch einmal lesen: Steht der eigene Stand noch da, sind die Felder erledigt. Hat ein Kollege in der Zwischenzeit
      geschrieben und dabei eigene Felder überdeckt, werden sie erneut darübergelegt. So geht keine Änderung verloren;
      gleichzeitig dasselbe Feld geändert → die zuletzt gespeicherte Eingabe gilt, und es wird gemeldet. */
const ZUSTAND_DATEI = '_BerichtKit.json';
const ich = () => { try { return (localStorage.getItem('spektron-ich') || '').trim(); } catch (e) { return ''; } };
const json = v => JSON.stringify(v === undefined ? null : v);
function zustandAus(text) {
  const d = JSON.parse(text);
  if (!d || d.format !== 'spektron-bericht' || d.version !== 1 || typeof d.form !== 'object') throw new Error(`${ZUSTAND_DATEI} hat ein unbekanntes Format.`);
  return d;
}
async function zustandLesen() {
  const o = await SO.ort(S.dir, 'berichtkit');
  if (!o.dir) return null;
  const r = await leseJson(o.dir, ZUSTAND_DATEI); if (!r) return null;
  const d = zustandAus(r.text); S.zustand.text = r.text; S.zustand.berichte = Array.isArray(d.berichte) ? d.berichte : [];
  return { form: d.form, von: d.geaendertVon || '', alt: d.nurEigene !== true };
}
/** Formular-Teil einer gelesenen Datei: nur eigene Angaben – ältere Dateien (ganzes Formular) bereinigt */
const dateiForm = d => d.nurEigene === true ? d.form : V.formBereinigen(d.form, bereinigenCtx(true, Array.isArray(d.berichte) ? d.berichte : [])).form;
function pfadWert(form, pfad) { const [k, sub] = pfad.split('\u0000'); return sub === undefined ? form[k] : (form[k] || {})[sub]; }
/** Stand der Datei + eigene offene Felder */
function mischen(fremd, eigen, offen) {
  const r = JSON.parse(JSON.stringify(fremd || {}));
  for (const pfad of offen) {
    const [k, sub] = pfad.split('\u0000');
    if (sub === undefined) { if (eigen[k] === undefined) delete r[k]; else r[k] = eigen[k]; continue; }
    const m = r[k] = { ...(r[k] && typeof r[k] === 'object' ? r[k] : {}) };
    if (eigen[k] && sub in eigen[k]) m[sub] = eigen[k][sub]; else delete m[sub];
  }
  return r;
}
const berichteVereinen = (a, b) => [...a, ...b].filter((x, i, l) => x && l.findIndex(y => y && y.datei === x.datei && y.am === x.am) === i).slice(-50);
/** Eigene Änderung merken (Feldnamen; Probenangaben als [Feld, Probe]): Wert aus dem Formular in die eigenen Angaben, Speichern planen */
function formMerken(...pfade) {
  const keys = pfade.map(p => Array.isArray(p) ? p.join('\u0000') : p);
  S.statusFest = null;   // eigene Eingabe: Statuszeile wieder normal
  for (const k of keys) S.zustand.offen.add(k);
  S.eigen = mischen(S.eigen, S.form, keys);
  formLokal(); zustandPlanen();
}
/** Eigene Angabe aufgeben – das Feld folgt wieder der Vorgabe (auch in der Datei) */
function eigenWeg(...keys) {
  for (const k of keys) { delete S.eigen[k]; S.zustand.offen.add(k); }
  formNeu(); formLokal(); zustandPlanen();
}
function zustandPlanen() { clearTimeout(S.zustand.geplant); S.zustand.geplant = setTimeout(() => zustandSchreiben().catch(e => fehler('Angaben zum Bericht nicht gespeichert: ' + (e && e.message || e))), 900); }
async function zustandSchreiben(bericht) {
  const dir = S.dir, z = S.zustand; if (!dir || !z) return;
  clearTimeout(z.geplant);
  const lauf = async () => {
    const o = await SO.ort(dir, 'berichtkit', { anlegen: true });
    if (!o.dir) throw new Error('Ablageort nicht verfügbar.');
    const jetzt = await leseJson(o.dir, ZUSTAND_DATEI).catch(() => null);
    const datei = jetzt ? zustandAus(jetzt.text) : null, fremd = !!jetzt && jetzt.text !== z.text;
    const offen = [...z.offen], form = mischen(datei ? dateiForm(datei) : S.eigen, S.eigen, offen);
    const berichte = berichteVereinen(datei && Array.isArray(datei.berichte) ? datei.berichte : [], [...z.berichte, ...(bericht ? [bericht] : [])]);
    const daten = { format: 'spektron-bericht', version: 1, nurEigene: true, hinweis: 'Angaben von BerichtKit zum Bericht dieses Projekts (nur selbst geänderte Felder) – nicht von Hand bearbeiten.',
      projekt: S.ordner.nr || '', form, berichte, geaendert: new Date().toISOString(), geaendertVon: ich(), geaendertMit: 'BerichtKit ' + APP_VERSION };
    const text = JSON.stringify(daten, null, 1);
    const fh = await o.dir.getFileHandle(ZUSTAND_DATEI, { create: true }), w = await fh.createWritable(); await w.write(text); await w.close();
    if (await (await fh.getFile()).text() !== text) throw new Error('Zurücklesen stimmt nicht.');
    z.text = text; z.berichte = berichte;
    const geschrieben = new Map(offen.map(p => [p, json(pfadWert(form, p))]));
    if (S.zustand === z && fremd && !V.gleich(form, S.eigen)) {   // Änderungen eines Kollegen sind jetzt auch hier
      S.eigen = mischen(form, S.eigen, [...z.offen]); formNeu(); formLokal(); render();   // während des Schreibens Getipptes bleibt
      $('status').textContent = `Angaben von ${datei.geaendertVon || 'einem Kollegen'} übernommen – Ihre Änderungen sind erhalten.`;
    }
    clearTimeout(z.pruef); z.pruef = setTimeout(() => zustandPruefen(dir, z, geschrieben).catch(() => {}), 2500);
  };
  return navigator.locks ? navigator.locks.request('berichtkit:projekt:' + dir.name, lauf) : lauf();
}
/** Nach dem Schreiben: steht der eigene Stand noch in der Datei? Sonst eigene Felder erneut darüberlegen. */
async function zustandPruefen(dir, z, geschrieben) {
  if (S.zustand !== z) return;
  const o = await SO.ort(dir, 'berichtkit'); if (!o.dir) return;
  const jetzt = await leseJson(o.dir, ZUSTAND_DATEI).catch(() => null); if (!jetzt) return;
  const d = zustandAus(jetzt.text), ueberdeckt = [];
  for (const [p, wert] of geschrieben) {
    if (json(pfadWert(d.form, p)) === wert) { if (json(pfadWert(S.eigen, p)) === wert) z.offen.delete(p); }   // steht da und lokal unverändert: erledigt
    else ueberdeckt.push(p);
  }
  if (jetzt.text !== z.text && S.zustand === z) {
    if (ueberdeckt.length) { $('status').textContent = 'Ein Kollege hat gleichzeitig gespeichert – Ihre Änderungen werden erneut gesichert.'; zustandPlanen(); }
    else { z.text = jetzt.text; z.berichte = berichteVereinen(Array.isArray(d.berichte) ? d.berichte : [], z.berichte);
      const form = mischen(dateiForm(d), S.eigen, [...z.offen]); if (!V.gleich(form, S.eigen)) { S.eigen = form; formNeu(); formLokal(); render(); } }
  }
}
/** Vor dem Projektwechsel: geplantes Speichern sofort ausführen, nichts landet im falschen Projekt. */
async function zustandAbschliessen() {
  const z = S.zustand; if (!z || !S.dir) return;
  clearTimeout(z.pruef);
  if (z.offen.size || z.geplant) { clearTimeout(z.geplant); z.geplant = 0; await zustandSchreiben().catch(e => fehler('Angaben zum Bericht nicht gespeichert: ' + (e && e.message || e))); clearTimeout(z.pruef); }
}
function formLokal() { try { localStorage.setItem(S.formKey, JSON.stringify({ v: 2, form: S.eigen })); } catch (e) { /* voll/gesperrt */ } }

/* ---------- Modell ---------- */
function modell(ueber) {
  const da = S.anlagenVorhanden, form = { ...S.form, ...(ueber || {}), anlagenExtra: (S.form.anlagenExtra || []).map(x => ({ ...x, fehlt: !!da && !da.has(x.pfad) })) };
  return T.bericht({ pj: S.pj, ordner: S.ordner, lk: S.lk, erg: S.erg, cfg: S.cfg, mitarbeiter: S.mitarbeiter, fotos: S.fotoListe, feldbogen: S.feldbogen, anlagen: S.anlagen, form });
}

/* ---------- Anzeige ---------- */
function fehler(text) { $('fehler').hidden = !text; $('fehler').textContent = text || ''; }
function optionen(sel, wert, leer, filter) {
  const liste = S.mitarbeiter.length ? S.mitarbeiter : Object.keys(S.cfg.personen || {}).map(k => ({ ordnerKuerzel: k, name: (S.cfg.personen[k] || {}).name || k }));
  sel.innerHTML = `<option value="">${esc(leer)}</option>` + liste.filter(p => !filter || filter(p.ordnerKuerzel) || p.ordnerKuerzel === wert)
    .map(p => `<option value="${esc(p.ordnerKuerzel)}">${esc(((S.cfg.personen || {})[p.ordnerKuerzel] || {}).name || p.name || p.ordnerKuerzel)} (${esc(p.ordnerKuerzel)})</option>`).join('');
  if (wert && ![...sel.options].some(o => o.value === wert)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(wert)}">${esc(wert)}</option>`);
  sel.value = wert || '';
}
function render() {
  if (S.laedt || !S.dir) return;
  const f = S.form, m = modell(), P = T.projektSicht(S.pj, S.ordner);
  meldungenZeigen();
  $('fDatum').value = f.datum || ''; $('fMitteilung').value = f.mitteilung || 1;
  document.querySelectorAll('input[name=variante]').forEach(r => { r.checked = r.value === (f.variante || 'eigen'); });
  const zug = f.variante === 'zugestellt';
  $('zeileEingang').hidden = !zug; $('fEingang').value = f.eingangsdatum || '';
  $('fAuftrag').value = f.auftragsdatum || ''; $('fAuftrag').closest('.feld').hidden = zug;
  $('qAuftrag').textContent = P.auftragsdatum ? (f.auftragsdatum === P.auftragsdatum ? 'aus der Projektzentrale' : `Projektzentrale: ${T.datumDE(P.auftragsdatum)}`) : 'in der Projektzentrale nicht eingetragen';
  $('fAg').value = f.agSatz || '';
  { const agName = T.zeilen(P.ag)[0] || '', agIstVn = agName && agName.toLowerCase() === (T.zeilen(P.vn)[0] || '').toLowerCase();
    const pjVers = T.zeilen(P.versicherer)[0] || '';
    $('zeileVers').hidden = !m.versicherungsfall; $('fVers').value = f.versicherer || '';
    $('fVers').placeholder = pjVers || (agIstVn || !agName ? 'bitte eintragen' : agName);
    const vq = m.versichererQuelle;   // Annahme „Auftraggeber = Versicherer“ – die Meldung selbst steht einmal in den Hinweisen
    $('qVers').textContent = f.versicherer ? 'eigene Angabe (Deckblatt)' : pjVers ? 'aus der Projektzentrale' : agIstVn ? 'Auftraggeber ist der VN selbst – Versicherer unbekannt'
      : vq ? (vq.angenommen ? 'angenommen – bitte prüfen' : vq.text) : 'in der Projektzentrale nicht eingetragen';
    $('qVers').classList.toggle('annahme', !!(vq && vq.angenommen)); $('btnVersOk').hidden = !(vq && vq.angenommen); }
  // Deckblatt mit/ohne Versicherung: ohne Wahl nach den Projektdaten (bericht-text.js versicherungsfallAuto), sonst die eigene Wahl
  document.querySelectorAll('input[name=deckblatt]').forEach(r => { r.checked = r.value === (m.versicherungsfall ? 'versicherung' : 'direkt'); });
  $('qDeckblatt').textContent = f.deckblatt ? 'selbst gewählt' : `automatisch: ${P.versicherungsfallGrund}`;
  $('btnDeckblattAuto').hidden = !f.deckblatt;
  optionen($('fPn'), f.probenehmer, '– bitte wählen –'); $('zeilePn').hidden = zug;
  { const q = m.probenehmerQuelle; $('qPn').textContent = q ? (q.angenommen ? 'angenommen – bitte prüfen' : q.text) : '';
    $('qPn').classList.toggle('annahme', !!(q && q.angenommen)); $('btnPnOk').hidden = !(q && q.angenommen); }
  optionen($('fSv'), f.sv, '– bitte wählen –');
  { const q = m.svQuelle; $('qSv').textContent = q && q.angenommen ? 'angenommen – bitte prüfen' : '';
    $('qSv').classList.toggle('annahme', !!(q && q.angenommen)); $('btnSvOk').hidden = !(q && q.angenommen); }
  optionen($('fMt'), f.mt, 'keine'); $('zeileMt').hidden = zug;
  // „als …“: eigene Wahl für diesen Bericht, sonst die Rolle aus den Einstellungen
  $('fR1').value = f.rolle1 || rolle(f.sv); $('fR1').disabled = !f.sv;
  $('fR2').value = f.rolle2 || rolle(f.mt); $('fR2').disabled = !f.mt;
  $('fLabor').value = f.labor || '';
  // Proben
  const alle = T.probenSammeln(S.erg, S.lk).proben, imBericht = new Map(m.proben.map(p => [p.label, p]));
  $('probenInfo').textContent = alle.length ? `${m.proben.length} von ${alle.length} im Bericht` : '';
  $('probenListe').innerHTML = alle.length ? alle.map(p => {
    const b = imBericht.get(p.label), an = !!b, x = b || p;
    const bef = p.befund ? `<span class="befund ${p.befund.gefunden ? 'pos' : p.befund.eindeutig ? 'neg' : 'unk'}">${esc(p.befund.text)}</span>` : '<span class="befund unk">–</span>';
    const fotos = S.fotoListe[p.label] || [];
    const kmf = b ? b.istKmf : false;
    let unter = '';
    if (an) {
      unter += `<label title="Dämmstoff / künstliche Mineralfasern"><input type="checkbox" data-art="kmf" data-l="${esc(p.label)}" ${kmf ? 'checked' : ''}> KMF</label>`;
      if (kmf) {
        unter += `<label><input type="checkbox" data-art="who" data-l="${esc(p.label)}" ${b.whoNachgewiesen ? 'checked' : ''}> WHO-Fasern nachgewiesen</label>`;
        unter += p.kmf.ki ? `<span>KI = ${esc(p.kmf.ki)} <span class="klein">(Labor)</span></span>`
          : `<label>KI <input type="text" data-art="ki" data-l="${esc(p.label)}" value="${esc((f.ki || {})[p.label] || '')}" placeholder="aus PDF" title="Steht nicht in den Labordaten – genau wie im Prüfbericht eintragen"></label>`;
      }
      unter += `<label>Foto <select data-art="foto" data-l="${esc(p.label)}"><option value="">kein Foto</option>${fotos.map(o => `<option value="${esc(o.datei)}" ${o.datei === b.foto ? 'selected' : ''}>${esc(o.datei)}</option>`).join('')}</select></label>`;
    }
    return `<tr class="${an ? '' : 'aus'}"><td><input type="checkbox" data-art="aus" data-l="${esc(p.label)}" ${an ? 'checked' : ''} title="Im Bericht"></td>
      <td style="white-space:nowrap">${esc(p.ref || p.label)}<div class="klein" style="font-size:10.5px">${esc(p.labNr)}</div></td>
      <td>${x.material ? esc(x.material) : '<span class="befund unk">Material fehlt</span>'}<div class="klein">${esc(x.stelle)}</div>${unter ? `<div class="unter">${unter}</div>` : ''}</td>
      <td>${bef}</td></tr>`;
  }).join('') + m.offen.map(o => `<tr class="${o.aus ? 'aus' : ''}"><td><input type="checkbox" data-art="aus" data-l="${esc(o.label)}" ${o.aus ? '' : 'checked'} title="Abwählen, wenn die Probe nicht in diesen Bericht gehört"></td>
      <td>${esc(o.label)}</td><td>${o.material ? esc(o.material) : '–'}<div class="klein">${esc(o.stelle)}</div></td><td><span class="befund unk">noch kein Ergebnis</span></td></tr>`).join('')
    : '<tr><td colspan="4" class="klein">Keine Asbestergebnisse gefunden.</td></tr>';
  $('einbauWahl').hidden = !m.proben.some(p => p.istKmf && p.whoNachgewiesen);
  anlagenZeigen(m);
  document.querySelectorAll('input[name=einbau]').forEach(r => { r.checked = r.value === (f.einbau || 'unbekannt'); });
  // Hinweise
  $('hinweise').innerHTML = [
    ...m.sperren.map(x => `<li class="sperre">Gesperrt: ${esc(x)}</li>`),
    ...m.annahmen.map(a => `<li class="luecke">${esc(a.text)} <button type="button" class="klein-knopf" data-ok="${esc(a.id)}" title="Stimmt so – Hinweis ausblenden">✓ stimmt</button></li>`),
    ...m.luecken.map(l => `<li class="luecke">Lücke im Bericht: ${esc(l)}</li>`),
    ...m.hinweise.map(h => `<li>${esc(h)}${aktionHtml(m.hinweisAktionen[h])}</li>`),
    ...[...S.quellenDaten, ...S.quellen].map(q => `<li class="${q.ok ? 'ok' : ''}">${q.ok ? '✓ ' : ''}${esc(q.text)}</li>`),
    ...(S.cfgOrt === 'lokal' ? ['<li>Archivordner nicht verbunden: Einstellungen gelten nur in diesem Browser.</li>'] : []),
  ].join('');
  const gesperrt = m.sperren.length > 0;
  vorschau(gesperrt ? T.alsEntwurf(m) : m);
  $('btnErstellen').disabled = gesperrt;
  $('btnErstellen').title = gesperrt ? 'Gesperrt: ' + m.sperren.join(' · ') : '';
  $('btnLaden').textContent = gesperrt ? 'Entwurf herunterladen' : 'Herunterladen';
  if (S.statusFest && Date.now() < S.statusFest.bis) $('status').innerHTML = S.statusFest.html;   // eben gemeldet – nicht gleich überschreiben
  else (S.statusFest = null, $('status')).textContent = gesperrt ? `Speichern gesperrt (${m.sperren.length}) – siehe Hinweise. „Entwurf herunterladen“ geht.`
    : `Speichert als Mitteilungen/${m.dateiname}` + (m.luecken.length ? ` · ${m.luecken.length} Lücke(n) gelb markiert` : '');
}
/** Sprung zu einem Hinweis: in die App, die die Anlage erzeugt, oder in die Einstellungen */
function aktionHtml(a) {
  if (!a) return '';
  if (a.einstellungen) return ' <button type="button" class="klein-knopf" data-aktion="einstellungen">Einstellungen öffnen</button>';
  return a.link && S.dir ? ` <a href="${esc(a.link)}#projekt=${encodeURIComponent(S.dir.name)}" target="${esc(a.ziel)}">in ${esc(a.app)} ${a.was === 'erstellen' ? 'erstellen' : 'öffnen'} ↗</a>` : '';
}
/** „✓ stimmt“ – Annahme bestätigen. Versicherer/Unterschrift: bestätigt ist der Wert, der jetzt angenommen ist (ändert er sich, wird wieder gefragt). */
function bestaetigen(id) {
  if (id === 'probenehmer') return setze('pnQuelle', 'hand');
  const m = modell();
  if (id === 'versicherer' && m.versichererQuelle) return setze('versOk', m.versichererQuelle.wert);
  if (id === 'sv' && S.form.sv) return setze('svOk', S.form.sv);
}
const tagDE = t => { if (!t) return ''; const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const ZUSTAND = { veraltet: 'veraltet', unvollstaendig: 'unvollständig', unbekannt: 'Stand unbekannt', fehlt: 'fehlt' };
function anlagenZeigen(m) {
  const zeile = z => {
    const fest = z.art === 'pruefbericht', sperr = fest || z.zustand === 'fehlt';
    const dateien = z.dateien.map(d => d.split('/').pop()), app = z.app && z.app.link && S.dir
      ? ` <a href="${esc(z.app.link)}#projekt=${encodeURIComponent(S.dir.name)}" target="${esc(z.app.ziel)}">in ${esc(z.app.app)} ${z.zustand === 'fehlt' ? 'erstellen' : 'öffnen'} ↗</a>` : '';
    const info = [dateien.length ? esc(dateien.join(' · ')) : '', z.t ? 'Stand ' + tagDE(z.t) : ''].filter(Boolean).join(' · ');
    const extra = z.art === 'sonstiges';
    return `<li class="anl z-${esc(z.zustand)}${z.an ? '' : ' aus'}">
      <label><input type="checkbox" ${extra ? `data-anl-extra="${z.index}"` : `data-anl="${esc(z.art)}" data-key="${esc(z.key || '')}"`} ${z.an ? 'checked' : ''} ${sperr || extra ? 'disabled' : ''}>
        <span class="nr">${z.nr ? 'Anlage ' + z.nr : '–'}</span>
        ${extra ? `<input type="text" data-anl-name="${z.index}" value="${esc(z.bezeichnung)}" placeholder="Bezeichnung im Bericht" aria-label="Bezeichnung im Bericht">` : `<span>${esc(z.titel)}</span>`}
        ${ZUSTAND[z.zustand] ? `<span class="marke ${esc(z.zustand)}">${ZUSTAND[z.zustand]}</span>` : ''}
        ${extra ? `<button type="button" class="klein-knopf" data-anl-weg="${z.index}" title="Aus dem Bericht nehmen (die Datei bleibt)">✕</button>` : ''}</label>
      ${info || z.grund || app ? `<div class="klein">${info}${z.grund ? `${info ? '<br>' : ''}${esc(z.grund)}` : ''}${app}</div>` : ''}</li>`;
  };
  const zs = m.anlagenZeilen || [], fest = zs.filter(z => z.fest || z.art === 'pruefbericht'), opt = zs.filter(z => !z.fest && z.art !== 'pruefbericht' && z.art !== 'sonstiges'), extra = zs.filter(z => z.art === 'sonstiges');
  $('anlagenListe').innerHTML = fest.map(zeile).join('')
    + (opt.length ? `<li class="anl-kopf">Weitere gefundene Anlagen – nur wenn angehakt</li>${opt.map(zeile).join('')}` : '')
    + (extra.length ? `<li class="anl-kopf">Eigene Anlagen</li>${extra.map(zeile).join('')}` : '');
  $('anlagenInfo').textContent = `${(m.anlagenListe || []).length} im Bericht`;
  $('btnAnlageDazu').hidden = !window.showOpenFilePicker;
}
function runsHtml(r) { return (Array.isArray(r) ? r : [r]).map(x => x && typeof x === 'object' ? `<span class="gap">${esc(x.gap)}</span>` : esc(x)).join(''); }
function vorschau(m) {
  const d = m.deckblatt;
  const kenn = (m.kennzeilen || []).length ? `<p class="kenn">${m.kennzeilen.map(k => `<span class="${esc(k.art)}">${esc(k.text)}</span>`).join(' · ')}</p>` : '';
  const deck = `<div class="blatt">${kenn}<p class="titel">${esc(d.titel)}</p><p class="mitt">(${esc(d.mitteilung)})</p>
    <div class="zeile"><span>Projektnummer:</span><span>${runsHtml(d.projektnummer || { gap: '[Projektnummer]' })}</span></div>
    <p style="margin:0 0 12px;text-align:left;line-height:1.35">${runsHtml(d.betreff)}</p>
    ${d.felder.map(([k, v]) => `<div class="zeile"><span>${esc(k)}</span><span>${v.map(runsHtml).join('<br>')}</span></div>`).join('')}</div>`;
  const teile = [`${kenn}<div class="kopfzeilen">${m.kopf.map(runsHtml).join('<br>')}</div>`];
  for (const a of m.abschnitte) {
    teile.push(`<h3>${esc(a.titel)}</h3>`);
    for (const x of a.inhalt) {
      if (x.t === 'p') teile.push(`<p>${runsHtml(x.runs)}</p>`);
      else if (x.t === 'fig') teile.push(`<figure>${S.thumbs[x.datei] ? `<img src="${S.thumbs[x.datei]}" alt="">` : `<span class="ersatz" data-thumb="${esc(x.datei)}">${esc(x.datei)}</span>`}<figcaption>${esc(x.caption)}</figcaption></figure>`);
      else if (x.t === 'tab') teile.push(`<div class="tabtitel">${esc(x.caption)}</div><table><tr>${x.kopf.map((k, i) => `<th${(x.ausrichtung || [])[i] === 'center' ? ' style="text-align:center"' : ''}>${esc(k)}</th>`).join('')}</tr>${x.zeilen.map(z => `<tr>${z.map((c, i) => `<td${(x.ausrichtung || [])[i] === 'center' ? ' style="text-align:center"' : ''}>${esc(c || '–')}</td>`).join('')}</tr>`).join('')}</table>`);
    }
  }
  teile.push(`<p style="margin-top:20px">${esc(m.ortDatum)}</p><div class="sig">${m.unterschriften.map(u => {
    const b = u.kuerzel && S.sig[sigKey(u.kuerzel)];
    return `<div><div class="linie">${b ? `<img src="${b.url}" alt="">` : ''}</div>${runsHtml(u.rolle)}<br>${runsHtml(u.name)}</div>`; }).join('')}</div>`);
  teile.push(`<div style="margin-top:28px;display:grid;grid-template-columns:auto 1fr;column-gap:.7em;row-gap:.5em;text-align:left">${(m.anlagenTeile || [])
    .map(a => `<div>${esc(a.label)}</div><div>${a.zeilen.map(runsHtml).join('<br>')}</div>`).join('')}</div>`);
  $('vorschau').innerHTML = deck + `<div class="blatt">${teile.join('')}</div>`;
  vorschauBilder();
}
async function vorschauBilder() {
  for (const el of document.querySelectorAll('[data-thumb]')) {
    const datei = el.dataset.thumb; if (S.thumbs[datei] === undefined) {
      S.thumbs[datei] = null;
      try { const f = await fotoBytes(datei, 480); S.thumbs[datei] = URL.createObjectURL(new Blob([f.data], { type: 'image/jpeg' })); } catch (e) { S.thumbs[datei] = ''; }
    }
    if (S.thumbs[datei]) { const img = document.createElement('img'); img.src = S.thumbs[datei]; img.alt = ''; el.replaceWith(img); }
  }
}

/* ---------- Bilder ---------- */
function drehungVon(datei) { const b = S.fk && S.fk.bilder && S.fk.bilder[datei]; return b ? +b.drehung || 0 : 0; }
async function fotoBytes(datei, max = 1600) {
  if (!S.fotosDir) throw new Error('Ordner „Fotos“ fehlt.');
  const file = await (await S.fotosDir.getFileHandle(datei)).getFile();
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const turn = ((Math.round(drehungVon(datei) / 90) % 4) + 4) % 4, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s), c = document.createElement('canvas');
    c.width = turn % 2 ? h : w; c.height = turn % 2 ? w : h;
    const ctx = c.getContext('2d'); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(turn * Math.PI / 2); ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return { data: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
  } finally { bmp.close(); }
}
async function logoLaden() {
  if (S.logo) return S.logo;
  const hol = async n => new Uint8Array(await (await fetch(n, { cache: 'no-cache' })).arrayBuffer());
  S.logo = { logoSvg: await hol('assets/logo-schiffers.svg'), logoPng: await hol('assets/logo-schiffers.png') };
  return S.logo;
}

/* ---------- Word-Datei ---------- */
async function wordBlob(m) {
  if (!m.proben.length) throw new Error('Keine Proben im Bericht.');
  const bilder = { ...(await logoLaden()), sig: {}, fotos: {} };
  for (const u of m.unterschriften) { const b = u.kuerzel && S.sig[sigKey(u.kuerzel)]; if (b) bilder.sig[u.kuerzel] = b; }
  const fehlen = [];
  for (const p of m.proben) if (p.foto) { try { bilder.fotos[p.label] = await fotoBytes(p.foto); } catch (e) { fehlen.push(p.foto); } }
  const blob = await docx.Packer.toBlob(BerichtDocx.erstellen(docx, m, bilder));
  return { blob, m, fehlen };
}
const UNGESEHEN_MS = 3000;
/** Vor dem Speichern/Herunterladen: geänderte Daten aus ResultKit, LabelKit, Projektzentrale? Dann erst ansehen lassen. */
async function vorherNeuLesen(anlass) {
  await (S.fokusLauf || Promise.resolve()).catch(() => {});   // gerade beim Zurückkommen ins Fenster neu gelesen? Erst abwarten.
  const geaendert = await quellenAuffrischen(anlass).catch(() => []);
  await anlagenLesen().catch(() => {}); render();   // Anlagen frisch: inzwischen in FotoKit/PlanKit erstellt oder geändert?
  // Eben erst neu gelesen (Fokus und Klick fast gleichzeitig, z. B. direkt auf „Speichern“ aus ResultKit zurück): auch dann einmal anhalten
  const ungesehen = S.ungesehen && Date.now() - S.ungesehen < UNGESEHEN_MS;
  S.ungesehen = 0;
  if (!geaendert.length && !ungesehen) return false;
  statusFest('<span class="warn">Die Daten haben sich inzwischen geändert – schau dir die Vorschau an und klick dann noch einmal.</span>');
  return true;
}
/** Statuszeile, die ein Neuzeichnen kurz übersteht (bis zur nächsten eigenen Eingabe, höchstens 8 s) */
function statusFest(html) { S.statusFest = { html, bis: Date.now() + 8000 }; $('status').innerHTML = html; }
const dateiDa = async (dir, name) => { try { await dir.getFileHandle(name); return true; } catch (e) { return false; } };
async function freierName(dir, name) { for (let i = 2; ; i++) { const n = name.replace(/\.docx$/i, ` (${i}).docx`); if (!(await dateiDa(dir, n))) return n; } }
async function speichern() {
  const knopf = $('btnErstellen');
  knopf.disabled = true;
  try { if (await vorherNeuLesen('speichern')) return; } finally { knopf.disabled = modell().sperren.length > 0; }
  let m0 = modell();
  if (m0.sperren.length) { fehler('Nicht gespeichert – ' + m0.sperren.join(' ')); return; }   // Knopf ist dann ohnehin aus
  knopf.disabled = true; uebergabeZeigen(''); S.speichert = true;   // während der Rückfragen nichts nachladen – der Bericht entsteht aus dem geprüften Stand
  try {
    if (!(await erlaubt(S.dir, true))) throw new Error('Kein Schreibzugriff auf den Projektordner.');
    const ziel = await SO.unter(S.dir, ['Mitteilungen'], true);
    let name = m0.dateiname, neueNr = 0;
    if (await dateiDa(ziel, name)) {
      // Datei gibt es schon: Ersetzen / daneben / abbrechen – ist sie schon beim Büro, wird nicht ersetzt
      const buero = await beimBuero(name).catch(() => ({ unklar: true })), naechste = await naechsteMitteilung();
      const wahl = await ersetzenFragen(name, buero, naechste);
      if (wahl === 'abbrechen') { statusFest(esc(`Nicht gespeichert – „${name}“ ist unverändert.`)); return; }
      if (wahl === 'daneben') name = await freierName(ziel, name);
      if (wahl === 'naechste') {   // Nummer erst nach allen Rückfragen übernehmen – bei Abbruch bleibt das Formular, wie es war
        neueNr = naechste; m0 = modell({ mitteilung: naechste });
        if (m0.sperren.length) { fehler('Nicht gespeichert – ' + m0.sperren.join(' ')); return; }
        name = m0.dateiname; if (await dateiDa(ziel, name)) name = await freierName(ziel, name);
      }
    }
    if (m0.luecken.length && !confirm(`Im Bericht sind noch ${m0.luecken.length} Lücke(n) gelb markiert:\n${m0.luecken.join(', ')}\n\nTrotzdem speichern?`)) { render(); return; }
    if (neueNr) { S.form.mitteilung = neueNr; S.form.mitteilungAm = new Date().toISOString(); formMerken('mitteilung', 'mitteilungAm'); render(); }
    S.statusFest = null; $('status').textContent = 'Word-Datei wird erstellt …';
    const { blob, m, fehlen } = await wordBlob(m0);
    const fh = await ziel.getFileHandle(name, { create: true });
    let w; try { w = await fh.createWritable(); } catch (e) { throw new Error(`„${name}“ lässt sich nicht schreiben – ist die Datei noch in Word geöffnet?`); }
    await w.write(blob); await w.close();
    const zurueck = await (await fh.getFile()).arrayBuffer();
    if (zurueck.byteLength !== blob.size) throw new Error('Gespeicherte Datei ist unvollständig – bitte erneut versuchen.');
    clearTimeout(S.zustand.geplant);
    // Protokoll: welche Dateien als Anlage dazugehören (für die Übergabe: Pfade im Projektordner), wie viele Lücken beim Speichern offen waren,
    // Nummer und Datum (beim nächsten Öffnen: eine Nummer, die es schon gibt, und das Datum dazu werden nicht mehr vorgeschlagen)
    await zustandSchreiben({ datei: name, am: new Date().toISOString(), von: ich(), mitteilung: +S.form.mitteilung || 1, datum: S.form.datum || '',
      anlagen: m.anlagenDateien, anlagenListe: m.anlagenListe, luecken: m.luecken.length })
      .catch(e => fehler('Bericht gespeichert, Angaben dazu nicht: ' + (e && e.message || e)));
    if (window.MosaikLeiste) MosaikLeiste.aktualisieren();
    statusFest(`<span class="ok">✓ Gespeichert: Mitteilungen/${esc(name)}</span>` + (fehlen.length ? ` · Foto(s) nicht lesbar: ${esc(fehlen.join(', '))}` : ''));
    uebergabeZeigen(name);
  } catch (e) {
    $('status').textContent = ''; fehler('Speichern fehlgeschlagen: ' + (e && e.message || e));
  } finally { S.speichert = false; knopf.disabled = modell().sperren.length > 0; }
}
/** Rückfrage „gibt es schon“ mit drei Knöpfen; Abbrechen ist der Standard (Fokus, Esc).
    Schon beim Büro: kein „Ersetzen“, stattdessen „Als n. Mitteilung speichern“. → 'ersetzen' | 'daneben' | 'naechste' | 'abbrechen' */
function ersetzenFragen(name, buero, naechste) {
  const d = $('dlgErsetzen'), am = buero && Date.parse(buero.erstellt) ? tagDE(Date.parse(buero.erstellt)) : '';
  $('ersTitel').textContent = buero ? (buero.unklar ? 'Büro-Stand unklar' : 'Schon beim Büro') : 'Datei gibt es schon';
  $('ersText').textContent = buero
    ? (buero.unklar ? `Ob „${name}“ schon beim Büro ist, ließ sich nicht prüfen – als nächste Mitteilung speichern?`
      : `„${name}“ ist schon beim Büro${am ? ` (übergeben am ${am})` : ''} – als nächste Mitteilung speichern?`)
    : `„${name}“ gibt es schon in „Mitteilungen“. Was soll passieren?`;
  $('ersErkl').innerHTML = [
    buero ? `<li><b>Als ${naechste}. Mitteilung speichern</b>: neuer Bericht mit der Nummer ${naechste}, der übergebene bleibt unverändert.</li>`
      : '<li><b>Ersetzen</b>: Die vorhandene Datei wird überschrieben – auch was dort schon in Word ergänzt wurde.</li>',
    `<li><b>Daneben speichern</b>: neue Datei „${esc(name.replace(/\.docx$/i, ' (2).docx'))}“, die vorhandene bleibt.</li>`,
    '<li><b>Abbrechen</b>: nichts wird gespeichert.</li>'].join('');
  $('ersErsetzen').hidden = !!buero; $('ersNaechste').hidden = !buero;
  $('ersNaechste').textContent = `Als ${naechste}. Mitteilung speichern`;
  d.returnValue = '';
  d.showModal(); $('ersAbbrechen').focus();
  return new Promise(res => d.addEventListener('close', () => res(['ersetzen', 'daneben', 'naechste'].includes(d.returnValue) ? d.returnValue : 'abbrechen'), { once: true }));
}
/** Büroaufgaben des Projekts lesen (nur lesen; Ort wie BüroKit: spektron-ordner.js, Bereich „buero“) und prüfen, ob eine die Datei nennt. */
async function beimBuero(datei) {
  const o = await SO.ort(S.dir, 'buero').catch(() => ({})), aufgaben = [], vermerke = [];
  if (!o.dir) return null;
  const lies = async (d, n) => { try { return JSON.parse(await (await (await d.getFileHandle(n)).getFile()).text()); } catch (e) { return null; } };
  for await (const h of o.dir.values()) {
    if (h.kind !== 'directory') continue;
    if (h.name === 'aufgaben' || h.name === 'vermerke') {
      for await (const f of h.values()) {
        if (f.kind !== 'file' || !/\.json$/i.test(f.name)) continue;
        const x = await lies(h, f.name); if (!x || x.format !== 'spektron-buerokit' || x.version !== 1) continue;
        if (x.typ === 'aufgabe') aufgaben.push(x); else if (x.typ === 'vermerk') vermerke.push(x);
      }
    } else {   // frühere Büroübergaben der Projektzentrale (bis 1.27): <id>/auftrag.json + rueckmeldung-*.json (wie buero-aufgaben.js altLesen)
      const x = await lies(h, 'auftrag.json');
      if (!x || x.format !== 'spektron-buero' || !x.content) continue;
      const a = { id: x.id, art: 'gutachten', word: x.content.word, erstellt: x.created }, ev = [];
      for await (const f of h.values()) if (f.kind === 'file' && /^rueckmeldung-[0-9a-zA-Z-]+\.json$/.test(f.name)) {
        const e = await lies(h, f.name); if (e && e.format === 'spektron-buero' && e.orderId === x.id && e.payload) ev.push(e);
      }
      ev.sort((p, q) => String(p.at).localeCompare(String(q.at)) || String(p.id).localeCompare(String(q.id)));
      for (const e of ev) {
        if (e.type === 'revise' && e.payload.content && e.payload.content.word) a.word = e.payload.content.word;
        if (e.type === 'withdraw') vermerke.push({ id: String(e.id), aufgabe: x.id, schritt: 'geloescht', wert: true, zeit: e.at });
      }
      aufgaben.push(a);
    }
  }
  return V.beimBuero(aufgaben, vermerke, datei);
}
/** Nach dem Speichern: in der Projektzentrale „Ans Büro übergeben“ – Word-Datei und Prüfberichte dort vorbelegt. */
function uebergabeZeigen(datei) {
  const a = $('btnUebergabe'); if (!a) return;
  a.hidden = !datei || !S.dir;
  a.href = datei && S.dir ? `../Projektzentrale/#projekt=${encodeURIComponent(S.dir.name)}&uebergabe=${encodeURIComponent('Mitteilungen/' + datei)}` : '#';
}
async function herunterladen() {
  try {
    if (await vorherNeuLesen('herunterladen')) return;
    const m0 = modell(), { blob, m } = await wordBlob(m0.sperren.length ? T.alsEntwurf(m0) : m0);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m.dateiname; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (e) { fehler('Erstellen fehlgeschlagen: ' + (e && e.message || e)); }
}

/* ---------- Einstellungen (Archivordner: _Spektron-BerichtKit.json) ---------- */
function einstellungenOeffnen() {
  const c = S.cfg || { personen: {} }, pers = c.personen || {};
  const liste = [...S.mitarbeiter.map(p => p.ordnerKuerzel), ...Object.keys(pers)].filter((k, i, a) => k && a.indexOf(k) === i);
  $('eLabor').value = c.labor || '';
  $('ePersonen').innerHTML = liste.length ? liste.map(k => {
    const p = pers[k] || {}, ma = S.mitarbeiter.find(x => x.ordnerKuerzel === k) || {};
    const vorschlag = T.person({ personen: { [k]: { ...p, satz: '' } } }, S.mitarbeiter, k);
    return `<tr data-k="${esc(k)}"><td>${esc(k)}</td>
      <td><input type="text" data-f="name" value="${esc(p.name || '')}" placeholder="${esc(ma.name || '')}" title="Leer = Name aus der Projektzentrale; z. B. mit akademischem Grad"></td>
      <td><select data-f="geschlecht"><option value="">${({ w: 'Frau (Standard)', m: 'Herr (Standard)' })[T.anredeStandard(p.name || ma.name || '')] || '–'}</option><option value="w" ${p.geschlecht === 'w' ? 'selected' : ''}>Frau</option><option value="m" ${p.geschlecht === 'm' ? 'selected' : ''}>Herr</option></select></td>
      <td><select data-f="rolle"><option value="">nicht festgelegt (gilt als SV)</option><option value="sv" ${p.rolle === 'sv' ? 'selected' : ''}>Sachverständige(r)</option><option value="mt" ${p.rolle === 'mt' ? 'selected' : ''}>Messtechniker(in)</option></select></td>
      <td><input type="text" data-f="satz" value="${esc(p.satz || '')}" placeholder="${esc(vorschlag ? vorschlag.satz : '')}" title="„… wurde durch ___ entnommen“ – leer = Vorschlag"></td>
      <td>${S.sig[sigKey(k)] ? '<span class="ok">✓ vorhanden</span>' : `<span class="klein">fehlt (${esc(k)}.png)</span>`}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="klein">Keine Namensliste – in der Projektzentrale unter Mitarbeiter anlegen.</td></tr>';
  $('eHinweis').textContent = S.cfgOrt === 'lokal' ? 'Archivordner nicht verbunden – Einstellungen werden nur in diesem Browser gespeichert. Öffnen Sie BerichtKit aus der Projektzentrale, damit sie für alle gelten.' : '';
  $('dlgEinstellungen').showModal();
}
async function einstellungenSpeichern() {
  const personen = {};
  for (const tr of $('ePersonen').querySelectorAll('tr[data-k]')) {
    const p = {}; for (const el of tr.querySelectorAll('[data-f]')) if (el.value.trim()) p[el.dataset.f] = el.value.trim();
    if (Object.keys(p).length) personen[tr.dataset.k] = p;   // Rolle wird auch als „sv“ gespeichert – sonst bliebe sie „nicht festgelegt“
  }
  const neu = { format: 'spektron-berichtkit', version: 1, hinweis: 'Einstellungen von BerichtKit (Spektron) – Namen, Rollen, Labor. Nicht von Hand bearbeiten.',
    labor: $('eLabor').value.trim(), personen, geaendert: new Date().toISOString(), geaendertMit: 'BerichtKit ' + APP_VERSION };
  const text = JSON.stringify(neu, null, 1);
  try {
    if (S.cfgOrt === 'archiv' && S.archiv) {
      if (!(await erlaubt(S.archiv, true))) throw new Error('Kein Schreibzugriff auf den Archivordner.');
      const jetzt = await leseJson(S.archiv, CFG_DATEI).catch(() => null);
      if ((jetzt ? jetzt.text : null) !== S.cfgText && !confirm('Die Einstellungen wurden inzwischen von jemand anderem geändert.\nOK = trotzdem mit Ihrer Fassung überschreiben, Abbrechen = nichts speichern.')) return;
      const fh = await S.archiv.getFileHandle(CFG_DATEI, { create: true }), w = await fh.createWritable(); await w.write(text); await w.close();
      const zurueck = await (await fh.getFile()).text(); if (zurueck !== text) throw new Error('Zurücklesen stimmt nicht.');
      S.cfgText = text;
    } else localStorage.setItem('berichtkit:cfg', text);
    const laborAlt = S.cfg.labor || '';
    S.cfg = neu; vorgabenNeu();   // Labor, Rollen → Vorgaben neu; ein eigenes Labor, das dem bisherigen Standard entsprach, folgt dem neuen
    $('dlgEinstellungen').close();
    if ('labor' in S.eigen && (!S.eigen.labor || S.eigen.labor === laborAlt)) eigenWeg('labor');
    render();
  } catch (e) { alert('Einstellungen nicht gespeichert: ' + (e && e.message || e)); }
}

/* ---------- Eingaben ---------- */
function setze(k, v) { S.form[k] = v; formMerken(k); render(); }
function verbinden() {
  $('btnWaehlen').onclick = waehlen; $('btnOrdner').onclick = waehlen; $('btnAsbest').onclick = zumAsbestbericht;
  $('btnEinstellungen').onclick = einstellungenOeffnen;
  $('eAbbrechen').onclick = () => $('dlgEinstellungen').close(); $('eSpeichern').onclick = einstellungenSpeichern;
  $('btnErstellen').onclick = speichern; $('btnLaden').onclick = herunterladen;
  $('fDatum').onchange = e => setze('datum', e.target.value);
  $('fMitteilung').onchange = e => { S.form.mitteilung = Math.max(1, +e.target.value || 1); S.form.mitteilungAm = new Date().toISOString(); formMerken('mitteilung', 'mitteilungAm'); render(); };
  $('fEingang').onchange = e => setze('eingangsdatum', e.target.value);
  $('fAuftrag').onchange = e => setze('auftragsdatum', e.target.value);
  $('fAg').oninput = e => { S.form.agSatz = e.target.value; formMerken('agSatz'); vorschau(modell()); };
  $('fAg').onchange = () => render();
  $('fPn').onchange = e => { const k = e.target.value, mtAlt = S.form.mt; S.form.probenehmer = k; if (k && rolle(k) === 'mt') S.form.mt = k; else if (S.form.mt && S.form.mt !== k && rolle(S.form.mt) === 'mt') S.form.mt = '';
    S.form.pnQuelle = 'hand'; formMerken('probenehmer', 'pnQuelle', ...(S.form.mt !== mtAlt ? ['mt'] : [])); render(); };
  $('btnPnOk').onclick = () => bestaetigen('probenehmer');
  $('btnVersOk').onclick = () => bestaetigen('versicherer');
  $('btnSvOk').onclick = () => bestaetigen('sv');
  $('hinweise').addEventListener('click', e => {
    const ok = e.target.closest('[data-ok]'); if (ok) { bestaetigen(ok.dataset.ok); return; }
    if (e.target.closest('[data-aktion="einstellungen"]')) einstellungenOeffnen();
  });
  // Neue Person: „als …“ wieder nach den Einstellungen; gleiche Rolle wie in den Einstellungen = keine eigene Wahl
  $('fSv').onchange = e => { S.form.sv = e.target.value; S.form.svOk = e.target.value; S.form.rolle1 = ''; formMerken('sv', 'svOk', 'rolle1'); render(); };   // selbst gewählt = bestätigt
  $('fMt').onchange = e => { S.form.mt = e.target.value; S.form.rolle2 = ''; formMerken('mt', 'rolle2'); render(); };
  // Gleich wie in den Einstellungen = keine eigene Wahl – aber nur, wenn die Rolle dort festgelegt ist; sonst gilt die Wahl hier ausdrücklich
  const rolleWahl = (k, v) => v === rolle(k) && T.rolleFestgelegt(S.cfg, k) ? '' : v;
  $('fR1').onchange = e => setze('rolle1', rolleWahl(S.form.sv, e.target.value));
  $('fR2').onchange = e => setze('rolle2', rolleWahl(S.form.mt, e.target.value));
  document.querySelectorAll('input[name=deckblatt]').forEach(r => { r.onchange = () => setze('deckblatt', r.value); });
  $('btnDeckblattAuto').onclick = () => setze('deckblatt', '');
  $('fLabor').onchange = e => setze('labor', e.target.value.trim());
  $('fVers').onchange = e => setze('versicherer', e.target.value.trim());
  document.querySelectorAll('input[name=variante]').forEach(r => { r.onchange = () => setze('variante', r.value); });
  document.querySelectorAll('input[name=einbau]').forEach(r => { r.onchange = () => setze('einbau', r.value); });
  $('probenListe').addEventListener('change', e => {
    const el = e.target, art = el.dataset.art, l = el.dataset.l; if (!art) return;
    const map = S.form[art] = { ...(S.form[art] || {}) };
    if (art === 'aus') { if (el.checked) delete map[l]; else map[l] = false; }
    else if (art === 'kmf' || art === 'who') map[l] = el.checked;
    else map[l] = el.value.trim();
    formMerken([art, l]); render();
  });
  $('anlagenListe').addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.anl) { S.form.anlagen = { ...(S.form.anlagen || {}), [el.dataset.anl]: { an: el.checked, key: el.dataset.key } }; formMerken(['anlagen', el.dataset.anl]); render(); }
    else if (el.dataset.anlName !== undefined) { const x = [...(S.form.anlagenExtra || [])], i = +el.dataset.anlName; if (x[i]) { x[i] = { ...x[i], bezeichnung: el.value.trim() }; setze('anlagenExtra', x); } }
  });
  $('anlagenListe').addEventListener('click', e => {
    const b = e.target.closest('[data-anl-weg]'); if (!b) return;
    const x = [...(S.form.anlagenExtra || [])]; x.splice(+b.dataset.anlWeg, 1); setze('anlagenExtra', x);
  });
  $('btnAnlageDazu').onclick = anlageHinzufuegen;
  // Zurück aus ResultKit, LabelKit, Projektzentrale, FotoKit, PlanKit: geänderte Daten und neu erstellte Anlagen gleich sehen
  // Neu gezeichnet wird nur bei einer Änderung – sonst bliebe z. B. „Nicht gespeichert …“ nach einem Dialog nicht stehen
  window.addEventListener('focus', () => {
    if (!S.dir || S.laedt || S.speichert) return;
    const anl = () => V.stabil([S.anlagen, [...(S.anlagenVorhanden || [])]]), vorher = anl();
    S.fokusLauf = Promise.all([quellenAuffrischen('fokus'), anlagenLesen()]).then(([g]) => { if (g.length || anl() !== vorher) render(); }).catch(() => {});
  });
  $('btnMeldungenWeg').onclick = () => { S.meldungen = []; meldungenZeigen(); };
  window.addEventListener('hashchange', () => {
    const n = PROJEKT_URL.lesen(), a = artAusAdresse();
    if ((n && (!S.dir || n !== S.dir.name)) || !a.bereit || (S.dir && a.art !== S.art)) start();
  });
}
verbinden();
start();

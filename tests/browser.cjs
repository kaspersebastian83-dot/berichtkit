// BerichtKit im echten Browser (Chromium): Archiv- und Projektordner werden im privaten Dateisystem des Browsers (OPFS)
// nachgebaut – mit erfundenen Daten. Geprüft: Öffnen über #projekt=, Vorschau, Einstellungen, Word-Datei in „Mitteilungen“.
// node tests/browser.cjs [chromium]   (Playwright wird in CI installiert; lokal reicht ein vorhandenes playwright)
// Mit BERICHT_AUSGABE=<Ordner> wird die erzeugte Word-Datei dort abgelegt (zum Ansehen).
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { chromium } = require('playwright');
const B = require('./daten/beispiel.cjs');
const ROOT = path.join(__dirname, '..');
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYP[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const PROJEKT = '99.9001 Musterweg Musterstadt Tst';
/** Eine Datei aus einem ZIP lesen (Word-Datei → word/document.xml) – ohne Bibliothek */
function zipDatei(buf, name) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0, n = buf.readUInt16LE(eocd + 10); i < n; i++) {
    const methode = buf.readUInt16LE(p + 10), groesse = buf.readUInt32LE(p + 20), lName = buf.readUInt16LE(p + 28), ofs = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + lName) === name) {
      const start = ofs + 30 + buf.readUInt16LE(ofs + 26) + buf.readUInt16LE(ofs + 28), daten = buf.subarray(start, start + groesse);
      return (methode === 8 ? zlib.inflateRawSync(daten) : daten).toString('utf8');
    }
    p += 46 + lName + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return null;
}
const daten = {
  pj: B.pj(),
  // P3 in LabelKit storniert (4.49.0), der Prüfbericht hat trotzdem einen Wert dafür
  lk: { ...B.lk([[1, '2026-10-16', 'Umkleide Schwimmbad', 'Fliesenkleber', 'Bituminöse Proben / Kleber'], [2, '2026-10-16', 'Dachboden', 'Dämmstoff Mineralwolle', 'Sonstige'],
    [3, '2026-10-16', 'Heizungskeller', 'Rohrisolierung', 'Rohrisolierungen (Gips-Basis)', B.STORNO]]), nrSchutz: 1 },
  erg: B.erg([[1, 'chrysotil'], [2, 'kmf'], [3, 'kein']]),
  ma: { format: 'spektron-mitarbeiter', version: 1, personen: B.mitarbeiter },
  fk: { app: 'Bildumbenenner', format: 1, reihenfolge: ['01_P1_Fliesenkleber.jpg'], bilder: { '01_P1_Fliesenkleber.jpg': { beschreibung: 'Fliesenkleber', probe: 'P1' }, '02_alt.jpg': { aussortiert: true, probe: 'P1' } },
    projekt: { anlage: 'Anlage 2' }, dokuGeaendert: '2026-10-30T09:00:00.000Z',
    bilddoku: { dateien: ['Bilddokumentation_99.9001_Musterstadt_2026-10-30_Teil_1_von_2.pdf', 'Bilddokumentation_99.9001_Musterstadt_2026-10-30_Teil_2_von_2.pdf'], erstellt: '2026-10-30T10:00:00.000Z', anlage: 'Anlage 2' } },
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Archiv-Handle wie aus „mosaik-suite“/„archiv“: direkt aus dem OPFS geliefert. Ein Ordner-Handle aus IndexedDB zurückzulesen
  // bringt manche Headless-Chromium-Builds zum Absturz; die Projektzentrale legt es im echten Browser genauso ab.
  await context.addInitScript(() => {
    const orig = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (k) {
      if (k !== 'archiv' || this.name !== 'kv') return orig.call(this, k);
      const req = { result: undefined, error: null, onsuccess: null, onerror: null };
      navigator.storage.getDirectory().then(r => r.getDirectoryHandle('Archiv')).then(
        h => { req.result = h; if (req.onsuccess) req.onsuccess({ target: req }); },
        () => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    };
  });
  const page = await context.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(e.message)); page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  const dialoge = []; page.on('dialog', d => { dialoge.push(d.message()); d.accept(); });
  try {
    await page.goto(url + 'index.html');
    await page.waitForSelector('#start:not([hidden])');
    // Archiv im OPFS anlegen (Ordner „Archiv“ – BerichtKit bekommt ihn als „archiv“, siehe oben)
    await page.evaluate(async ({ PROJEKT, daten }) => {
      const root = await navigator.storage.getDirectory();
      const archiv = await root.getDirectoryHandle('Archiv', { create: true });
      const schreib = async (dir, pfad, inhalt) => {
        const teile = pfad.split('/'); let d = dir;
        for (const t of teile.slice(0, -1)) d = await d.getDirectoryHandle(t, { create: true });
        const w = await (await d.getFileHandle(teile.at(-1), { create: true })).createWritable(); await w.write(inhalt); await w.close();
      };
      const c = document.createElement('canvas'); c.width = 800; c.height = 450; const x = c.getContext('2d');
      x.fillStyle = '#c9b38a'; x.fillRect(0, 0, 800, 450); x.fillStyle = '#333'; x.font = '60px sans-serif'; x.fillText('Probe 1', 250, 240);
      const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
      await schreib(archiv, '_Spektron-Mitarbeiter.json', JSON.stringify(daten.ma));
      const p = PROJEKT + '/';
      await schreib(archiv, p + '_Spektron/_Projekt.json', JSON.stringify(daten.pj));
      await schreib(archiv, p + '_Spektron/LabelKit/99.9001_16.10.2026_Daten.json', JSON.stringify(daten.lk));
      await schreib(archiv, p + '_Spektron/ResultKit/_Ergebnisse.json', JSON.stringify(daten.erg));
      await schreib(archiv, p + '_Spektron/FotoKit/_Bildumbenenner.json', JSON.stringify(daten.fk));
      await schreib(archiv, p + 'Fotos/01_P1_Fliesenkleber.jpg', jpg);
      await schreib(archiv, p + 'Mitteilungen/1._Mitteilung_99.9001.docx', 'alt');
      // Anlagen: Bilddoku in zwei Teilen (FotoKit), Probenplan-PDF nach der PlanKit-Datei (aktuell), Raumbuch (optional)
      await schreib(archiv, p + '_Spektron/PlanKit/Probenplan ' + PROJEKT + '.probenplan', '{"plan":1}');
      await new Promise(r => setTimeout(r, 30));
      for (const t of [1, 2]) await schreib(archiv, p + `Fotos/Bilddokumentation_99.9001_Musterstadt_2026-10-30_Teil_${t}_von_2.pdf`, '%PDF-1.4 Teil ' + t);
      await schreib(archiv, p + 'Pläne/Probenplan ' + PROJEKT + '.pdf', '%PDF-1.4 Plan');
      await schreib(archiv, p + 'Mitteilungen/99.9001_Raumbuch_2026-10-30.docx', 'PK');
    }, { PROJEKT, daten });

    // Dateien im Projektordner lesen/ändern (wie ein Kollege oder eine andere App)
    const projektDatei = (pfad, inhalt) => page.evaluate(async ({ P, pfad, inhalt }) => {
      let d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P);
      const teile = pfad.split('/'); for (const t of teile.slice(0, -1)) d = await d.getDirectoryHandle(t, { create: inhalt != null });
      if (inhalt == null) { try { return await (await (await d.getFileHandle(teile.at(-1))).getFile()).text(); } catch (e) { return null; } }
      const w = await (await d.getFileHandle(teile.at(-1), { create: true })).createWritable(); await w.write(inhalt); await w.close(); return inhalt;
    }, { P: PROJEKT, pfad, inhalt });
    const heuteISO = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

    // Öffnen wie aus der Projektzentrale
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT));
    await page.waitForSelector('#app:not([hidden]) .blatt');
    assert.equal(await page.textContent('#kopfProjekt'), PROJEKT);
    assert.equal(await page.inputValue('#fMitteilung'), '2', 'nächste freie Mitteilung');
    let v = await page.textContent('#vorschau');
    assert.match(v, /Untersuchung auf Asbest und künstliche Mineralfasern \(KMF\)/);
    assert.match(v, /Am 05\.10\.2026 wurde unser Büro durch die Beispiel Versicherung AG beauftragt/);
    assert.match(v, /In Probe 1 \(Material: Fliesenkleber\) wurde Asbest nachgewiesen: Chrysotil, 5 - 20 %\./);
    assert.match(v, /Kanzerogenitätsindex von KI = 26 aus/);
    assert.match(v, /Abb\. 1: Fliesenkleber, Umkleide Schwimmbad\./);
    await page.waitForSelector('#vorschau figure img');
    // Stornierte Probe P3: nicht angeboten, nicht im Bericht, sperrt nicht – nur der Hinweis zum Laborwert
    assert.equal(await page.textContent('#probenInfo'), '2 von 2 im Bericht');
    assert.doesNotMatch(await page.textContent('#probenListe'), /Probe 3|Heizungskeller|Rohrisolierung/);
    assert.doesNotMatch(v, /Heizungskeller|Rohrisolierung|999-2026-0000103/);
    assert.match(await page.textContent('#hinweise'), /P3 ist in LabelKit storniert – der Laborwert \(Prüfbericht AR-999-2026-000001-01\) kommt nicht in den Bericht\./);
    assert.doesNotMatch(await page.textContent('#hinweise'), /Gesperrt/);
    assert.ok(await page.isEnabled('#btnErstellen'), 'Speichern nicht gesperrt');
    // Labor fehlt noch → Lücke; Probenehmer ohne Frau/Herr → Hinweis
    assert.match(await page.textContent('#hinweise'), /Lücke im Bericht: \[Labor\] – Personen › Labor/);
    // Offene Stellen: Zähler oben, leeres Pflichtfeld gelb umrandet, Klick springt zum Feld (Zuordnung aus bericht-luecken.js)
    assert.equal(await page.textContent('#lueckenZaehler'), '1 Stelle noch offen');
    assert.ok(await page.isEnabled('#lueckenZaehler'));
    assert.equal(await page.textContent('#lueckenListe'), '[Labor] – Personen › Labor', 'Liste für Vorleser (aria-describedby)');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.offen-feld')].map(el => el.id)), ['fLabor']);
    await page.click('#lueckenZaehler');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fLabor', 'Sprung zum Feld, das die Lücke füllt');
    await page.click('#lueckenZaehler');   // nur eine Stelle → wieder dieselbe
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fLabor');
    // Versicherer nur angenommen (Auftraggeber): eine Meldung in den Hinweisen, am Feld nur „angenommen“; „✓ stimmt“ bestätigt
    const hw = () => page.textContent('#hinweise');
    assert.equal((await hw()).match(/Versicherer angenommen/g).length, 1, 'nicht doppelt');
    assert.match(await hw(), /Versicherer angenommen: Auftraggeber „Beispiel Versicherung AG“ – bitte prüfen\./);
    assert.equal(await page.textContent('#qVers'), 'angenommen – bitte prüfen'); assert.ok(await page.isVisible('#btnVersOk'));
    await page.click('#hinweise [data-ok="versicherer"]');
    assert.doesNotMatch(await hw(), /Versicherer angenommen/);
    assert.equal(await page.textContent('#qVers'), 'Auftraggeber = Versicherer (bestätigt)'); assert.ok(await page.isHidden('#btnVersOk'));
    // SV hat selbst Proben genommen, Rolle nicht festgelegt → Hinweis mit Knopf zu den Einstellungen
    assert.match(await hw(), /Dr\. Tanja Test hat die Proben genommen und unterschreibt als Sachverständige\(r\) – die Rolle ist in den Einstellungen noch nicht festgelegt\./);
    // Anlagen: Prüfbericht 1, Bilddoku 2 (zwei Dateien = eine Anlage), Probenplan 3; Raumbuch angeboten, nicht angehakt
    const anl = () => page.textContent('#anlagenListe');
    assert.match(await anl(), /Anlage 1\s*Prüfbericht AR-999-2026-000001-01/);
    assert.match(await anl(), /Anlage 2\s*Bilddokumentation[\s\S]*Teil_1_von_2\.pdf · Bilddokumentation_[^ ]*Teil_2_von_2\.pdf/);
    assert.match(await anl(), /Anlage 3\s*Probenplan/);
    assert.match(await anl(), /Weitere gefundene Anlagen[\s\S]*–\s*Raumbuch/);
    assert.ok(!(await page.isChecked('input[data-anl="raumbuch"]')));
    v = await page.textContent('#vorschau');
    assert.match(v, /Die Entnahmestellen sind zusätzlich in der Bilddokumentation \(Anlage 2\) und im Probenplan \(Anlage 3\) dargestellt\./);
    assert.match(v, /Anlage 2:\s*Bilddokumentation\s*Anlage 3:\s*Probenplan/);
    // Bilddoku abwählen → Probenplan wird Anlage 2; Raumbuch anhaken → Anlage 3
    await page.uncheck('input[data-anl="bilddoku"]'); await page.check('input[data-anl="raumbuch"]');
    v = await page.textContent('#vorschau');
    assert.match(v, /Die Lage der Entnahmestellen ist im Probenplan \(Anlage 2\) dargestellt\./);
    assert.match(v, /Anlage 2:\s*Probenplan\s*Anlage 3:\s*Raumbuch/);
    await page.check('input[data-anl="bilddoku"]'); await page.uncheck('input[data-anl="raumbuch"]');
    // In FotoKit nach dem Erstellen geändert → beim Zurückkommen veraltet und abgewählt
    await page.evaluate(async P => {
      const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P);
      const fh = await (await (await p.getDirectoryHandle('_Spektron')).getDirectoryHandle('FotoKit')).getFileHandle('_Bildumbenenner.json');
      const d = JSON.parse(await (await fh.getFile()).text()); d.dokuGeaendert = '2026-10-30T11:00:00.000Z';
      const w = await fh.createWritable(); await w.write(JSON.stringify(d)); await w.close();
    }, PROJEKT);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForSelector('#anlagenListe li.z-veraltet');
    assert.ok(!(await page.isChecked('input[data-anl="bilddoku"]')));
    assert.match(await anl(), /veraltet[\s\S]*nach dem Erstellen in FotoKit geändert[\s\S]*in FotoKit öffnen/);
    // … und nicht still: Hinweis „nicht im Bericht“ mit Sprung in FotoKit
    assert.match(await hw(), /Bilddokumentation veraltet – nicht im Bericht\. In FotoKit neu erstellen oder trotzdem anhaken\.\s*in FotoKit öffnen ↗/);
    assert.equal(await page.getAttribute('#hinweise a[target="bildumbenenner"]', 'href'), '../Bildumbenenner/#projekt=' + encodeURIComponent(PROJEKT));
    assert.match(await page.textContent('#vorschau'), /Anlage 2:\s*Probenplan/);
    // wieder aktuell (neu erstellt) → wieder angehakt
    await page.evaluate(async P => {
      const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P);
      const fh = await (await (await p.getDirectoryHandle('_Spektron')).getDirectoryHandle('FotoKit')).getFileHandle('_Bildumbenenner.json');
      const d = JSON.parse(await (await fh.getFile()).text()); d.bilddoku.erstellt = '2026-10-30T12:00:00.000Z';
      const w = await fh.createWritable(); await w.write(JSON.stringify(d)); await w.close();
    }, PROJEKT);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => !document.querySelector('#anlagenListe li.z-veraltet'));
    assert.ok(await page.isChecked('input[data-anl="bilddoku"]'), 'neue Fassung: wieder vorgehakt');
    assert.doesNotMatch(await hw(), /Bilddokumentation veraltet/);

    // Zurück aus ResultKit („Übernehmen“ mit neuem Wert): Laborwerte beim Fokus neu gelesen, bleibender Hinweis
    assert.ok(await page.isHidden('#meldungen'));
    const ergPfad = '_Spektron/ResultKit/_Ergebnisse.json', ergAlt = await projektDatei(ergPfad);
    await projektDatei(ergPfad, ergAlt.replace('"r":"5 - 20"', '"r":"10 - 50"'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => /Chrysotil, 10 - 50 %/.test(document.getElementById('vorschau').textContent));
    assert.match(await page.textContent('#meldungen'), /Daten neu gelesen \(\d\d:\d\d\): Laborergebnisse \(ResultKit\) – die Vorschau zeigt jetzt den neuen Stand\./);
    // Ohne Fokus geändert (z. B. zweiter Bildschirm): vor dem Herunterladen neu gelesen, erst ansehen, dann noch einmal klicken
    await projektDatei(ergPfad, ergAlt);
    // Statuszeile leeren: „… erst ansehen“ bleibt sonst bis zu 8 s stehen und würde den nächsten Halt vortäuschen
    const statusLeer = () => page.evaluate(() => { S.statusFest = null; document.getElementById('status').textContent = ''; });
    await statusLeer(); await page.click('#btnLaden');
    await page.waitForSelector('#status .warn');
    assert.match(await page.textContent('#status'), /Die Daten haben sich inzwischen geändert – schau dir die Vorschau an und klick dann noch einmal\./);
    assert.match(await page.textContent('#meldungen'), /Daten neu gelesen vor dem Speichern|Daten neu gelesen \(/);
    assert.match(await page.textContent('#vorschau'), /Chrysotil, 5 - 20 %/);
    await page.click('#btnMeldungenWeg'); assert.ok(await page.isHidden('#meldungen'));

    // Einstellungen: Labor und Personen für das Büro speichern
    await page.click('#hinweise [data-aktion="einstellungen"]');
    await page.waitForFunction(() => document.getElementById('dlgEinstellungen').open);
    assert.equal(await page.inputValue('tr[data-k="Tst"] select[data-f="rolle"]'), '', 'Rolle noch nicht festgelegt');
    await page.fill('#eLabor', 'Eurofins Beispiel-Labor GmbH');
    await page.selectOption('tr[data-k="Tst"] select[data-f="geschlecht"]', 'w');
    await page.selectOption('tr[data-k="Tst"] select[data-f="rolle"]', 'sv');
    await page.selectOption('tr[data-k="Mes"] select[data-f="geschlecht"]', 'm');
    await page.selectOption('tr[data-k="Mes"] select[data-f="rolle"]', 'mt');
    await page.click('#eSpeichern');
    await page.waitForFunction(() => !document.getElementById('dlgEinstellungen').open);
    const cfg = await page.evaluate(async () => JSON.parse(await (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getFileHandle('_Spektron-BerichtKit.json')).getFile()).text()));
    assert.equal(cfg.format, 'spektron-berichtkit'); assert.equal(cfg.labor, 'Eurofins Beispiel-Labor GmbH');
    assert.deepEqual(cfg.personen.Mes, { geschlecht: 'm', rolle: 'mt' });
    assert.deepEqual(cfg.personen.Tst, { geschlecht: 'w', rolle: 'sv' }, '„Sachverständige(r)“ wird ausdrücklich gespeichert');
    assert.equal(cfg.personen.Vom, undefined, 'nichts eingetragen – kein Eintrag');
    assert.doesNotMatch(await hw(), /hat die Proben genommen/, 'nach einmaligem Festlegen weg');
    await page.click('#btnEinstellungen');   // bleibt beim erneuten Öffnen stehen
    assert.equal(await page.inputValue('tr[data-k="Tst"] select[data-f="rolle"]'), 'sv');
    await page.click('#eAbbrechen'); await page.waitForFunction(() => !document.getElementById('dlgEinstellungen').open);

    // Personen wählen: Probenahme durch Messtechniker → zweite Unterschrift automatisch
    await page.selectOption('#fPn', 'Mes');
    await page.selectOption('#fSv', 'Tst');
    assert.equal(await page.inputValue('#fMt'), 'Mes');
    await page.check('input[name=einbau][value=vor1996]');
    v = await page.textContent('#vorschau');
    assert.match(v, /wurden durch Herrn Messer \(Sachverständigenbüro Dr\. Heinz Schiffers & Partner\) im Objekt zwei Materialproben entnommen/);
    assert.match(v, /Die Proben wurden der Eurofins Beispiel-Labor GmbH zur Untersuchung auf Asbest übergeben/);
    assert.match(v, /Der Dämmstoff wurde vor 1996 eingebaut/);
    assert.match(v, /Die Sachverständige.*Dr\. Tanja Test/s); assert.match(v, /Der Messtechniker.*Max Messer/s);
    assert.doesNotMatch(await page.textContent('#hinweise'), /Lücke im Bericht/);
    assert.equal(await page.textContent('#lueckenZaehler'), '✓ Keine offenen Stellen im Bericht'); assert.ok(await page.isDisabled('#lueckenZaehler'));
    assert.equal(await page.locator('.offen-feld').count(), 0, 'keine gelbe Umrandung ohne Lücke');
    // „als …“ je Unterschrift: folgt den Einstellungen, für diesen Bericht änderbar; Messtechniker darf allein unterschreiben
    const vs = () => page.textContent('#vorschau');
    assert.equal(await page.inputValue('#fR1'), 'sv'); assert.equal(await page.inputValue('#fR2'), 'mt');
    await page.selectOption('#fSv', 'Mes'); assert.equal(await page.inputValue('#fR1'), 'mt');
    assert.match(await vs(), /Der Messtechniker.*Max Messer/s); assert.doesNotMatch(await vs(), /Die Sachverständige/);
    await page.selectOption('#fSv', 'Tst'); await page.selectOption('#fR1', 'mt');
    assert.match(await vs(), /Die Messtechnikerin.*Dr\. Tanja Test/s);
    await page.selectOption('#fR1', 'sv'); assert.match(await vs(), /Die Sachverständige.*Dr\. Tanja Test/s);
    // Deckblatt mit/ohne Versicherung: automatisch (Auftraggeber ist eine Versicherung), umstellbar, zurück auf automatisch
    assert.ok(await page.isChecked('input[name=deckblatt][value=versicherung]'));
    assert.equal(await page.textContent('#qDeckblatt'), 'automatisch: Auftraggeber ist eine Versicherung');
    assert.ok(await page.isVisible('#fVers')); assert.match(await vs(), /Versicherer:/);
    await page.check('input[name=deckblatt][value=direkt]');
    assert.ok(!(await page.isVisible('#fVers'))); assert.doesNotMatch(await vs(), /Versicherer:/); assert.match(await vs(), /Auftraggeber:/);
    assert.equal(await page.textContent('#qDeckblatt'), 'selbst gewählt');
    await page.click('#btnDeckblattAuto');
    assert.ok(await page.isChecked('input[name=deckblatt][value=versicherung]')); assert.ok(!(await page.isVisible('#btnDeckblattAuto')));

    if (process.env.BERICHT_AUSGABE) { await page.setViewportSize({ width: 1440, height: 1000 }); await page.locator('#anlagenListe').evaluate(el => el.closest('.karte').scrollIntoView()); await page.locator('#anlagenListe').evaluate(el => el.closest('.karte')).then(() => page.locator('.karte:has(#anlagenListe)').screenshot({ path: path.join(process.env.BERICHT_AUSGABE, 'anlagen.png') })); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForSelector('#mosaikLeiste .ml-step'); await page.screenshot({ path: path.join(process.env.BERICHT_AUSGABE, 'oberflaeche.png'), fullPage: false }); }
    // Probe abwählen und wieder an
    await page.uncheck('input[data-art="aus"][data-l="P2"]');
    assert.doesNotMatch(await page.textContent('#vorschau'), /KMF/);
    await page.check('input[data-art="aus"][data-l="P2"]');

    // Speichern als 1. Mitteilung → Datei gibt es schon → eigener Dialog mit drei Knöpfen, Abbrechen ist der Standard
    await page.fill('#fMitteilung', '1'); await page.dispatchEvent('#fMitteilung', 'change');
    // vorher noch ein geänderter Laborwert: Speichern hält an, die Datei bleibt unberührt
    await projektDatei(ergPfad, ergAlt.replace('"r":"5 - 20"', '"r":"10 - 50"'));
    await statusLeer(); await page.click('#btnErstellen');
    await page.waitForSelector('#status .warn');
    assert.match(await page.textContent('#meldungen'), /Daten neu gelesen vor dem Speichern \(\d\d:\d\d\): Laborergebnisse \(ResultKit\)/);
    assert.ok(!(await page.evaluate(() => document.getElementById('dlgErsetzen').open)), 'noch keine Rückfrage');
    assert.equal(await projektDatei('Mitteilungen/1._Mitteilung_99.9001.docx'), 'alt');
    // Fokus und Klick fast gleichzeitig (zurück aus ResultKit, gleich auf „Speichern“): auch dann einmal anhalten
    await projektDatei(ergPfad, ergAlt); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await statusLeer(); await page.click('#btnErstellen');
    await page.waitForFunction(() => /Chrysotil, 5 - 20 %/.test(document.getElementById('vorschau').textContent));
    await page.waitForSelector('#status .warn');
    assert.ok(!(await page.evaluate(() => document.getElementById('dlgErsetzen').open)), 'erst ansehen');
    assert.equal(await projektDatei('Mitteilungen/1._Mitteilung_99.9001.docx'), 'alt');
    const ersetzen = async () => { await page.click('#btnErstellen'); await page.waitForSelector('#dlgErsetzen[open]'); };
    await ersetzen();
    assert.match(await page.textContent('#ersText'), /„1\._Mitteilung_99\.9001\.docx“ gibt es schon in „Mitteilungen“\. Was soll passieren\?/);
    assert.ok(await page.isVisible('#ersErsetzen')); assert.ok(await page.isVisible('#ersDaneben')); assert.ok(await page.isHidden('#ersNaechste'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ersAbbrechen', 'Abbrechen hat den Fokus');
    await page.keyboard.press('Enter');   // Enter = Abbrechen
    await page.waitForSelector('#dlgErsetzen', { state: 'hidden' });
    // „close“ kommt als eigene Aufgabe nach dem Schließen – auf die Statuszeile warten, nicht sofort lesen
    await page.waitForFunction(() => /Nicht gespeichert – „1\._Mitteilung_99\.9001\.docx“ ist unverändert\./.test(document.getElementById('status').textContent));
    assert.equal(await projektDatei('Mitteilungen/1._Mitteilung_99.9001.docx'), 'alt', 'Abbrechen speichert nichts');
    await ersetzen(); await page.keyboard.press('Escape'); await page.waitForSelector('#dlgErsetzen', { state: 'hidden' });
    assert.equal(await projektDatei('Mitteilungen/1._Mitteilung_99.9001.docx'), 'alt', 'Esc speichert nichts');
    await ersetzen(); await page.click('#ersErsetzen');
    await page.waitForSelector('#status .ok');
    const b64 = await page.evaluate(async P => {
      const d = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P)).getDirectoryHandle('Mitteilungen');
      const f = await (await d.getFileHandle('1._Mitteilung_99.9001.docx')).getFile(); const b = new Uint8Array(await f.arrayBuffer());
      let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s);
    }, PROJEKT);
    const buf = Buffer.from(b64, 'base64');
    assert.equal(buf.subarray(0, 2).toString(), 'PK', 'Word-Datei (ZIP)');
    assert.ok(buf.length > 20000);
    // Im Word: Tabelle 1 und Text nur mit P1 und P2 (Nummern wie LabelKit), die stornierte P3 fehlt ganz
    const wort = zipDatei(buf, 'word/document.xml').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    // (Labor-Nr. mit geschütztem Bindestrich – im XML ein eigenes Element)
    assert.match(wort, /Tabelle 1: Entnommene Proben und Ergebnisse Probe Labor-Nr\. Entnahmestelle Material Ergebnis 1 999\D{1,3}2026\D{1,3}0000101 Umkleide Schwimmbad Fliesenkleber Chrysotil, 5 - 20 % 2 999\D{1,3}2026\D{1,3}0000102 Dachboden /);
    assert.match(wort, /zwei Materialproben entnommen/);
    assert.doesNotMatch(wort, /Heizungskeller|Rohrisolierung|0000103|Probe 3/);
    if (process.env.BERICHT_AUSGABE) { fs.mkdirSync(process.env.BERICHT_AUSGABE, { recursive: true }); fs.writeFileSync(path.join(process.env.BERICHT_AUSGABE, 'browser_1._Mitteilung_99.9001.docx'), buf); }
    // Angaben zum Bericht liegen für alle im Projektordner (_Spektron/BerichtKit/_BerichtKit.json) – auch der gespeicherte Bericht
    const zustand = await page.evaluate(async P => {
      const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P);
      const d = await (await p.getDirectoryHandle('_Spektron')).getDirectoryHandle('BerichtKit');
      return JSON.parse(await (await (await d.getFileHandle('_BerichtKit.json')).getFile()).text());
    }, PROJEKT);
    assert.equal(zustand.format, 'spektron-bericht'); assert.equal(zustand.projekt, '99.9001'); assert.equal(zustand.nurEigene, true);
    assert.equal(zustand.form.probenehmer, 'Mes'); assert.equal(zustand.form.versOk, 'Beispiel Versicherung AG', 'Bestätigung gilt für alle'); assert.equal(zustand.form.einbau, 'vor1996'); assert.equal(zustand.form.mitteilung, 1);
    // nur selbst Geändertes: Datum, Variante, Labor (folgt den Einstellungen) und Auftragsdatum werden nicht eingefroren
    for (const k of ['datum', 'variante', 'labor', 'auftragsdatum', 'agSatz', 'kmf']) assert.ok(!(k in zustand.form), 'nicht in der Datei: ' + k);
    assert.equal(zustand.berichte[0].mitteilung, 1); assert.equal(zustand.berichte[0].datum, heuteISO);
    assert.deepEqual(zustand.berichte.map(b => b.datei), ['1._Mitteilung_99.9001.docx']);
    assert.deepEqual(zustand.berichte[0].anlagen, ['Laborergebnisse/AR-999-2026-000001-01.pdf', 'Fotos/Bilddokumentation_99.9001_Musterstadt_2026-10-30_Teil_1_von_2.pdf',
      'Fotos/Bilddokumentation_99.9001_Musterstadt_2026-10-30_Teil_2_von_2.pdf', 'Pläne/Probenplan ' + PROJEKT + '.pdf']); assert.equal(zustand.berichte[0].luecken, 0);
    assert.deepEqual(zustand.berichte[0].anlagenListe.map(a => a.nr + ' ' + a.art), ['1 pruefbericht', '2 bilddoku', '3 probenplan']);
    // Danach: „Ans Büro übergeben →“ öffnet die Projektzentrale mit vorbelegter Word-Datei
    assert.equal(await page.getAttribute('#btnUebergabe', 'href'),
      '../Projektzentrale/#projekt=' + encodeURIComponent(PROJEKT) + '&uebergabe=' + encodeURIComponent('Mitteilungen/1._Mitteilung_99.9001.docx'));
    assert.ok(await page.isVisible('#btnUebergabe'));
    // Zwei Rechner gleichzeitig: Ein Kollege ändert ein anderes Feld direkt in der Datei, hier wird gleichzeitig das Datum geändert –
    // beide Änderungen bleiben erhalten, die des Kollegen erscheint auch hier.
    const lesen = () => page.evaluate(async P => {
      const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P);
      const d = await (await p.getDirectoryHandle('_Spektron')).getDirectoryHandle('BerichtKit');
      return JSON.parse(await (await (await d.getFileHandle('_BerichtKit.json')).getFile()).text());
    }, PROJEKT);
    await page.evaluate(async P => {
      const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(P);
      const fh = await (await (await p.getDirectoryHandle('_Spektron')).getDirectoryHandle('BerichtKit')).getFileHandle('_BerichtKit.json');
      const d = JSON.parse(await (await fh.getFile()).text()); d.form.agSatz = 'die Beispiel Versicherung AG (Regionaldirektion West)'; d.geaendertVon = 'KOL';
      const w = await fh.createWritable(); await w.write(JSON.stringify(d, null, 1)); await w.close();
    }, PROJEKT);
    await page.fill('#fDatum', '2026-10-28'); await page.dispatchEvent('#fDatum', 'change');
    let gemischt = null;
    for (let i = 0; i < 40 && !(gemischt && gemischt.form.datum === '2026-10-28'); i++) { await page.waitForTimeout(150); gemischt = await lesen(); }
    assert.equal(gemischt.form.datum, '2026-10-28', 'eigene Änderung gespeichert');
    assert.equal(gemischt.form.agSatz, 'die Beispiel Versicherung AG (Regionaldirektion West)', 'Änderung des Kollegen bleibt');
    assert.equal(await page.inputValue('#fAg'), 'die Beispiel Versicherung AG (Regionaldirektion West)', 'und erscheint auch hier');
    // Noch einmal speichern → „Daneben als (2)“: neue Datei, die vorhandene bleibt
    await ersetzen(); await page.click('#ersDaneben');
    await page.waitForFunction(() => /Gespeichert: Mitteilungen\/1\._Mitteilung_99\.9001 \(2\)\.docx/.test(document.getElementById('status').textContent));
    // Schon beim Büro (Büroaufgabe nennt die Datei): kein „Ersetzen“, stattdessen als nächste Mitteilung
    await projektDatei('_Spektron/Buero/aufgaben/0b7c1a2e-buero-test.json', JSON.stringify({ format: 'spektron-buerokit', version: 1, typ: 'aufgabe',
      id: '0b7c1a2e-buero-test', art: 'gutachten', erstellt: '2026-10-30T15:00:00.000Z', projekt: { name: PROJEKT, nr: '99.9001' }, word: 'Mitteilungen/1._Mitteilung_99.9001.docx', empfaenger: [] }));
    await ersetzen();
    assert.equal(await page.textContent('#ersTitel'), 'Schon beim Büro');
    assert.match(await page.textContent('#ersText'), /„1\._Mitteilung_99\.9001\.docx“ ist schon beim Büro \(übergeben am 30\.10\.2026\) – als nächste Mitteilung speichern\?/);
    assert.ok(await page.isHidden('#ersErsetzen')); assert.equal(await page.textContent('#ersNaechste'), 'Als 2. Mitteilung speichern');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ersAbbrechen');
    await page.click('#ersNaechste');
    await page.waitForFunction(() => /Gespeichert: Mitteilungen\/2\._Mitteilung_99\.9001\.docx/.test(document.getElementById('status').textContent));
    assert.equal(await page.inputValue('#fMitteilung'), '2');
    assert.match(await page.textContent('#vorschau'), /\(2\. Mitteilung\)/);
    // Spektron-Leiste: BerichtKit ist der eigene Schritt, die anderen Apps sind Links mit demselben Projekt
    await page.waitForSelector('#mosaikLeiste .ml-step.hier');
    assert.match(await page.textContent('#mosaikLeiste .ml-step.hier'), /BerichtKit/);
    assert.equal(await page.locator('#mosaikLeiste a.ml-step').count(), 5);
    // Ein Kollege (anderer Browser, leerer Speicher) sieht dieselben Angaben
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('berichtkit:form:')) localStorage.removeItem(k); });
    await page.reload(); await page.waitForSelector('#app:not([hidden]) .blatt');
    assert.equal(await page.inputValue('#fPn'), 'Mes');
    // 1. und 2. Mitteilung gibt es: vorgeschlagen ist die 3.; das Datum der 2. bleibt nicht stehen
    assert.equal(await page.inputValue('#fMitteilung'), '3');
    assert.equal(await page.inputValue('#fDatum'), heuteISO);
    assert.match(await page.textContent('#meldungen'), /Die 2\. Mitteilung gibt es schon in „Mitteilungen“ – vorgeschlagen ist jetzt die 3\. Mitteilung\./);
    assert.match(await page.textContent('#meldungen'), /Das Berichtsdatum 28\.10\.2026 gehörte zur 2\. Mitteilung – jetzt steht das heutige Datum da\./);
    assert.match(await page.textContent('#hinweise'), /Angaben zum Bericht aus dem Projektordner/);
    // Übergang: _BerichtKit.json von BerichtKit 1.6.1 (ganzes Formular, Datum und Nummer vom ersten Bearbeiten eingefroren)
    const altForm = { datum: '2026-10-01', mitteilung: 1, variante: 'eigen', eingangsdatum: '', auftragsdatum: '2026-10-05', agSatz: 'die Beispiel Versicherung AG',
      probenehmer: 'Mes', sv: 'Tst', mt: 'Mes', labor: '', einbau: 'vor1996', aus: {}, kmf: {}, who: {}, ki: {}, foto: {} };
    const bkPfad = '_Spektron/BerichtKit/_BerichtKit.json';
    const bk = JSON.parse(await projektDatei(bkPfad)); delete bk.nurEigene; bk.form = altForm; bk.berichte = []; bk.geaendertMit = 'BerichtKit 1.6.1';
    await projektDatei(bkPfad, JSON.stringify(bk, null, 1));
    await page.reload(); await page.waitForSelector('#app:not([hidden]) .blatt');
    assert.equal(await page.inputValue('#fDatum'), heuteISO); assert.equal(await page.inputValue('#fMitteilung'), '3');
    assert.equal(await page.inputValue('#fLabor'), 'Eurofins Beispiel-Labor GmbH', 'leeres Labor war eingefroren – jetzt aus den Einstellungen');
    assert.match(await page.textContent('#meldungen'), /Berichtsdatum war seit dem ersten Bearbeiten auf dem 01\.10\.2026 stehen geblieben/);
    assert.match(await page.textContent('#meldungen'), /weicht von den Projektdaten ab: Probenahme durch, Zweite Unterschrift – bitte prüfen\./);
    let neuGeschrieben = null;
    for (let i = 0; i < 40 && !(neuGeschrieben && neuGeschrieben.nurEigene); i++) { await page.waitForTimeout(150); neuGeschrieben = JSON.parse(await projektDatei(bkPfad)); }
    // Vorgaben und Leeres fallen weg; was von der heutigen Vorgabe abweicht (Probenehmer, zweite Unterschrift), bleibt als eigene Angabe
    assert.deepEqual(neuGeschrieben.form, { einbau: 'vor1996', probenehmer: 'Mes', mt: 'Mes' }, 'nur noch eigene Angaben in der Datei');
    // Berichtsart aus der Projektzentrale (#…&art=): den Brandbericht gibt es noch nicht → „kommt bald“, kein Bericht der falschen Art
    const startZeigt = async (titel, text) => {
      await page.waitForSelector('#start:not([hidden])');
      assert.equal(await page.textContent('#startTitel'), titel); assert.match(await page.textContent('#startText'), text);
      assert.ok(await page.isHidden('#app')); assert.ok(await page.isHidden('#btnWaehlen')); assert.ok(await page.isVisible('#btnAsbest'));
    };
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=brand');   // nur die Adresse ändert sich, Projekt offen
    await startZeigt('Brandbericht', /Der Brandbericht kommt bald\. Bisher erstellt BerichtKit den Asbestbericht\./);
    await page.click('#btnAsbest'); await page.waitForSelector('#app:not([hidden]) .blatt');
    assert.doesNotMatch(page.url(), /art=/); assert.match(await page.textContent('#vorschau'), /Untersuchungsbericht vom/);
    // Projekt offen: wieder art=brand, dann zurück (Zurück-Knopf) und per Link art=asbest → der Bericht ist wieder da
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=brand'); await startZeigt('Brandbericht', /kommt bald/);
    await page.goBack(); await page.waitForSelector('#app:not([hidden]) .blatt');
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=brand'); await startZeigt('Brandbericht', /kommt bald/);
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=asbest'); await page.waitForSelector('#app:not([hidden]) .blatt');
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=brand'); await page.reload();   // frisch geöffnet
    await startZeigt('Brandbericht', /kommt bald/);
    // Archiv ist auch hier bekannt – „Projekt wählen“ im Kopf öffnet dann mit Mitarbeitern, Unterschriften, Einstellungen aus dem Archiv
    assert.ok(await page.evaluate(() => !!S.archiv), 'Archiv geladen');
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=asbest');
    await page.waitForSelector('#app:not([hidden]) .blatt');
    assert.ok(await page.isHidden('#start')); assert.match(await page.textContent('#vorschau'), /Untersuchung auf Asbest/);
    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT) + '&art=pak'); await page.reload();
    await startZeigt('Bericht', /Die Berichtsart „pak“ kennt BerichtKit nicht/);
    await page.click('#btnAsbest'); await page.waitForSelector('#app:not([hidden]) .blatt');
    // Die Berichtsart ist eine Vorgabe – nach einer eigenen Änderung steht sie nicht in _BerichtKit.json
    await page.fill('#fLabor', 'Labor nach Berichtsart-Wechsel'); await page.dispatchEvent('#fLabor', 'change');
    let nachArt = null;
    for (let i = 0; i < 40 && !(nachArt && nachArt.form.labor === 'Labor nach Berichtsart-Wechsel'); i++) { await page.waitForTimeout(150); nachArt = JSON.parse(await projektDatei(bkPfad)); }
    assert.equal(nachArt.form.labor, 'Labor nach Berichtsart-Wechsel'); assert.ok(!('art' in nachArt.form), 'art nicht in den eigenen Angaben');
    // Mehrere offene Stellen: Zähler zählt je Lücke einmal, jeder Klick springt zur nächsten (Reihenfolge wie im Bericht), auch in
    // die Probenliste (KI-Wert); ist das Feld gefüllt, verschwindet Umrandung und Stelle
    await page.selectOption('#fPn', '');
    await page.check('#probenListe input[data-art="kmf"][data-l="P1"]');   // Fliesenkleber als KMF → KI-Wert fehlt
    assert.equal(await page.textContent('#lueckenZaehler'), '2 Stellen noch offen');
    assert.deepEqual(await page.evaluate(() => S.luecken.map(x => x.luecke)), ['[Probenehmer]', '[KI-Wert]']);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.offen-feld')].map(el => el.id || el.dataset.art + ':' + el.dataset.l).sort()), ['fPn', 'ki:P1']);
    const fokus = () => page.evaluate(() => { const el = document.activeElement; return el.id || el.dataset.art + ':' + el.dataset.l; });
    await page.click('#lueckenZaehler'); assert.equal(await fokus(), 'fPn');
    if (process.env.BERICHT_AUSGABE) { await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(process.env.BERICHT_AUSGABE, 'luecken.png') }); }
    await page.click('#lueckenZaehler'); assert.equal(await fokus(), 'ki:P1');
    await page.click('#lueckenZaehler'); assert.equal(await fokus(), 'fPn', 'nach der letzten wieder die erste');
    await page.fill('#probenListe input[data-art="ki"][data-l="P1"]', '30'); await page.dispatchEvent('#probenListe input[data-art="ki"][data-l="P1"]', 'change');
    assert.equal(await page.textContent('#lueckenZaehler'), '1 Stelle noch offen');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.offen-feld')].map(el => el.id)), ['fPn']);
    await page.click('#lueckenZaehler'); assert.equal(await fokus(), 'fPn', 'neue Lückenliste → wieder bei der ersten');
    assert.match(await page.textContent('#vorschau'), /\[Probenehmer\]/);
    // Zugestellte Probe: „Probenahme durch“ ist versteckt – keine Umrandung, kein Sprungziel; offen ist das Eingangsdatum
    await page.check('input[name=variante][value=zugestellt]');
    assert.ok(await page.isHidden('#fPn'));
    assert.deepEqual(await page.evaluate(() => S.luecken.map(x => x.luecke)), ['[Eingangsdatum]']);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.offen-feld')].map(el => el.id)), ['fEingang']);
    await page.click('#lueckenZaehler'); assert.equal(await fokus(), 'fEingang');
    assert.match(await page.getAttribute('#lueckenZaehler', 'aria-label'), /^1 Stelle noch offen – zur nächsten Stelle springen$/);
    assert.equal(await page.textContent('#lueckenListe'), '[Eingangsdatum] – Bericht › Eingangsdatum');
    // Foto-Datei nicht lesbar: in Word stünde [Foto fehlt: …] – Zähler und Hinweise zählen es mit, sobald die Vorschau es merkt
    await projektDatei('Fotos/01_P1_Fliesenkleber.jpg', 'kein Bild');
    await page.evaluate(() => { S.thumbs = {}; render(); });
    await page.waitForFunction(() => S.luecken.some(x => x.luecke === '[Foto fehlt: 01_P1_Fliesenkleber.jpg]'));
    assert.equal(await page.textContent('#lueckenZaehler'), '2 Stellen noch offen');
    assert.match(await page.textContent('#hinweise'), /Lücke im Bericht: \[Foto fehlt: 01_P1_Fliesenkleber\.jpg\] – Proben › Foto/);
    assert.deepEqual(fehler, [], 'keine Fehler in der Konsole');
    console.log('ok – BerichtKit im Browser: öffnen, Vorschau, Einstellungen, Word-Datei in „Mitteilungen“, Angaben im Projektordner, Spektron-Leiste');
  } catch (e) {
    console.log('DIALOGE', dialoge, 'FEHLER', fehler);
    if (process.env.GITHUB_ACTIONS) console.log('::error title=Browsertest Seite::' + (`Status: ${await page.textContent('#status').catch(() => '?')} | Meldungen: ${await page.textContent('#meldungen').catch(() => '?')} | Fehler: ${fehler.join(' / ')} | Dialoge: ${dialoge.join(' / ')}`).slice(0, 1500).replace(/%/g, '%25').replace(/\r?\n/g, '%0A'));
    throw e;
  } finally { await browser.close(); server.close(); }
})().catch(e => {
  console.error(e);
  // In GitHub Actions: Grund als Annotation – sichtbar in der Prüfungsübersicht, auch ohne das ganze Protokoll
  if (process.env.GITHUB_ACTIONS) console.log('::error title=Browsertest::' + String(e && (e.stack || e.message) || e).slice(0, 1500).replace(/%/g, '%25').replace(/\r?\n/g, '%0A'));
  process.exit(1);
});

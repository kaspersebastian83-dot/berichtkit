// BerichtKit im Browser (Chromium): Fotos in Unterordnern von „Fotos“ (FotoKit ab 2.7.0, O2/O3/O10) – Schlüssel
// „Unterordner/Datei“, genau eine Ebene. Vorschau und Word lesen das Foto über den Weg; ein Weg, der nicht gelesen werden
// darf (leerer Ordnerteil, „..“, „_…“, „.…“, tiefer), wird zu [Foto fehlt: …]. Erfundene Daten im privaten Dateisystem (OPFS).
// node tests/fotos-unterordner.cjs
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
const PROJEKT = '99.9002 Musterweg Musterstadt Tst';
function zipDatei(buf, name) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); let p = buf.readUInt32LE(eocd + 16); const namen = [];
  for (let i = 0, n = buf.readUInt16LE(eocd + 10); i < n; i++) {
    const methode = buf.readUInt16LE(p + 10), groesse = buf.readUInt32LE(p + 20), lName = buf.readUInt16LE(p + 28), ofs = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + lName);
    namen.push(nm);
    if (nm === name) {
      const start = ofs + 30 + buf.readUInt16LE(ofs + 26) + buf.readUInt16LE(ofs + 28), daten = buf.subarray(start, start + groesse);
      return (methode === 8 ? zlib.inflateRawSync(daten) : daten).toString('utf8');
    }
    p += 46 + lName + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return name ? null : namen;
}
// Schlüssel, die nicht gelesen werden dürfen → [Datei, die dort läge] (relativ zum Projektordner; null = keine)
const UNGUELTIG = { '_aussortiert/IMG_0003.jpg': 'Fotos/_aussortiert/IMG_0003.jpg', '.versteckt/IMG_0004.jpg': 'Fotos/.versteckt/IMG_0004.jpg', '../IMG_0005.jpg': 'IMG_0005.jpg',
  'Bilder A/Tiefer/IMG_0006.jpg': 'Fotos/Bilder A/Tiefer/IMG_0006.jpg', '/IMG_0007.jpg': 'Fotos/IMG_0007.jpg', 'Bilder A/': null };
const pj = B.pj({ projektnummer: '99.9002' });
const daten = {
  pj,
  lk: { ...B.lk([[1, '2026-10-16', 'Umkleide Schwimmbad', 'Fliesenkleber', 'Bituminöse Proben / Kleber'], [2, '2026-10-16', 'Dachboden', 'Dämmstoff Mineralwolle', 'Sonstige']]), projekt: { nr: '99.9002' } },
  erg: { ...B.erg([[1, 'chrysotil'], [2, 'kmf']]), projekt: '99.9002' },
  ma: { format: 'spektron-mitarbeiter', version: 1, personen: B.mitarbeiter },
  // P1: Foto im Unterordner (gültig), P2: Foto unter „_aussortiert“ (darf nicht gelesen werden, Datei liegt aber da)
  fk: { app: 'Bildumbenenner', format: 1, version: '2.7.0', reihenfolge: ['Bilder A/IMG_0001.jpg', '_aussortiert/IMG_0003.jpg'],
    bilder: { 'Bilder A/IMG_0001.jpg': { beschreibung: 'Fliesenkleber', probe: 'P1' }, '_aussortiert/IMG_0003.jpg': { beschreibung: 'Mineralwolle', probe: 'P2' },
      'Bilder B/IMG_0001.jpg': { beschreibung: 'gleicher Name, anderer Ordner' }, '01_direkt.jpg': { beschreibung: 'direkt in Fotos' } } },
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Archiv-Handle direkt aus dem OPFS (wie tests/browser.cjs)
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
  page.on('dialog', d => d.accept());
  try {
    await page.goto(url + 'index.html');
    await page.waitForSelector('#start:not([hidden])');
    await page.evaluate(async ({ PROJEKT, daten, UNGUELTIG }) => {
      const root = await navigator.storage.getDirectory();
      for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
      const archiv = await root.getDirectoryHandle('Archiv', { create: true });
      const schreib = async (dir, pfad, inhalt) => {
        const teile = pfad.split('/'); let d = dir;
        for (const t of teile.slice(0, -1)) d = await d.getDirectoryHandle(t, { create: true });
        const w = await (await d.getFileHandle(teile.at(-1), { create: true })).createWritable(); await w.write(inhalt); await w.close();
      };
      const jpg = async (farbe, text) => { const c = document.createElement('canvas'); c.width = 800; c.height = 450; const x = c.getContext('2d');
        x.fillStyle = farbe; x.fillRect(0, 0, 800, 450); x.fillStyle = '#333'; x.font = '60px sans-serif'; x.fillText(text, 200, 240); return new Promise(r => c.toBlob(r, 'image/jpeg', .9)); };
      await schreib(archiv, '_Spektron-Mitarbeiter.json', JSON.stringify(daten.ma));
      const p = PROJEKT + '/';
      await schreib(archiv, p + '_Spektron/_Projekt.json', JSON.stringify(daten.pj));
      await schreib(archiv, p + '_Spektron/LabelKit/99.9002_16.10.2026_Daten.json', JSON.stringify(daten.lk));
      await schreib(archiv, p + '_Spektron/ResultKit/_Ergebnisse.json', JSON.stringify(daten.erg));
      await schreib(archiv, p + '_Spektron/FotoKit/_Bildumbenenner.json', JSON.stringify(daten.fk));
      await schreib(archiv, p + 'Fotos/Bilder A/IMG_0001.jpg', await jpg('#c9b38a', 'Ordner A'));
      await schreib(archiv, p + 'Fotos/Bilder B/IMG_0001.jpg', await jpg('#8ab3c9', 'Ordner B'));
      await schreib(archiv, p + 'Fotos/01_direkt.jpg', await jpg('#b38ac9', 'direkt'));
      for (const ziel of Object.values(UNGUELTIG)) if (ziel) await schreib(archiv, p + ziel, await jpg('#555', 'ungültig'));
    }, { PROJEKT, daten, UNGUELTIG });

    await page.goto(url + 'index.html#projekt=' + encodeURIComponent(PROJEKT));
    await page.waitForSelector('#app:not([hidden]) .blatt');
    await page.waitForFunction(() => !S.laedt);

    // Vorschau: P1 mit Bild aus „Fotos/Bilder A“, P2 (Weg unter „_aussortiert“) als Lücke [Foto fehlt: …]
    await page.waitForFunction(() => S.luecken.some(x => x.luecke === '[Foto fehlt: _aussortiert/IMG_0003.jpg]'));
    await page.waitForSelector('#vorschau figure img');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#vorschau figure img').length), 1, 'ein Foto in der Vorschau (P1)');
    assert.ok(!(await page.evaluate(() => S.luecken.some(x => /Foto fehlt: Bilder A/.test(x.luecke)))), 'Foto im Unterordner fehlt nicht');
    assert.deepEqual(await page.evaluate(() => fotosFehlen()), ['_aussortiert/IMG_0003.jpg']);
    console.log('ok – Vorschau: Foto im Unterordner gelesen, Weg unter „_aussortiert“ = [Foto fehlt: …]');

    // Word: Foto aus dem Unterordner eingebettet, der ungültige Weg als [Foto fehlt: …]
    const w = await page.evaluate(async () => {
      const { blob, fehlen } = await wordBlob(modell()); const b = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768)); return { b64: btoa(s), fehlen };
    });
    assert.deepEqual(w.fehlen, ['_aussortiert/IMG_0003.jpg']);
    const buf = Buffer.from(w.b64, 'base64'), wort = zipDatei(buf, 'word/document.xml').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(wort, /\[Foto fehlt: _aussortiert\/IMG_0003\.jpg\]/);
    assert.doesNotMatch(wort, /Foto fehlt: Bilder A/);
    assert.match(wort, /Abb\. 1: Fliesenkleber/);
    assert.ok(zipDatei(buf).some(n => /^word\/media\/.*\.(jpe?g|png)$/i.test(n) && !/logo/i.test(n)), 'Foto als Bild in der Word-Datei');
    console.log('ok – Word: Foto im Unterordner eingebettet, ungültiger Weg als [Foto fehlt: …]');

    // fotoBytes über den Weg: gültig = direkt oder genau eine Ebene; gleicher Dateiname in zwei Ordnern = zwei Fotos
    const r = await page.evaluate(async keys => {
      const out = {};
      for (const k of keys) try { const f = await fotoBytes(k, 64); out[k] = f.data.length + ':' + f.data.reduce((a, b) => (a * 31 + b) >>> 0, 7); } catch (e) { out[k] = null; }
      return out;
    }, ['01_direkt.jpg', 'Bilder A/IMG_0001.jpg', 'Bilder B/IMG_0001.jpg', 'Bilder A/fehlt.jpg', ...Object.keys(UNGUELTIG)]);
    for (const k of ['01_direkt.jpg', 'Bilder A/IMG_0001.jpg', 'Bilder B/IMG_0001.jpg']) assert.ok(r[k], `gelesen: ${k}`);
    assert.notEqual(r['Bilder A/IMG_0001.jpg'], r['Bilder B/IMG_0001.jpg'], 'gleicher Dateiname in zwei Ordnern: zwei verschiedene Fotos');
    for (const k of ['Bilder A/fehlt.jpg', ...Object.keys(UNGUELTIG)]) assert.equal(r[k], null, `nicht gelesen: ${k}`);
    console.log('ok – fotoBytes: genau eine Ebene; leerer Ordnerteil, „..“, „_…“, „.…“ und tiefer werden nicht gelesen');

    assert.deepEqual(fehler, []);
    console.log('ok – Fotos in Unterordnern (FotoKit 2.7.0): Vorschau, Word, Wegregeln');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

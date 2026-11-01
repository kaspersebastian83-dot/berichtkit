// Spektron-Leiste v3 (mosaik-leiste.js) und die Berichtsart-Regel ohne Browser:
// 1. bericht-vorgaben.js artWaehlen: ohne art → gemerkt / Proben / asbest; gemerkt wird nur die Adresse.
// 2. Leiste mit erfundenem Archiv (Ordner als Objekte, DOM nur so weit nachgebaut, wie die Leiste es braucht):
//    Schrittname mit Berichtsart, Haken nur bei passender Mitteilung, „Weiter“ mit alter Mitteilung, „Ans Büro übergeben“.
//    v3 Kopfband ({kopfband: true}): Projekt groß, Kacheln mit Arbeitsnamen, „Weiter“ mit kurzem Grund, „Mehr …“.
// 3. Leiste byte-gleich mit allen Apps, die daneben ausgecheckt sind und schon v3 tragen (in CI: LabelKit); Apps mit v2 werden genannt.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const V = require('../bericht-vorgaben.js');

/* ---------- 1. Regel ---------- */
const LK_BRAND = { chloridProben: [{ _nr: 1 }, { _nr: 2 }], proben: [{ _nr: 3 }], asbestProben: [{ _nr: 4 }] };
const LK_ASBEST = { asbestProben: [{ _nr: 1 }, { _nr: 2, storniert: true }] };
const w = (adresse, datei, lk) => V.artWaehlen({ adresse, datei, lk });
assert.deepEqual(w('brand', null, LK_ASBEST), { art: 'brand', quelle: 'adresse', merken: true, grund: '' }, 'Adresse geht vor und wird gemerkt');
assert.equal(w('pak', null, null).merken, false, 'unbekannte Art wird nicht gemerkt');
assert.equal(w('', { art: 'brand', berichte: [] }, LK_ASBEST).art, 'brand', 'gemerkt geht vor den Proben');
assert.equal(w('', { art: 'brand' }, LK_ASBEST).merken, false);
assert.equal(w('', { berichte: [{ datei: '1._Mitteilung_1.docx' }] }, LK_BRAND).art, 'asbest', 'Datei bis 1.14.0: Bericht ohne art = Asbestbericht gespeichert');
assert.equal(w('', { berichte: [{ datei: 'a.docx', art: 'asbest' }, { datei: 'b.docx', art: 'brand' }] }, null).art, 'brand', 'zuletzt gespeicherter Bericht');
assert.equal(w('', { form: {}, berichte: [] }, LK_BRAND).quelle, 'proben', 'nichts gemerkt → Proben');
assert.match(w('', null, LK_BRAND).grund, /2 Chlorid-Proben, 1 PAK-Probe und 1 Asbestprobe/);
assert.equal(w('', null, LK_ASBEST).art, 'asbest');
assert.equal(w('', null, { sonstigeProben: [{ tiefe: '0-2 cm', notiz: 'Chlorid' }] }).art, 'brand', 'Chlorid-Bohrmehl');
assert.equal(w('', null, { proben: [{ storniert: true }] }).quelle, 'standard', 'storniert zählt nicht');
assert.deepEqual(w('', null, null), { art: 'asbest', quelle: 'standard', merken: false, grund: '' });
// gleich wie Projektzentrale stufen.js (falls daneben)
const pz = path.join(ROOT, '..', 'projektzentrale', 'stufen.js');
if (fs.existsSync(pz)) {
  const ctx = { console }; ctx.globalThis = ctx; vm.runInNewContext(fs.readFileSync(pz, 'utf8'), ctx);
  const St = ctx.Stufen || ctx.SpektronStufen || Object.values(ctx).find(x => x && typeof x.berichtsart === 'function');
  for (const lk of [LK_BRAND, LK_ASBEST, null, { brandgeruchProben: [{}] }, { ui: { bohrmehlAktiv: true }, sonstigeProben: [{}] }, { sonstigeProben: [{ notiz: 'Blei' }] }])
    assert.deepEqual({ ...V.artAusProben(lk) }, { ...St.berichtsart(lk) }, 'wie Projektzentrale: ' + JSON.stringify(lk));
}

/* ---------- 2. Leiste ---------- */
class El {
  constructor(tag) { this.tag = tag; this.tagName = String(tag).toUpperCase(); this.kinder = []; this.attr = {}; this.text = ''; this.style = { setProperty: (k, v) => { this.style[k] = v; } }; this.ev = {};
    const c = new Set(); this.classList = { add: (...k) => k.forEach(x => c.add(x)), remove: (...k) => k.forEach(x => c.delete(x)), contains: k => c.has(k) }; }
  setAttribute(k, v) { this.attr[k] = String(v); } getAttribute(k) { return this.attr[k]; }
  set textContent(v) { this.text = String(v); this.kinder = []; } get textContent() { return this.text + this.kinder.map(k => k.textContent).join(''); }
  appendChild(k) { this.kinder.push(k); k.parent = this; return k; } insertBefore(k) { return this.appendChild(k); } remove() {}
  addEventListener(n, f) { this.ev[n] = f; } contains() { return false; } focus() {}
  get firstChild() { return this.kinder[0] || null; } get lastChild() { return this.kinder[this.kinder.length - 1] || null; }
  get offsetHeight() { return 0; } get offsetWidth() { return 0; }
  get scrollWidth() { return 0; } get clientWidth() { return 1000; } getBoundingClientRect() { return { left: 0, top: 500, bottom: 540 }; }
  alle(f, out = []) { for (const k of this.kinder) { if (f(k)) out.push(k); k.alle(f, out); } return out; }
  querySelector() { return null; }
}
const datei = (name, inhalt) => ({ kind: 'file', name, getFile: async () => ({ text: async () => typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt) }) });
const ordner = (name, kinder) => ({ kind: 'directory', name, async *values() { yield* kinder; }, queryPermission: async () => 'granted',
  async getDirectoryHandle(n) { const k = kinder.find(x => x.kind === 'directory' && x.name === n); if (!k) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' }); return k; },
  async getFileHandle(n) { const k = kinder.find(x => x.kind === 'file' && x.name === n); if (!k) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' }); return k; } });
/** Projekt „Vor Spektron“ (alte Ordner): Mitteilungen mit _BerichtKit.json, LabelKit, ResultKit, PlanKit */
function projekt(name, { mitteilungen = [], bk = null, plan = true, beleg = false, pj = null } = {}) {
  return ordner(name, [
    ...(pj ? [datei('_Projekt.json', pj)] : []),
    ordner('Laboraufträge', [datei('x_Daten.json', '{}')]), ordner('Fotos', [datei('_Bildumbenenner.json', '{}')]), ordner('Laborergebnisse', [datei('_Ergebnisse.json', '{}')]),
    ordner('Pläne', plan ? [datei(`Probenplan ${name}.probenplan`, '{}')] : []),
    ordner('Mitteilungen', [...mitteilungen.map(n => datei(n, 'docx')), ...(bk ? [datei('_BerichtKit.json', { format: 'spektron-bericht', version: 1, nurEigene: true, form: {}, ...bk })] : [])]),
    ordner('Abrechnung', beleg ? [datei('x_Aufwand_1.json', '{}')] : []),
  ]);
}
async function leiste(app, proj, opt) {
  const archiv = ordner('Archiv', [proj]);
  const body = new El('body'), head = new El('head');
  const document = { body, head, createElement: t => new El(t), createElementNS: (ns, t) => new El(t), getElementById: () => null, addEventListener() {}, hidden: false, activeElement: null };
  const kv = { archiv, zuletzt: [] };
  const indexedDB = { open() { const r = { result: { createObjectStore() {}, close() {}, transaction: () => ({ objectStore: () => ({
    get(k) { const g = {}; setTimeout(() => { g.result = kv[k]; g.onsuccess && g.onsuccess(); }); return g; },
    put(v, k) { kv[k] = v; } }), set oncomplete(f) { setTimeout(f); } }) } }; setTimeout(() => r.onsuccess && r.onsuccess()); return r; } };
  const win = { document, indexedDB, location: { href: `http://x/${app}/#projekt=${encodeURIComponent(proj.name)}`, hash: '#projekt=' + encodeURIComponent(proj.name), search: '' },
    addEventListener() {}, setInterval() { return 0; }, setTimeout, clearTimeout, innerWidth: 1600, innerHeight: 900, URL, URLSearchParams, console, Promise };
  win.window = win; win.globalThis = win;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'mosaik-leiste.js'), 'utf8'), win);
  win.MosaikLeiste.start(app, opt);
  for (let i = 0; i < 50; i++) { await new Promise(r => setTimeout(r, 5)); if (body.kinder[0] && body.kinder[0].alle(k => k.classList.contains('done')).length) break; }
  await new Promise(r => setTimeout(r, 30));
  const bar = body.kinder[0];
  const steps = bar.alle(k => k.attr.class && /\bml-step\b/.test(k.attr.class));
  const schritt = n => steps.find(s => s.textContent.includes(n));
  const weiter = bar.alle(k => k.attr.class === 'ml-weiter')[0] || null;
  return { schritt, steps, weiter, pop: bar, bar, body, win };
}
const P = '26.0100 Testweg Teststadt', name = s => s.kinder[1].textContent;   // Schrittname ohne ✓
(async () => {
  // a) Brandschaden, alte Asbest-Mitteilung (berichte ohne art), danach Brandbericht ausdrücklich geöffnet (art: brand gemerkt)
  let l = await leiste('plan', projekt(P, { mitteilungen: ['1._Mitteilung_26.0100.docx'], bk: { art: 'brand', berichte: [{ datei: '1._Mitteilung_26.0100.docx', am: '2026-10-01' }] } }));
  let b = l.schritt('BerichtKit');
  assert.equal(name(b), 'BerichtKit · Brandbericht', 'Schrittname mit gemerkter Art');
  assert.ok(!/\bdone\b/.test(b.attr.class), 'alte Asbest-Mitteilung gibt keinen Haken für den Brandbericht');
  assert.ok(l.steps.length === 6 && l.steps.every(s => !/\d/.test(s.kinder[0].textContent)), 'keine Nummern an den Schritten (nur ✓ oder leer)');
  assert.ok(l.weiter, 'Weiter da');
  assert.equal(l.weiter.textContent, 'Weiter: BerichtKit · Brandbericht→', 'aus PlanKit weiter zum Brandbericht, nicht zu BelegKit');
  assert.match(l.weiter.attr.href, /^\.\.\/berichtkit\/#projekt=26\.0100%20Testweg%20Teststadt&art=brand&auto=1$/, 'gemerkt: &auto=1 – BerichtKit merkt nicht neu');
  assert.equal(l.weiter.attr.target, 'berichtkit');
  assert.match(l.weiter.attr.title, /^Weiter zu BerichtKit · Brandbericht: noch kein Brandbericht gespeichert/);
  // b) Brandbericht gespeichert, Datei da → Haken, Weiter „Ans Büro übergeben“
  l = await leiste('plan', projekt(P, { mitteilungen: ['1._Mitteilung_26.0100.docx', '2._Mitteilung_26.0100.docx'],
    bk: { art: 'brand', berichte: [{ datei: '1._Mitteilung_26.0100.docx' }, { datei: '2._Mitteilung_26.0100.docx', art: 'brand' }] } }));
  assert.match(l.schritt('BerichtKit').attr.class, /\bdone\b/, 'Haken bei gespeichertem Brandbericht');
  assert.equal(l.weiter.textContent, 'Weiter: Ans Büro übergeben→');
  assert.equal(l.weiter.attr.target, 'projektzentrale');
  assert.match(l.weiter.attr.href, /^\.\.\/Projektzentrale\/#projekt=26\.0100%20Testweg%20Teststadt&uebergabe=Mitteilungen%2F2\._Mitteilung_26\.0100\.docx$/);
  assert.match(l.weiter.attr.title, /Bericht gespeichert \(2\._Mitteilung_26\.0100\.docx\)/);
  // c) gespeichert, aber die Datei ist weg → kein Haken
  l = await leiste('plan', projekt(P, { mitteilungen: [], bk: { art: 'brand', berichte: [{ datei: '2._Mitteilung_26.0100.docx', art: 'brand' }] } }));
  assert.ok(!/\bdone\b/.test(l.schritt('BerichtKit').attr.class), 'Datei gelöscht: kein Haken');
  assert.match(l.weiter.attr.title, /Brandbericht „2\._Mitteilung_26\.0100\.docx“ ist nicht mehr in „Mitteilungen“/);
  // d) ohne _BerichtKit.json: wie v1 nach dem Dateinamen, Schritt nur „BerichtKit“, Link ohne art
  l = await leiste('label', projekt(P, { mitteilungen: ['1__Mitteilung.docx'] }));
  assert.equal(name(l.schritt('BerichtKit')), 'BerichtKit');
  assert.match(l.schritt('BerichtKit').attr.class, /\bdone\b/);
  assert.equal(l.schritt('BerichtKit').attr.href, '../berichtkit/#projekt=26.0100%20Testweg%20Teststadt');
  l = await leiste('plan', projekt(P, { mitteilungen: ['1__Mitteilung.docx'] }));
  assert.match(l.weiter.attr.href, /&uebergabe=Mitteilungen%2F1__Mitteilung\.docx$/, 'ohne _BerichtKit.json: Übergabe mit der Mitteilung (Codex)');
  // e) _BerichtKit.json ohne art und ohne gespeicherten Bericht (nur Angaben) → wie v1, Haken nach Dateiname
  l = await leiste('plan', projekt(P, { mitteilungen: [], bk: { berichte: [] } }));
  assert.equal(name(l.schritt('BerichtKit')), 'BerichtKit');
  assert.equal(l.weiter.textContent, 'Weiter: BerichtKit→');
  assert.match(l.weiter.attr.title, /BerichtKit wählt die Berichtsart nach den Proben/);
  // e2) _BerichtKit.json nur mit Angaben, aber eine Mitteilung von Hand → kein Haken (Dateiname zählt nur ohne _BerichtKit.json)
  l = await leiste('plan', projekt(P, { mitteilungen: ['1__Mitteilung.docx'], bk: { berichte: [] } }));
  assert.ok(!/\bdone\b/.test(l.schritt('BerichtKit').attr.class)); assert.equal(l.weiter.textContent, 'Weiter: BerichtKit→');
  // f) Bericht gespeichert und BelegKit-Stand da → kein „Ans Büro übergeben“ mehr
  l = await leiste('plan', projekt(P, { mitteilungen: ['1._Mitteilung_26.0100.docx'], bk: { art: 'asbest', berichte: [{ datei: '1._Mitteilung_26.0100.docx', art: 'asbest' }] }, beleg: true }));
  assert.equal(name(l.schritt('BerichtKit')), 'BerichtKit · Asbestbericht');
  assert.equal(l.weiter, null, 'alles erledigt: kein Weiter');
  // g) früherer Schritt offen (kein Plan), aus BelegKit: Grund nennt „früherer Schritt“
  l = await leiste('beleg', projekt(P, { plan: false, mitteilungen: [] }));
  assert.equal(l.weiter.textContent, 'Weiter: PlanKit→');
  assert.match(l.weiter.attr.title, /noch kein Probenplan in PlanKit \(früherer Schritt, noch offen\)/);

  /* ---------- 2b. Kopfband (v3, {kopfband: true}) ---------- */
  const PJ = { objekt: 'MFH', nutzung: 'Wohnen', schadendatum: '2026-10-14', schadenereignis: 'Küchenbrand' };
  const klasse = (el, k) => el.alle(x => x.attr.class && x.attr.class.split(' ').includes(k));
  l = await leiste('plan', projekt(P, { pj: PJ, mitteilungen: ['1._Mitteilung_26.0100.docx'], bk: { art: 'brand', berichte: [{ datei: '1._Mitteilung_26.0100.docx', am: '2026-10-01' }] } }), { kopfband: true });
  assert.match(l.bar.attr.class, /\bml-band\b/, 'Kopfband-Klasse');
  assert.equal(l.steps.length, 6);
  assert.deepEqual(l.steps.map(name), ['Proben ✓', 'Fotos ✓', 'Labor ✓', 'Plan ✓', 'Brandbericht', 'Abrechnung'], 'Arbeitsnamen, Haken im Namen, Berichtsart an der Kachel');
  assert.equal(l.steps[3].tag, 'span'); assert.equal(l.steps[3].attr['aria-current'], 'page'); assert.match(l.steps[3].attr.class, /\bhier\b/);
  assert.equal(l.steps[4].attr.title, 'Brandbericht – BerichtKit', 'App-Name im Tooltip');
  assert.equal(l.steps[4].attr.href, '../berichtkit/#projekt=26.0100%20Testweg%20Teststadt&art=brand&auto=1', 'gleicher Link wie v2');
  assert.equal(l.steps.filter(s => s.kinder[0].tag === 'svg').length, 6, 'Symbol je Kachel');
  assert.equal(klasse(l.bar, 'ml-proj')[0].kinder[0].textContent, '26.0100 · Testweg Teststadt', 'Projekt groß: Nr · Ort');
  assert.equal(klasse(l.bar, 'ml-z2')[0].textContent, 'MFH · Wohnen · Schaden vom 14.10.2026', 'zweite Zeile aus _Projekt.json');
  assert.match(klasse(l.bar, 'ml-z2')[0].attr.title, /Küchenbrand/);
  assert.equal(l.weiter.kinder[0].textContent, 'Weiter: Brandbericht →'); assert.equal(l.weiter.kinder[1].textContent, 'noch kein Bericht gespeichert');
  assert.equal(l.weiter.attr.target, 'berichtkit'); assert.match(l.weiter.attr.title, /^Weiter zu BerichtKit · Brandbericht: noch kein Brandbericht gespeichert/, 'Tooltip wie v2');
  assert.equal(klasse(l.bar, 'ml-rm').length, 0, 'Rückmeldung nicht im Kopfband (steht in „Mehr …“)');
  l = await leiste('bericht', projekt(P, { mitteilungen: ['1._Mitteilung_26.0100.docx', '2._Mitteilung_26.0100.docx'],
    bk: { art: 'brand', berichte: [{ datei: '2._Mitteilung_26.0100.docx', art: 'brand' }] } }), { kopfband: true });
  assert.equal(name(l.schritt('Brandbericht')), 'Brandbericht ✓');
  assert.equal(l.weiter.kinder[0].textContent, 'Weiter: Ans Büro übergeben →'); assert.equal(l.weiter.kinder[1].textContent, 'Bericht ist gespeichert');
  assert.equal(l.weiter.attr.target, 'projektzentrale');
  assert.equal(klasse(l.bar, 'ml-z2').length, 0, 'ohne Projektdaten keine zweite Zeile');
  l = await leiste('beleg', projekt(P, { plan: false }), { kopfband: true });
  assert.equal(l.weiter.kinder[0].textContent, 'Weiter: Plan →'); assert.equal(l.weiter.kinder[1].textContent, 'früherer Schritt: noch kein Probenplan');
  l = await leiste('bericht', projekt(P, { mitteilungen: [] }), { kopfband: true });
  assert.equal(name(l.schritt('Bericht')), 'Bericht', 'ohne gemerkte Art nur „Bericht“');
  // „Mehr …“: eigene Einträge (versteckte nicht), Trenner, dann Handbuch, Rückmeldung, Alle Projekte
  const knopf = new El('button'); let geklickt = 0;
  l.win.MosaikLeiste.mehr(knopf, [{ text: 'Einstellungen …', onclick: () => geklickt++ }, { text: 'versteckt', hidden: true }]);
  const menue = l.body.kinder.find(k => k.attr.id === 'mosaikMehrPop');
  assert.ok(menue, 'Menü da'); assert.equal(knopf.attr['aria-expanded'], 'true');
  assert.deepEqual(menue.kinder.map(k => k.tag === 'hr' ? '—' : k.textContent), ['Einstellungen …', '—', '📘 Handbuch ↗', '💬 Rückmeldung ↗', '⌂ Alle Projekte ↗']);
  assert.equal(menue.kinder[2].attr.href, '../aidkit/#app-berichtkit'); assert.equal(menue.kinder[2].attr.target, 'aidkit');
  assert.match(menue.kinder[3].attr.href, /^\.\.\/rueckmeldung\/\?app=berichtkit/);
  assert.equal(menue.kinder[4].attr.target, 'projektzentrale');
  menue.kinder[0].ev.click({ preventDefault() {} }); assert.equal(geklickt, 1, 'eigener Eintrag ausgeführt');
  assert.equal(knopf.attr['aria-expanded'], 'false', 'nach dem Klick zu');

  /* ---------- 3. byte-gleich ---------- */
  const block = t => { const a = t.indexOf('/* ===== MOSAIK-LEISTE v'), e = t.indexOf('/* ===== Ende MOSAIK-LEISTE v'); return a < 0 || e < 0 ? null : t.slice(a, e); };
  const eigen = block(fs.readFileSync(path.join(ROOT, 'mosaik-leiste.js'), 'utf8'));
  assert.ok(eigen && eigen.startsWith('/* ===== MOSAIK-LEISTE v3'), 'Block v3');
  const andere = { LabelKit: 'labelkit/index.html', FotoKit: 'bildumbenenner/index.html', ResultKit: 'resultkit/src/suite-bar.ts', PlanKit: 'probenplan/src/suite-bar.ts', BelegKit: 'aufwandkit/index.html' };
  const V3 = ['LabelKit', 'FotoKit'];   // tragen v3 schon (müssen gleich sein); die anderen ziehen mit ihrem Umbau nach (FotoKit ab 2.0.0)
  const geprueft = [], nochV2 = [];
  for (const [app, rel] of Object.entries(andere)) {
    const f = path.join(ROOT, '..', rel); if (!fs.existsSync(f)) continue;
    const b = block(fs.readFileSync(f, 'utf8'));
    if (!V3.includes(app) && b && b.startsWith('/* ===== MOSAIK-LEISTE v2')) { nochV2.push(app); continue; }
    assert.equal(b, eigen, `Leiste in ${app} (${rel}) nicht byte-gleich`); geprueft.push(app);
  }
  console.log(`Leiste v3: Regel ohne art, Haken/Weiter/Büro, Kopfband, „Mehr …“ – ok; byte-gleich mit ${geprueft.join(', ') || '(keine App daneben)'}${nochV2.length ? ` · noch v2: ${nochV2.join(', ')}` : ''}`);

  /* ---------- 4. SPEKTRON-LOOK v1 (ab BerichtKit 1.17.0): ein Block, ohne App-Farbe, byte-gleich in Apps, die ihn schon tragen ---------- */
  const look = t => { const a = t.indexOf('/* ===== SPEKTRON-LOOK v'), e = t.indexOf('/* ===== Ende SPEKTRON-LOOK v'); return a < 0 || e < 0 ? null : t.slice(a, e); };
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lookEigen = look(html);
  assert.ok(lookEigen && lookEigen.startsWith('/* ===== SPEKTRON-LOOK v1'), 'Look-Block v1 in index.html');
  assert.equal(html.split('/* ===== SPEKTRON-LOOK v').length, 2, 'Look-Block genau einmal');
  const appFarben = ['#5469b8', '#2f87a6', '#7a5ca8', '#4179b2', '#b0683c', '#9c5a32', '#2f7d6d'];
  for (const c of appFarben) assert.ok(!lookEigen.toLowerCase().includes(c), `keine App-Farbe ${c} im Look-Block`);
  assert.match(html.slice(html.indexOf('/* ===== Ende SPEKTRON-LOOK v')), /--sp-app:#b0683c;\s*--sp-app-dunkel:#9c5a32/, 'BerichtKit setzt seine Leistenfarbe nach dem Block');
  const mitLook = [];
  for (const [app, rel] of Object.entries(andere)) {
    const f = path.join(ROOT, '..', rel); if (!fs.existsSync(f)) continue;
    const b = look(fs.readFileSync(f, 'utf8')); if (!b) continue;
    assert.equal(b, lookEigen, `Spektron-Look in ${app} (${rel}) nicht byte-gleich`); mitLook.push(app);
  }
  console.log(`Spektron-Look v1: Block ok${mitLook.length ? `; byte-gleich mit ${mitLook.join(', ')}` : ' (noch keine andere App mit dem Block daneben)'}`);
})().catch(e => { console.error(e); process.exit(1); });

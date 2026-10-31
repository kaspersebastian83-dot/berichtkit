/* BerichtKit – gemeinsame Bausteine aller Berichtsarten (ohne Browserteile, in Node testbar).
   Helfer, Personen, Proben aus LabelKit/ResultKit mit Asbest-/KMF-Befund, Projektsicht, Deckblatt mit/ohne Versicherung,
   Auftraggeber mit Artikel, Kopfzeilen, Unterschriften, Anlagen, Lücken. Die Berichtsarten (bericht-asbest.js, später
   bericht-brand.js) setzen daraus ihr Modell zusammen; bericht-text.js wählt die Berichtsart.
   Regeln: Laborwerte und Probenbezeichnungen kommen unverändert aus ResultKit (_Ergebnisse.json) und LabelKit –
   hier wird nichts umgerechnet oder umformuliert. Fehlende Angaben werden als [Lücke] markiert (gelb im Bericht),
   nie erfunden. Materialnamen stehen nur im Nominativ (in Anführungszeichen oder hinter Doppelpunkt). */
(function (root) {
'use strict';
const ANL = root.BerichtAnlagen || (typeof require === 'function' ? require('./anlagen.js') : null);

/* ---------- kleine Helfer ---------- */
const s = v => (v == null ? '' : String(v)).trim();
const ZAHLWORT = ['', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'];
const zahlwort = n => (n >= 1 && n <= 12 ? ZAHLWORT[n] : String(n));
/** ISO JJJJ-MM-TT → TT.MM.JJJJ; schon deutsches Datum bleibt. */
function datumDE(v) {
  const t = s(v); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  return m ? `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[3]}` : t;
}
/** Aufzählung „A“, „A und B“, „A, B und C“ */
function liste(xs) { xs = xs.filter(Boolean); return xs.length < 2 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' und ' + xs[xs.length - 1]; }
/** Lücke: Wert oder markierte Platzhalter-Lücke */
const L = (wert, name) => (s(wert) ? s(wert) : { gap: `[${name}]` });
/** Zeilen einer Adress-Zeichenkette „Name, Straße, PLZ Ort“ */
function zeilen(v) { return s(v).split(/\s*[\n;]\s*|,\s+/).map(x => x.trim()).filter(Boolean); }
/** Erste Zeile (Name) */
const nameVon = v => zeilen(v)[0] || '';
const PNR = v => { const m = /(\d+)\s*$/.exec(s(v)); return m ? +m[1] : null; };
const gleicherName = (a, b) => !!a && a.toLowerCase().replace(/\s+/g, ' ') === s(b).toLowerCase().replace(/\s+/g, ' ');

/* ---------- Entnahmestelle: LabelKit ↔ Prüfbericht (Regel wie ResultKit src/ergebnisse.ts) ---------- */
const tidy = v => String(v == null ? '' : v).normalize('NFC').replace(/\s+/g, ' ').trim();
/** Probenbeschreibung vergleichbar machen. Eurofins übernimmt den Text der LabelKit-Laborübergabe wörtlich (geprüft an 15 echten
    Asbestproben, 30.10.2026 – sogar Tippfehler bleiben stehen); angeglichen werden nur Leerraum, Groß-/Kleinschreibung, Striche
    und Anführungszeichen. In ResultKit (src/ergebnisse.ts) gleich halten. */
const beschreibungKey = v => tidy(v).toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u201E\u201C\u201D\u201A\u2018\u2019\u00AB\u00BB"']/g, '"');
/** Weicht die Beschreibung im Prüfbericht von der aus LabelKit ab? Nie bei fehlendem Text und bei Bohrkernen (andere Reihenfolge
    in der Übergabe); „Tiefe: …“ am Ende zählt nicht (LabelKit übergibt sie nur bei Bohrmehl). */
function beschreibungWeichtAb(auftrag, bericht, art = '') {
  if (!tidy(auftrag) || !tidy(bericht) || /bohrkern/i.test(art)) return false;
  const a = beschreibungKey(auftrag), b = beschreibungKey(bericht);
  return a !== b && a.replace(/, tiefe: [^,]*$/, '') !== b;
}
/** Abweichende Entnahmestelle sperrt das Speichern noch nicht – erst nach dem Gegentest mit echten Projekten auf true setzen.
    Gilt für jede Berichtsart, die Asbestproben aus probenSammeln() zeigt. */
const ABGLEICH_SPERRT = false;

/* ---------- Auftraggeber und Objekt im Fließtext ---------- */
/** Auftraggeber mit Artikel für „… durch <X> beauftragt / zugestellt“ (Akkusativ). Unbekannt → unverändert, artikel:false. */
const SCHON_MIT = /^(?:die|der|den|das|dem|des|Herrn|Frau|Firma|Fa\.|Familie|Eheleute)\s/i;
const DIE = /\b(?:g?GmbH|mbH|mbB|AG|eG|KG|KGaA|OHG|oHG|GbR|UG|SE|PartG\w*|Ltd\.?)(?=$|[\s,.&)])|(?:gesellschaft|genossenschaft|gemeinschaft|versicherung|verwaltung|stiftung|gemeinde|anstalt|kasse|bank|universität|hochschule)\b|^(?:Stadt|WEG)\b/i;
const DEN = /\b(?:e\.\s?V\.|Verein|Verband|Kreis|Landkreis|Zweckverband|Eigenbetrieb)(?=$|[\s,.)])/i;
const DAS = /^(?:Land|Bistum|Erzbistum|Amt|Unternehmen)\s/i;
function mitArtikel(name) {
  const n = s(name); if (!n) return { text: '', artikel: true };
  if (SCHON_MIT.test(n)) return { text: n, artikel: true };
  if (/^Herr\s/i.test(n)) return { text: n.replace(/^Herr\s/i, 'Herrn '), artikel: true };
  if (DAS.test(n)) return { text: 'das ' + n, artikel: true };
  if (DEN.test(n)) return { text: 'den ' + n, artikel: true };
  if (DIE.test(n)) return { text: 'die ' + n, artikel: true };
  return { text: n, artikel: false };
}
/** Objekt für den Fließtext: steht die Lage (z. B. „2. OG rechts“, „Wohnung …“) vor der Adresse, kommt sie in Klammern ans Ende. */
const LAGE = /^(?:Wohnung|Whg\.?|Etage|Einheit|Büro|Laden|Praxis)\b|\b(?:\d+\.\s*)?(?:OG|EG|DG|UG|KG|SB|Obergeschoss|Erdgeschoss|Dachgeschoss|Untergeschoss|Kellergeschoss|Souterrain|Hochparterre)\b/i;
const STRASSE = /\d+\s*[a-z]?(?:\s*[-–\/]\s*\d+\s*[a-z]?)?$|(?:str\.|straße|strasse|weg|platz|allee|ring|gasse|damm|ufer|chaussee)\b/i;
function objektImSatz(v) {
  const z = zeilen(v);
  if (z.length > 1 && LAGE.test(z[0]) && !STRASSE.test(z[0]) && !/^\d{5}\s/.test(z[0])) return `${z.slice(1).join(', ')} (${z[0]})`;
  return z.join(', ');
}

/* ---------- Asbest-Befund (Logik wie ResultKit asbestBefund, src/uebersicht.ts – Trenner im Bericht „, “) ---------- */
const ASBEST = /asbest|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const POSITIV = /nachgewiesen|positiv|enthalten|gefunden|^ja$|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const NEGATIV = /nicht|kein|negativ|n\.\s*n\.|^<|unter/i;
const GEHALT = /^asbestgehalt\b/i, ART = /^asbest(?:art)?\b/i;
const gehaltPositiv = w => GEHALT.test(s(w.p)) && /\d/.test(w.r) && !/^\s*</.test(w.r) && !NEGATIV.test(s(w.r));
function asbestBefund(werte) {
  const a = (werte || []).filter(w => ASBEST.test(w.p || '') && !/^[-–—]?$/.test(s(w.r)));
  if (!a.length) return null;
  const teil = w => GEHALT.test(s(w.p)) ? `${s(w.r)}${s(w.u) && /\d/.test(w.r) ? ` ${s(w.u)}` : ''}`
    : ART.test(s(w.p)) ? s(w.r) : `${s(w.p)}: ${s(w.r)}`;
  const sortiert = [...a.filter(w => !GEHALT.test(s(w.p))), ...a.filter(w => GEHALT.test(s(w.p)))];
  const text = [...new Set(sortiert.map(teil))].join(', ');
  const gefunden = a.some(w => (POSITIV.test(s(w.r)) && !NEGATIV.test(s(w.r))) || gehaltPositiv(w));
  const negativ = !gefunden && a.every(w => NEGATIV.test(s(w.r)) || /^[-–—]?$/.test(s(w.r)));
  return { text, gefunden, eindeutig: gefunden || negativ };
}
/** KMF-Angaben aus den Laborwerten (ResultKit liest sie als normale Werte) */
const KI = /\bKI\b|kanzerogenit/i, WHO = /WHO|mineralfaser|\bKMF\b/i;
function kmfWerte(werte) {
  const ki = (werte || []).find(w => KI.test(w.p || '') && s(w.r) && !/^[-–—]$/.test(s(w.r)));
  const who = (werte || []).find(w => WHO.test(w.p || '') && !KI.test(w.p || '') && s(w.r) && !/^[-–—]$/.test(s(w.r)));
  return { ki: ki ? s(ki.r) : '', who: who ? `${s(who.p)}: ${s(who.r)}${s(who.u) ? ' ' + s(who.u) : ''}` : '',
    whoPositiv: who ? (POSITIV.test(s(who.r)) || (/\d/.test(who.r) && !NEGATIV.test(s(who.r)))) && !NEGATIV.test(s(who.r)) : null };
}
const IST_KMF = /KMF|mineralwolle|glaswolle|steinwolle|dämm|daemm|mineralfaser/i;

/* ---------- Personen ---------- */
const TITEL = /^(?:Dr\.|Prof\.|Dipl\.-\S+|M\.\s?Sc\.|B\.\s?Sc\.|M\.|Sc\.)$/;
/** „Dr. Ricarda Pütt“ → {titel:'Dr.', nachname:'Pütt'}; „Lucas vom Dorp“ → nachname „vom Dorp“ */
function namensteile(name) {
  const w = s(name).split(/\s+/).filter(Boolean); const titel = [];
  while (w.length > 1 && TITEL.test(w[0])) titel.push(w.shift());
  const nachname = w.length > 1 ? w.slice(1).join(' ') : (w[0] || '');
  return { titel: titel.filter(t => /^(Dr\.|Prof\.)$/.test(t)).join(' '), nachname };
}
/* Frau/Herr ohne Eintrag in den Einstellungen: Büro-Standard nach Nachname (Basti, 30.10.2026).
   Ein Eintrag in den Einstellungen geht immer vor; Unbekannte bleiben leer (Hinweis „fehlt Frau/Herr“). */
const ANREDE_STANDARD = { 'pütt': 'w', 'jung': 'w', 'kasper': 'm', 'grund': 'm', 'cremer': 'm', 'vom dorp': 'm' };
/** 'w' | 'm' | '' für einen Namen laut Büro-Standard */
function anredeStandard(name) {
  const nn = s(namensteile(name).nachname).normalize('NFC').toLowerCase();
  return ANREDE_STANDARD[nn] || '';
}
/** Person für Bericht: {kuerzel, name, rolle:'sv'|'mt', geschlecht:'w'|'m'|'', satz} */
function person(cfg, mitarbeiter, kuerzel) {
  const k = s(kuerzel); if (!k) return null;
  const ma = (mitarbeiter || []).find(p => s(p.ordnerKuerzel).toLowerCase() === k.toLowerCase()) || {};
  const c = ((cfg && cfg.personen) || {})[k] || {};
  const name = s(c.name) || s(ma.name) || k;
  const g = c.geschlecht === 'w' || c.geschlecht === 'm' ? c.geschlecht : anredeStandard(name);
  const t = namensteile(name);
  const satz = s(c.satz) || (g ? `${g === 'w' ? 'Frau' : 'Herrn'} ${t.titel ? t.titel + ' ' : ''}${t.nachname}` : name);
  return { kuerzel: k, name, rolle: c.rolle === 'mt' ? 'mt' : 'sv', geschlecht: g, satz };
}
/** Rolle in den Einstellungen ausdrücklich festgelegt? (bis 1.7.0 wurde „Sachverständige(r)“ nie gespeichert – gilt als nicht festgelegt) */
function rolleFestgelegt(cfg, kuerzel) {
  const r = ((((cfg && cfg.personen) || {})[s(kuerzel)]) || {}).rolle;
  return r === 'sv' || r === 'mt';
}
/** Vorschlag für die erste Unterschrift: der Zuständige laut Ordner, wenn er Sachverständige(r) ist. Sonst (Zuständiger ist
    Messtechniker(in) oder fehlt) die erste Sachverständige der Mitarbeiterliste – das ist eine Annahme und wird angezeigt.
    → { kuerzel, angenommen, grund } */
function svVorschlag(cfg, mitarbeiter, zustaendig) {
  const rolle = k => ((((cfg && cfg.personen) || {})[k]) || {}).rolle === 'mt' ? 'mt' : 'sv', z = s(zustaendig);
  if (z && rolle(z) === 'sv') return { kuerzel: z, angenommen: false, grund: '' };
  const erste = (mitarbeiter || []).find(p => s(p.ordnerKuerzel) && rolle(s(p.ordnerKuerzel)) === 'sv');
  if (!erste) return { kuerzel: '', angenommen: false, grund: '' };
  const zp = z ? person(cfg, mitarbeiter, z) : null;
  return { kuerzel: s(erste.ordnerKuerzel), angenommen: true,
    grund: zp ? `zuständig laut Ordner ist ${zp.name}, ${zp.geschlecht === 'w' ? 'Messtechnikerin' : 'Messtechniker'}` : 'kein Zuständiger im Projekt' };
}
function rollentext(p) {
  if (p.rolle === 'mt') return p.geschlecht === 'w' ? 'Die Messtechnikerin' : 'Der Messtechniker';
  return p.geschlecht === 'w' ? 'Die Sachverständige' : p.geschlecht === 'm' ? 'Der Sachverständige' : 'Sachverständige(r)';
}

/* ---------- Proben zusammenführen ---------- */
/* LabelKit-Matrix (Auswahl für die Nachweisgrenze nach VDI 3866-5) → Materialname für den Bericht (Einzahl, ohne Markennamen).
   Nur Ersatz, wenn „Bauteil / Material“ (z3) leer ist – die Matrix ist eine Laborgruppe, z3 das konkrete Material. */
const MATRIX_MATERIAL = {
  'Faserzementprodukte (z.B. Eternit)': 'Faserzement', 'Promabest (Leichtbauplatten)': 'Leichtbauplatte', 'Pappen': 'Pappe',
  'Schnüre': 'Schnur', 'Dichtungen': 'Dichtung', 'Cushion-Vinyl (Bodenbelag)': 'Cushion-Vinyl-Bodenbelag',
  'Fußbodenplatten (Flexplatten)': 'Fußbodenplatte (Flexplatte)', 'Rohrisolierungen (Diatomeen-Basis)': 'Rohrisolierung (Diatomeen-Basis)',
  'KMF-Deckenplatten': 'KMF-Deckenplatte', 'Bituminöse Proben / Kleber': 'bituminöses Material / Kleber', 'Kitte': 'Kitt',
  'Rohrisolierungen (Gips-Basis)': 'Rohrisolierung (Gips-Basis)', 'Farben': 'Farbe', 'Estriche': 'Estrich',
  'Ausgleichsmassen': 'Ausgleichsmasse', 'Putze / Spachtelmassen': 'Putz / Spachtelmasse',
};
const matrixMaterial = m => MATRIX_MATERIAL[s(m).normalize('NFC')] || '';
/* Raum-Kürzel aus LabelKit („SZ“, „WZ“) sind für den Auftraggeber nicht selbsterklärend (Testbericht 26.0512, 30.10.2026).
   Im Bericht (Tabelle 1, Abb.-Unterschriften) werden nur diese eindeutigen Kürzel ausgeschrieben – als ganzes Wort, genau so
   geschrieben. Geschosse (OG, EG …) bleiben. Nicht dabei: AZ (im Asbestbericht = Asbestzement, „AZ-Rohr“), EZ (mehrdeutig). Jede Ersetzung erscheint als Hinweis; LabelKit, Abgleich und Prüfbericht bleiben unberührt. */
const RAUM_KUERZEL = { SZ: 'Schlafzimmer', WZ: 'Wohnzimmer', KiZ: 'Kinderzimmer', GZ: 'Gästezimmer',
  HWR: 'Hauswirtschaftsraum', TRH: 'Treppenhaus' };
const RAUM_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(RAUM_KUERZEL).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
/** „Bodenaufbau SZ Unterseite“ → { text: „Bodenaufbau Schlafzimmer Unterseite“, ersetzt: ['SZ'] } */
function raumAusschreiben(v) {
  const ersetzt = [];
  const text = s(v).replace(RAUM_RE, k => { ersetzt.push(k); return RAUM_KUERZEL[k]; });
  return { text, ersetzt };
}
/** In LabelKit storniert (ab 4.49.0: storniert = {am, kuerzel, grund})? Jede Angabe zählt, auch ein einfaches true.
    Stornierte Proben sind keine Proben mehr: nicht anbieten, nicht zählen, nicht abgleichen – die Nummer bleibt aber vergeben,
    die übrigen Proben behalten ihre LabelKit-Nummer (keine Lücke schließen). */
const istStorniert = p => !!(p && p.storniert);
/** LabelKit-Asbestproben nach Label „P<n>“ (Nummer wie LabelKit: _nr, sonst id) → { aktiv, storniert } (je Map Label → Probe).
    Gäbe es eine Nummer aktiv und storniert zugleich, gilt die aktive. */
function labelkitAsbest(lk) {
  const aktiv = new Map(), storniert = new Map();
  for (const p of (lk && Array.isArray(lk.asbestProben) ? lk.asbestProben : [])) {
    if (!p) continue;
    const n = p._nr != null && p._nr !== '' ? +p._nr : +p.id; if (!n) continue;
    (istStorniert(p) ? storniert : aktiv).set('P' + n, { nr: n, datum: s(p.datum), stelle: s(p.z2), material: s(p.z3), matrix: s(p.matrix) });
  }
  for (const k of aktiv.keys()) storniert.delete(k);
  return { aktiv, storniert };
}
/** Alle Proben mit Asbest- oder KMF-Ergebnis aus _Ergebnisse.json, angereichert mit LabelKit.
    abgleich: Beschreibung aus dem LabelKit-Auftrag (auftrag.proben[].desc, wie ResultKit ihn übernommen hat) gegen die aus dem
    Prüfbericht (berichte[].proben[].desc) – ok: true/false, null = nicht abgleichbar (kein Auftrag oder kein Text).
    offen: LabelKit-Asbestproben ohne Ergebnis (stornierte nie).
    storniert: Laborwerte zu Proben, die in LabelKit storniert sind – nicht im Bericht, nicht im Abgleich, nur als Hinweis. */
function probenSammeln(erg, lk) {
  const { aktiv: lkm, storniert: lks } = labelkitAsbest(lk), out = [], storniert = [], gesehen = new Set();
  const berichte = erg && Array.isArray(erg.berichte) ? erg.berichte : [];
  const auftrag = erg && erg.auftrag && Array.isArray(erg.auftrag.proben) ? new Map(erg.auftrag.proben.filter(a => a && a.label).map(a => [s(a.label), a])) : null;
  for (const b of berichte) for (const p of (b.proben || [])) {
    const werte = p.werte || [];
    const befund = asbestBefund(werte), kmf = kmfWerte(werte);
    if (!(p.typ === 'Asbest' || befund || kmf.ki || kmf.who)) continue;
    const label = s(p.label) || (PNR(p.ref) ? 'P' + PNR(p.ref) : s(p.ref));
    if (gesehen.has(label + '|' + b.bericht)) continue; gesehen.add(label + '|' + b.bericht);
    if (lks.has(label)) { storniert.push({ label, nr: lks.get(label).nr, ref: s(p.ref), labNr: s(p.labNr), bericht: s(b.bericht || p.bericht) }); continue; }
    const l = lkm.get(label) || {}, a = auftrag && auftrag.get(label);
    const abgleich = { labelkit: a ? tidy(a.desc) : '', bericht: tidy(p.desc), auftrag: !!auftrag };
    abgleich.ok = abgleich.labelkit && abgleich.bericht ? !beschreibungWeichtAb(a.desc, p.desc, s(p.art)) : null;
    out.push({ label, nr: l.nr || PNR(p.ref) || PNR(label), ref: s(p.ref), labNr: s(p.labNr), bericht: s(b.bericht || p.bericht),
      stelle: l.stelle || s(p.raum) || '', material: l.material || matrixMaterial(l.matrix), materialAusMatrix: !l.material && !!matrixMaterial(l.matrix),
      matrix: l.matrix || s(p.art),
      datum: l.datum || s(p.datum), befund, kmf, vorlaeufig: !!b.vorlaeufig, abgleich });
  }
  out.sort((a, b) => (a.nr || 0) - (b.nr || 0));
  const offen = [...lkm].filter(([k]) => !out.some(p => p.label === k)).map(([label, l]) => ({ label, nr: l.nr, stelle: l.stelle, material: l.material }));
  storniert.sort((a, b) => (a.nr || 0) - (b.nr || 0));
  // nurStorniert: LabelKit hat Asbestproben, aber alle sind storniert (dann gibt es keinen Bericht – siehe bericht())
  const nurStorniert = !lkm.size && lks.size ? [...lks.values()].map(l => 'P' + l.nr).sort((a, b) => a.slice(1) - b.slice(1)) : [];
  return { proben: out, offen, storniert, nurStorniert };
}

/* ---------- Projektdaten ---------- */
/** Sieht der Name nach einer Versicherung aus? (Auftraggeber im Versicherungsfall ist meist die Versicherung selbst.) */
const VERSICHERER = /versicher|assekura|allianz|\baxa\b|\bergo\b|\bhuk\b|provinzial|gothaer|\bzurich\b|generali|signal iduna|\br\s*\+\s*v\b|\bdevk\b|\blvm\b|\bvhv\b|\bvgh\b|helvetia|basler|barmenia|continentale|alte leipziger|württembergische|nürnberger|concordia|debeka|mecklenburgische|uelzener|ammerländer/i;
const istVersicherer = name => VERSICHERER.test(s(name));
/** Deckblatt „mit Versicherung“ (VN · Risiko · Versicherer) oder „ohne“ (Auftraggeber · Schadenort), wenn im Bericht nichts gewählt ist:
    Versicherer in der Projektzentrale → mit; kein VN → ohne; VN da: mit, wenn der Auftraggeber eine Versicherung ist, sonst ohne
    (Hausverwaltung, Sanierer, Privatauftrag …). Im Bericht unter „Auftrag“ umstellbar (form.deckblatt). */
function versicherungsfallAuto(vn, ag, versicherer) {
  if (versicherer) return { ja: true, grund: 'Versicherer in der Projektzentrale eingetragen' };
  if (!vn) return { ja: false, grund: 'kein VN in der Projektzentrale' };
  if (istVersicherer(nameVon(ag))) return { ja: true, grund: 'Auftraggeber ist eine Versicherung' };
  return { ja: false, grund: 'VN eingetragen, aber der Auftraggeber ist keine Versicherung' };
}
/* Projektnummer „26.0512“ aus einem Text. Das Feld „Projektnummer“ in LabelKit ist Freitext – ältere Projekte tragen dort
   oft die Adresse mit („26.0512 Stegerwaldstraße Leverkusen“). Gleiche Regel in ResultKit (labelkit.ts) und LabelKit. */
const projektNummer = v => (s(v).match(/(?<!\d)\d{2}\.\d{3,6}(?!\d)/) || [''])[0];
/* Gehören zwei Projektangaben zum selben Projekt? Haben beide eine Projektnummer, zählt nur die Nummer;
   sonst (z. B. „2025-047“, „PAK“) der ganze Text wie bisher. */
function gleichesProjekt(a, b) {
  const na = projektNummer(a), nb = projektNummer(b);
  return na && nb ? na === nb : s(a) === s(b);
}

function projektSicht(pj, ordner) {
  pj = pj || {};
  const vn = s(pj.versicherungsnehmer), ag = s(pj.auftraggeber), objekt = s(pj.objekt);
  const auto = versicherungsfallAuto(vn, ag, s(pj.versicherer));
  return { nr: s(pj.projektnummer) || s(ordner && ordner.nr), versicherungsfall: auto.ja, versicherungsfallGrund: auto.grund, vn, ag, objekt, versicherer: s(pj.versicherer),
    schadennummer: s(pj.schadennummer), auftragsdatum: s(pj.auftragsdatum), zustaendig: s(pj.zustaendig && pj.zustaendig.kuerzel) || s(ordner && ordner.kuerzel),
    sachverstaendiger: s(pj.sachverstaendiger) };
}

/* ---------- Bausteine, die jede Berichtsart braucht ----------
   Reihenfolge der Aufrufe in einer Berichtsart = Reihenfolge der Hinweise in der Liste (sie werden hier nur angehängt). */

/** LabelKit-Datei eines anderen Projekts: nichts daraus darf in den Bericht → Sperre */
function labelkitProjektPruefen(e, P, sperren) {
  const lkNr = s(e.lk && e.lk.projekt && e.lk.projekt.nr), nr = s(e.ordner && e.ordner.nr) || P.nr;
  if (lkNr && nr && !gleichesProjekt(lkNr, nr)) sperren.push(`Die LabelKit-Datei gehört zu Projekt ${lkNr}, nicht zu ${nr} – in LabelKit/ResultKit prüfen.`);
}

/** Deckblatt-Feldblock „mit Versicherung“ (VN · Risiko · Versicherer) oder „ohne“ (Auftraggeber · Schadenort), dazu Schaden-Nr.
    → { vfall, felder, versicherer, versichererQuelle } */
function deckblattFelder(P, f, hinweise) {
  const felder = [];
  // Versicherer: Eingabe, dann Feld „Versicherer“ der Projektzentrale, sonst angenommen: Auftraggeber (der Arbeitszettel-Import
  // schreibt im Versicherungsfall die Versicherung dorthin) – aber nicht, wenn der Auftraggeber der VN selbst ist (→ Lücke).
  const vfall = f.deckblatt === 'versicherung' ? true : f.deckblatt === 'direkt' ? false : P.versicherungsfall;
  if (!f.deckblatt && !vfall && P.vn) hinweise.push(`Deckblatt ohne Versicherung (${P.versicherungsfallGrund}) – ist doch eine Versicherung beteiligt, unter „Auftrag“ umstellen.`);
  const agIstVn = vfall && gleicherName(nameVon(P.ag), nameVon(P.vn));
  const versicherer = s(f.versicherer) || nameVon(P.versicherer) || (agIstVn ? '' : nameVon(P.ag));
  // Annahme „Auftraggeber = Versicherer“: eine Meldung (versichererQuelle), mit „✓ stimmt“ bestätigt (versOk = bestätigter Name –
  // ändert sich der Auftraggeber, gilt die Bestätigung nicht mehr)
  let versichererQuelle = null;
  if (vfall && !s(f.versicherer) && !P.versicherer) {
    if (agIstVn) hinweise.push('Auftraggeber und VN sind gleich – trag den Versicherer unter „Versicherer“ ein.');
    else if (versicherer) versichererQuelle = gleicherName(s(f.versOk), versicherer)
      ? { angenommen: false, wert: versicherer, text: 'Auftraggeber = Versicherer (bestätigt)' }
      : { angenommen: true, wert: versicherer, text: `Versicherer angenommen: Auftraggeber „${versicherer}“ – bitte prüfen. Stimmt das nicht, trag den Versicherer unter „Versicherer“ ein (oder in der Projektzentrale).` };
  }
  if (vfall) {
    felder.push(['VN:', zeilen(P.vn)], ['Risiko:', zeilen(P.objekt)], ['Versicherer:', [versicherer].filter(Boolean)]);
  } else {
    felder.push(['Auftraggeber:', zeilen(P.ag)], ['Schadenort:', zeilen(P.objekt)]);
  }
  if (P.schadennummer) felder.push(['Schaden-Nr.:', [P.schadennummer]]);
  felder.forEach(([k, v]) => { if (!v.length) v.push({ gap: `[${k.replace(':', '')}]` }); });
  return { vfall, felder, versicherer, versichererQuelle };
}

/** Kopf der Folgeseiten (4 Zeilen, 9 pt): Titel, Betreff, VN bzw. AG, Risiko bzw. Schadenort */
function kopfZeilen(titel, betreff, P, vfall) {
  return [titel, betreff,
    vfall ? ['VN: ', L(zeilen(P.vn).join(', '), 'VN')] : ['AG: ', L(zeilen(P.ag).join(', '), 'Auftraggeber')],
    [vfall ? 'Risiko: ' : 'Schadenort: ', L(zeilen(P.objekt).join(', '), 'Objekt')]];
}

/** Auftraggeber im Satz („… durch <X> beauftragt“): eigene Eingabe bleibt, wie sie ist; der unveränderte Name aus der
    Projektzentrale bekommt den Artikel. → Run (Text oder Lücke) */
function auftraggeberImSatz(f, P, hinweise) {
  const agEingabe = s(f.agSatz), agName = nameVon(P.ag);
  const agArt = !agEingabe || agEingabe === agName ? mitArtikel(agName) : { text: agEingabe, artikel: true };
  if (agArt.text && !agArt.artikel) hinweise.push(`Auftraggeber im Satz: „durch ${agArt.text} beauftragt“ – Artikel prüfen (z. B. „die …“, „Herrn …“).`);
  return L(agArt.text, 'Auftraggeber');
}

/** PDF eines Prüfberichts im Projektordner („Laborergebnisse/…pdf“), sonst '' */
function pruefberichtPdf(erg, nr) {
  const ergBerichte = erg && Array.isArray(erg.berichte) ? erg.berichte : [];
  const b = ergBerichte.find(x => s(x.bericht) === nr), pdf = b && b.sources && s(b.sources.pdf);
  return pdf ? 'Laborergebnisse/' + pdf : '';
}

/** Hinweise und Sprünge (FotoKit/PlanKit) aus BerichtAnlagen.zusammenstellen übernehmen */
function anlagenUebernehmen(A, hinweise, hinweisAktionen) {
  hinweise.push(...A.hinweise);
  for (const [h, a] of Object.entries(A.aktionen || {})) { const art = ANL.ARTEN[a.art]; hinweisAktionen[h] = { app: art.app, link: art.link, ziel: art.ziel, was: a.was }; }
}

/** Anlagen für den Bericht: „Anlage n:“ | Prüfbericht Nr. … / (Labor) – zweizeilig mit hängendem Einzug, die übrigen einzeilig;
    anlagen = als Fließtext; anlagenDateien = Pfade aller Anlagen für die Übergabe ans Büro („Laborergebnisse/…pdf“, „Fotos/…pdf“). */
function anlagenAusgabe(A) {
  const anlagenTeile = A.liste.map(a => ({ label: `Anlage ${a.nr}:`, zeilen: a.zeilen }));
  const anlagen = anlagenTeile.map(a => [a.label + ' ', ...a.zeilen.flatMap((z, i) => i ? [' ', ...z] : z)]);
  const anlagenDateien = A.liste.flatMap(a => a.dateien);
  const anlagenListe = A.liste.map(a => ({ nr: a.nr, art: a.art, titel: a.titel, dateien: a.dateien }));
  return { anlagenTeile, anlagen, anlagenDateien, anlagenListe };
}

/** Unterschriften: je Unterschrift Person und Rolle („als Sachverständige(r)“ / „als Messtechniker(in)“); ohne Wahl gilt die Rolle
    aus den Einstellungen. Hinweise: Rolle nicht festgelegt, Frau/Herr fehlt; svQuelle: Unterschrift nur vorgeschlagen.
    personen = { sv, pn, mt } (aus person()), zugestellt: Proben nicht selbst genommen → { unterschriften, svQuelle } */
function unterschriftenBlock(e, f, personen, zugestellt, hinweise, hinweisAktionen) {
  const { sv, pn, mt } = personen;
  const unterschriften = [], alsRolle = (p, r) => p && (r === 'sv' || r === 'mt') ? { ...p, rolle: r } : p;
  const u1 = alsRolle(sv, f.rolle1), u2 = alsRolle(mt, f.rolle2);
  if (u1) unterschriften.push({ kuerzel: u1.kuerzel, rolle: rollentext(u1), name: u1.name });
  else unterschriften.push({ kuerzel: '', rolle: 'Sachverständige(r)', name: { gap: '[Sachverständige(r)]' } });
  if (u2 && (!u1 || u2.kuerzel !== u1.kuerzel)) unterschriften.push({ kuerzel: u2.kuerzel, rolle: rollentext(u2), name: u2.name });
  // Hängt an der Rolle, nicht am Eintrag: Ein Eintrag nur mit Frau/Herr oder Namen legt die Rolle nicht fest
  if (sv && pn && sv.kuerzel === pn.kuerzel && !f.rolle1 && !rolleFestgelegt(e.cfg, sv.kuerzel) && !zugestellt) {
    const h = `${sv.name} hat die Proben genommen und unterschreibt als Sachverständige(r) – die Rolle ist in den Einstellungen noch nicht festgelegt. Leg sie dort einmal fest (Sachverständige(r) oder Messtechniker(in)).`;
    hinweise.push(h); hinweisAktionen[h] = { einstellungen: true };
  }
  // Unterschrift nur vorgeschlagen (Zuständiger ist Messtechniker(in) oder fehlt): Annahme mit „✓ stimmt“ (svOk = bestätigtes Kürzel)
  const svV = f.svVorschlag;
  const svQuelle = sv && svV && svV.angenommen && s(svV.kuerzel) === sv.kuerzel
    ? (s(f.svOk) === sv.kuerzel ? { angenommen: false, text: 'bestätigt' }
      : { angenommen: true, text: `Unterschrift: ${sv.name} angenommen (${svV.grund}) – bitte prüfen.` })
    : null;
  [sv, pn, mt].filter((p, i, xs) => p && xs.findIndex(q => q && q.kuerzel === p.kuerzel) === i).forEach(p => { if (!p.geschlecht) hinweise.push(`${p.name}: in den Einstellungen fehlt Frau/Herr.`); });
  return { unterschriften, svQuelle };
}

/** Kennzeile „Vorläufig“ (Kopf), wenn ein Prüfbericht vorläufig ist */
const kennzeilenVorlaeufig = vorlaeufig => vorlaeufig ? [{ art: 'vorlaeufig', text: 'Vorläufig – beruht auf einem vorläufigen Prüfbericht' }] : [];

/** Annahmen, die mit „✓ stimmt“ bestätigt werden: je eine Meldung (Hinweisliste, am Feld nur „angenommen – bitte prüfen“).
    quellen = [[id, quelle|null], …] */
const annahmenAus = quellen => quellen.filter(([, q]) => q && q.angenommen).map(([id, q]) => ({ id, text: q.text, wert: q.wert }));

/** Probenehmer: Es zählt nur ein genauer Treffer aus dem Feldbogen (LabelKit schlägt die Namen der Mitarbeiterliste vor) oder die
    eigene Auswahl. Alles andere – meist der Zuständige laut Ordnername – ist eine Annahme und wird angezeigt. */
function pnQuelle(f, fb, zugestellt, pn, zustaendig) {
  if (zugestellt || !pn) return null;
  const text = s(fb && fb.text), k = s(fb && fb.kuerzel), gewaehlt = s(f.probenehmer);
  if (k && k === gewaehlt) return { angenommen: false, text: `aus dem Feldbogen (LabelKit): „${text}“` };
  if (f.pnQuelle === 'hand') return { angenommen: false, text: 'eigene Auswahl' + (text ? ` – Feldbogen: „${text}“` : '') };
  const grund = k ? `Feldbogen nennt „${text}“` : text ? `Feldbogen „${text}“ passt zu keinem Namen der Mitarbeiterliste`
    : 'kein Probenehmer im Feldbogen';
  return { angenommen: true, text: `Probenehmer ${pn.name} angenommen (${gewaehlt === zustaendig ? 'zuständig laut Ordner' : 'nicht aus dem Feldbogen'}; ${grund}) – bitte prüfen.` };
}
/** Fassung zum Herunterladen, wenn das Speichern gesperrt ist: Kopfzeile „ENTWURF“ und „_ENTWURF“ im Dateinamen. */
function alsEntwurf(m) {
  return { ...m, dateiname: m.dateiname.replace(/\.docx$/i, '_ENTWURF.docx'), kennzeilen: [{ art: 'entwurf', text: 'ENTWURF – nicht versenden' }, ...(m.kennzeilen || [])] };
}
/** Alle offenen Lücken im Modell (für die Hinweisliste) */
function luecken(m) {
  const out = new Set();
  const lauf = x => { if (!x) return; if (Array.isArray(x)) x.forEach(lauf); else if (typeof x === 'object') { if (x.gap) out.add(x.gap); else Object.values(x).forEach(lauf); } };
  lauf([m.deckblatt, m.kopf, m.abschnitte, m.unterschriften, m.anlagen]);
  return [...out];
}
/** Runs → reiner Text (Lücken in eckigen Klammern) */
const text = runs => (Array.isArray(runs) ? runs : [runs]).map(r => (r && typeof r === 'object' ? r.gap : String(r == null ? '' : r))).join('');

const API = { VERSION: 1, ABGLEICH_SPERRT,
  // Helfer
  s, L, datumDE, liste, zahlwort, zeilen, nameVon, PNR, gleicherName, text, luecken, alsEntwurf,
  // Proben und Befund
  tidy, beschreibungKey, beschreibungWeichtAb, asbestBefund, kmfWerte, IST_KMF, matrixMaterial, RAUM_KUERZEL, raumAusschreiben,
  istStorniert, labelkitAsbest, probenSammeln,
  // Personen
  namensteile, anredeStandard, person, rolleFestgelegt, svVorschlag, rollentext, pnQuelle,
  // Projekt, Deckblatt, Kopf, Auftraggeber
  istVersicherer, versicherungsfallAuto, projektNummer, gleichesProjekt, projektSicht, mitArtikel, objektImSatz,
  labelkitProjektPruefen, deckblattFelder, kopfZeilen, auftraggeberImSatz,
  // Unterschriften, Anlagen, Kennzeilen, Annahmen
  unterschriftenBlock, pruefberichtPdf, anlagenUebernehmen, anlagenAusgabe, kennzeilenVorlaeufig, annahmenAus };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtGemeinsam = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

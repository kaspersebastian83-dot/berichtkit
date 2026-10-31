/* BerichtKit – Word-Datei aus dem Berichtsmodell (bericht-text.js, jede Berichtsart) mit docx (MIT, vendor/docx.iife.js).
   Format wie die Berichte des Büros (Spezifikation „bericht-format-spec“): A4, Arial 12, Zeilenabstand 1,5, Blocksatz,
   Deckblatt mit großem Logo und Adressblock, Folgeseiten mit kleinem Logo, „Seite X von Y“ und vier Kopfzeilen (9 pt),
   Überschriften nummeriert und unterstrichen, Bildunterschrift „Abb. n“ (11 pt kursiv), Lücken gelb markiert.
   Alle Texte kommen aus dem Modell – auch der Titel (deckblatt.titel, kopf[0]); hier steht nur das Layout.
   Blöcke in abschnitte[].inhalt: { t:'p', runs } Absatz · { t:'h2', runs } Unterüberschrift (kursiv, nicht unterstrichen, z. B. „5.1 …“)
   · { t:'fig', label, datei, caption } Foto · { t:'tab', caption, kopf[], zeilen[][], ausrichtung[], spalten[] } Tabelle
   (spalten = Breiten in twips, zusammen 9070; fehlen sie, gleich breit; ohneUmbruch = Spalten, deren Text nicht am Bindestrich
   umbrechen darf, z. B. die Labor-Nr.).
   bilder = { logoSvg:Uint8Array, logoPng:Uint8Array, sig:{<Kürzel>:{data,w,h}}, fotos:{<Label>:{data,w,h}} } */
(function (root) {
'use strict';

function erstellen(D, m, bilder) {
  const { Document, Paragraph, TextRun, ImageRun, Header, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
    TabStopType, PageNumber, ShadingType, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
    SectionType, VerticalAlign, UnderlineType, NoBreakHyphen } = D;
  const FONT = 'Arial';
  const cmPx = cm => cm / 2.54 * 96, cmEmu = cm => Math.round(cm * 360000);
  const LINE15 = { line: 360, lineRule: 'auto' }, LINE1 = { line: 240, lineRule: 'auto' };
  const B = 9070;                                   // Textbreite in twips (21 cm − 2 × 2,5 cm)

  /* Runs: Text oder { gap } (gelb) */
  const runs = (xs, o = {}) => (Array.isArray(xs) ? xs : [xs]).filter(x => x !== '' && x != null).map(x =>
    x && typeof x === 'object' ? new TextRun({ text: x.gap, font: FONT, highlight: 'yellow', ...o }) : new TextRun({ text: String(x), font: FONT, ...o }));
  const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
  const einfach = (children, o = {}) => new Paragraph({ children, spacing: { ...LINE1, after: 0 }, ...o });

  /* Logo: SVG mit PNG-Ersatz (ältere Word-Versionen) */
  const LOGO_RATIO = 103 / 393;
  const logo = (wCm, xCm, yCm) => new ImageRun({
    type: 'svg', data: bilder.logoSvg, fallback: { type: 'png', data: bilder.logoPng },
    transformation: { width: cmPx(wCm), height: cmPx(wCm * LOGO_RATIO) },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: cmEmu(xCm) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: cmEmu(yCm) },
      wrap: { type: TextWrappingType.NONE }, allowOverlap: true },
    altText: { title: 'Logo', description: 'Dr. Heinz Schiffers & Partner', name: 'Logo' },
  });

  /* Kopf Deckblatt */
  const ADR = 6381;
  const adr = text => einfach([text ? t(text, { size: 16 }) : t('')], { indent: { left: ADR } });
  const kopfDeckblatt = new Header({ children: [
    new Paragraph({ children: [logo(11.6, -0.94, 0.33), t('Dr. Schiffers & Partner', { size: 16 })], indent: { left: ADR }, spacing: { ...LINE1, after: 0 } }),
    adr('Gouleystr. 59'), adr('52146 Würselen'), adr('E-Mail: Dr.Schiffers@t-online.de'), adr('Tel: 02405-418 480'), adr('https://dr-schiffers.de'),
    adr(''), adr('Sachverständige für'), adr('die chemische Untersuchung von'), adr('Brandfolgeschäden'),
    adr(''), adr('Sachverständige'), adr('für Schimmelpilzschäden in Innenräumen'),
  ] });

  /* Kennzeilen „ENTWURF – nicht versenden“ (rot) / „Vorläufig …“: auf dem Deckblatt über dem Titel, auf den Folgeseiten
     in der zweiten Leerzeile des Kopfes – die Seitenaufteilung bleibt gleich. */
  const kennRuns = (o = {}) => (m.kennzeilen || []).flatMap((k, i) => [...(i ? [t('  ·  ', o)] : []),
    t(k.text, { bold: true, ...(k.art === 'entwurf' ? { color: 'C00000' } : {}), ...o })]);

  /* Kopf Folgeseiten */
  const k9 = r => einfach(runs(r, { size: 18 }));
  const kopfFolge = new Header({ children: [
    new Paragraph({ children: [logo(3.97, -0.26, -0.44), t('\t'), new TextRun({ font: FONT, children: ['Seite ', PageNumber.CURRENT, ' von ', PageNumber.TOTAL_PAGES] })],
      tabStops: [{ type: TabStopType.RIGHT, position: B }], spacing: { ...LINE1, after: 0 } }),
    einfach([t('')]), einfach((m.kennzeilen || []).length ? kennRuns({ size: 18 }) : [t('')]),
    ...m.kopf.map(k9),
  ] });

  /* Deckblatt */
  const TAB = 3960, d = m.deckblatt;
  const kenn = (m.kennzeilen || []).length;
  const deckblatt = [
    ...(kenn ? [einfach(kennRuns(), { spacing: { ...LINE1, before: 2760 - 480, after: 240 } })] : []),
    new Paragraph({ children: [t(d.titel, { bold: true, italics: true, size: 28 })], spacing: { ...LINE15, before: kenn ? 0 : 2760, after: 0 } }),
    new Paragraph({ children: [t(`(${d.mitteilung})`, { bold: true, italics: true })], spacing: { ...LINE15, after: 600 } }),
    einfach([t('Projektnummer:'), t('\t'), ...runs(d.projektnummer || { gap: '[Projektnummer]' })], { tabStops: [{ type: TabStopType.LEFT, position: TAB }], spacing: { ...LINE1, after: 360 } }),
    einfach(runs(d.betreff), { spacing: { ...LINE1, after: 720 } }),
  ];
  d.felder.forEach(([label, zeilen], i) => zeilen.forEach((z, j) => deckblatt.push(einfach([t(j === 0 ? label : ''), t('\t'), ...runs(z)], {
    tabStops: [{ type: TabStopType.LEFT, position: TAB }],
    spacing: { ...LINE1, after: j === zeilen.length - 1 && !(label === 'Versicherer:' && i < d.felder.length - 1) ? 360 : 0 },
  }))));

  /* Abschnitte */
  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, duenn = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
  /* Abstände: 1 Leerzeile = 12 pt. Über jeder Überschrift 2 Leerzeilen (24 pt), darunter 1; die erste Überschrift
     („1. Veranlassung“) beginnt ohne Abstand. Der Abstand steht nur an der Überschrift – der Absatz davor bekommt 0,
     damit Word und LibreOffice gleich aussehen (sie verrechnen „nach“ + „vor“ unterschiedlich). */
  const LEER = 240;
  const ueberschrift = (text, erste) => new Paragraph({ children: [t(text, { underline: { type: UnderlineType.SINGLE } })],
    spacing: { ...LINE15, before: erste ? 0 : 2 * LEER, after: LEER }, keepNext: true, outlineLevel: 0 });
  const absatz = (r, nach = LEER) => new Paragraph({ children: runs(r), alignment: AlignmentType.JUSTIFIED, spacing: { ...LINE15, after: nach } });
  /* Unterüberschrift („5.1 Chlorid“): kursiv, nicht unterstrichen; der Block davor bringt die Leerzeile mit, darunter eine */
  const unterueberschrift = (r, nach = LEER) => new Paragraph({ children: runs(r, { italics: true }), spacing: { ...LINE15, before: 0, after: nach },
    keepNext: true, outlineLevel: 1 });
  /* Spaltenbreiten je Tabelle (tab.spalten); ohne Angabe gleich breit, der Rest auf die letzte Spalte */
  const spaltenVon = x => {
    const n = x.kopf.length;
    if (Array.isArray(x.spalten) && x.spalten.length === n) return x.spalten;
    const w = Math.floor(B / n); return x.kopf.map((_, i) => (i === n - 1 ? B - w * (n - 1) : w));
  };
  /* Spalten in tab.ohneUmbruch (z. B. Labor-Nr.): geschützte Bindestriche, damit Word die Nummer nicht am Bindestrich umbricht */
  const ohneUmbruch = (text, o) => [new TextRun({ font: FONT, ...o, children: String(text).split('-').flatMap((x, i) => (i ? [new NoBreakHyphen(), x] : [x])).filter(x => x !== '') })];
  const zelle = (inhalt, w, kopf, fest, ausr) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: { top: duenn, bottom: duenn, left: duenn, right: duenn },
    shading: kopf ? { type: ShadingType.CLEAR, fill: 'EDEDED', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ spacing: { ...LINE1, after: 0 }, alignment: ausr === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT, children: fest && typeof inhalt === 'string' && inhalt.includes('-') ? ohneUmbruch(inhalt, { size: 20 })
      : runs(inhalt === '' || inhalt == null ? '–' : inhalt, { size: 20, bold: !!kopf }) })],
  });
  const kinder = [];
  m.abschnitte.forEach((a, ai) => {
    kinder.push(ueberschrift(a.titel, ai === 0));
    a.inhalt.forEach((x, xi) => {
      const nach = xi === a.inhalt.length - 1 && ai < m.abschnitte.length - 1 ? 0 : LEER;   // vor der nächsten Überschrift
      if (x.t === 'p') kinder.push(absatz(x.runs, nach));
      else if (x.t === 'h2') kinder.push(unterueberschrift(x.runs, nach));
      else if (x.t === 'fig') {
        const b = bilder.fotos && bilder.fotos[x.label];
        if (b) {
          const w = b.w >= b.h ? 10 : 6.5, h = w * b.h / b.w;
          kinder.push(new Paragraph({ children: [new ImageRun({ type: 'jpg', data: b.data, transformation: { width: cmPx(w), height: cmPx(h) },
            altText: { title: x.caption, description: x.caption, name: x.label } })], alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 } }));
        } else kinder.push(new Paragraph({ children: [t(`[Foto fehlt: ${x.datei}]`, { highlight: 'yellow' })], alignment: AlignmentType.CENTER, keepNext: true }));
        kinder.push(new Paragraph({ children: [t(x.caption, { italics: true, size: 22 })], alignment: AlignmentType.CENTER, spacing: { ...LINE15, after: nach } }));
      } else if (x.t === 'tab') {
        kinder.push(new Paragraph({ children: [t(x.caption, { italics: true, size: 22 })], keepNext: true, spacing: { ...LINE1, after: 120 } }));
        const sp = spaltenVon(x);
        kinder.push(new Table({ width: { size: B, type: WidthType.DXA }, columnWidths: sp,
          rows: [new TableRow({ tableHeader: true, children: x.kopf.map((k, i) => zelle(k, sp[i], true, false, (x.ausrichtung || [])[i])) }),
            ...x.zeilen.map(z => new TableRow({ cantSplit: true, children: z.map((c, i) => zelle(c, sp[i], false, (x.ohneUmbruch || []).includes(i), (x.ausrichtung || [])[i])) }))] }));
        kinder.push(new Paragraph({ children: [], spacing: { ...LINE1, after: nach } }));
      }
    });
  });

  /* Ort/Datum, Unterschriften, Anlagen */
  kinder.push(new Paragraph({ children: [t(m.ortDatum)], spacing: { ...LINE15, before: 240, after: 480 }, keepNext: true }));
  const SIG_H = 1.74;   // einheitliche Bildhöhe → Unterschriftslinien auf gleicher Höhe
  const sigZelle = u => {
    const b = u.kuerzel && bilder.sig && bilder.sig[u.kuerzel];
    const bild = b ? [new ImageRun({ type: 'png', data: b.data, transformation: { width: cmPx(Math.min(5, SIG_H * b.w / b.h)), height: cmPx(Math.min(5, SIG_H * b.w / b.h) * b.h / b.w) } })] : [];
    return new TableCell({ width: { size: B / 2, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.BOTTOM,
      margins: { left: 0, right: 0 },   // Unterschriftslinie und Text bündig mit dem Textrand
      children: [
        new Paragraph({ children: bild, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, indent: { right: 900 },
          spacing: b ? { ...LINE1, after: 60 } : { before: Math.round(SIG_H / 2.54 * 1440), after: 60 } }),
        einfach(runs(u.rolle, { size: 22 })), einfach(runs(u.name, { size: 22 })),
      ] });
  };
  const sig = m.unterschriften.map(sigZelle);
  if (sig.length === 1) sig.push(new TableCell({ width: { size: B / 2, type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [new Paragraph('')] }));
  kinder.push(new Table({ width: { size: B, type: WidthType.DXA }, columnWidths: [B / 2, B / 2],
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ cantSplit: true, children: sig })] }));
  /* Anlagen: „Anlage 1:“ ⇥ Prüfbericht Nr. …  ↵  (Labor) – Folgezeile bündig unter dem Text (hängender Einzug),
     jede Anlage bleibt zusammen, alle Anlagen bleiben beieinander */
  const ANL = 1276;                                 // 2,25 cm – reicht auch für „Anlage 10:“
  const anlagen = m.anlagenTeile || m.anlagen.map(a => ({ label: '', zeilen: [a] }));
  anlagen.forEach((a, i) => kinder.push(new Paragraph({
    children: [...(a.label ? [t(a.label), t('\t')] : []), ...runs(a.zeilen[0]),
      ...a.zeilen.slice(1).flatMap(z => [new TextRun({ font: FONT, break: 1 }), ...runs(z)])],
    tabStops: [{ type: TabStopType.LEFT, position: ANL }], indent: a.label ? { left: ANL, hanging: ANL } : undefined,
    keepLines: true, keepNext: i < anlagen.length - 1,
    spacing: { ...LINE1, before: i ? 0 : 960, after: i < anlagen.length - 1 ? 200 : 0 },
  })));

  const seite = top => ({ size: { width: 11906, height: 16838 }, margin: { top, right: 1418, bottom: 1134, left: 1418, header: 720, footer: 720 } });
  return new Document({
    creator: 'Dr. Schiffers & Partner · BerichtKit', title: `${d.titel} (${d.mitteilung}) ${d.projektnummer || ''}`.trim(),
    styles: { default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { after: 0 } } } } },
    sections: [
      { properties: { page: seite(2943), titlePage: true }, headers: { first: kopfDeckblatt, default: kopfFolge }, children: deckblatt },
      { properties: { type: SectionType.NEXT_PAGE, page: seite(3594) }, headers: { default: kopfFolge }, children: kinder },
    ],
  });
}

const API = { erstellen };
if (typeof module === 'object' && module.exports) module.exports = API;
root.BerichtDocx = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// Erzeugt Beispielberichte als .docx zum Ansehen (node tests/render-beispiele.cjs <Zielordner>) – nicht Teil der CI.
const fs = require('node:fs'), path = require('node:path');
const D = require('docx'), T = require('../bericht-text.js'), W = require('../bericht-docx.js'), B = require('./daten/beispiel.cjs');
const ziel = process.argv[2] || 'beispiele'; fs.mkdirSync(ziel, { recursive: true });
const bilder = { logoSvg: fs.readFileSync(path.join(__dirname, '../assets/logo-schiffers.svg')), logoPng: fs.readFileSync(path.join(__dirname, '../assets/logo-schiffers.png')), sig: {}, fotos: {} };
const foto = process.env.FOTO ? { data: fs.readFileSync(process.env.FOTO), w: 1600, h: 900 } : null;
const { faelle } = require('./daten/faelle.cjs');
(async () => { for (const [name, f] of Object.entries(faelle)) {
  const m0 = T.bericht({ ...f, cfg: B.cfg, mitarbeiter: B.mitarbeiter }), m = f.entwurf ? T.alsEntwurf(m0) : m0;
  const fotos = {}; if (foto) for (const p of m.proben) if (p.foto) fotos[p.label] = foto;
  const buf = await D.Packer.toBuffer(W.erstellen(D, m, { ...bilder, fotos }));
  fs.writeFileSync(path.join(ziel, name + '.docx'), buf); console.log(name, buf.length, 'Hinweise:', m.hinweise.length, 'Lücken:', m.luecken.join(' '));
} })();

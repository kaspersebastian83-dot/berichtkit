// Beispielberichte (erfundene Daten) für render-beispiele.cjs und den Golden-Test asbest-golden.cjs
const B = require('./beispiel.cjs');
const form = (o = {}) => ({ datum: '2026-10-27', mitteilung: 1, variante: 'eigen', probenehmer: 'Mes', sv: 'Tst', mt: 'Mes', ...o });
const faelle = {
  'A_positiv_eine_Probe': { pj: B.pj(), lk: B.lk([[1, '2026-10-16', 'Umkleide Schwimmbad', 'Fliesenkleber', 'Bituminöse Proben / Kleber']]), erg: B.erg([[1, 'chrysotil']]), form: form(), fotos: { P1: [{ datei: 'x.jpg' }] } },
  'B_gemischt_KMF': { pj: B.pj({ versicherungsnehmer: '' }), lk: B.lk([[1, '2026-10-08', 'Dach', 'Wellplatte', 'Faserzementprodukte (z.B. Eternit)'], [2, '2026-10-08', 'EG Flur', 'Putz', 'Putze / Spachtelmassen'], [3, '2026-10-09', 'Dachboden', 'Dämmstoff Mineralwolle', 'Sonstige']]), erg: B.erg([[1, 'chrysotil'], [2, 'kein'], [3, 'kmf']]), form: form({ einbau: 'vor1996' }), fotos: { P1: [{ datei: 'x.jpg' }], P3: [{ datei: 'y.jpg' }] } },
  'C_zugestellt_luecken': { pj: B.pj({ auftragsdatum: '' }), lk: B.lk([[1, '', 'Keller', 'Dachplatte', 'Faserzementprodukte (z.B. Eternit)']]), erg: B.erg([[1, 'kein']]), form: form({ variante: 'zugestellt', sv: '' }) },
  'D_ENTWURF_vorlaeufig': { pj: B.pj(), lk: B.lk([[1, '2026-10-16', 'Keller', 'Putz', 'Putze / Spachtelmassen'], [2, '2026-10-16', 'Dach', 'Wellplatte', 'Sonstige']]),
    erg: (e => { e.berichte[0].vorlaeufig = true; return e; })(B.erg([[1, 'chrysotil']])), form: form(), entwurf: true },
};
module.exports = { faelle, form };

// Beschreibungsvergleich gegen ResultKit (Audit 2026-11 Lauf 5, E4 #11): beschreibungKey und beschreibungWeichtAb in
// bericht-gemeinsam.js sind eine Kopie von ResultKit src/ergebnisse.ts. Gleiche Eingaben → gleiches Ergebnis. Vorher verglich
// BerichtKit nur gegen feste Werte (text.cjs). ResultKit daneben (../resultkit); in der CI Pflicht (RESULTKIT_PFLICHT=1), sonst SKIP.
// node tests/kopien-resultkit.mjs
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {createRequire,registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const rk=new URL('../../resultkit/src/ergebnisse.ts',import.meta.url);
if(!existsSync(fileURLToPath(rk))){
 assert.ok(process.env.RESULTKIT_PFLICHT!=='1',`${fileURLToPath(rk)} fehlt (RESULTKIT_PFLICHT=1)`);
 console.log('SKIP Beschreibungsvergleich: ../resultkit fehlt');process.exit(0);
}
const BK=createRequire(import.meta.url)('../bericht-gemeinsam.js'),RK=await import(rk.href);
const texte=['EG Küche, verrußt, Wand','EG Küche , verrußt , Wand','eg küche, verrußt, wand','EG  Küche,,verrußt','„EG“ Küche – Wand','"EG" Küche - Wand','EG Küche, verrußt, Wand, Tiefe: 0-2 cm',
 'OG Bad, verrußt, Wand','EG Küche, verrußt, Wand','',' ',null,undefined,'Bohrkern EG-WZ-B-7','EG Küche\tWand','EG Küche ‐ Wand','EG Küche −Wand','‚Bad‘ «Tür»','Keller, Putz','Keller,Putz, Tiefe: 2 cm'];
const arten=['','Asbest','Bohrkern','bohrkern Segment'];let n=0;
for(const a of texte){assert.equal(BK.beschreibungKey(a),RK.beschreibungKey(a),`beschreibungKey(${JSON.stringify(a)})`);
 for(const b of texte)for(const art of arten){assert.equal(BK.beschreibungWeichtAb(a,b,art),RK.beschreibungWeichtAb(a,b,art),`beschreibungWeichtAb(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${art})`);n++;}}
console.log(`OK Beschreibungsvergleich wie ResultKit (${n} Fälle)`);

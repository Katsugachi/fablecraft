// Smoke test for iteration 5 worldgen + common structures:
//   - Pale Garden biome (moss ground, eyeblossoms, pale oaks, creaking hearts, resin)
//   - ruined portals, pillager outposts, woodland mansions, igloos, buried treasure
//   - chest loot ents / mob ents emitted by the new structures
//   node tools/test-gen-263b.mjs
import { WorldGen, BIOME } from '../src/worldgen.js';
import { B } from '../src/blocks.js';

const seed = 20240229;
const gen = new WorldGen(seed);
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg); if (!cond) failures++; };

// java.util.Random 48-bit LCG (matches structures.js) for placement lookup
const R_MASK = (1n << 48n) - 1n, R_MULT = 25214903917n, R_INC = 11n;
class JRand {
  constructor(s) { this.setSeed(s); }
  setSeed(s) { const b = typeof s === 'bigint' ? s : BigInt(Math.trunc(s)); this.s = (b ^ R_MULT) & R_MASK; }
  next(bits) { this.s = (this.s * R_MULT + R_INC) & R_MASK; return Number(this.s >> BigInt(48 - bits)); }
  nextInt(bound) {
    let r = this.next(31), m = bound - 1;
    if ((bound & m) === 0) return Math.floor((bound * r) / 0x80000000);
    let u = r;
    for (;;) { r = u % bound; if (((u - r + m) | 0) >= 0) return r; u = this.next(31); }
  }
}
const homeChunk = (spacing, margin, salt, rx, rz) => {
  const r = new JRand(0);
  r.setSeed(BigInt(rx) * 341873128712n + BigInt(rz) * 132897987541n + BigInt(seed) + BigInt(salt));
  const b = spacing - 2 * margin;
  return [rx * spacing + margin + r.nextInt(b), rz * spacing + margin + r.nextInt(b)];
};
// find up to `n` home chunks in a world range that pass their biome gate
const findHomes = (spacing, margin, salt, biomes, range, n) => {
  const out = [];
  for (let rx = Math.floor(-range / spacing); rx <= Math.floor(range / spacing) && out.length < n; rx++)
    for (let rz = Math.floor(-range / spacing); rz <= Math.floor(range / spacing) && out.length < n; rz++) {
      const [cx, cz] = homeChunk(spacing, margin, salt, rx, rz);
      const b = gen.biomeAt(cx * 16, cz * 16);
      if (!biomes || biomes.has(b)) out.push([cx, cz]);
    }
  return out;
};
const sigIn9 = (cx, cz, ids) => {
  const total = {};
  const byType = {};
  let ents = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const { blocks, ents: ee } = gen.generate(cx + dx, cz + dz);
    for (const e of ee || []) { ents++; byType[e[0]] = (byType[e[0]] || 0) + 1; }
    for (let i = 0; i < blocks.length; i++) if (ids.includes(blocks[i])) total[blocks[i]] = (total[blocks[i]] || 0) + 1;
  }
  return { total, ents, byType };
};

// ---- 1. pale garden -----------------------------------------------------------
let pg = null;
outer:
for (let x = -8000; x <= 8000; x += 32) for (let z = -8000; z <= 8000; z += 32) {
  const h = gen.heightAt(x, z);
  if (gen.oBiome === BIOME.PALE_GARDEN && h >= 40) { pg = [x, z, h]; break outer; }
}
ok(!!pg, 'pale garden column found' + (pg ? ` at ${pg}` : ''));
if (pg) {
  const px = Math.floor(pg[0] / 16), pz = Math.floor(pg[1] / 16);
  const counts = {};
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const { blocks } = gen.generate(px + dx, pz + dz);
    for (let i = 0; i < blocks.length; i++) if (blocks[i]) counts[blocks[i]] = (counts[blocks[i]] || 0) + 1;
  }
  const show = (id, name) => console.log(`    ${name}: ${counts[id] || 0}`);
  show(B.PALE_MOSS_BLOCK, 'pale_moss_block'); show(B.EYEBLOSSOM, 'eyeblossom'); show(B.PALE_MOSS_CARPET, 'pale_moss_carpet');
  show(B.PALE_OAK_LOG, 'pale_oak_log'); show(B.CREAKING_HEART, 'creaking_heart'); show(B.RESIN_CLUMP, 'resin_clump');
  ok(counts[B.PALE_MOSS_BLOCK] > 0, 'pale moss ground present');
  ok(counts[B.PALE_OAK_LOG] > 0, 'pale oak trunks present');
  ok(counts[B.CREAKING_HEART] > 0, 'creaking hearts present in pale oaks');
}

// ---- 2. the five common structures --------------------------------------------
const R = 1500;
const cold = new Set([5, 7, 6, 11]);
const snowy = new Set([6, 7, 11]);

const portals = findHomes(32, 4, 441186252, null, R, 8);
const outposts = findHomes(25, 3, 34326452, new Set([2, 3, 4, 5, 7, 8, 9, 13]), R, 5);
const mansions = findHomes(52, 10, 33947651, cold, R, 5);
const igloos = findHomes(40, 5, 19377411, snowy, R, 5);
const treasures = findHomes(40, 1, 51233019, null, R, 8);
console.log('home chunks found: portals', portals.length, 'outposts', outposts.length,
  'mansions', mansions.length, 'igloos', igloos.length, 'treasures', treasures.length);

let portalOK = false, outpostOK = false, mansionOK = false, iglooOK = false, treasureOK = false;
let chestEnts = 0, witchEnts = 0, wolfEnts = 0, snowGolemEnts = 0;
const add = (byType) => {
  chestEnts += byType[13] || 0;
  witchEnts += byType[12] || 0;
  wolfEnts += byType[10] || 0;
  snowGolemEnts += byType[11] || 0;
};
for (const [cx, cz] of portals) {
  const { total, byType } = sigIn9(cx, cz, [B.OBSIDIAN, B.CRYING_OBSIDIAN, B.NETHERRACK, B.CHEST]);
  add(byType);
  const ring = (total[B.OBSIDIAN] || 0) + (total[B.CRYING_OBSIDIAN] || 0);
  if (ring >= 11 && (total[B.NETHERRACK] || 0) >= 8) { portalOK = true; console.log('  portal @', cx, cz, 'ring', ring, 'netherrack', total[B.NETHERRACK] || 0); }
}
for (const [cx, cz] of outposts) {
  const { total, byType } = sigIn9(cx, cz, [B.DARK_OAK_LOG, B.BANNER, B.IRON_BARS, B.CHEST]);
  add(byType);
  if ((total[B.BANNER] || 0) >= 8 && (total[B.IRON_BARS] || 0) >= 56) { outpostOK = true; console.log('  outpost @', cx, cz, 'banners', total[B.BANNER], 'bars', total[B.IRON_BARS] || 0); }
}
for (const [cx, cz] of mansions) {
  const { total, byType } = sigIn9(cx, cz, [B.PURPUR_BLOCK, B.SPRUCE_LOG, B.SPRUCE_STAIRS, B.CHEST]);
  add(byType);
  if ((total[B.PURPUR_BLOCK] || 0) >= 1500 && byType[12] === 2) {
    mansionOK = true;
    console.log('  mansion @', cx, cz, 'purpur', total[B.PURPUR_BLOCK], 'witches', byType[12] || 0);
  }
}
for (const [cx, cz] of igloos) {
  const { total, byType } = sigIn9(cx, cz, [B.SNOW_BLOCK, B.CAULDRON, B.BED, B.CHEST]);
  add(byType);
  if (((total[B.CAULDRON] || 0) > 0 || (total[B.BED] || 0) > 0) && byType[10] === 1 && byType[11] === 1) {
    iglooOK = true;
    console.log('  igloo @', cx, cz, 'bed', total[B.BED] || 0, 'wolf 1, snowgolem 1');
  }
}
for (const [cx, cz] of treasures) {
  const { byType } = sigIn9(cx, cz, [B.CHEST]);
  add(byType);
  let buried = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const { blocks } = gen.generate(cx + dx, cz + dz);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 25; y++)
      if (blocks[(lx << 11) | (lz << 7) | y] === B.CHEST) buried++;
  }
  if (buried === 3) { treasureOK = true; console.log('  treasure @', cx, cz, 'buried chests 3'); }
}

ok(portalOK, 'ruined portals generate');
ok(outpostOK, 'pillager outposts generate');
ok(mansionOK, 'woodland mansions generate');
ok(iglooOK, 'igloos generate');
ok(treasureOK, 'buried treasure generates');
ok(chestEnts > 0, `chest loot ents emitted (total ${chestEnts})`);
ok(witchEnts > 0, `mansion witches emitted (${witchEnts})`);
ok(wolfEnts > 0 && snowGolemEnts > 0, `igloo companions emitted (wolf ${wolfEnts}, snow golem ${snowGolemEnts})`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL GEN CHECKS PASSED');
process.exit(failures ? 1 : 0);

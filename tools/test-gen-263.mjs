// Smoke test for iteration 3 worldgen: dappled forest biome, poplars, camps.
//   node tools/test-gen-263.mjs
import { WorldGen, BIOME } from '../src/worldgen.js';
import { B } from '../src/blocks.js';

const seed = 20240229;
const gen = new WorldGen(seed);

// ---- 1. find a dappled forest column -----------------------------------------
let df = null;
outer:
for (let x = -8000; x <= 8000; x += 64) {
  for (let z = -8000; z <= 8000; z += 64) {
    const h = gen.heightAt(x, z);
    if (gen.oBiome === BIOME.DAPPLED_FOREST && h >= 40) { df = [x, z, h]; break outer; }
  }
}
if (!df) { console.error('FAIL: no dappled forest column found in scan range'); process.exit(1); }
console.log('dappled forest at', df, 'temp', gen.oTemp.toFixed(2), 'humid', (gen.column(df[0], df[1]), gen.oTemp));

// ---- 2. generate the chunk there, count new blocks ----------------------------
const cx = Math.floor(df[0] / 16), cz = Math.floor(df[1] / 16);
const { blocks, meta } = gen.generate(cx, cz);
const counts = {};
const bump = (i) => { counts[i] = (counts[i] || 0) + 1; };
for (let i = 0; i < blocks.length; i++) if (blocks[i]) bump(blocks[i]);
const show = (id, name) => console.log(`  ${name}: ${counts[id] || 0}`);
console.log('chunk', cx, cz, 'blocks:');
show(256, 'poplar_log'); show(270, 'red_poplar_leaves'); show(271, 'orange_poplar_leaves');
show(272, 'yellow_poplar_leaves'); show(273, 'leaf_litter'); show(274, 'red_shrub');
show(275, 'shelf_mushroom'); show(276, 'big_shelf_mushroom'); show(55, 'spruce_leaves'); show(57, 'spruce_log');

// ---- 3. find an abandoned camp near a camp-allowed start chunk ----------------
import('../src/structures.js').then(({ stampCamps }) => {
  // replicate camp placement scan
  const CAMP_BIOMES = new Set([2, 3, 4, 5, 7, 9, 10, 11, 13, 14]);
  const SPACING = 34, SALT = 91231127;
  // re-derive start chunks the same way structures.js does
  const R_MASK = (1n << 48n) - 1n, R_MULT = 25214903917n, R_INC = 11n;
  class JRand {
    constructor() { this.s = 0n; }
    setSeed(seed) { const b = typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed)); this.s = (b ^ R_MULT) & R_MASK; }
    next(bits) { this.s = (this.s * R_MULT + R_INC) & R_MASK; return Number(this.s >> BigInt(48 - bits)); }
    nextInt(bound) {
      let r = this.next(31), m = bound - 1;
      if ((bound & m) === 0) return Math.floor((bound * r) / 0x80000000);
      let u = r;
      for (;;) { r = u % bound; if (((u - r + m) | 0) >= 0) return r; u = this.next(31); }
    }
  }
  const startChunk = (ccx, ccz) => {
    const rx = Math.floor(ccx / SPACING), rz = Math.floor(ccz / SPACING);
    const r = new JRand();
    r.setSeed(BigInt(rx) * 341873128712n + BigInt(rz) * 132897987541n + BigInt(seed) + BigInt(SALT));
    const b = SPACING - 8;
    return [rx * SPACING + r.nextInt(b), rz * SPACING + r.nextInt(b)];
  };
  let camp = null;
  for (let rx = -40; rx <= 40 && !camp; rx++) for (let rz = -40; rz <= 40 && !camp; rz++) {
    const [scx, scz] = startChunk(rx * SPACING, rz * SPACING);
    const h = gen.heightAt(scx << 4, scz << 4);
    if (!CAMP_BIOMES.has(gen.oBiome)) continue;
    if (h < 40) continue;
    camp = [scx, scz, gen.oBiome];
  }
  if (!camp) { console.error('FAIL: no camp start chunk found'); process.exit(1); }
  console.log('camp start chunk', camp[0], camp[1], 'biome', camp[2]);
  const gen2 = new WorldGen(seed); // fresh (camp/village caches are per-module, heights deterministic)
  const out = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const ccx = camp[0] + dx, ccz = camp[1] + dz;
    const r = gen2.generate(ccx, ccz);
    out.push(r);
    const c = {};
    for (let i = 0; i < r.blocks.length; i++) if (r.blocks[i]) c[r.blocks[i]] = (c[r.blocks[i]] || 0) + 1;
    if (dx === 0 && dz === 0) {
      console.log('camp chunk counts:');
      for (const [id, name] of [[283, 'wool_stairs'], [117, 'campfire'], [34, 'chest'], [142, 'barrel'], [255, 'cobweb'], [277, 'cushion'], [278, 'straw_bed'], [282, 'copper_chest_oxidized'], [123, 'dirt_path']]) {
        console.log(`  ${name}: ${c[id] || 0}`);
      }
      const hasWool = (c[283] || 0) > 0, hasFire = (c[117] || 0) > 0;
      if (!hasWool || !hasFire) { console.error('FAIL: camp missing tent wool stairs or campfire'); process.exit(1); }
    }
  }
  console.log('PASS: dappled forest + camps generate');
  process.exit(0);
});

// Convert vanilla 1.21.5 village data (structure NBTs + template pools +
// processor lists + structure sets + biome tags) into a compact
// src/structure_data.js consumed by the in-game jigsaw generator (src/structures.js).
//
//   node tools/templates.mjs
//
// Output format (all JSON-emitted, base64 for binary):
//   VILLAGES[vt] = {
//     d:  start depth, sp: startPoolIdx, md: maxDistanceFromCenter,
//     bi: [biome names],
//     p:  [[fallbackPoolIdx | -1, [[weight, tplIdx, procIdx, projection], ...]], ...],
//     pr: [null | [[type, inVnameIdx, prob, outVnameIdx], ...]],  // type 0=random 1=match
//     t:  [[w,h,d, cellsB64, jigs, ents, palStart, palLen], ...],
//   }
//   PAL  = base64 u32[] : (blockId << 24) | (meta << 16) | vnameIdx   (global, deduped)
//   template pal = u16[] of indices into PAL (base64 per template? no: one buffer)
//   cells = base64 u8[], index = x + z*w + y*w*d, value = palette index
//   jigs[k] = [x,y,z,dir,rot,poolI,nameI,targetI,joint, finalBlockIdx(u16 into PAL)]
//     dir: 0=S(+Z) 1=W(-X) 2=N(-Z) 3=E(+X) 4=up 5=down ; rot: CW 90°, 0=N
//   ents[k] = [x,y,z,entIdx, extra] ; extra(villager) = profIdx | baby<<4
//   VNAMES: interned vanilla block names (processor matching key)

import fs from 'node:fs';
import path from 'node:path';
import { readNBT } from './nbt.mjs';

const PACK = '/home/user/src-assets/vanilla';
const DATA = path.join(PACK, 'data/minecraft');
const OUT = path.join(process.cwd(), 'src/structure_data.js');
const VILLAGES = ['plains', 'taiga', 'desert', 'savanna', 'snowy'];
const JDIR = { north: 2, south: 0, west: 1, east: 3, up: 4, down: 5 };
const JROT = { north: 0, east: 1, south: 2, west: 3 };
// RLE: pairs of [run(1..255), value] encoded as bytes
function rleB64(buf) {
  const out = [];
  for (let i = 0; i < buf.length; ) {
    let run = 1;
    while (i + run < buf.length && buf[i + run] === buf[i] && run < 255) run++;
    out.push(run, buf[i]);
    i += run;
  }
  return Buffer.from(new Uint8Array(out).buffer).toString('base64');
}

// block id map from fablecraft (B keys are UPPERCASE; normalize to lowercase)
const B = {};
{
  const m = await import('../src/blocks.js');
  for (const [k, v] of Object.entries(m.B)) B[k.toLowerCase()] = v;
}

// ---------------------------------------------------------------------------
// vanilla block state -> fablecraft (blockKey, meta)
// fablecraft facing: 0=+Z(south) 1=-X(west) 2=-Z(north) 3=+X(east)
const F = { north: 2, south: 0, west: 1, east: 3 };
const WOOL = { white: 0, orange: 1, magenta: 2, light_blue: 3, yellow: 4, lime: 5, pink: 6, gray: 7,
  light_gray: 8, cyan: 9, purple: 10, blue: 11, brown: 12, green: 13, red: 14, black: 15 };

const slabMeta = (p) => (p.type && p.type !== 'bottom') ? 1 : 0;
const stairMeta = (p) => (p.facing != null ? F[p.facing] : 0) | (p.half === 'top' ? 4 : 0);
const axisMeta = (p) => (p.axis === 'x' ? 1 : p.axis === 'z' ? 2 : 0);
const face = (p) => (p.facing != null ? F[p.facing] : 0);
const lit = (p) => (p.lit ? 8 : 0);
const paneMeta = (color) => (p) => (color << 4)
  | ((p.north ? 1 : 0) << 4) | ((p.east ? 1 : 0) << 5) | ((p.south ? 1 : 0) << 6) | ((p.west ? 1 : 0) << 7);

const SIMPLE = {
  air: ['air', 0], cave_air: ['air', 0],
  grass_block: ['grass', 0], dirt: ['dirt', 0], cobblestone: ['cobblestone', 0],
  mossy_cobblestone: ['mossy_cobblestone', 0],
  oak_planks: ['planks', 0], spruce_planks: ['spruce_planks', 0], acacia_planks: ['acacia_planks', 0],
  sand: ['sand', 0], gravel: ['gravel', 0], clay: ['clay', 0],
  granite: ['granite', 0], diorite: ['diorite', 0],
  smooth_stone: ['smooth_stone', 0], stone_bricks: ['stone_bricks', 0], bricks: ['bricks', 0],
  sandstone: ['sandstone', 0],
  water: ['water', 0], lava: ['lava', 0],
  short_grass: ['tall_grass', 0], tall_grass: ['tall_grass', 0], fern: ['tall_grass', 0], large_fern: ['tall_grass', 0],
  dead_bush: ['dead_bush', 0], dandelion: ['dandelion', 0], poppy: ['poppy', 0], oxeye_daisy: ['daisy', 0],
  torch: ['torch', 0], wall_torch: ['torch', (p) => face(p) + 1], structure_void: ['air', 0],
  bookshelf: ['bookshelf', 0], chest: ['chest', face], crafting_table: ['crafting_table', 0],
  farmland: ['farmland', 0], ladder: ['ladder', face],
  snow: ['snow_layer', 0], snow_block: ['snow_block', 0],
  cactus: ['cactus', 0], pumpkin: ['pumpkin', face],
  oak_log: ['log', axisMeta], spruce_log: ['spruce_log', axisMeta],
  stripped_oak_log: ['stripped_oak_log', axisMeta], stripped_spruce_log: ['stripped_spruce_log', axisMeta],
  stripped_acacia_log: ['stripped_acacia_log', axisMeta],
  oak_wood: ['oak_wood', axisMeta], spruce_wood: ['spruce_wood', axisMeta],
  stripped_oak_wood: ['stripped_oak_wood', axisMeta], stripped_spruce_wood: ['stripped_spruce_wood', axisMeta],
  acacia_log: ['acacia_log', axisMeta], acacia_wood: ['acacia_wood', axisMeta],
  oak_leaves: ['leaves', 0], spruce_leaves: ['spruce_leaves', 0], acacia_leaves: ['acacia_leaves', 0],
  oak_sapling: ['sapling', 0], spruce_sapling: ['spruce_sapling', 0], acacia_sapling: ['acacia_sapling', 0],
  oak_slab: ['oak_slab', slabMeta], cobblestone_slab: ['cobblestone_slab', slabMeta],
  smooth_stone_slab: ['stone_slab', slabMeta], sandstone_slab: ['sandstone_slab', slabMeta],
  spruce_slab: ['spruce_slab', slabMeta], diorite_slab: ['diorite_slab', slabMeta],
  smooth_sandstone_slab: ['smooth_sandstone_slab', slabMeta],
  oak_stairs: ['oak_stairs', stairMeta], cobblestone_stairs: ['cobblestone_stairs', stairMeta],
  sandstone_stairs: ['sandstone_stairs', stairMeta], spruce_stairs: ['spruce_stairs', stairMeta],
  diorite_stairs: ['diorite_stairs', stairMeta], granite_stairs: ['granite_stairs', stairMeta],
  smooth_sandstone_stairs: ['smooth_sandstone_stairs', stairMeta],
  oak_fence: ['fence', 0], spruce_fence: ['spruce_fence', 0], acacia_fence: ['acacia_fence', 0], jungle_fence: ['jungle_fence', 0],
  cut_sandstone: ['cut_sandstone', 0], chiseled_sandstone: ['chiseled_sandstone', 0], smooth_sandstone: ['smooth_sandstone', 0],
  cobblestone_wall: ['cobblestone_wall', 0], diorite_wall: ['diorite_wall', 0],
  granite_wall: ['granite_wall', 0], sandstone_wall: ['sandstone_wall', 0],
  glass_pane: ['glass_pane', 0], orange_stained_glass_pane: ['stained_glass_pane_orange', 0],
  yellow_stained_glass_pane: ['stained_glass_pane_yellow', 0], white_stained_glass_pane: ['stained_glass_pane_white', 0],
  iron_bars: ['iron_bars', 0],
  terracotta: ['terracotta', 0],
  wheat: ['wheat', (p) => (p.stage ?? 0) & 7],
  melon_stem: ['melon_stem', (p) => (p.stage ?? 0) & 7], pumpkin_stem: ['pumpkin_stem', (p) => (p.stage ?? 0) & 7],
  melon: ['melon', 0],
  packed_ice: ['packed_ice', 0], blue_ice: ['blue_ice', 0],
  sea_pickle: ['sea_pickle', (p) => (p.level ?? 0) & 3],
  campfire: ['campfire', (p) => (p.lit === false ? 1 : 0)],
  lantern: ['lantern', 0], water_cauldron: ['cauldron', 1],
  dirt_path: ['dirt_path', 0],
  furnace: ['furnace', (p) => face(p) | lit(p)],
  smoker: ['smoker', (p) => face(p) | lit(p)],
  blast_furnace: ['blast_furnace', (p) => face(p) | lit(p)],
  barrel: ['barrel', (p) => face(p) | (p.open ? 4 : 0)],
  composter: ['composter', (p) => (p.state ?? 0) & 3],
  cartography_table: ['cartography_table', face], fletching_table: ['fletching_table', face],
  grindstone: ['grindstone', face], loom: ['loom', face],
  smithing_table: ['smithing_table', face], stonecutter: ['stonecutter', face],
  brewing_stand: ['brewing_stand', 0], bell: ['bell', 0], hay_block: ['hay_block', 0], lectern: ['lectern', 0],
  spruce_wall_sign: ['sign', face],
  brown_wall_banner: ['banner', (p) => face(p) | (12 << 2)],
  stone_button: ['stone_button', (p) => face(p) | (p.pressed ? 8 : 0)],
  potted_cactus: ['flower_pot', 0], potted_dandelion: ['flower_pot', 1],
  potted_dead_bush: ['flower_pot', 2], potted_poppy: ['flower_pot', 3],
  potted_spruce_sapling: ['flower_pot', 4],
};
for (const [c, i] of Object.entries(WOOL)) {
  SIMPLE[c + '_terracotta'] = ['terracotta_' + c, 0];
  SIMPLE[c + '_glazed_terracotta'] = ['glazed_terracotta_' + c, 0];
  SIMPLE[c + '_wool'] = ['wool' + i, 0];
  SIMPLE[c + '_carpet'] = ['carpet_' + c, 0];
  SIMPLE[c + '_bed'] = ['bed', (p) => (i << 3) | face(p) | (p.parts === 'head' ? 4 : 0)];
}
// existing fablecraft keys win; new woods get fresh keys
const DOORKEY = { oak: 'door', spruce: 'door_spruce', acacia: 'door_acacia', jungle: 'door_jungle' };
const SLABKEY = { oak: 'oak_slab', spruce: 'spruce_slab', acacia: 'slab_acacia', jungle: 'slab_jungle' };
const STAIRKEY = { oak: 'oak_stairs', spruce: 'spruce_stairs', acacia: 'stairs_acacia', jungle: 'stairs_jungle' };
for (const w of ['oak', 'spruce', 'acacia', 'jungle']) {
  SIMPLE[w + '_door'] = [DOORKEY[w], (p) => face(p) | (p.hinge === 'right' ? 4 : 0) | (p.half === 'upper' ? 8 : 0)];
  SIMPLE[w + '_trapdoor'] = ['trapdoor_' + w, (p) => face(p) | (p.opened ? 4 : 0) | (p.half === 'upper' ? 8 : 0)];
  SIMPLE[w + '_fence_gate'] = ['fence_gate_' + w, (p) => face(p) | (p.opened ? 4 : 0)];
  SIMPLE[w + '_pressure_plate'] = ['pressure_plate_' + w, (p) => (p.powered ? 1 : 0)];
  SIMPLE[w + '_slab'] = [SLABKEY[w], slabMeta];
  SIMPLE[w + '_stairs'] = [STAIRKEY[w], stairMeta];
  SIMPLE[w + '_button'] = ['button_' + w, (p) => face(p) | (p.pressed ? 8 : 0)];
}

// ---------------------------------------------------------------------------
// interns
const vnMap = new Map(); const vn = (s) => { let i = vnMap.get(s); if (i === undefined) { i = vnMap.size; vnMap.set(s, i); } return i; };
const poolMap = new Map(), nameMap = new Map(), tgtMap = new Map(), entMap = new Map(), profMap = new Map(), featMap = new Map();
const mi = (m, s) => { let i = m.get(s); if (i === undefined) { i = m.size; m.set(s, i); } return i; };

const palMap = new Map();           // u32 -> idx
const palBuf = [];                   // u32 values
const palIdxOf = (id, meta, v) => {
  const u = ((id & 0xff) << 24) | ((meta & 0xff) << 16) | (v & 0xffff);
  let i = palMap.get(u);
  if (i === undefined) { i = palBuf.length; palBuf.push(u); palMap.set(u, i); }
  return i;
};

const warnings = new Set();
const missingIds = new Set();
function fcId(key) {
  const m = key.match(/^wool(\d+)$/); // wool0..wool15 = white..black
  if (m) return 96 + parseInt(m[1], 10);
  const id = B[key];
  if (id === undefined) { missingIds.add(key); return 0; }
  return id;
}

const TAG_CACHE = new Map();
function blockTagNames(tag) {
  if (TAG_CACHE.has(tag)) return TAG_CACHE.get(tag);
  const f = path.join(DATA, 'tags/blocks', tag + '.json');
  let names = [];
  if (fs.existsSync(f)) names = JSON.parse(fs.readFileSync(f, 'utf8')).values.map((v) => v.replace(/^minecraft:/, ''));
  TAG_CACHE.set(tag, names);
  return names;
}

function parseFinal(s) {
  if (!s) return null;
  let name = s, props = {};
  const b = s.indexOf('[');
  if (b >= 0) {
    name = s.slice(0, b);
    for (const m of s.slice(b + 1, -1).matchAll(/(\w+)=("[^"]*"|[-\w.:]+)(?=,|$)/g)) props[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  name = name.replace(/^minecraft:/, '');
  const e = SIMPLE[name];
  if (!e) { warnings.add('jigsaw final unmapped: ' + name); return null; }
  const meta = typeof e[1] === 'function' ? e[1](props) : e[1];
  return { id: fcId(e[0]), meta, v: vn(name) };
}

// ---------------------------------------------------------------------------
// global shared state (pools/templates/processors dedupe across village types)
const results = {};
const st = {
  pools: [], procs: [null], tpls: [], tplCache: new Map(), procCache: new Map(), poolMap: new Map(),
};

const procIdx = (name) => {
  if (name === undefined || name === null) return 0;
  if (st.procCache.has(name)) return st.procCache.get(name);
  const f = path.join(DATA, 'worldgen/processor_list', name + '.json');
  if (!fs.existsSync(f)) { warnings.add('missing processor list ' + name); st.procCache.set(name, 0); return 0; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rules = [];
  for (const pr of j.processors || []) {
    if (pr.processor_type !== 'minecraft:rule') { warnings.add('skip proc type ' + pr.processor_type); continue; }
    for (const r of pr.rules || []) {
      const ip = r.input_predicate || {};
      const out = r.output_state || {};
      if (!out.Name) continue;
      const outV = vn(out.Name.replace(/^minecraft:/, ''));
      if (ip.predicate_type === 'minecraft:block_match' && ip.block) {
        rules.push([1, vn(ip.block.replace(/^minecraft:/, '')), 1, outV]);
      } else if (ip.predicate_type === 'minecraft:random_block_match' && ip.block) {
        rules.push([0, vn(ip.block.replace(/^minecraft:/, '')), ip.probability ?? 1, outV]);
      } else if (ip.predicate_type === 'minecraft:tag_match' && ip.tag) {
        for (const n of blockTagNames(ip.tag.replace(/^minecraft:/, ''))) rules.push([1, vn(n), 1, outV]);
      }
    }
  }
  const idx = st.procs.length;
  st.procs.push(rules.length ? rules : null);
  st.procCache.set(name, idx);
  return idx;
};

const tplIdx = (loc) => {
  if (st.tplCache.has(loc)) return st.tplCache.get(loc);
  const f = path.join(DATA, 'structure', loc + '.nbt');
  if (!fs.existsSync(f)) { warnings.add('missing template ' + loc); st.tplCache.set(loc, -1); return -1; }
  const root = readNBT(fs.readFileSync(f));
  const [w, h, d] = [...root.size];
  const pal = root.palette;
  const palOut = new Array(pal.length);
  const jigs = [];
  for (let i = 0; i < pal.length; i++) {
    const e = pal[i];
    const name = e.Name ? e.Name.replace(/^minecraft:/, '') : null;
    const props = e.Properties || {};
    let u;
    if (name === 'jigsaw') {
      u = palIdxOf(0, 0, vn('air'));
      jigs.push(i);
    } else {
      const e2 = SIMPLE[name];
      if (!e2) { warnings.add('unmapped block: ' + name); u = palIdxOf(0, 0, vn(name || 'air')); }
      else {
        const meta = typeof e2[1] === 'function' ? e2[1](props) : e2[1];
        u = palIdxOf(fcId(e2[0]), meta, vn(name));
      }
    }
    palOut[i] = u;
  }
  const cells = new Uint8Array(w * h * d);
  for (const b of root.blocks) {
    cells[b.pos[0] + b.pos[2] * w + b.pos[1] * w * d] = b.state;
    if (b.nbt && pal[b.state] && pal[b.state].Name === 'minecraft:jigsaw') {
      const [d0, r0] = pal[b.state].Properties.orientation.split('_');
      const fin = parseFinal(b.nbt.final_state);
      const fi = fin ? palIdxOf(fin.id, fin.meta, fin.v) : palIdxOf(0, 0, vn('air'));
      palOut[b.state] = fi;
      jigs.push([b.pos[0], b.pos[1], b.pos[2], JDIR[d0], JROT[r0],
        mi(poolMap, b.nbt.pool || 'minecraft:empty'),
        mi(nameMap, b.nbt.name || 'minecraft:empty'),
        mi(tgtMap, b.nbt.target || 'minecraft:empty'),
        b.nbt.joint === 'aligned' ? 1 : 0, fi]);
    }
  }
  const ents = [];
  for (const e of root.entities || []) {
    const n = e.nbt || {};
    const P = n.Pos || [0, 0, 0];
    const id = (n.id || '').replace(/^minecraft:/, '');
    if (!id) continue;
    const rx = +(P[0] - Math.floor(P[0])).toFixed(3);
    const ry = +(P[1] - Math.floor(P[1])).toFixed(3);
    const rz = +(P[2] - Math.floor(P[2])).toFixed(3);
    if (id === 'villager' || id === 'zombie_villager') {
      const prof = (n.VillagerData ? n.VillagerData.profession : 'nitwit').replace(/^minecraft:/, '');
      ents.push([rx, ry, rz, mi(entMap, id), mi(profMap, prof) | (n.Age ? 16 : 0)]);
    } else {
      ents.push([rx, ry, rz, mi(entMap, id), 0]);
    }
  }
  st.tpls.push([w, h, d, rleB64(cells), jigs.filter((x) => Array.isArray(x)),
    ents, Buffer.from(new Uint16Array(palOut).buffer).toString('base64')]);
  st.tplCache.set(loc, st.tpls.length - 1);
  return st.tpls.length - 1;
};

const poolIdx = (pname, seen) => {
  pname = pname.replace(/^minecraft:/, '');
  const seen2 = seen || new Set();
  const got = st.poolMap.get(pname);
  if (got !== undefined) return got;
  if (pname === 'empty' || pname === 'minecraft:empty') {
    st.pools.push([-1, []]);
    st.poolMap.set(pname, st.pools.length - 1);
    return st.pools.length - 1;
  }
  if (seen2.has(pname)) throw new Error('pool cycle ' + pname);
  seen2.add(pname);
  const pf = path.join(DATA, 'worldgen/template_pool', pname.split('/').join(path.sep) + '.json');
  if (!fs.existsSync(pf)) { warnings.add('missing pool ' + pname); st.pools.push([-1, []]); st.poolMap.set(pname, st.pools.length - 1); return st.pools.length - 1; }
  const j = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const idx = st.pools.length;
  st.poolMap.set(pname, idx);
    st.pools.push([null, []]);
    for (const el of j.elements || []) {
      const e = el.element || {};
      const pi = (typeof e.processors === 'string') ? procIdx(e.processors.replace(/^minecraft:/, '')) : 0;
      const proj = e.projection === 'terrain_matching' ? 1 : 0;
      let tpl = -1, feat = -1;
      if (e.element_type === 'minecraft:feature_pool_element') {
        feat = mi(featMap, (e.feature || '').replace(/^minecraft:/, ''));
      } else if (e.element_type !== 'minecraft:empty_pool_element' && e.location) {
        tpl = tplIdx(e.location.replace(/^minecraft:/, ''));
      }
      st.pools[idx][1].push([el.weight ?? 1, tpl, pi, proj, feat]);
    }
  const fb = j.fallback ? j.fallback.replace(/^minecraft:/, '') : 'empty';
  st.pools[idx][0] = (fb === 'empty') ? -1 : poolIdx(fb, seen2);
  return idx;
};

// 1.21.5: one structure set holds placement params; per-structure files hold jigsaw params
const set = JSON.parse(fs.readFileSync(path.join(DATA, 'worldgen/structure_set/villages.json'), 'utf8'));
const placement = { spacing: set.placement.spacing, separation: set.placement.separation, salt: set.placement.salt };
const weights = {};
for (const s of set.structures) weights[s.structure.replace(/^minecraft:/, '')] = s.weight;

for (const vt of VILLAGES) {
  const sfile = path.join(DATA, 'worldgen/structure', 'village_' + vt + '.json');
  const vs = JSON.parse(fs.readFileSync(sfile, 'utf8'));
  const depth = vs.size ?? 6;
  const maxDist = vs.max_distance_from_center ?? 80;
  const startPool = (vs.start_pool || '').replace(/^minecraft:/, '');
  let biomes = [];
  const bi = vs.biomes;
  if (typeof bi === 'string') {
    const tag = bi.replace(/^#minecraft:/, '');
    const tf = path.join(DATA, 'tags/worldgen/biome', tag + '.json');
    biomes = JSON.parse(fs.readFileSync(tf, 'utf8')).values.map((b) => b.replace(/^minecraft:/, ''));
  } else if (Array.isArray(bi)) {
    biomes = bi.map((b) => b.replace(/^minecraft:/, ''));
  }

  const sp = poolIdx(startPool);
  // follow jigsaw->pool references to a fixpoint (templates reference further pools)
  let grew;
  do {
    grew = false;
    for (const pname of [...poolMap.keys()]) {
      const bare = pname.replace(/^minecraft:/, '');
      if (!st.poolMap.has(bare)) { poolIdx(pname); grew = true; }
    }
  } while (grew);
  results[vt] = {
    d: depth, sp, md: maxDist, bi: biomes,
    proj: vs.project_start_to_heightmap === 'WORLD_SURFACE_WG' ? 1 : 0,
    adapt: vs.terrain_adaptation || 'beard_thin',
  };
  console.log(vt.padEnd(8), 'depth=' + depth, 'maxDist=' + maxDist, 'startPool=' + startPool, 'biomes=' + biomes.join(','), 'w=' + (weights['village_' + vt] ?? 1));
}
console.log('shared: pools=' + st.pools.length, 'procs=' + st.procs.length, 'tpls=' + st.tpls.length,
  'palEntries=' + palBuf.length);

// ---------------------------------------------------------------------------
// synthesize feature_pool_element content (patch_cactus, pile_hay) as tiny templates
const featTpl = {};
{
  const airU = palIdxOf(B.air ?? 0, 0, vn('air'));
  const cactU = palIdxOf(B.cactus ?? 0, 0, vn('cactus'));
  const hayU = palIdxOf(B.hay_block ?? 0, 0, vn('hay_block'));
  function mini(w, h, d, fill, localPal) {
    const cells = new Uint8Array(w * h * d);
    const wI = (x, y, z) => x + z * w + y * w * d;
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const v = fill(x, y, z);
      cells[wI(x, y, z)] = localPal.indexOf(v);
    }
    const pi = st.tpls.length;
    st.tpls.push([w, h, d, rleB64(cells), [], [], Buffer.from(new Uint16Array(localPal).buffer).toString('base64')]);
    return pi;
  }
  // cactus patch on a 5x5 surface, one cactus two blocks tall
  featTpl['patch_cactus'] = mini(5, 2, 5, (x, y, z) => ((x === 1 && z === 1) || (x === 3 && z === 2) || ((x === 2 && z === 4) && y < 2)) ? cactU : airU, [airU, cactU]);
  featTpl['pile_hay'] = mini(2, 1, 1, () => hayU, [hayU]);
  // swap feature elements -> synthetic templates
  const featNames = [...featMap.keys()];
  for (const p of st.pools) for (const el of p[1]) {
    if (el[4] >= 0) {
      const nm = featNames[el[4]];
      if (nm === 'patch_cactus') { el[1] = featTpl['patch_cactus']; el[3] = 1; } // terrain matching
      else if (nm === 'pile_hay') { el[1] = featTpl['pile_hay']; el[3] = 1; }
      else el[1] = -1;
    }
  }
}

// ---------------------------------------------------------------------------
// emit
{
  const J = (v) => JSON.stringify(v);
  const parts = [];
  for (const vt of VILLAGES) {
    const r = results[vt];
    if (!r) continue;
    parts.push(J(vt) + ': ' + J({ d: r.d, sp: r.sp, md: r.md, bi: r.bi, pr_: r.proj, ad: r.adapt }));
  }
  const js = `// GENERATED by tools/templates.mjs — do not edit.
// Vanilla 1.21.5 village jigsaw data for src/structures.js.
// VILLAGES[vt] = { d: depthRounds, sp: startPool, md: maxDist, bi: [biomes], pr_: projectToSurface, ad: terrainAdaptation }
// PLACEMENT = { spacing, separation, salt } (random_spread, from structure_set/villages.json)
// POOLS[i] = [fallbackPool | -1, [[weight, tpl, proc, projection, feat], ...]]
//   tpl: template idx | -1 (empty/terminator) ; feat: feature idx (ignored after synth)
// PROCS[i] = null | [[type, inVname, prob, outVname], ...]  type 0=random 1=match
// TPLS[i] = [w,h,d, cellsRLE, jigs, ents, palB64]
//   cells: RLE base64, pairs [run 1..255, paletteIdx]; decoded idx = x + z*w + y*w*d
//   pal: u16[] of global PAL indices (per-template base64)
// jigs[k] = [x,y,z,dir,rot,poolI,nameI,targetI,joint,finalPalIdx]
//   dir: 0=S(+Z) 1=W(-X) 2=N(-Z) 3=E(+X) 4=up 5=down ; rot: CW 90deg, 0=N
// ents[k] = [x,y,z,entI,extra] ; villager extra: profI | baby<<4
export const VILLAGES = {
${parts.join(',\n')}
};
export const POOLS = ${J(st.pools)};
export const PROCS = ${J(st.procs)};
export const TPLS = ${J(st.tpls)};
export const PLACEMENT = ${J(placement)};
export const VNAMES = ${J([...vnMap.keys()])};
export const GPOOLS = ${J([...poolMap.keys()])};
export const GNAMES = ${J([...nameMap.keys()])};
export const GTARGETS = ${J([...tgtMap.keys()])};
export const GENTS = ${J([...entMap.keys()])};
export const GPROFS = ${J([...profMap.keys()])};
export const PAL = ${J(Buffer.from(new Uint32Array(palBuf).buffer).toString('base64'))};
export const PAL_KEYS = ${J(palBuf.map((u) => ((u >>> 24) & 0xff) + '|' + ((u >>> 16) & 0xff) + '|' + (u & 0xffff)))};
`;
  fs.writeFileSync(OUT, js);
  console.log('\nwrote', OUT, (js.length / 1024).toFixed(1), 'KB');
  console.log('palette entries:', palBuf.length, 'unique; vn:', vnMap.size);
  if (missingIds.size) console.log('MISSING fablecraft ids:', [...missingIds].join(', '));
  if (warnings.size) { console.log('WARNINGS:'); for (const w of warnings) console.log('  ' + w); }
}

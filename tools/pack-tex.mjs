// Convert real vanilla 16x16 PNGs (src-assets/vanilla) into fablecraft's
// [ARGB palette, base64 index] texture entries -> src/textures_real.js.
// Textures absent from the pack are derived with vanilla's own pixel rules
// (walls = base with bottom row transparent; fences = planks with 2px margin;
// carpets = flat wool colour; slabs = planks with dark top edge; ...).
//   node tools/pack-tex.mjs
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const BLOCK = '/home/user/src-assets/vanilla/assets/minecraft/textures/block/';
const OUT = path.join(process.cwd(), 'src/textures_real.js');

// ---- pixel ops ---------------------------------------------------------------
function empty() { return { w: 16, h: 16, data: new Uint8Array(16 * 16 * 4) }; }
function setP(im, x, y, r, g, b, a) {
  const o = (y * 16 + x) * 4;
  im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = a;
}
function copy(im) { return { w: 16, h: 16, data: Uint8Array.from(im.data) }; }
// clear (transparent) rows/cols
function clearEdge(im, top, bottom, left, right) {
  const clr = (x, y) => { const o = (y * 16 + x) * 4 + 3; im.data[o] = 0; };
  for (let y = 0; y < top; y++) for (let x = 0; x < 16; x++) clr(x, y);
  for (let y = 16 - bottom; y < 16; y++) for (let x = 0; x < 16; x++) clr(x, y);
  for (let x = 0; x < left; x++) for (let y = top; y < 16 - bottom; y++) clr(x, y);
  for (let x = 16 - right; x < 16; x++) for (let y = top; y < 16 - bottom; y++) clr(x, y);
}
function darkenRow(im, y, f) {
  for (let x = 0; x < 16; x++) {
    const o = (y * 16 + x) * 4;
    im.data[o] = (im.data[o] * f) | 0; im.data[o + 1] = (im.data[o + 1] * f) | 0; im.data[o + 2] = (im.data[o + 2] * f) | 0;
  }
}
function flatFill(hex) {
  const im = empty();
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  for (let i = 0; i < 256; i++) setP(im, i % 16, (i / 16) | 0, r, g, b, 255);
  return im;
}
// ---- vanilla derivation rules --------------------------------------------------
function wallFrom(base) { const im = copy(base); clearEdge(im, 0, 1, 0, 0); return im; }
function fenceFrom(planks) { const im = copy(planks); clearEdge(im, 2, 0, 2, 2); return im; }
function slabSideFrom(planks) { const im = copy(planks); darkenRow(im, 0, 0.72); return im; }
function plateFrom(planks) {
  const im = copy(planks);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x >= 4 && x < 12 && y >= 5 && y < 11) continue;
    const o = (y * 16 + x) * 4 + 3; im.data[o] = 0;
  }
  return im;
}
function buttonFrom(hex) {
  const im = empty();
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) {
    if ((x === 5 || x === 10 || y === 5) && (y === 10 || x === 10)) continue; // rounded corners
    const dark = y === 10 ? 0.75 : 1;
    setP(im, x, y, r * dark | 0, g * dark | 0, b * dark | 0, 255);
  }
  return im;
}
function paneFrom(hex, alpha) {
  const im = empty();
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const put = (x, y, a) => setP(im, x, y, r, g, b, a);
  for (let i = 0; i < 16; i++) {
    put(i, 0, alpha); put(i, 1, alpha >> 1);
    put(i, 15, alpha); put(i, 14, alpha >> 1);
    put(0, i, alpha); put(1, i, alpha >> 1);
    put(15, i, alpha); put(14, i, alpha >> 1);
  }
  // sparkles
  put(4, 4, 200); put(5, 4, 200); put(11, 9, 160); put(11, 10, 160);
  return im;
}
function signFrom(hex) {
  const im = empty();
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  for (let y = 3; y < 13; y++) for (let x = 1; x < 15; x++) {
    const edge = y === 3 || y === 12 || x === 1 || x === 14;
    const f = edge ? 0.6 : 1;
    setP(im, x, y, r * f | 0, g * f | 0, b * f | 0, 255);
  }
  return im;
}
function bannerFrom() {
  const im = empty();
  for (let y = 1; y < 15; y++) for (let x = 3; x < 13; x++) {
    const edge = y === 1 || y === 14 || x === 3 || x === 12;
    const notch = y === 14 && x === 7 && x < 9;
    if (notch) continue;
    if (edge) setP(im, x, y, 120, 90, 50, 255);
    else setP(im, x, y, 235, 232, 224, 255);
  }
  return im;
}

// ---- texture registry ----------------------------------------------------------
// real = { name: png file }; derive = { name: fn }
const real = {};
const add = (name, file) => { real[name] = file; };

// wood families (files that exist in the pack)
for (const [fc, v] of [['acacia', 'acacia'], ['jungle', 'jungle'], ['spruce', 'spruce'], ['oak', 'oak']]) {
  add(fc + '_log', `${v}_log.png`);
  add(fc + '_log_top', `${v}_log_top.png`);
  add(fc + '_planks', `${v}_planks.png`);
  add(fc + '_leaves', `${v}_leaves.png`);
  add(fc + '_sapling', `${v}_sapling.png`);
  add(fc + '_door_bottom', `${v}_door_bottom.png`);
  add(fc + '_door_top', `${v}_door_top.png`);
  add(fc + '_trapdoor', `${v}_trapdoor.png`);
}
for (const v of ['oak', 'spruce', 'acacia']) add('stripped_' + v + '_log', `stripped_${v}_log.png`);
for (const v of ['oak', 'spruce', 'acacia']) add('stripped_' + v + '_log_top', `stripped_${v}_log_top.png`);

// stone / sand
add('smooth_sandstone_base', 'sandstone_top.png');
add('cut_sandstone', 'cut_sandstone.png');
add('chiseled_sandstone', 'chiseled_sandstone.png');
add('cobblestone_base', 'cobblestone.png');
add('diorite_base', 'diorite.png');
add('granite_base', 'granite.png');
add('sandstone_base', 'sandstone.png');

// coloured terracotta / glazed (colour-first filenames in vanilla)
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
for (const c of COLORS) {
  add('terracotta_' + c, `${c}_terracotta.png`);
  add('glazed_terracotta_' + c, `${c}_glazed_terracotta.png`);
}
add('terracotta', 'terracotta.png');

// misc (files that exist in the pack)
const MISC = {
  packed_ice: 'packed_ice.png', blue_ice: 'blue_ice.png', sea_pickle: 'sea_pickle.png',
  campfire_log: 'campfire_log.png', campfire_log_lit: 'campfire_log_lit.png',
  lantern: 'lantern.png',
  cauldron_side: 'cauldron_side.png', cauldron_inner: 'cauldron_inner.png',
  cauldron_top: 'cauldron_top.png', cauldron_bottom: 'cauldron_bottom.png',
  melon_side: 'melon_side.png', melon_top: 'melon_top.png',
  melon_stem: 'melon_stem.png', pumpkin_stem: 'pumpkin_stem.png',
  dirt_path_side: 'dirt_path_side.png', dirt_path_top: 'dirt_path_top.png',
  hay_block_side: 'hay_block_side.png', hay_block_top: 'hay_block_top.png',
  bell_side: 'bell_side.png', bell_top: 'bell_top.png', bell_bottom: 'bell_bottom.png',
  barrel_side: 'barrel_side.png', barrel_top: 'barrel_top.png',
  barrel_bottom: 'barrel_bottom.png', barrel_top_open: 'barrel_top_open.png',
  brewing_stand: 'brewing_stand.png', brewing_stand_base: 'brewing_stand_base.png',
  blast_furnace_front: 'blast_furnace_front.png', blast_furnace_front_on: 'blast_furnace_front_on.png',
  blast_furnace_side: 'blast_furnace_side.png', blast_furnace_top: 'blast_furnace_top.png',
  cartography_table_top: 'cartography_table_top.png',
  cartography_table_side1: 'cartography_table_side1.png',
  cartography_table_side2: 'cartography_table_side2.png',
  cartography_table_side3: 'cartography_table_side3.png',
  composter_side: 'composter_side.png', composter_top: 'composter_top.png',
  composter_bottom: 'composter_bottom.png', composter_compost: 'composter_compost.png',
  composter_ready: 'composter_ready.png',
  fletching_table_front: 'fletching_table_front.png',
  fletching_table_side: 'fletching_table_side.png', fletching_table_top: 'fletching_table_top.png',
  grindstone_side: 'grindstone_side.png', grindstone_round: 'grindstone_round.png',
  loom_side: 'loom_side.png', loom_front: 'loom_front.png',
  loom_top: 'loom_top.png', loom_bottom: 'loom_bottom.png',
  smithing_table_front: 'smithing_table_front.png',
  smithing_table_side: 'smithing_table_side.png',
  smithing_table_top: 'smithing_table_top.png',
  smithing_table_bottom: 'smithing_table_bottom.png',
  smoker_front: 'smoker_front.png', smoker_front_on: 'smoker_front_on.png',
  smoker_side: 'smoker_side.png', smoker_top: 'smoker_top.png', smoker_bottom: 'smoker_bottom.png',
  stonecutter_side: 'stonecutter_side.png', stonecutter_front: 'stonecutter_saw.png',
  stonecutter_top: 'stonecutter_top.png', stonecutter_bottom: 'stonecutter_bottom.png',
  lectern_base: 'lectern_base.png', lectern_front: 'lectern_front.png',
  lectern_sides: 'lectern_sides.png', lectern_top: 'lectern_top.png',
  iron_bars: 'iron_bars.png',
  flower_pot: 'flower_pot.png',
};
for (const [k, v] of Object.entries(MISC)) add(k, v);

// ---- convert -------------------------------------------------------------------
function toEntry(im) {
  const pal = [], pmap = new Map(), idx = new Array(256).fill(0);
  for (let i = 0; i < 256; i++) {
    const o = i * 4;
    if (!im.data[o + 3]) continue;
    const c = ((im.data[o + 3] << 24) | (im.data[o] << 16) | (im.data[o + 1] << 8) | im.data[o + 2]) >>> 0;
    let p = pmap.get(c);
    if (p === undefined) { p = pal.length; pmap.set(c, p); pal.push(c); }
    idx[i] = p + 1;
  }
  return [pal, Buffer.from(idx).toString('base64')];
}

const cache = new Map();
const load = (file) => {
  if (!cache.has(file)) {
    const f = path.join(BLOCK, file);
    if (!fs.existsSync(f)) throw new Error('missing vanilla file ' + file);
    const png = PNG.sync.read(fs.readFileSync(f));
    if (png.width !== 16 || png.height % 16 !== 0) throw new Error(file + ' is ' + png.width + 'x' + png.height);
    cache.set(file, png);
  }
  return cache.get(file);
};

const out = {};
// 1) real files
for (const [name, file] of Object.entries(real)) out[name] = toEntry(load(file));

// 2) derivations (vanilla pixel rules)
const smoothSand = load('sandstone_top.png');
out['smooth_sandstone'] = toEntry(smoothSand);
out['smooth_sandstone_slab_side'] = toEntry(slabSideFrom(smoothSand));
out['cut_sandstone_slab_side'] = toEntry(slabSideFrom(load('cut_sandstone.png')));
out['cobblestone_wall'] = toEntry(wallFrom(load('cobblestone.png')));
out['diorite_wall'] = toEntry(wallFrom(load('diorite.png')));
out['granite_wall'] = toEntry(wallFrom(load('granite.png')));
out['sandstone_wall'] = toEntry(wallFrom(load('sandstone.png')));
for (const [fc, v] of [['oak', 'oak'], ['spruce', 'spruce'], ['acacia', 'acacia'], ['jungle', 'jungle']]) {
  const pl = load(`${v}_planks.png`);
  const fence = fenceFrom(pl);
  out[`${fc}_fence`] = toEntry(fence);
  out[`${fc}_fence_gate`] = toEntry(fence);
  out[`${fc}_slab_side`] = toEntry(slabSideFrom(pl));
  out[`${fc}_pressure_plate`] = toEntry(plateFrom(pl));
}
// wood (ring) sides = log top; stripped wood = stripped log top
for (const [fc, v] of [['oak', 'oak'], ['spruce', 'spruce'], ['acacia', 'acacia'], ['jungle', 'jungle']]) {
  out[`${fc}_wood`] = toEntry(load(`${v}_log_top.png`));
}
for (const v of ['oak', 'spruce', 'acacia']) out[`stripped_${v}_wood`] = toEntry(load(`stripped_${v}_log_top.png`));
// carpets: flat vanilla wool colours
const WOOL_RGB = [0xe9ecec, 0xf07613, 0xbd44b3, 0x3aafd9, 0xf8c627, 0x70b919, 0xed8dac, 0x3e4447,
  0x8e8e86, 0x158991, 0x792aac, 0x35399d, 0x724728, 0x546d1b, 0xa12722, 0x141519];
COLORS.forEach((c, i) => { out['carpet_' + c] = toEntry(flatFill(WOOL_RGB[i])); });
// glass panes (clear + stained; vanilla border+arms layout)
const PANE_C = { glass_pane: [0xcfe8f0, 150], orange_stained_glass_pane: [0xe0731f, 230], yellow_stained_glass_pane: [0xf0c030, 230], white_stained_glass_pane: [0xf5f5f5, 200] };
for (const [n, [hex, a]] of Object.entries(PANE_C)) out[n] = toEntry(paneFrom(hex, a));
// buttons (round stone/wood buttons on transparent)
out['button_stone'] = toEntry(buttonFrom(0x7f7f7f));
out['jungle_button'] = toEntry(buttonFrom(0x6b8f2d));
out['acacia_button'] = toEntry(buttonFrom(0xb8946d));
out['spruce_button'] = toEntry(buttonFrom(0x6b553f));
out['oak_button'] = toEntry(buttonFrom(0x9c7f5f));
// sign + banner
out['sign'] = toEntry(signFrom(0x6b553f));
out['banner'] = toEntry(bannerFrom());

const js = `// GENERATED by tools/pack-tex.mjs — do not edit.
// Real vanilla 1.21.5 textures (src-assets/vanilla) in fablecraft [ARGB palette, base64] format.
// A few textures missing from the pack are derived with vanilla's documented pixel rules
// (wall=floor-row-transparent, fence=planks-margin, carpet=flat wool colour, slab=dark top edge,
// pressure-plate=centre band, pane=border+arms).
export const REAL = ${JSON.stringify(out)};
`;
fs.writeFileSync(OUT, js);
console.log('wrote', OUT, (js.length / 1024).toFixed(1), 'KB,', Object.keys(out).length, 'textures');

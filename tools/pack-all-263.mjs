// Pack real Minecraft 26.3 (Wilderness Bound) vanilla textures into fablecraft.
//
// Source : /home/user/proof/assets263  (PixiGeko/Minecraft-default-assets, branch 26.3)
// Output : src/textures_extra.js  (export const EXTRA) — merged into DATA by src/textures.js.
//
// Covers everything the in-browser proof reported as missing:
//   * the full village/structure set (oak/spruce/acacia/jungle wood, terracotta,
//     glazed terracotta, carpets, panes, buttons, crops, cauldrons, workstations,
//     barrels, campfire logs, dirt path, cobwebs, ice, ...),
//   * the 26.3 wave (poplar family, dappled-forest plants, 16 concrete colours,
//     16 cushions, straw bed),
//   * item icons (16 dyes, melon slice/seeds, pumpkin seeds, beetroot seeds,
//     carrot, potato, baked potato, beetroot).
//
// Textures vanilla renders from a model transform (walls, fences, slabs, plates,
// buttons, panes, sign, banner, carpets) are derived with vanilla's pixel rules,
// the same way the 1.21.5 packer did — those files do not exist as PNGs.
//
// Palette encoding MUST stay R<<24 | G<<16 | B<<8 | A to match decodeImg() in
// src/textures.js (the old pack-tex.mjs used ARGB and was corrupted).
//
//   node tools/pack-all-263.mjs
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const T = '/home/user/proof/assets263/assets/minecraft/textures';
const BLOCK = path.join(T, 'block');
const ITEM = path.join(T, 'item');
const ENTITY = path.join(T, 'entity');
const OUT = path.join(process.cwd(), 'src/textures_extra.js');

// ---- pixel ops ---------------------------------------------------------------
function empty() { return { w: 16, h: 16, data: new Uint8Array(16 * 16 * 4) }; }
function setP(im, x, y, r, g, b, a) {
  const o = (y * 16 + x) * 4;
  im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = a;
}
function copy(im) { return { w: 16, h: 16, data: Uint8Array.from(im.data) }; }
function clearEdge(im, top, bottom, left, right) {
  const clr = (x, y) => { im.data[(y * 16 + x) * 4 + 3] = 0; };
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
// average colour of opaque pixels (used for buttons/signs that vanilla
// renders in the planks colour)
function avgHex(im) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < im.data.length; i += 4) {
    if (im.data[i + 3] === 0) continue;
    r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; n++;
  }
  if (!n) return 0x808080;
  return (((r / n) | 0) << 16) | (((g / n) | 0) << 8) | ((b / n) | 0);
}

// ---- vanilla derivation rules --------------------------------------------------
function wallFrom(base) { const im = copy(base); clearEdge(im, 0, 1, 0, 0); return im; }
function fenceFrom(planks) { const im = copy(planks); clearEdge(im, 2, 0, 2, 2); return im; }
function slabSideFrom(planks) { const im = copy(planks); darkenRow(im, 0, 0.72); return im; }
function plateFrom(planks) {
  const im = copy(planks);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x >= 4 && x < 12 && y >= 5 && y < 11) continue;
    im.data[(y * 16 + x) * 4 + 3] = 0;
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

// ---- convert -------------------------------------------------------------------
// fablecraft palette order: R<<24 | G<<16 | B<<8 | A  (see decodeImg in textures.js)
function toEntry(im) {
  const pal = [], pmap = new Map(), idx = new Array(256).fill(0);
  for (let i = 0; i < 256; i++) {
    const o = i * 4;
    if (!im.data[o + 3]) continue;
    const c = ((im.data[o] << 24) | (im.data[o + 1] << 16) | (im.data[o + 2] << 8) | im.data[o + 3]) >>> 0;
    let p = pmap.get(c);
    if (p === undefined) { p = pal.length; pmap.set(c, p); pal.push(c); }
    idx[i] = p + 1;
  }
  return [pal, Buffer.from(idx).toString('base64')];
}

const cache = new Map();
function load(dir, file) {
  const key = dir + '/' + file;
  if (!cache.has(key)) {
    const f = path.join(dir, file);
    if (!fs.existsSync(f)) throw new Error('missing 26.3 file ' + key);
    const png = PNG.sync.read(fs.readFileSync(f));
    cache.set(key, png);
  }
  return cache.get(key);
}
// 16x16 view of a vanilla png (16x16, multi-frame 16xN, or a 32/64 sprite sheet)
function fit16(png) {
  const im = empty();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const s = (Math.min(y, png.height - 1) * png.width + Math.min(x, png.width - 1)) * 4;
    setP(im, x, y, png.data[s], png.data[s + 1], png.data[s + 2], png.data[s + 3]);
  }
  return im;
}

const out = {};
const real = (name, dir, file) => { out[name] = toEntry(fit16(load(dir, file))); };
const B = (name, file) => real(name, BLOCK, file);
const I = (name, file) => real(name, ITEM, file);

// ---- A. wood families (oak / spruce / acacia / jungle) --------------------------
for (const v of ['oak', 'spruce', 'acacia', 'jungle']) {
  B(v + '_log', v + '_log.png');
  B(v + '_log_top', v + '_log_top.png');
  B(v + '_planks', v + '_planks.png');
  B(v + '_leaves', v + '_leaves.png');
  B(v + '_sapling', v + '_sapling.png');
  B(v + '_door_bottom', v + '_door_bottom.png');
  B(v + '_door_top', v + '_door_top.png');
  B(v + '_trapdoor', v + '_trapdoor.png');
}
for (const v of ['oak', 'spruce', 'acacia']) {
  B('stripped_' + v + '_log', 'stripped_' + v + '_log.png');
  B('stripped_' + v + '_log_top', 'stripped_' + v + '_log_top.png');
}

// ---- B. poplar family (26.3) -----------------------------------------------------
for (const [n, f] of [
  ['poplar_log', 'poplar_log.png'], ['poplar_log_top', 'poplar_log_top.png'],
  ['poplar_planks', 'poplar_planks.png'], ['poplar_sapling', 'poplar_sapling.png'],
  ['poplar_door_bottom', 'poplar_door_bottom.png'], ['poplar_door_top', 'poplar_door_top.png'],
  ['poplar_trapdoor', 'poplar_trapdoor.png'],
  ['stripped_poplar_log', 'stripped_poplar_log.png'], ['stripped_poplar_log_top', 'stripped_poplar_log_top.png'],
]) B(n, f);

// dappled forest flora (26.3)
B('red_poplar_leaves', 'red_poplar_leaves.png');
B('orange_poplar_leaves', 'orange_poplar_leaves.png');
B('yellow_poplar_leaves', 'yellow_poplar_leaves.png');
B('leaf_litter', 'leaf_litter.png');
B('red_shrub', 'red_shrub.png');
B('shelf_mushroom_0', 'shelf_mushroom_stage0.png'); // 32x32 sheet -> top-left 16x16
B('shelf_mushroom_1', 'shelf_mushroom_stage1.png');

// ---- C. stone / sandstone ---------------------------------------------------------
B('smooth_sandstone_base', 'sandstone_top.png');
B('cut_sandstone', 'cut_sandstone.png');
B('chiseled_sandstone', 'chiseled_sandstone.png');
B('cobblestone_base', 'cobblestone.png');
B('diorite_base', 'diorite.png');
B('granite_base', 'granite.png');
B('sandstone_base', 'sandstone.png');

// ---- D. terracotta / glazed terracotta -------------------------------------------
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
for (const c of COLORS) {
  B('terracotta_' + c, c + '_terracotta.png');
  B('glazed_terracotta_' + c, c + '_glazed_terracotta.png');
}
B('terracotta', 'terracotta.png');

// ---- E. village farm crops + item icons -------------------------------------------
for (const k of ['carrots', 'potatoes', 'beetroots']) for (let s = 0; s < 4; s++) {
  B(k + '_' + (s * 2), k + '_stage' + s + '.png');
  B(k + '_' + (s * 2 + 1), k + '_stage' + s + '.png');
}
B('cobweb', 'cobweb.png');
for (const n of ['carrot', 'potato', 'baked_potato', 'beetroot']) I('item_' + n, n + '.png');
// 26.3 item icons reported missing by the proof
I('item_melon_slice', 'melon_slice.png');
I('item_melon_seeds', 'melon_seeds.png');
I('item_pumpkin_seeds', 'pumpkin_seeds.png');
I('item_beetroot_seeds', 'beetroot_seeds.png');
for (const c of COLORS) I('item_' + c + '_dye', c + '_dye.png');

// ---- F. misc structure furniture (files exist in the 26.3 pack) --------------------
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
for (const [k, v] of Object.entries(MISC)) B(k, v);

// ---- G. derived (vanilla model-transform textures) ---------------------------------
const smoothSand = fit16(load(BLOCK, 'sandstone_top.png'));
out['smooth_sandstone'] = toEntry(smoothSand);
out['smooth_sandstone_slab_side'] = toEntry(slabSideFrom(smoothSand));
out['cut_sandstone_slab_side'] = toEntry(slabSideFrom(fit16(load(BLOCK, 'cut_sandstone.png'))));
out['cobblestone_wall'] = toEntry(wallFrom(fit16(load(BLOCK, 'cobblestone.png'))));
out['diorite_wall'] = toEntry(wallFrom(fit16(load(BLOCK, 'diorite.png'))));
out['granite_wall'] = toEntry(wallFrom(fit16(load(BLOCK, 'granite.png'))));
out['sandstone_wall'] = toEntry(wallFrom(fit16(load(BLOCK, 'sandstone.png'))));
for (const v of ['oak', 'spruce', 'acacia', 'jungle']) {
  const pl = fit16(load(BLOCK, v + '_planks.png'));
  out[v + '_fence'] = toEntry(fenceFrom(pl));
  out[v + '_fence_gate'] = toEntry(fenceFrom(pl));
  out[v + '_slab_side'] = toEntry(slabSideFrom(pl));
  out[v + '_pressure_plate'] = toEntry(plateFrom(pl));
  out[v + '_wood'] = toEntry(fit16(load(BLOCK, v + '_log_top.png')));
  out[v + '_button'] = toEntry(buttonFrom(avgHex(pl)));
}
out['poplar_fence'] = toEntry(fenceFrom(fit16(load(BLOCK, 'poplar_planks.png'))));
out['poplar_fence_gate'] = toEntry(fenceFrom(fit16(load(BLOCK, 'poplar_planks.png'))));
out['poplar_slab_side'] = toEntry(slabSideFrom(fit16(load(BLOCK, 'poplar_planks.png'))));
out['poplar_pressure_plate'] = toEntry(plateFrom(fit16(load(BLOCK, 'poplar_planks.png'))));
out['poplar_wood'] = toEntry(fit16(load(BLOCK, 'poplar_log_top.png')));
out['poplar_button'] = toEntry(buttonFrom(avgHex(fit16(load(BLOCK, 'poplar_planks.png')))));
for (const v of ['oak', 'spruce', 'acacia']) out['stripped_' + v + '_wood'] = toEntry(fit16(load(BLOCK, 'stripped_' + v + '_log_top.png')));
out['stripped_poplar_wood'] = toEntry(fit16(load(BLOCK, 'stripped_poplar_log_top.png')));
out['button_stone'] = toEntry(buttonFrom(0x7f7f7f));
// carpets: flat vanilla wool colours
const WOOL_RGB = [0xe9ecec, 0xf07613, 0xbd44b3, 0x3aafd9, 0xf8c627, 0x70b919, 0xed8dac, 0x3e4447,
  0x8e8e86, 0x158991, 0x792aac, 0x35399d, 0x724728, 0x546d1b, 0xa12722, 0x141519];
COLORS.forEach((c, i) => { out['carpet_' + c] = toEntry(flatFill(WOOL_RGB[i])); });
// glass panes (clear + stained; vanilla border+arms layout)
const PANE_C = { glass_pane: [0xcfe8f0, 150], orange_stained_glass_pane: [0xe0731f, 230], yellow_stained_glass_pane: [0xf0c030, 230], white_stained_glass_pane: [0xf5f5f5, 200], brown_stained_glass_pane: [0x654c32, 230] };
for (const [n, [hex, a]] of Object.entries(PANE_C)) out[n] = toEntry(paneFrom(hex, a));
// sign + banner
out['sign'] = toEntry(signFrom(avgHex(fit16(load(BLOCK, 'oak_planks.png')))));
out['banner'] = toEntry(bannerFrom());

// ---- H. 26.3 colour blocks -----------------------------------------------------------
for (const c of COLORS) B('concrete_' + c, c + '_concrete.png');
for (const c of COLORS) out['cushion_' + c] = toEntry(fit16(load(ENTITY, 'cushion/' + c + '_cushion.png')));
out['straw_bed'] = toEntry(fit16(load(BLOCK, 'straw_bed.png')));

// ---- I. 26.3 trial chambers + copper ---------------------------------------------------
for (const f of [
  'tuff', 'tuff_bricks', 'chiseled_tuff_bricks', 'chiseled_tuff_bricks_top',
  'polished_tuff', 'chiseled_tuff', 'chiseled_tuff_top',
  'copper_block', 'cut_copper', 'chiseled_copper', 'oxidized_copper',
  'oxidized_cut_copper', 'oxidized_chiseled_copper', 'copper_grate', 'copper_bulb_lit',
  'copper_door_bottom', 'copper_door_top', 'oxidized_copper_trapdoor',
  'trial_spawner_bottom', 'trial_spawner_side_inactive', 'trial_spawner_top_inactive',
  'vault_top', 'vault_side_off', 'vault_front_off', 'vault_side_on', 'vault_front_on',
  'vault_top_ominous', 'vault_side_off_ominous', 'vault_front_off_ominous',
  'vault_side_on_ominous', 'vault_front_on_ominous',
  'heavy_core',
]) B(f, f + '.png');
I('item_breeze_rod', 'breeze_rod.png');
I('item_wind_charge', 'wind_charge.png');
I('item_trial_key', 'trial_key.png');
I('item_ominous_trial_key', 'ominous_trial_key.png');
I('item_mace', 'mace.png');
I('item_copper_ingot', 'copper_ingot.png');
I('item_emerald', 'emerald.png');
I('item_golden_carrot', 'golden_carrot.png');

// ---- J. 26.3 creaking / pale garden / nether structures (iteration 5) --------------
for (const f of [
  'pale_oak_log', 'pale_oak_log_top', 'pale_oak_planks', 'pale_oak_leaves', 'pale_oak_sapling',
  'pale_moss_block', 'pale_moss_carpet',
  'open_eyeblossom', 'open_eyeblossom_emissive', 'closed_eyeblossom',
  'resin_clump', 'resin_block', 'resin_bricks', 'chiseled_resin_bricks',
  'creaking_heart', 'creaking_heart_top', 'creaking_heart_dormant', 'creaking_heart_awake',
  'creaking_heart_top_dormant', 'creaking_heart_top_awake',
  'netherrack', 'nether_bricks', 'chiseled_nether_bricks', 'cracked_nether_bricks',
  'crying_obsidian', 'chiseled_stone_bricks', 'cracked_stone_bricks',
  'dark_oak_log', 'dark_oak_log_top', 'dark_oak_planks',
  'purpur_block', 'purpur_pillar_side', 'purpur_pillar_top',
  'soul_lantern', 'purple_stained_glass',
]) B(f, f + '.png');
// model-transform derivations (vanilla renders these from a transform, no PNG exists)
out['pale_oak_slab_side'] = toEntry(slabSideFrom(fit16(load(BLOCK, 'pale_oak_planks.png'))));
out['dark_oak_slab_side'] = toEntry(slabSideFrom(fit16(load(BLOCK, 'dark_oak_planks.png'))));
out['dark_oak_fence'] = toEntry(fenceFrom(fit16(load(BLOCK, 'dark_oak_planks.png'))));
// item icons
I('item_resin_brick', 'resin_brick.png');
I('item_resin_clump', 'resin_clump.png');
I('item_gold_nugget', 'gold_nugget.png');
I('item_glass_bottle', 'glass_bottle.png');
I('item_glowstone_dust', 'glowstone_dust.png');
I('item_spider_eye', 'spider_eye.png');
I('item_sugar', 'sugar.png');
I('item_nether_brick', 'nether_brick.png');
I('item_soul_lantern', 'soul_lantern.png');
out['item_pale_oak_sapling'] = toEntry(fit16(load(BLOCK, 'pale_oak_sapling.png')));

// ---- write ---------------------------------------------------------------------------
const js = `// GENERATED by tools/pack-all-263.mjs from real Minecraft 26.3 (Wilderness Bound)
// vanilla PNGs (PixiGeko/Minecraft-default-assets, branch 26.3) — do not edit.
// [ARGB palette: R<<24|G<<16|B<<8|A, base64 index] entries matching decodeImg().
// Model-transform textures (wall/fence/slab/plate/button/pane/carpet/sign/banner)
// are derived with vanilla's pixel rules from the real planks/stone images.
export const EXTRA = ${JSON.stringify(out)};
`;
fs.writeFileSync(OUT, js);
console.log('wrote', OUT, (js.length / 1024).toFixed(1), 'KB,', Object.keys(out).length, 'textures');

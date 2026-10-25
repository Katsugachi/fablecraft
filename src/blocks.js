// Block registry: ids, physical/render properties, shapes and collision boxes.
// Shared by the main thread and the workers, so it must stay dependency-free.

export const CH = 16; // chunk width
export const WH = 128; // world height
export const SEA = 62; // sea level (top water block)

// ---- texture name registry (name -> array-texture layer) -------------------
export const TEX = [];
const texMap = new Map();
export function texId(name) {
  let i = texMap.get(name);
  if (i === undefined) {
    i = TEX.length;
    TEX.push(name);
    texMap.set(name, i);
  }
  return i;
}
function texAnim(name, frames) {
  const first = texId(name + '_0');
  for (let i = 1; i < frames; i++) texId(name + '_' + i);
  return first;
}
export const ANIM_FRAMES = 16;

// ---- shapes -----------------------------------------------------------------
export const SH = {
  CUBE: 0, CROSS: 1, TORCH: 2, SLAB: 3, STAIRS: 4, FLUID: 5, CACTUS: 6, FARMLAND: 7,
  DOOR: 8, LADDER: 9, SNOW: 10, CROP: 11, FENCE: 12, CHEST: 13, BED: 14, FIRE: 15,
  CARPET: 16, WALL: 17, TRAPDOOR: 18, GATE: 19, BUTTON: 20, SIGNW: 21, BANNERW: 22,
  FLOWER_POT: 23, CAMPFIRE: 24, PICKLE: 25, PRESSURE: 26, FURN: 27,
};

export const BMAX = 512; // block id space (was 256; extended for 26.3 content)
export const blocks = new Array(BMAX).fill(null);
export const B = {};
export const OPAQUE = new Uint8Array(BMAX); // full cube that hides neighbours
export const LOPAC = new Uint8Array(BMAX); // light opacity 0..15
export const LEMIT = new Uint8Array(BMAX); // light emission 0..15
export const SHAPE = new Uint8Array(BMAX);
export const SOLID = new Uint8Array(BMAX); // has collision
export const TRANSL = new Uint8Array(BMAX); // drawn in translucent pass
export const FLUID = new Uint8Array(BMAX); // 1 water, 2 lava
export const REPLACEABLE = new Uint8Array(BMAX);
export const TICKS = new Uint8Array(BMAX); // receives random ticks
export const LTERM = new Uint8Array(BMAX); // receives light but does not pass it on (slabs, stairs)

// face order: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
// facing (meta & 3): 0:+Z(south) 1:-X(west) 2:-Z(north) 3:+X(east)
export const FACING_DX = [0, -1, 0, 1];
export const FACING_DZ = [1, 0, -1, 0];
export const FACING_TO_FACE = [4, 1, 5, 0];

function def(id, key, name, o = {}) {
  const shape = o.shape ?? SH.CUBE;
  const t = o.tex ?? key;
  const faces = new Uint16Array(6);
  if (typeof t === 'string') faces.fill(texId(t));
  else {
    const side = texId(t.side ?? t.all ?? t.top ?? t.bottom ?? 'stone');
    faces[0] = faces[1] = faces[4] = faces[5] = side;
    faces[2] = texId(t.top ?? t.all ?? t.side ?? 'stone');
    faces[3] = texId(t.bottom ?? t.top ?? t.all ?? t.side ?? 'stone');
  }
  const nonSolidShape = shape === SH.CROSS || shape === SH.TORCH || shape === SH.FLUID || shape === SH.CROP || shape === SH.FIRE || shape === SH.SNOW ||
    shape === SH.CARPET || shape === SH.CAMPFIRE || shape === SH.PICKLE || shape === SH.PRESSURE || shape === SH.BUTTON || shape === SH.SIGNW || shape === SH.BANNERW;
  const opaque = shape === SH.CUBE && !o.cutout && !o.transl;
  const d = {
    id, key, name, shape, faces,
    front: typeof t === 'object' && t.front ? texId(t.front) : -1,
    tex: {},
    solid: o.solid ?? !nonSolidShape,
    opaque,
    cutout: !!o.cutout,
    transl: !!o.transl,
    opac: o.opac ?? (opaque ? 15 : 0),
    emit: o.emit ?? 0,
    hard: o.h ?? 1,
    tool: o.t ?? null,
    level: o.lv ?? 0,
    need: !!o.need,
    sound: o.snd ?? 'stone',
    tint: o.tint ?? 0, // 1 grass, 2 foliage, 3 water, 4 fixed colour
    color: o.color ?? 0xffffff,
    flammable: !!o.flam,
    gravity: !!o.grav,
    slip: o.slip ?? 0.6,
    replaceable: !!o.repl,
    fluid: o.fluid ?? 0,
    anim: o.anim ?? 0,
    full: o.full ?? 0, // slabs: block made by stacking two
    noItem: !!o.noItem,
    flat: o.flat ?? null, // flat inventory icon texture
    climb: !!o.climb,
    ticks: !!o.ticks,
    resist: o.resist ?? (o.h ?? 1) * 5,
    selBox: o.sel ?? null,
    cullSame: !!o.cullSame,
    term: !!o.term,
    log: !!o.log,        // log axis: meta 1=x, 2=z (0=y)
    metaFaces: o.metaFaces || null, // (meta) => Uint16Array(6) | null
  };
  if (typeof t === 'object') for (const k in t) d.tex[k] = texId(t[k]);
  blocks[id] = d;
  B[key.toUpperCase()] = id;
  OPAQUE[id] = opaque ? 1 : 0;
  LOPAC[id] = d.opac;
  LEMIT[id] = d.emit;
  SHAPE[id] = shape;
  SOLID[id] = d.solid ? 1 : 0;
  TRANSL[id] = d.transl ? 1 : 0;
  FLUID[id] = d.fluid;
  REPLACEABLE[id] = d.replaceable ? 1 : 0;
  TICKS[id] = d.ticks ? 1 : 0;
  LTERM[id] = d.term ? 1 : 0;
  return d;
}

const PICK = 'pickaxe', AXE = 'axe', SHOVEL = 'shovel';
const plant = (tex, extra = {}) => ({ shape: SH.CROSS, tex, h: 0, snd: 'grass', cutout: true, flat: tex, ...extra });

blocks[0] = { id: 0, key: 'air', name: 'Air', shape: SH.CUBE, faces: new Uint16Array(6), solid: false, opaque: false, opac: 0, emit: 0, hard: 0, replaceable: true, noItem: true, sound: 'stone', tex: {}, slip: 0.6, fluid: 0, resist: 0 };
B.AIR = 0;
REPLACEABLE[0] = 1;

def(1, 'stone', 'Stone', { h: 1.5, t: PICK, need: 1, resist: 30 });
def(2, 'grass', 'Grass Block', { tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side', overlay: 'grass_side_overlay', snow: 'grass_side_snow' }, h: 0.6, t: SHOVEL, snd: 'grass', tint: 1, ticks: 1 });
def(3, 'dirt', 'Dirt', { h: 0.5, t: SHOVEL, snd: 'gravel', ticks: 1 });
def(4, 'cobblestone', 'Cobblestone', { h: 2, t: PICK, need: 1, resist: 30 });
def(5, 'planks', 'Oak Planks', { tex: 'planks_oak', h: 2, t: AXE, snd: 'wood', flam: 1 });
def(6, 'sapling', 'Oak Sapling', plant('sapling_oak', { ticks: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));
def(7, 'bedrock', 'Bedrock', { h: -1, resist: 1e7 });
def(8, 'water', 'Water', { shape: SH.FLUID, tex: 'water_0', transl: 1, opac: 1, h: 100, tint: 3, repl: 1, fluid: 1, anim: 1, noItem: 1, cullSame: 1, resist: 500 });
texAnim('water', ANIM_FRAMES);
def(9, 'lava', 'Lava', { shape: SH.FLUID, tex: 'lava_0', emit: 15, h: 100, repl: 1, fluid: 2, anim: 2, noItem: 1, cullSame: 1, resist: 500 });
texAnim('lava', ANIM_FRAMES);
def(10, 'sand', 'Sand', { h: 0.5, t: SHOVEL, snd: 'sand', grav: 1 });
def(11, 'gravel', 'Gravel', { h: 0.6, t: SHOVEL, snd: 'gravel', grav: 1 });
def(12, 'gold_ore', 'Gold Ore', { h: 3, t: PICK, lv: 2, need: 1 });
def(13, 'iron_ore', 'Iron Ore', { h: 3, t: PICK, lv: 1, need: 1 });
def(14, 'coal_ore', 'Coal Ore', { h: 3, t: PICK, need: 1 });
def(15, 'log', 'Oak Log', { tex: { top: 'log_oak_top', side: 'log_oak' }, h: 2, t: AXE, snd: 'wood', flam: 1 });
def(16, 'leaves', 'Oak Leaves', { tex: 'leaves_oak', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 2, flam: 1, ticks: 1 });
def(17, 'glass', 'Glass', { cutout: 1, h: 0.3, snd: 'glass', cullSame: 1 });
def(18, 'lapis_ore', 'Lapis Lazuli Ore', { h: 3, t: PICK, lv: 1, need: 1 });
def(19, 'sandstone', 'Sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, h: 0.8, t: PICK, need: 1 });
def(20, 'tall_grass', 'Grass', plant('tall_grass', { tint: 1, repl: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));
def(21, 'dead_bush', 'Dead Bush', plant('dead_bush', { repl: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));
def(22, 'dandelion', 'Dandelion', plant('dandelion', { sel: [0.3, 0, 0.3, 0.7, 0.6, 0.7] }));
def(23, 'poppy', 'Poppy', plant('poppy', { sel: [0.3, 0, 0.3, 0.7, 0.6, 0.7] }));
def(24, 'brown_mushroom', 'Brown Mushroom', plant('mushroom_brown', { emit: 1, sel: [0.3, 0, 0.3, 0.7, 0.4, 0.7] }));
def(25, 'red_mushroom', 'Red Mushroom', plant('mushroom_red', { sel: [0.3, 0, 0.3, 0.7, 0.4, 0.7] }));
def(26, 'gold_block', 'Block of Gold', { h: 3, t: PICK, lv: 2, need: 1, resist: 30 });
def(27, 'iron_block', 'Block of Iron', { h: 5, t: PICK, lv: 1, need: 1, resist: 30 });
def(28, 'bricks', 'Bricks', { h: 2, t: PICK, need: 1, resist: 30 });
def(29, 'tnt', 'TNT', { tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, h: 0, snd: 'grass', flam: 1 });
def(30, 'bookshelf', 'Bookshelf', { tex: { top: 'planks_oak', side: 'bookshelf' }, h: 1.5, t: AXE, snd: 'wood', flam: 1 });
def(31, 'mossy_cobblestone', 'Mossy Cobblestone', { h: 2, t: PICK, need: 1, resist: 30 });
def(32, 'obsidian', 'Obsidian', { h: 50, t: PICK, lv: 3, need: 1, resist: 6000 });
def(33, 'torch', 'Torch', { shape: SH.TORCH, cutout: 1, emit: 14, h: 0, snd: 'wood', flat: 'torch' });
def(34, 'chest', 'Chest', { shape: SH.CHEST, tex: { top: 'chest_top', side: 'chest_side', front: 'chest_front' }, h: 2.5, t: AXE, snd: 'wood' });
def(35, 'diamond_ore', 'Diamond Ore', { h: 3, t: PICK, lv: 2, need: 1 });
def(36, 'diamond_block', 'Block of Diamond', { h: 5, t: PICK, lv: 2, need: 1, resist: 30 });
def(37, 'crafting_table', 'Crafting Table', { tex: { top: 'crafting_top', bottom: 'planks_oak', side: 'crafting_side', front: 'crafting_front' }, h: 2.5, t: AXE, snd: 'wood', flam: 1 });
def(38, 'farmland', 'Farmland', { shape: SH.FARMLAND, tex: { top: 'farmland_dry', wet: 'farmland_wet', side: 'dirt', bottom: 'dirt' }, term: 1, h: 0.6, t: SHOVEL, snd: 'gravel', ticks: 1, noItem: 1 });
def(39, 'wheat', 'Wheat Crops', { shape: SH.CROP, tex: 'wheat_0', cutout: 1, h: 0, snd: 'grass', ticks: 1, noItem: 1 });
for (let i = 1; i < 8; i++) texId('wheat_' + i);
def(40, 'furnace', 'Furnace', { tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, h: 3.5, t: PICK, need: 1 });
def(41, 'furnace_lit', 'Furnace', { tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit' }, h: 3.5, t: PICK, need: 1, emit: 13, noItem: 1 });
def(42, 'ladder', 'Ladder', { shape: SH.LADDER, cutout: 1, h: 0.4, t: AXE, snd: 'wood', flat: 'ladder', climb: 1 });
def(43, 'door', 'Oak Door', { shape: SH.DOOR, tex: { all: 'door_bottom', top: 'door_top', bottom: 'door_bottom' }, cutout: 1, h: 3, t: AXE, snd: 'wood', flat: 'item_door' });
def(44, 'redstone_ore', 'Redstone Ore', { h: 3, t: PICK, lv: 2, need: 1 });
def(45, 'snow_layer', 'Snow', { shape: SH.SNOW, tex: 'snow', h: 0.1, t: SHOVEL, need: 1, snd: 'snow', repl: 1 });
def(46, 'ice', 'Ice', { transl: 1, opac: 2, h: 0.5, t: PICK, snd: 'glass', slip: 0.98, cullSame: 1 });
def(47, 'snow_block', 'Snow Block', { tex: 'snow', h: 0.2, t: SHOVEL, need: 1, snd: 'snow' });
def(48, 'cactus', 'Cactus', { shape: SH.CACTUS, tex: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, cutout: 1, h: 0.4, snd: 'cloth', ticks: 1 });
def(49, 'clay', 'Clay', { h: 0.6, t: SHOVEL, snd: 'gravel' });
def(50, 'sugar_cane', 'Sugar Cane', plant('sugar_cane', { ticks: 1, sel: [0.125, 0, 0.125, 0.875, 1, 0.875] }));
def(51, 'pumpkin', 'Pumpkin', { tex: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' }, h: 1, t: AXE, snd: 'wood' });
def(52, 'jack_o_lantern', "Jack o'Lantern", { tex: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face_lit' }, h: 1, t: AXE, snd: 'wood', emit: 15 });
def(53, 'glowstone', 'Glowstone', { h: 0.3, snd: 'glass', emit: 15 });
def(54, 'birch_log', 'Birch Log', { tex: { top: 'log_birch_top', side: 'log_birch' }, h: 2, t: AXE, snd: 'wood', flam: 1 });
def(55, 'birch_leaves', 'Birch Leaves', { tex: 'leaves_birch', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0x80a755, flam: 1, ticks: 1 });
def(56, 'birch_planks', 'Birch Planks', { tex: 'planks_birch', h: 2, t: AXE, snd: 'wood', flam: 1 });
def(57, 'spruce_log', 'Spruce Log', { tex: { top: 'log_spruce_top', side: 'log_spruce' }, h: 2, t: AXE, snd: 'wood', flam: 1 });
def(58, 'spruce_leaves', 'Spruce Leaves', { tex: 'leaves_spruce', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0x619961, flam: 1, ticks: 1 });
def(59, 'spruce_planks', 'Spruce Planks', { tex: 'planks_spruce', h: 2, t: AXE, snd: 'wood', flam: 1 });
def(60, 'stone_bricks', 'Stone Bricks', { h: 1.5, t: PICK, need: 1, resist: 30 });
def(67, 'smooth_stone', 'Smooth Stone', { h: 2, t: PICK, need: 1, resist: 30 });
const slab = (o) => ({ shape: SH.SLAB, term: 1, ...o });
def(61, 'stone_slab', 'Stone Slab', slab({ tex: 'smooth_stone', h: 2, t: PICK, need: 1, full: 67 }));
def(62, 'oak_slab', 'Oak Slab', slab({ tex: 'planks_oak', h: 2, t: AXE, snd: 'wood', full: 5, flam: 1 }));
def(63, 'cobblestone_slab', 'Cobblestone Slab', slab({ tex: 'cobblestone', h: 2, t: PICK, need: 1, full: 4 }));
const stairs = (o) => ({ shape: SH.STAIRS, term: 1, ...o });
def(64, 'oak_stairs', 'Oak Stairs', stairs({ tex: 'planks_oak', h: 2, t: AXE, snd: 'wood', flam: 1 }));
def(65, 'cobblestone_stairs', 'Cobblestone Stairs', stairs({ tex: 'cobblestone', h: 2, t: PICK, need: 1 }));
def(66, 'stone_brick_stairs', 'Stone Brick Stairs', stairs({ tex: 'stone_bricks', h: 1.5, t: PICK, need: 1 }));
def(68, 'coal_block', 'Block of Coal', { h: 5, t: PICK, need: 1, resist: 30 });
def(69, 'lapis_block', 'Lapis Lazuli Block', { h: 3, t: PICK, lv: 1, need: 1 });
def(70, 'redstone_block', 'Block of Redstone', { h: 5, t: PICK, need: 1, resist: 30 });
def(71, 'birch_sapling', 'Birch Sapling', plant('sapling_birch', { ticks: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));
def(72, 'spruce_sapling', 'Spruce Sapling', plant('sapling_spruce', { ticks: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));
def(73, 'cornflower', 'Cornflower', plant('cornflower', { sel: [0.3, 0, 0.3, 0.7, 0.6, 0.7] }));
def(74, 'allium', 'Allium', plant('allium', { sel: [0.3, 0, 0.3, 0.7, 0.6, 0.7] }));
def(75, 'daisy', 'Oxeye Daisy', plant('daisy', { sel: [0.3, 0, 0.3, 0.7, 0.6, 0.7] }));
def(76, 'fence', 'Oak Fence', { shape: SH.FENCE, tex: 'planks_oak', h: 2, t: AXE, snd: 'wood', flam: 1 });
def(77, 'bed', 'Bed', { shape: SH.BED, tex: { all: 'bed_side', top: 'bed_top_foot', head: 'bed_top_head', bottom: 'planks_oak', side: 'bed_side', end: 'bed_end' }, cutout: 1, h: 0.2, snd: 'wood', flat: 'item_bed' });
def(78, 'granite', 'Granite', { h: 1.5, t: PICK, need: 1, resist: 30 });
def(79, 'diorite', 'Diorite', { h: 1.5, t: PICK, need: 1, resist: 30 });
def(80, 'andesite', 'Andesite', { h: 1.5, t: PICK, need: 1, resist: 30 });
def(81, 'fire', 'Fire', { shape: SH.FIRE, tex: 'fire_0', cutout: 1, emit: 15, h: 0, repl: 1, anim: 3, noItem: 1, ticks: 1, snd: 'cloth' });
texAnim('fire', ANIM_FRAMES);
def(83, 'brick_stairs', 'Brick Stairs', stairs({ tex: 'bricks', h: 2, t: PICK, need: 1 }));
def(84, 'brick_slab', 'Brick Slab', slab({ tex: 'bricks', h: 2, t: PICK, need: 1, full: 28 }));
def(85, 'stone_brick_slab', 'Stone Brick Slab', slab({ tex: 'stone_bricks', h: 2, t: PICK, need: 1, full: 60 }));
def(86, 'sandstone_stairs', 'Sandstone Stairs', stairs({ tex: { all: 'sandstone_side', top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, h: 0.8, t: PICK, need: 1 }));
def(87, 'sandstone_slab', 'Sandstone Slab', slab({ tex: { all: 'sandstone_side', top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, h: 2, t: PICK, need: 1, full: 19 }));
def(88, 'birch_slab', 'Birch Slab', slab({ tex: 'planks_birch', h: 2, t: AXE, snd: 'wood', full: 56, flam: 1 }));
def(89, 'spruce_slab', 'Spruce Slab', slab({ tex: 'planks_spruce', h: 2, t: AXE, snd: 'wood', full: 59, flam: 1 }));
def(90, 'birch_stairs', 'Birch Stairs', stairs({ tex: 'planks_birch', h: 2, t: AXE, snd: 'wood', flam: 1 }));
def(91, 'spruce_stairs', 'Spruce Stairs', stairs({ tex: 'planks_spruce', h: 2, t: AXE, snd: 'wood', flam: 1 }));
def(92, 'mossy_stone_bricks', 'Mossy Stone Bricks', { h: 1.5, t: PICK, need: 1, resist: 30 });

export const WOOL_COLORS = [
  ['white', 'White', 0xe9ecec], ['orange', 'Orange', 0xf07613], ['magenta', 'Magenta', 0xbd44b3], ['light_blue', 'Light Blue', 0x3aafd9],
  ['yellow', 'Yellow', 0xf8c627], ['lime', 'Lime', 0x70b919], ['pink', 'Pink', 0xed8dac], ['gray', 'Gray', 0x3e4447],
  ['light_gray', 'Light Gray', 0x8e8e86], ['cyan', 'Cyan', 0x158991], ['purple', 'Purple', 0x792aac], ['blue', 'Blue', 0x35399d],
  ['brown', 'Brown', 0x724728], ['green', 'Green', 0x546d1b], ['red', 'Red', 0xa12722], ['black', 'Black', 0x141519],
];
WOOL_COLORS.forEach(([k, n], i) => def(96 + i, k + '_wool', n + ' Wool', { tex: 'wool_' + i, h: 0.8, t: 'shears', snd: 'cloth', flam: 1 }));
B.WOOL = 96;

// ===========================================================================
// Modern (1.21.5-era) block set — village + worldgen waves (iterations 1-2)
// Real vanilla textures via src/textures_real.js.
// ===========================================================================
// Colour variants are individual block ids (192+) — the item system is id-based,
// so each terracotta/carpet/glazed/pane colour gets its own block.
// 82 (free id) + 112..191 + colour families 192..242
{
  def(82, 'terracotta', 'Terracotta', { h: 2, t: PICK, need: 1, resist: 30 });

  def(114, 'packed_ice', 'Packed Ice', { tex: 'packed_ice', h: 0.9, t: PICK, snd: 'glass' });
  def(115, 'blue_ice', 'Blue Ice', { tex: 'blue_ice', transl: 1, opac: 2, h: 0.9, t: PICK, snd: 'glass', slip: 0.98, cullSame: 1 });
  def(116, 'sea_pickle', 'Sea Pickle', { shape: SH.PICKLE, tex: 'sea_pickle', cutout: 1, emit: 14, h: 0.4, t: 'shears', snd: 'glass' });
  def(117, 'campfire', 'Campfire', { shape: SH.CAMPFIRE, tex: { log: 'campfire_log', logLit: 'campfire_log_lit', fire: 'fire_0' }, cutout: 1, emit: 14, h: 0, snd: 'wood', noItem: 1, ticks: 1, flat: 'campfire_log' });
  def(118, 'lantern', 'Lantern', { shape: SH.FURN, tex: 'lantern', cutout: 1, emit: 14, h: 0.6, t: PICK, need: 1, snd: 'metal' });
  def(119, 'cauldron', 'Cauldron', { shape: SH.FURN, tex: { side: 'cauldron_side', inner: 'cauldron_inner', top: 'cauldron_top', bottom: 'cauldron_bottom', water: 'water_0', lava: 'lava_0' }, h: 6, t: PICK, need: 1, snd: 'stone' });
  def(120, 'melon', 'Melon', { tex: { top: 'melon_top', side: 'melon_side' }, h: 1, t: null, snd: 'wood' });
  def(121, 'melon_stem', 'Melon Stem', plant('melon_stem'));
  def(122, 'pumpkin_stem', 'Pumpkin Stem', plant('pumpkin_stem'));
  def(123, 'dirt_path', 'Dirt Path', { tex: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' }, h: 0.6, t: SHOVEL, snd: 'gravel', ticks: 1 });
  def(124, 'hay_block', 'Hay Bale', { tex: { top: 'hay_block_top', side: 'hay_block_side' }, h: 0.5, t: 'shears', snd: 'cloth', flam: 1 });
  def(125, 'flower_pot', 'Flower Pot', { shape: SH.FLOWER_POT, tex: 'flower_pot', cutout: 1, h: 1, t: SHOVEL, snd: 'stone' });
  def(126, 'sign', 'Spruce Sign', { shape: SH.SIGNW, tex: 'sign', cutout: 1, h: 1, t: AXE, snd: 'wood', flam: 1 });
  def(127, 'banner', 'Brown Wall Banner', { shape: SH.BANNERW, tex: 'banner', cutout: 1, h: 0.6, t: 'shears', snd: 'cloth' });
  def(128, 'cobblestone_wall', 'Cobblestone Wall', { shape: SH.WALL, tex: 'cobblestone_wall', cutout: 1, h: 2, t: PICK, need: 1, resist: 30, snd: 'stone' });
  def(129, 'diorite_wall', 'Diorite Wall', { shape: SH.WALL, tex: 'diorite_wall', cutout: 1, h: 1.5, t: PICK, need: 1, resist: 30 });
  def(130, 'granite_wall', 'Granite Wall', { shape: SH.WALL, tex: 'granite_wall', cutout: 1, h: 1.5, t: PICK, need: 1, resist: 30 });
  def(131, 'sandstone_wall', 'Sandstone Wall', { shape: SH.WALL, tex: 'sandstone_wall', cutout: 1, h: 0.8, t: PICK, need: 1, resist: 30 });
  def(132, 'diorite_stairs', 'Diorite Stairs', stairs({ tex: 'diorite', h: 1.5, t: PICK, need: 1 }));
  def(133, 'diorite_slab', 'Diorite Slab', slab({ tex: 'diorite', h: 1.5, t: PICK, need: 1, full: 79 }));
  def(134, 'granite_stairs', 'Granite Stairs', stairs({ tex: 'granite', h: 1.5, t: PICK, need: 1 }));
  def(249, 'granite_slab', 'Granite Slab', slab({ tex: 'granite', h: 1.5, t: PICK, need: 1, full: 78 }));
  def(250, 'stripped_acacia_wood', 'Stripped Acacia Wood', { tex: 'stripped_acacia_wood', h: 2, t: AXE, snd: 'wood', flam: 1 });
  { const d = blocks[250]; d.log = 1; d.logFaces = [null, new Uint16Array([d.faces[2], d.faces[2], d.faces[0], d.faces[0], d.faces[0], d.faces[0]]), new Uint16Array([d.faces[0], d.faces[0], d.faces[0], d.faces[0], d.faces[2], d.faces[2]])]; }
  def(135, 'smooth_sandstone', 'Smooth Sandstone', { tex: 'smooth_sandstone', h: 2, t: PICK, need: 1, resist: 30 });
  def(136, 'smooth_sandstone_slab', 'Smooth Sandstone Slab', slab({ tex: { top: 'smooth_sandstone', side: 'smooth_sandstone_slab_side', all: 'smooth_sandstone_slab_side' }, h: 2, t: PICK, need: 1, full: 135 }));
  def(137, 'smooth_sandstone_stairs', 'Smooth Sandstone Stairs', stairs({ tex: 'smooth_sandstone', h: 2, t: PICK, need: 1 }));
  def(138, 'cut_sandstone', 'Cut Sandstone', { tex: 'cut_sandstone', h: 2, t: PICK, need: 1, resist: 30 });
  def(139, 'chiseled_sandstone', 'Chiseled Sandstone', { tex: 'chiseled_sandstone', h: 2, t: PICK, need: 1, resist: 30 });
  def(140, 'glass_pane', 'Glass Pane', { shape: SH.CUBE, tex: 'glass_pane', cutout: 1, cullSame: 1, h: 0.3, snd: 'glass' });
  def(141, 'iron_bars', 'Iron Bars', { shape: SH.CUBE, tex: 'iron_bars', cutout: 1, cullSame: 1, h: 5, t: PICK, lv: 1, need: 1, snd: 'metal' });
  def(142, 'barrel', 'Barrel', { shape: SH.FURN, tex: { side: 'barrel_side', top: 'barrel_top', topOpen: 'barrel_top_open', bottom: 'barrel_bottom' }, h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(143, 'bell', 'Bell', { shape: SH.FURN, tex: { side: 'bell_side', top: 'bell_top', bottom: 'bell_bottom' }, h: 5, t: PICK, lv: 1, need: 1, snd: 'metal' });
  def(144, 'blast_furnace', 'Blast Furnace', { shape: SH.FURN, tex: { top: 'blast_furnace_top', side: 'blast_furnace_side', front: 'blast_furnace_front', frontLit: 'blast_furnace_front_on' }, h: 3.5, t: PICK, need: 1, snd: 'stone' });
  def(145, 'brewing_stand', 'Brewing Stand', { shape: SH.FURN, tex: { stand: 'brewing_stand', base: 'brewing_stand_base' }, cutout: 1, h: 1, t: PICK, snd: 'glass', flat: 'brewing_stand' });
  def(146, 'cartography_table', 'Cartography Table', { shape: SH.FURN, tex: { top: 'cartography_table_top', front: 'cartography_table_side1', side1: 'cartography_table_side2', side2: 'cartography_table_side3' }, h: 2.5, t: AXE, snd: 'wood', flam: 1, flat: 'cartography_table_top' });
  def(147, 'composter', 'Composter', { shape: SH.FURN, tex: { side: 'composter_side', top: 'composter_top', compost: 'composter_compost', ready: 'composter_ready', bottom: 'composter_bottom' }, h: 0.6, t: 'shears', snd: 'wood' });
  def(148, 'fletching_table', 'Fletching Table', { shape: SH.FURN, tex: { top: 'fletching_table_top', front: 'fletching_table_front', side: 'fletching_table_side' }, h: 2.5, t: AXE, snd: 'wood', flam: 1 });
  def(149, 'grindstone', 'Grindstone', { shape: SH.FURN, tex: { top: 'grindstone_round', side: 'grindstone_side' }, h: 2, t: PICK, need: 1, snd: 'stone' });
  def(150, 'loom', 'Loom', { shape: SH.FURN, tex: { top: 'loom_top', front: 'loom_front', side: 'loom_side', bottom: 'loom_bottom' }, h: 2.5, t: AXE, snd: 'wood', flam: 1 });
  def(151, 'smithing_table', 'Smithing Table', { shape: SH.FURN, tex: { top: 'smithing_table_top', front: 'smithing_table_front', side: 'smithing_table_side', bottom: 'smithing_table_bottom' }, h: 2.5, t: AXE, snd: 'wood', flam: 1 });
  def(152, 'smoker', 'Smoker', { shape: SH.FURN, tex: { top: 'smoker_top', side: 'smoker_side', front: 'smoker_front', frontLit: 'smoker_front_on', bottom: 'smoker_bottom' }, h: 3.5, t: PICK, need: 1, snd: 'stone' });
  def(153, 'stonecutter', 'Stonecutter', { shape: SH.FURN, tex: { top: 'stonecutter_top', front: 'stonecutter_front', side: 'stonecutter_side', bottom: 'stonecutter_bottom' }, h: 2, t: PICK, need: 1, snd: 'stone' });
  def(154, 'door_spruce', 'Spruce Door', { shape: SH.DOOR, tex: { all: 'spruce_door_bottom', top: 'spruce_door_top', bottom: 'spruce_door_bottom' }, cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1, flat: 'spruce_door_bottom' });
  def(155, 'spruce_fence', 'Spruce Fence', { shape: SH.FENCE, tex: 'spruce_fence', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(156, 'fence_gate_oak', 'Oak Fence Gate', { shape: SH.GATE, tex: 'oak_fence_gate', cutout: 1, h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(157, 'fence_gate_spruce', 'Spruce Fence Gate', { shape: SH.GATE, tex: 'spruce_fence_gate', cutout: 1, h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(158, 'fence_gate_acacia', 'Acacia Fence Gate', { shape: SH.GATE, tex: 'acacia_fence_gate', cutout: 1, h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(159, 'fence_gate_jungle', 'Jungle Fence Gate', { shape: SH.GATE, tex: 'jungle_fence_gate', cutout: 1, h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(160, 'pressure_plate_oak', 'Oak Pressure Plate', { shape: SH.PRESSURE, tex: 'oak_pressure_plate', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(161, 'pressure_plate_spruce', 'Spruce Pressure Plate', { shape: SH.PRESSURE, tex: 'spruce_pressure_plate', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(162, 'pressure_plate_acacia', 'Acacia Pressure Plate', { shape: SH.PRESSURE, tex: 'acacia_pressure_plate', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(163, 'pressure_plate_jungle', 'Jungle Pressure Plate', { shape: SH.PRESSURE, tex: 'jungle_pressure_plate', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(164, 'trapdoor_oak', 'Oak Trapdoor', { shape: SH.TRAPDOOR, tex: 'oak_trapdoor', cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1 });
  def(165, 'trapdoor_spruce', 'Spruce Trapdoor', { shape: SH.TRAPDOOR, tex: 'spruce_trapdoor', cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1 });
  def(166, 'trapdoor_acacia', 'Acacia Trapdoor', { shape: SH.TRAPDOOR, tex: 'acacia_trapdoor', cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1 });
  def(167, 'trapdoor_jungle', 'Jungle Trapdoor', { shape: SH.TRAPDOOR, tex: 'jungle_trapdoor', cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1 });
  def(168, 'button_jungle', 'Jungle Button', { shape: SH.BUTTON, tex: 'jungle_button', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(169, 'stone_button', 'Stone Button', { shape: SH.BUTTON, tex: 'button_stone', cutout: 1, h: 0.1, t: PICK, need: 1, snd: 'stone' });
  def(170, 'button_oak', 'Oak Button', { shape: SH.BUTTON, tex: 'oak_button', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(171, 'button_spruce', 'Spruce Button', { shape: SH.BUTTON, tex: 'spruce_button', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(172, 'button_acacia', 'Acacia Button', { shape: SH.BUTTON, tex: 'acacia_button', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });

  // acacia family
  const aLog = def(173, 'acacia_log', 'Acacia Log', { tex: { top: 'acacia_log_top', side: 'acacia_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); aLog.log = 1;
  const aWood = def(174, 'acacia_wood', 'Acacia Wood', { tex: 'acacia_wood', h: 2, t: AXE, snd: 'wood', flam: 1 }); aWood.log = 1;
  def(175, 'acacia_planks', 'Acacia Planks', { tex: 'acacia_planks', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(176, 'acacia_leaves', 'Acacia Leaves', { tex: 'acacia_leaves', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0x8a9a2b, flam: 1, ticks: 1 });
  def(177, 'acacia_sapling', 'Acacia Sapling', plant('acacia_sapling'));
  const sAcLog = def(178, 'stripped_acacia_log', 'Stripped Acacia Log', { tex: { top: 'stripped_acacia_log_top', side: 'stripped_acacia_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); sAcLog.log = 1;
  const spWood = def(179, 'spruce_wood', 'Spruce Wood', { tex: 'spruce_wood', h: 2, t: AXE, snd: 'wood', flam: 1 }); spWood.log = 1;
  const sSpLog = def(180, 'stripped_spruce_log', 'Stripped Spruce Log', { tex: { top: 'stripped_spruce_log_top', side: 'stripped_spruce_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); sSpLog.log = 1;
  const sSpWood = def(181, 'stripped_spruce_wood', 'Stripped Spruce Wood', { tex: 'stripped_spruce_wood', h: 2, t: AXE, snd: 'wood', flam: 1 }); sSpWood.log = 1;
  const sOaLog = def(182, 'stripped_oak_log', 'Stripped Oak Log', { tex: { top: 'stripped_oak_log_top', side: 'stripped_oak_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); sOaLog.log = 1;
  const sOaWood = def(183, 'stripped_oak_wood', 'Stripped Oak Wood', { tex: 'stripped_oak_wood', h: 2, t: AXE, snd: 'wood', flam: 1 }); sOaWood.log = 1;
  def(184, 'door_acacia', 'Acacia Door', { shape: SH.DOOR, tex: { all: 'acacia_door_bottom', top: 'acacia_door_top', bottom: 'acacia_door_bottom' }, cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1, flat: 'acacia_door_bottom' });
  def(185, 'acacia_fence', 'Acacia Fence', { shape: SH.FENCE, tex: 'acacia_fence', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(186, 'slab_acacia', 'Acacia Slab', slab({ tex: { top: 'acacia_planks', side: 'acacia_slab_side', all: 'acacia_slab_side' }, h: 2, t: AXE, snd: 'wood', flam: 1, full: 175 }));
  def(187, 'stairs_acacia', 'Acacia Stairs', stairs({ tex: 'acacia_planks', h: 2, t: AXE, snd: 'wood', flam: 1 }));
  def(188, 'door_jungle', 'Jungle Door', { shape: SH.DOOR, tex: { all: 'jungle_door_bottom', top: 'jungle_door_top', bottom: 'jungle_door_bottom' }, cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1, flat: 'jungle_door_bottom' });
  def(189, 'jungle_fence', 'Jungle Fence', { shape: SH.FENCE, tex: 'jungle_fence', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(190, 'slab_jungle', 'Jungle Slab', slab({ tex: { top: 'jungle_planks', side: 'jungle_slab_side', all: 'jungle_slab_side' }, h: 2, t: AXE, snd: 'wood', flam: 1, full: 0 }));
  def(191, 'stairs_jungle', 'Jungle Stairs', stairs({ tex: 'jungle_planks', h: 2, t: AXE, snd: 'wood', flam: 1 }));

  // log axis face permutations for existing + new logs
  const logIds = [15, 54, 57, 173, 174, 178, 179, 180, 181, 182, 183];
  for (const li of logIds) {
    const d = blocks[li], s = d.faces[0], t = d.faces[2];
    d.logFaces = [null, new Uint16Array([t, t, s, s, s, s]), new Uint16Array([s, s, s, s, t, t])];
  }
  // flower pot plant cross layers (cactus, dandelion, dead bush, poppy, spruce sapling)
  blocks[125].plantLayers = [texId('cactus_side'), texId('dandelion'), texId('dead_bush'), texId('poppy'), texId('sapling_spruce')];

  // ---- colour families (192..242) ------------------------------------------
  for (let i = 0; i < 16; i++) {
    const [ck, cn] = WOOL_COLORS[i];
    def(192 + i, 'terracotta_' + ck, cn + ' Terracotta', { tex: 'terracotta_' + ck, h: 2, t: PICK, need: 1, resist: 30 });
    def(208 + i, 'carpet_' + ck, cn + ' Carpet', { shape: SH.CARPET, tex: 'carpet_' + ck, h: 0.1, t: 'shears', snd: 'cloth', flam: 1 });
    def(224 + i, 'glazed_terracotta_' + ck, cn + ' Glazed Terracotta', { tex: 'glazed_terracotta_' + ck, h: 2, t: PICK, need: 1, resist: 30 });
  }
  def(240, 'stained_glass_pane_orange', 'Orange Stained Glass Pane', { shape: SH.CUBE, tex: 'orange_stained_glass_pane', cutout: 1, cullSame: 1, h: 0.3, snd: 'glass' });
  def(241, 'stained_glass_pane_yellow', 'Yellow Stained Glass Pane', { shape: SH.CUBE, tex: 'yellow_stained_glass_pane', cutout: 1, cullSame: 1, h: 0.3, snd: 'glass' });
  def(242, 'stained_glass_pane_white', 'White Stained Glass Pane', { shape: SH.CUBE, tex: 'white_stained_glass_pane', cutout: 1, cullSame: 1, h: 0.3, snd: 'glass' });
  def(243, 'lectern', 'Lectern', { shape: SH.FURN, tex: { top: 'lectern_top', front: 'lectern_front', side: 'lectern_sides', bottom: 'lectern_base' }, h: 2, t: AXE, snd: 'wood', flam: 1, flat: 'lectern_front' });
  const jLog = def(244, 'jungle_log', 'Jungle Log', { tex: { top: 'jungle_log_top', side: 'jungle_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); jLog.log = 1;
  const jWood = def(245, 'jungle_wood', 'Jungle Wood', { tex: 'jungle_wood', h: 2, t: AXE, snd: 'wood', flam: 1 }); jWood.log = 1;
  def(246, 'jungle_planks', 'Jungle Planks', { tex: 'jungle_planks', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(247, 'jungle_leaves', 'Jungle Leaves', { tex: 'jungle_leaves', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0x3f6b2a, flam: 1, ticks: 1 });
  def(248, 'jungle_sapling', 'Jungle Sapling', plant('jungle_sapling'));
  const jl = blocks[244]; jl.logFaces = [null, new Uint16Array([jl.faces[2], jl.faces[2], jl.faces[0], jl.faces[0], jl.faces[0], jl.faces[0]]), new Uint16Array([jl.faces[0], jl.faces[0], jl.faces[0], jl.faces[0], jl.faces[2], jl.faces[2]])];
  const jw = blocks[245]; jw.logFaces = [null, new Uint16Array([jw.faces[2], jw.faces[2], jw.faces[0], jw.faces[0], jw.faces[0], jw.faces[0]]), new Uint16Array([jw.faces[0], jw.faces[0], jw.faces[0], jw.faces[0], jw.faces[2], jw.faces[2]])];

  // ---- village farm + window wave (251..255) ---------------------------------
  // crops: vanilla has 4 visual stages; fablecraft crop metas run 0..7 (stage = meta>>1)
  def(251, 'carrots', 'Carrots', { shape: SH.CROP, tex: 'carrots_0', cutout: 1, h: 0, snd: 'grass', ticks: 1, noItem: 1 });
  def(252, 'potatoes', 'Potatoes', { shape: SH.CROP, tex: 'potatoes_0', cutout: 1, h: 0, snd: 'grass', ticks: 1, noItem: 1 });
  def(253, 'beetroots', 'Beetroots', { shape: SH.CROP, tex: 'beetroots_0', cutout: 1, h: 0, snd: 'grass', ticks: 1, noItem: 1 });
  for (const k of ['carrots', 'potatoes', 'beetroots']) for (let i = 1; i < 8; i++) texId(k + '_' + i);
  def(254, 'stained_glass_pane_brown', 'Brown Stained Glass Pane', { shape: SH.CUBE, tex: 'brown_stained_glass_pane', cutout: 1, cullSame: 1, h: 0.3, snd: 'glass' });
  def(255, 'cobweb', 'Cobweb', { tex: 'cobweb', cutout: 1, h: 0, snd: 'cloth', solid: 0, flam: 1 });

  // ---- iteration 3: 26.3 Wilderness Bound wave (256..287) ----------------------
  // poplar wood family
  const pLog = def(256, 'poplar_log', 'Poplar Log', { tex: { top: 'poplar_log_top', bottom: 'poplar_log_top', side: 'poplar_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); pLog.log = 1;
  const pSLog = def(257, 'stripped_poplar_log', 'Stripped Poplar Log', { tex: { top: 'stripped_poplar_log_top', bottom: 'stripped_poplar_log_top', side: 'stripped_poplar_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 }); pSLog.log = 1;
  const pWood = def(258, 'poplar_wood', 'Poplar Wood', { tex: 'poplar_log', h: 2, t: AXE, snd: 'wood', flam: 1 }); pWood.log = 1;
  const pSWood = def(259, 'stripped_poplar_wood', 'Stripped Poplar Wood', { tex: 'stripped_poplar_log', h: 2, t: AXE, snd: 'wood', flam: 1 }); pSWood.log = 1;
  def(260, 'poplar_planks', 'Poplar Planks', { tex: 'poplar_planks', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(261, 'poplar_slab', 'Poplar Slab', slab({ tex: 'poplar_planks', h: 2, t: AXE, snd: 'wood', full: 260, flam: 1 }));
  def(262, 'poplar_stairs', 'Poplar Stairs', stairs({ tex: 'poplar_planks', h: 2, t: AXE, snd: 'wood', flam: 1 }));
  def(263, 'poplar_fence', 'Poplar Fence', { shape: SH.FENCE, tex: 'poplar_fence', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(264, 'poplar_fence_gate', 'Poplar Fence Gate', { shape: SH.GATE, tex: 'poplar_fence_gate', cutout: 1, h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(265, 'poplar_door', 'Poplar Door', { shape: SH.DOOR, tex: { top: 'poplar_door_top', bottom: 'poplar_door_bottom' }, cutout: 1, h: 0.5, t: AXE, snd: 'wood', flam: 1, flat: 'poplar_door_top' });
  def(266, 'poplar_trapdoor', 'Poplar Trapdoor', { shape: SH.TRAPDOOR, tex: 'poplar_trapdoor', cutout: 1, h: 3, t: AXE, snd: 'wood', flam: 1 });
  def(267, 'poplar_pressure_plate', 'Poplar Pressure Plate', { shape: SH.PRESSURE, tex: 'poplar_pressure_plate', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(268, 'poplar_button', 'Poplar Button', { shape: SH.BUTTON, tex: 'poplar_button', cutout: 1, h: 0.1, t: AXE, snd: 'wood', flam: 1 });
  def(269, 'poplar_sapling', 'Poplar Sapling', plant('poplar_sapling', { ticks: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));
  def(270, 'red_poplar_leaves', 'Red Poplar Leaves', { tex: 'red_poplar_leaves', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0x9c3b12, flam: 1, ticks: 1 });
  def(271, 'orange_poplar_leaves', 'Orange Poplar Leaves', { tex: 'orange_poplar_leaves', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0xc25a1a, flam: 1, ticks: 1 });
  def(272, 'yellow_poplar_leaves', 'Yellow Poplar Leaves', { tex: 'yellow_poplar_leaves', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', tint: 4, color: 0xd9a02b, flam: 1, ticks: 1 });

  // dappled forest plants
  for (const li of [256, 257, 258, 259]) {
    const d = blocks[li], s2 = d.faces[0], t2 = d.faces[2];
    d.logFaces = [null, new Uint16Array([t2, t2, s2, s2, s2, s2]), new Uint16Array([s2, s2, s2, s2, t2, t2])];
  }

  // dappled forest plants
  def(273, 'leaf_litter', 'Leaf Litter', plant('leaf_litter', { h: 0.2, snd: 'gravel' }));
  def(274, 'red_shrub', 'Red Shrub', plant('red_shrub', { h: 0.3 }));
  def(275, 'shelf_mushroom', 'Shelf Mushroom', plant('shelf_mushroom_0', { h: 0.3, snd: 'wood' }));
  def(276, 'big_shelf_mushroom', 'Big Shelf Mushroom', plant('shelf_mushroom_1', { h: 0.4, snd: 'wood' }));

  // cushions (16 colours via meta)
  def(277, 'cushion', 'Cushion', {
    tex: 'cushion_white', flat: 'cushion_white',
    metaFaces: (m) => { const c = texId('cushion_' + WOOL_COLORS[m & 15][0]); return new Uint16Array([c, c, c, c, c, c]); },
    h: 0.4, t: 'shears', snd: 'cloth', flam: 1,
  });
  B.CUSHION = 277;

  // straw bed (bed-like, single colour)
  def(278, 'straw_bed', 'Straw Bed', { shape: SH.BED, tex: { all: 'straw_bed' }, cutout: 1, h: 0.2, snd: 'cloth', flat: 'straw_bed' });

  // copper chests (4 oxidation states; chest behaviour)
  def(279, 'copper_chest', 'Copper Chest', { shape: SH.CHEST, tex: { top: 'copper_chest_side', side: 'copper_chest_side', front: 'copper_chest_left' }, h: 2.5, t: AXE, snd: 'metal' });
  def(280, 'copper_chest_exposed', 'Exposed Copper Chest', { shape: SH.CHEST, tex: { top: 'copper_chest_exposed_side', side: 'copper_chest_exposed_side', front: 'copper_chest_exposed_left' }, h: 2.5, t: AXE, snd: 'metal' });
  def(281, 'copper_chest_weathered', 'Weathered Copper Chest', { shape: SH.CHEST, tex: { top: 'copper_chest_weathered_side', side: 'copper_chest_weathered_side', front: 'copper_chest_weathered_left' }, h: 2.5, t: AXE, snd: 'metal' });
  def(282, 'copper_chest_oxidized', 'Oxidized Copper Chest', { shape: SH.CHEST, tex: { top: 'copper_chest_oxidized_side', side: 'copper_chest_oxidized_side', front: 'copper_chest_oxidized_left' }, h: 2.5, t: AXE, snd: 'metal' });
  B.COPPER_CHEST = 279; B.COPPER_CHEST_EXPOSED = 280; B.COPPER_CHEST_WEATHERED = 281; B.COPPER_CHEST_OXIDIZED = 282;

  // coloured stairs/slabs: one id per family, colour in meta (colour<<3|dir|up, colour<<1|half)
  def(283, 'wool_stairs', 'Wool Stairs', stairs({ tex: 'wool_0', flat: 'wool_0', metaFaces: (m) => { const c = texId('wool_' + (m >> 3 & 15)); return new Uint16Array([c, c, c, c, c, c]); }, h: 0.8, t: 'shears', snd: 'cloth', flam: 1 }));
  def(284, 'wool_slab', 'Wool Slab', slab({ tex: 'wool_0', flat: 'wool_0', noCombine: 1, metaFaces: (m) => { const c = texId('wool_' + (m >> 1 & 15)); return new Uint16Array([c, c, c, c, c, c]); }, h: 0.8, t: 'shears', snd: 'cloth', flam: 1 }));
  def(285, 'concrete', 'Concrete', { tex: 'concrete_white', flat: 'concrete_white', metaFaces: (m) => { const c = texId('concrete_' + WOOL_COLORS[m & 15][0]); return new Uint16Array([c, c, c, c, c, c]); }, h: 1.5, t: SHOVEL, snd: 'gravel', resist: 30 });
  def(286, 'concrete_stairs', 'Concrete Stairs', stairs({ tex: 'concrete_white', flat: 'concrete_white', metaFaces: (m) => { const c = texId('concrete_' + WOOL_COLORS[m >> 3 & 15][0]); return new Uint16Array([c, c, c, c, c, c]); }, h: 1.5, t: SHOVEL, snd: 'gravel' }));
  def(287, 'concrete_slab', 'Concrete Slab', slab({ tex: 'concrete_white', flat: 'concrete_white', noCombine: 1, metaFaces: (m) => { const c = texId('concrete_' + WOOL_COLORS[m >> 1 & 15][0]); return new Uint16Array([c, c, c, c, c, c]); }, h: 1.5, t: SHOVEL, snd: 'gravel' }));
  B.WOOL_STAIRS = 283; B.WOOL_SLAB = 284; B.CONCRETE = 285; B.CONCRETE_STAIRS = 286; B.CONCRETE_SLAB = 287;
  B.POPLAR_LOG = 256; B.STRIPPED_POPLAR_LOG = 257; B.POPLAR_WOOD = 258; B.STRIPPED_POPLAR_WOOD = 259; B.POPLAR_PLANKS = 260;
  B.POPLAR_SLAB = 261; B.POPLAR_STAIRS = 262; B.POPLAR_FENCE = 263; B.POPLAR_FENCE_GATE = 264; B.POPLAR_DOOR = 265; B.POPLAR_TRAPDOOR = 266;
  B.POPLAR_PRESSURE_PLATE = 267; B.POPLAR_BUTTON = 268; B.POPLAR_SAPLING = 269; B.POPLAR_LEAVES_RED = 270; B.POPLAR_LEAVES_ORANGE = 271; B.POPLAR_LEAVES_YELLOW = 272;
  B.LEAF_LITTER = 273; B.RED_SHRUB = 274; B.SHELF_MUSHROOM = 275; B.BIG_SHELF_MUSHROOM = 276; B.CUSHION = 277; B.STRAW_BED = 278;
  B.TUFF = 288; B.TUFF_BRICKS = 289; B.CHISELED_TUFF_BRICKS = 290; B.POLISHED_TUFF = 291; B.CHISELED_TUFF = 292;
  B.COPPER_BLOCK = 293; B.CUT_COPPER = 294; B.CHISELED_COPPER = 295; B.OXIDIZED_COPPER = 296;
  B.OXIDIZED_CUT_COPPER = 297; B.OXIDIZED_CHISELED_COPPER = 298; B.COPPER_GRATE = 299; B.COPPER_BULB = 300;
  B.COPPER_DOOR = 301; B.COPPER_TRAPDOOR = 302; B.TRIAL_SPAWNER = 303; B.VAULT = 304; B.OMINOUS_VAULT = 305; B.HEAVY_CORE = 306;

  // ---- iteration 4: 26.3 trial chambers + copper --------------------------------
  // ids 288-306 (within the 512-id block space). Real 26.3 (Wilderness Bound)
  // textures are packed by tools/pack-all-263.mjs.
  def(288, 'tuff', 'Tuff', { tex: 'tuff', h: 1.5, t: PICK, snd: 'stone' });
  def(289, 'tuff_bricks', 'Tuff Bricks', { tex: 'tuff_bricks', h: 1.5, t: PICK, snd: 'stone' });
  def(290, 'chiseled_tuff_bricks', 'Chiseled Tuff Bricks', { tex: { side: 'chiseled_tuff_bricks', top: 'chiseled_tuff_bricks_top', bottom: 'chiseled_tuff_bricks' }, h: 1.5, t: PICK, snd: 'stone' });
  def(291, 'polished_tuff', 'Polished Tuff', { tex: 'polished_tuff', h: 1.5, t: PICK, snd: 'stone' });
  def(292, 'chiseled_tuff', 'Chiseled Tuff', { tex: { side: 'chiseled_tuff', top: 'chiseled_tuff_top', bottom: 'chiseled_tuff' }, h: 1.5, t: PICK, snd: 'stone' });
  def(293, 'copper_block', 'Block of Copper', { tex: 'copper_block', h: 3, t: AXE, snd: 'metal' });
  def(294, 'cut_copper', 'Cut Copper', { tex: 'cut_copper', h: 3, t: AXE, snd: 'metal' });
  def(295, 'chiseled_copper', 'Chiseled Copper', { tex: 'chiseled_copper', h: 3, t: AXE, snd: 'metal' });
  def(296, 'oxidized_copper', 'Oxidized Copper', { tex: 'oxidized_copper', h: 3, t: AXE, snd: 'metal' });
  def(297, 'oxidized_cut_copper', 'Oxidized Cut Copper', { tex: 'oxidized_cut_copper', h: 3, t: AXE, snd: 'metal' });
  def(298, 'oxidized_chiseled_copper', 'Oxidized Chiseled Copper', { tex: 'oxidized_chiseled_copper', h: 3, t: AXE, snd: 'metal' });
  def(299, 'copper_grate', 'Copper Grate', { tex: 'copper_grate', cutout: 1, h: 3, t: AXE, snd: 'metal' });
  def(300, 'copper_bulb', 'Copper Bulb', { tex: 'copper_bulb_lit', cutout: 1, emit: 14, h: 3, t: AXE, snd: 'metal' });
  def(301, 'copper_door', 'Copper Door', { shape: SH.DOOR, tex: { side: 'copper_door_bottom', top: 'copper_door_top', bottom: 'copper_door_bottom' }, cutout: 1, h: 3, t: AXE, snd: 'metal', flat: 'copper_door_bottom' });
  def(302, 'copper_trapdoor', 'Oxidized Copper Trapdoor', { shape: SH.TRAPDOOR, tex: 'oxidized_copper_trapdoor', cutout: 1, h: 3, t: AXE, snd: 'metal' });
  def(303, 'trial_spawner', 'Trial Spawner', { tex: { side: 'trial_spawner_side_inactive', top: 'trial_spawner_top_inactive', bottom: 'trial_spawner_bottom' }, h: 1, snd: 'stone', noItem: 1 });
  def(304, 'vault', 'Vault', { shape: SH.CHEST, tex: { top: 'vault_top', side: 'vault_side_off', front: 'vault_front_off' }, h: 1, snd: 'stone', noItem: 1, metaFaces: (m) => (m & 1 ? new Uint16Array([texId('vault_side_off'), texId('vault_side_off'), texId('vault_top'), texId('vault_top'), texId('vault_side_on'), texId('vault_front_on')]) : new Uint16Array([texId('vault_side_off'), texId('vault_side_off'), texId('vault_top'), texId('vault_top'), texId('vault_side_off'), texId('vault_front_off')])) });
  def(305, 'ominous_vault', 'Ominous Vault', { shape: SH.CHEST, tex: { top: 'vault_top_ominous', side: 'vault_side_off_ominous', front: 'vault_front_off_ominous' }, h: 1, snd: 'stone', noItem: 1, metaFaces: (m) => (m & 1 ? new Uint16Array([texId('vault_side_off_ominous'), texId('vault_side_off_ominous'), texId('vault_top_ominous'), texId('vault_top_ominous'), texId('vault_side_on_ominous'), texId('vault_front_on_ominous')]) : new Uint16Array([texId('vault_side_off_ominous'), texId('vault_side_off_ominous'), texId('vault_top_ominous'), texId('vault_top_ominous'), texId('vault_side_off_ominous'), texId('vault_front_off_ominous')])) });
  def(306, 'heavy_core', 'Heavy Core', { tex: 'heavy_core', cutout: 1, h: 3, snd: 'metal' });

  // ---- iteration 5: creaking, pale garden, nether structures -------------------
  // ids 307-333. Real 26.3 (Wilderness Bound) textures from tools/pack-all-263.mjs
  // section J. Creaking heart meta: bit0 = awake (per-meta faces, vault pattern),
  // bits1-2 = log axis (0=y, 1=x, 2=z) used by the creaking spawn rule.
  const poLog = def(307, 'pale_oak_log', 'Pale Oak Log', { tex: { top: 'pale_oak_log_top', side: 'pale_oak_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 });
  poLog.log = 1;
  def(308, 'pale_oak_planks', 'Pale Oak Planks', { tex: 'pale_oak_planks', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(309, 'pale_oak_leaves', 'Pale Oak Leaves', { tex: 'pale_oak_leaves', cutout: 1, opac: 1, h: 0.2, t: 'shears', snd: 'grass', flam: 1, ticks: 1 });
  def(310, 'pale_oak_slab', 'Pale Oak Slab', slab({ tex: { top: 'pale_oak_planks', side: 'pale_oak_slab_side', all: 'pale_oak_slab_side' }, h: 2, t: AXE, snd: 'wood', flam: 1, full: 308 }));
  def(311, 'pale_oak_stairs', 'Pale Oak Stairs', stairs({ tex: 'pale_oak_planks', h: 2, t: AXE, snd: 'wood', flam: 1 }));
  def(312, 'pale_moss_block', 'Pale Moss Block', { tex: 'pale_moss_block', h: 1, t: SHOVEL, snd: 'grass' });
  def(313, 'pale_moss_carpet', 'Pale Moss Carpet', { shape: SH.CARPET, tex: 'pale_moss_carpet', h: 0.1, t: 'shears', snd: 'grass', flam: 1 });
  def(314, 'eyeblossom', 'Eyeblossom', { shape: SH.CROSS, tex: 'open_eyeblossom', cutout: 1, emit: 8, h: 0, t: 'shears', snd: 'grass', flat: 'open_eyeblossom' });
  def(315, 'resin_clump', 'Resin Clump', { shape: SH.CROSS, tex: 'resin_clump', cutout: 1, h: 0, snd: 'wood', solid: 0, flat: 'resin_clump' });
  def(316, 'block_of_resin', 'Block of Resin', { tex: 'resin_block', h: 2, t: AXE, snd: 'wood' });
  def(317, 'resin_bricks', 'Resin Bricks', { tex: 'resin_bricks', h: 2, t: AXE, snd: 'wood' });
  def(318, 'creaking_heart', 'Creaking Heart', {
    tex: { side: 'creaking_heart_dormant', top: 'creaking_heart_top_dormant' },
    h: 1, snd: 'wood',
    metaFaces: (m) => (m & 1 ? new Uint16Array([
      texId('creaking_heart_awake'), texId('creaking_heart_awake'),
      texId('creaking_heart_top_awake'), texId('creaking_heart_top_dormant'),
      texId('creaking_heart_awake'), texId('creaking_heart_awake'),
    ]) : new Uint16Array([
      texId('creaking_heart_dormant'), texId('creaking_heart_dormant'),
      texId('creaking_heart_top_dormant'), texId('creaking_heart_top_dormant'),
      texId('creaking_heart_dormant'), texId('creaking_heart_dormant'),
    ])),
  });
  def(319, 'netherrack', 'Netherrack', { tex: 'netherrack', h: 2, t: PICK, snd: 'stone', flam: 1 });
  def(320, 'nether_bricks', 'Nether Bricks', { tex: 'nether_bricks', h: 2, t: PICK, snd: 'stone' });
  def(321, 'crying_obsidian', 'Crying Obsidian', { tex: 'crying_obsidian', emit: 10, h: 50, t: PICK, lv: 3, need: 1, resist: 6000 });
  def(322, 'chiseled_stone_bricks', 'Chiseled Stone Bricks', { tex: 'chiseled_stone_bricks', h: 1.5, t: PICK, need: 1, resist: 30 });
  def(323, 'cracked_stone_bricks', 'Cracked Stone Bricks', { tex: 'cracked_stone_bricks', h: 1.5, t: PICK, need: 1, resist: 30 });
  const doLog = def(324, 'dark_oak_log', 'Dark Oak Log', { tex: { top: 'dark_oak_log_top', side: 'dark_oak_log' }, h: 2, t: AXE, snd: 'wood', flam: 1 });
  doLog.log = 1;
  def(325, 'dark_oak_planks', 'Dark Oak Planks', { tex: 'dark_oak_planks', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(326, 'dark_oak_fence', 'Dark Oak Fence', { shape: SH.FENCE, tex: 'dark_oak_fence', h: 2, t: AXE, snd: 'wood', flam: 1 });
  def(327, 'dark_oak_slab', 'Dark Oak Slab', slab({ tex: { top: 'dark_oak_planks', side: 'dark_oak_slab_side', all: 'dark_oak_slab_side' }, h: 2, t: AXE, snd: 'wood', flam: 1, full: 325 }));
  def(328, 'dark_oak_stairs', 'Dark Oak Stairs', stairs({ tex: 'dark_oak_planks', h: 2, t: AXE, snd: 'wood', flam: 1 }));
  def(329, 'purpur_block', 'Purpur Block', { tex: 'purpur_block', h: 1, t: PICK, snd: 'stone' });
  def(330, 'purpur_pillar', 'Purpur Pillar', { tex: { side: 'purpur_pillar_side', top: 'purpur_pillar_top', bottom: 'purpur_pillar_top' }, h: 1, t: PICK, snd: 'stone' });
  def(331, 'soul_lantern', 'Soul Lantern', { shape: SH.FURN, tex: 'soul_lantern', cutout: 1, emit: 10, h: 0.6, t: PICK, need: 1, snd: 'metal', flat: 'item_soul_lantern' });
  def(332, 'purple_stained_glass', 'Purple Stained Glass', { tex: 'purple_stained_glass', transl: 1, opac: 15, h: 0.3, t: 'none', snd: 'glass', need: 1 });
  def(333, 'chiseled_nether_bricks', 'Chiseled Nether Bricks', { tex: 'chiseled_nether_bricks', h: 2, t: PICK, snd: 'stone' });
  def(334, 'pale_oak_sapling', 'Pale Oak Sapling', plant('pale_oak_sapling', { ticks: 1, sel: [0.1, 0, 0.1, 0.9, 0.8, 0.9] }));

  // ---- iteration 3 texture id pre-registration ---------------------------------
  for (let i = 0; i < 16; i++) { texId('wool_' + i); texId('cushion_' + WOOL_COLORS[i][0]); texId('concrete_' + WOOL_COLORS[i][0]); }

  // flat 2D icons for thin blocks (3D icons would be nearly invisible)
  const flatIcon = (id, name) => { const d = blocks[id]; if (d) d.flat = name; };
  flatIcon(116, 'sea_pickle');
  flatIcon(126, 'sign'); flatIcon(127, 'banner');
  [128, 129, 130, 131].forEach((id, i) => flatIcon(id, ['cobblestone_wall', 'diorite_wall', 'granite_wall', 'sandstone_wall'][i]));
  flatIcon(140, 'glass_pane'); flatIcon(141, 'iron_bars');
  flatIcon(240, 'orange_stained_glass_pane'); flatIcon(241, 'yellow_stained_glass_pane'); flatIcon(242, 'white_stained_glass_pane'); flatIcon(254, 'brown_stained_glass_pane');
  [156, 157, 158, 159].forEach((id, i) => flatIcon(id, ['oak_fence_gate', 'spruce_fence_gate', 'acacia_fence_gate', 'jungle_fence_gate'][i]));
  [160, 161, 162, 163].forEach((id, i) => flatIcon(id, ['oak_pressure_plate', 'spruce_pressure_plate', 'acacia_pressure_plate', 'jungle_pressure_plate'][i]));
  [164, 165, 166, 167].forEach((id, i) => flatIcon(id, ['oak_trapdoor', 'spruce_trapdoor', 'acacia_trapdoor', 'jungle_trapdoor'][i]));
  [168, 169, 170, 171, 172].forEach((id, i) => flatIcon(id, ['jungle_button', 'button_stone', 'oak_button', 'spruce_button', 'acacia_button'][i]));
  flatIcon(264, 'poplar_fence_gate'); flatIcon(267, 'poplar_pressure_plate'); flatIcon(266, 'poplar_trapdoor'); flatIcon(268, 'poplar_button');
}
export const TERRACOTTA_COLORS = new Array(16);
export const CARPETS = new Array(16);
export const GLAZED = new Array(16);
for (let i = 0; i < 16; i++) { TERRACOTTA_COLORS[i] = 192 + i; CARPETS[i] = 208 + i; GLAZED[i] = 224 + i; }
export const isWallBlock = (id) => id >= 128 && id <= 131;
export const isFenceBlock = (id) => id === 76 || id === 155 || id === 185 || id === 189;
export const isFenceLike = (id) => isFenceBlock(id) || isWallBlock(id);
export const WOOL_RGB = WOOL_COLORS.map(([, , c]) => c);

// misc non-block textures that live in the same array texture
for (let i = 0; i < 10; i++) texId('crack_' + i);
['p_smoke', 'p_flame', 'p_bubble', 'p_splash', 'p_crit', 'p_heart', 'p_note', 'p_white', 'p_explode', 'p_lava'].forEach(texId);

export const isLeaves = (id) => id === 16 || id === 55 || id === 58 || id === 176 || id === 247 || id === 270 || id === 271 || id === 272 || id === 309;
export const isLog = (id) => id === 15 || id === 54 || id === 57 || id === 173 || id === 244 || (id >= 256 && id <= 259) || id === 307 || id === 324;
export const isSapling = (id) => id === 6 || id === 71 || id === 72 || id === 177 || id === 248 || id === 269 || id === 334;
export const isFlower = (id) => id === 22 || id === 23 || (id >= 73 && id <= 75);
export const isWool = (id) => id >= 96 && id < 112;
export const COLOR_BLOCKS = new Set([277, 283, 284, 285, 286, 287]); // colour chosen via item dmg meta

// ---- collision / selection boxes ---------------------------------------------
const FULL = [[0, 0, 0, 1, 1, 1]];
const NONE = [];
const SLAB_BOT = [[0, 0, 0, 1, 0.5, 1]];
const SLAB_TOP = [[0, 0.5, 0, 1, 1, 1]];
const p = 1 / 16;
const STEP = [
  [0, 0.5, 0.5, 1, 1, 1], // facing +Z
  [0, 0.5, 0, 0.5, 1, 1], // -X
  [0, 0.5, 0, 1, 1, 0.5], // -Z
  [0.5, 0.5, 0, 1, 1, 1], // +X
];
const STAIR_BOXES = [];
for (let m = 0; m < 8; m++) {
  const s = STEP[m & 3];
  STAIR_BOXES.push(m & 4 ? [[0, 0.5, 0, 1, 1, 1], [s[0], 0, s[2], s[3], 0.5, s[5]]] : [[0, 0, 0, 1, 0.5, 1], s]);
}
// thin slab positions for doors / ladders, indexed by facing
const DOOR_BOXES = [
  [[0, 0, 0, 1, 1, 3 * p]],
  [[1 - 3 * p, 0, 0, 1, 1, 1]],
  [[0, 0, 1 - 3 * p, 1, 1, 1]],
  [[0, 0, 0, 3 * p, 1, 1]],
];
const LADDER_BOXES = [
  [[0, 0, 0, 1, 1, 2 * p]],
  [[1 - 2 * p, 0, 0, 1, 1, 1]],
  [[0, 0, 1 - 2 * p, 1, 1, 1]],
  [[0, 0, 0, 2 * p, 1, 1]],
];
const TORCH_SEL = [
  [[0.4, 0, 0.4, 0.6, 0.6, 0.6]],
  [[0.35, 0.2, 0, 0.65, 0.8, 0.3]],
  [[0.7, 0.2, 0.35, 1, 0.8, 0.65]],
  [[0.35, 0.2, 0.7, 0.65, 0.8, 1]],
  [[0, 0.2, 0.35, 0.3, 0.8, 0.65]],
];
const CROSS_SEL = [[0.2, 0, 0.2, 0.8, 0.8, 0.8]];
const CACTUS_COL = [[p, 0, p, 1 - p, 1 - p, 1 - p]];
const CACTUS_SEL = [[p, 0, p, 1 - p, 1, 1 - p]];
const FARM_BOX = [[0, 0, 0, 1, 15 * p, 1]];
const SNOW_SEL = [[0, 0, 0, 1, 2 * p, 1]];
const CHEST_BOX = [[p, 0, p, 1 - p, 14 * p, 1 - p]];
const BED_BOX = [[0, 0, 0, 1, 9 * p, 1]];

export function doorBoxIndex(meta) {
  return meta & 4 ? ((meta & 3) + 3) & 3 : meta & 3;
}
export function fenceConnects(id) {
  return id === 76 || isFenceBlock(id) || isWallBlock(id) || OPAQUE[id] === 1;
}

// sel=false: collision boxes, sel=true: selection (raycast) boxes.
// nb(dx,dz) returns a neighbour block id (only needed for fences).
export function getBoxes(id, meta, sel, nb) {
  switch (SHAPE[id]) {
    case SH.CUBE:
      return id === 0 ? NONE : FULL;
    case SH.CROSS:
      return sel ? (blocks[id].selBox ? [blocks[id].selBox] : CROSS_SEL) : NONE;
    case SH.CROP:
      return sel ? [[0, 0, 0, 1, 0.125 + (meta & 7) * 0.11, 1]] : NONE;
    case SH.FIRE:
      return NONE;
    case SH.TORCH:
      return sel ? TORCH_SEL[meta > 4 ? 0 : meta] : NONE;
    case SH.SLAB:
      return meta & 1 ? SLAB_TOP : SLAB_BOT;
    case SH.STAIRS:
      return STAIR_BOXES[meta & 7];
    case SH.FLUID:
      return NONE;
    case SH.CACTUS:
      return sel ? CACTUS_SEL : CACTUS_COL;
    case SH.FARMLAND:
      return FARM_BOX;
    case SH.DOOR:
      return DOOR_BOXES[doorBoxIndex(meta)];
    case SH.LADDER:
      return LADDER_BOXES[meta & 3];
    case SH.SNOW:
      return sel ? SNOW_SEL : NONE;
    case SH.FENCE: {
      const w = nb && fenceConnects(nb(-1, 0)), e = nb && fenceConnects(nb(1, 0));
      const n = nb && fenceConnects(nb(0, -1)), s = nb && fenceConnects(nb(0, 1));
      return [[w ? 0 : 0.375, 0, n ? 0 : 0.375, e ? 1 : 0.625, sel ? 1 : 1.5, s ? 1 : 0.625]];
    }
    case SH.CHEST:
      return CHEST_BOX;
    case SH.BED:
      return BED_BOX;
    case SH.CARPET:
      return sel ? [[0, 0, 0, 1, 2 * p, 1]] : NONE;
    case SH.WALL: {
      const conn = nb && (isWallLike(nb(-1, 0)) || isWallLike(nb(1, 0)) || isWallLike(nb(0, -1)) || isWallLike(nb(0, 1)));
      return sel ? FULL : conn ? FULL : [[0, 0, 0, 1, 0.5, 1]];
    }
    case SH.TRAPDOOR: {
      const tf = meta & 3, open = meta & 4, top = meta & 8;
      if (!open) return top ? [[0, 1 - p, 0, 1, 1, 1]] : [[0, 0, 0, 1, p, 1]];
      const y0 = 0, y1 = 1;
      if (tf === 0) return [[0, y0, 0, p, y1, 1]];
      if (tf === 1) return [[1 - p, y0, 0, 1, y1, 1]];
      if (tf === 2) return [[0, y0, 1 - p, 1, y1, 1]];
      return [[0, y0, 0, p, y1, 1]];
    }
    case SH.GATE: {
      const f = meta & 3, open = meta & 4;
      if (!open) {
        if (f === 0) return [[p, 0, 13 * p, 1 - p, 1, 1]];
        if (f === 1) return [[0, 0, p, 3 * p, 1, 1 - p]];
        if (f === 2) return [[p, 0, 0, 1 - p, 1, 3 * p]];
        return [[13 * p, 0, p, 1, 1, 1 - p]];
      }
      if (f === 0) return [[13 * p, 0, p, 1, 1, 1 - p]];
      if (f === 1) return [[p, 0, 0, 1 - p, 1, 3 * p]];
      if (f === 2) return [[0, 0, p, 3 * p, 1, 1 - p]];
      return [[p, 0, 13 * p, 1 - p, 1, 1]];
    }
    case SH.BUTTON:
    case SH.SIGNW:
    case SH.BANNERW: {
      const f = meta & 3;
      if (f === 0) return sel ? [[0, 0, 1 - 2 * p, 1, 1, 1]] : NONE;
      if (f === 1) return sel ? [[1 - 2 * p, 0, 0, 1, 1, 1]] : NONE;
      if (f === 2) return sel ? [[0, 0, 0, 1, 1, 2 * p]] : NONE;
      return sel ? [[0, 0, 0, 2 * p, 1, 1]] : NONE;
    }
    case SH.FLOWER_POT:
      return [[3 * p, 0, 3 * p, 13 * p, 10 * p, 13 * p]];
    case SH.CAMPFIRE:
      return sel ? [[0, 0, 0, 1, 4 * p, 1]] : NONE;
    case SH.PICKLE:
      return sel ? CROSS_SEL : NONE;
    case SH.PRESSURE:
      return sel ? [[0, 0, 0, 1, p, 1]] : NONE;
    case SH.FURN: {
      switch (id) {
        case 118: return [[5 * p, 2 * p, 5 * p, 11 * p, 9 * p, 11 * p]];
        case 119: return [[p, 0, p, 1 - p, 12 * p, 1 - p]];
        case 142: return [[p, 0, p, 1 - p, 1, 1 - p]];
        case 143: return [[3 * p, 0, 3 * p, 13 * p, 15 * p, 13 * p]];
        case 144:
        case 152: return FULL;
        case 145: return [[3 * p, 0, 3 * p, 13 * p, 1, 13 * p]];
        case 146:
        case 148: return [[p, 0, p, 1 - p, 10 * p, 1 - p]];
        case 147:
        case 149:
        case 151:
        case 153: return [[p, 0, p, 1 - p, 12 * p, 1 - p]];
        case 150:
        case 243: return [[p, 0, p, 1 - p, 12 * p, 1 - p]];
        default: return [[p, 0, p, 1 - p, 12 * p, 1 - p]];
      }
    }
  }
  return FULL;
}

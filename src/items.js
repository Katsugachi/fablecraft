// Item registry, tool/food/armor stats, crafting & smelting recipes, block drops.
import { B, blocks, SH, WOOL_COLORS, isLeaves, BMAX, COLOR_BLOCKS } from './blocks.js';

export const items = new Array(512).fill(null);
export const I = {};
export const itemByKey = new Map();
let nextId = BMAX;

function it(key, name, o = {}) {
  const id = nextId++;
  items[id] = { id, key, name, stack: 64, icon: 'item_' + key, ...o };
  I[key.toUpperCase()] = id;
  itemByKey.set(key, id);
  return id;
}

// block items share the block id
for (const b of blocks) {
  if (!b || b.id === 0) continue;
  const flat = b.flat ?? (b.shape === SH.CROSS ? blocks[b.id].key : null);
  items[b.id] = { id: b.id, key: b.key, name: b.name, stack: 64, block: b.id, icon: flat, hidden: b.noItem };
  itemByKey.set(b.key, b.id);
}
items[B.BED].stack = 1;
// colour-cycling block items (right-click in inventory to cycle dye colour)
for (const [key, b] of Object.entries(blocks)) { if (b && COLOR_BLOCKS.has(b.id)) items[b.id].cyc = true; }

// ---- materials ----------------------------------------------------------------
it('stick', 'Stick', { fuel: 100 });
it('coal', 'Coal', { fuel: 1600 });
it('charcoal', 'Charcoal', { fuel: 1600 });
it('iron_ingot', 'Iron Ingot');
it('gold_ingot', 'Gold Ingot');
it('diamond', 'Diamond');
it('redstone', 'Redstone Dust');
it('lapis', 'Lapis Lazuli');
it('flint', 'Flint');
it('feather', 'Feather');
it('string', 'String');
it('gunpowder', 'Gunpowder');
it('bone', 'Bone');
it('bone_meal', 'Bone Meal');
it('leather', 'Leather');
it('clay_ball', 'Clay Ball');
it('brick', 'Brick');
it('snowball', 'Snowball', { stack: 16 });
it('paper', 'Paper');
it('book', 'Book');
it('wheat_seeds', 'Wheat Seeds', { place: B.WHEAT });
it('wheat', 'Wheat');
it('bowl', 'Bowl');
it('melon_slice', 'Melon Slice', { food: { hunger: 2, sat: 0.6 } });
it('melon_seeds', 'Melon Seeds', { place: B.MELON_STEM });
it('pumpkin_seeds', 'Pumpkin Seeds', { place: B.PUMPKIN_STEM });
it('carrot', 'Carrot', { food: { hunger: 3, sat: 1.8 } });
it('potato', 'Potato', { food: { hunger: 1, sat: 0.3 } });
it('baked_potato', 'Baked Potato', { food: { hunger: 5, sat: 3 } });
it('beetroot', 'Beetroot', { food: { hunger: 1, sat: 0.6 } });
it('beetroot_seeds', 'Beetroot Seeds', { place: B.BEETROOTS });
// dyes (colour order matches WOOL_COLORS)
for (const [ck, cn] of WOOL_COLORS) it(ck + '_dye', cn + ' Dye');
// iteration 4: 26.3 trial chamber materials
it('emerald', 'Emerald');
it('copper_ingot', 'Copper Ingot');
it('golden_carrot', 'Golden Carrot', { food: { hunger: 6, sat: 2.4 } });
it('breeze_rod', 'Breeze Rod');
it('wind_charge', 'Wind Charge');
it('trial_key', 'Trial Key');
it('ominous_trial_key', 'Ominous Trial Key');
it('mace', 'Mace', { stack: 1, dmg: 6, dur: 500 });

// ---- tools --------------------------------------------------------------------
export const TIERS = {
  wooden: { tier: 0, speed: 2, dur: 59, dmg: 0, name: 'Wooden' },
  stone: { tier: 1, speed: 4, dur: 131, dmg: 1, name: 'Stone' },
  iron: { tier: 2, speed: 6, dur: 250, dmg: 2, name: 'Iron' },
  golden: { tier: 0, speed: 12, dur: 32, dmg: 0, name: 'Golden' },
  diamond: { tier: 3, speed: 8, dur: 1561, dmg: 3, name: 'Diamond' },
};
const TOOL_KINDS = [['sword', 'Sword', 4], ['pickaxe', 'Pickaxe', 2], ['axe', 'Axe', 3], ['shovel', 'Shovel', 1], ['hoe', 'Hoe', 0]];
for (const m in TIERS) {
  const t = TIERS[m];
  for (const [k, n, base] of TOOL_KINDS) {
    it(`${m}_${k}`, `${t.name} ${n}`, {
      stack: 1, tool: k, tier: t.tier, speed: t.speed, dur: t.dur, dmg: k === 'hoe' ? 1 : base + t.dmg, mat: m,
      fuel: m === 'wooden' ? 200 : 0,
    });
  }
}
it('shears', 'Shears', { stack: 1, tool: 'shears', tier: 0, speed: 5, dur: 238, dmg: 1 });
it('flint_and_steel', 'Flint and Steel', { stack: 1, dur: 64 });
it('bucket', 'Bucket', { stack: 16 });
it('water_bucket', 'Water Bucket', { stack: 1 });
it('lava_bucket', 'Lava Bucket', { stack: 1, fuel: 20000 });
it('bow', 'Bow', { stack: 1, dur: 384, fuel: 300 });
it('arrow', 'Arrow');

// ---- food ---------------------------------------------------------------------
const food = (hunger, sat, o = {}) => ({ food: { hunger, sat }, ...o });
it('apple', 'Apple', food(4, 2.4));
it('golden_apple', 'Golden Apple', food(4, 9.6, { always: true }));
it('bread', 'Bread', food(5, 6));
it('porkchop', 'Raw Porkchop', food(3, 1.8));
it('cooked_porkchop', 'Cooked Porkchop', food(8, 12.8));
it('beef', 'Raw Beef', food(3, 1.8));
it('steak', 'Steak', food(8, 12.8));
it('chicken', 'Raw Chicken', food(2, 1.2));
it('cooked_chicken', 'Cooked Chicken', food(6, 7.2));
it('mutton', 'Raw Mutton', food(2, 1.2));
it('cooked_mutton', 'Cooked Mutton', food(6, 9.6));
it('rotten_flesh', 'Rotten Flesh', food(4, 0.8));
it('mushroom_stew', 'Mushroom Stew', food(6, 7.2, { stack: 1 }));
// iteration 5: creaking / brewing / nether materials
it('glass_bottle', 'Glass Bottle');
it('glowstone_dust', 'Glowstone Dust', { fuel: 1600 });
it('sugar', 'Sugar');
it('spider_eye', 'Spider Eye', { food: { hunger: 1, sat: 0 } });
it('gold_nugget', 'Gold Nugget');
it('resin_brick', 'Resin Brick');
it('nether_brick', 'Nether Brick');

// ---- armor --------------------------------------------------------------------
export const ARMOR_MATS = {
  leather: { name: 'Leather', pts: [1, 3, 2, 1], dur: 5 },
  golden: { name: 'Golden', pts: [2, 5, 3, 1], dur: 7 },
  iron: { name: 'Iron', pts: [2, 6, 5, 2], dur: 15 },
  diamond: { name: 'Diamond', pts: [3, 8, 6, 3], dur: 33 },
};
const ARMOR_SLOTS = [['helmet', 'Helmet', 11], ['chestplate', 'Chestplate', 16], ['leggings', 'Leggings', 15], ['boots', 'Boots', 13]];
const LEATHER_NAMES = ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots'];
for (const m in ARMOR_MATS) {
  const a = ARMOR_MATS[m];
  ARMOR_SLOTS.forEach(([k, n, d], slot) => {
    it(`${m}_${k}`, m === 'leather' ? LEATHER_NAMES[slot] : `${a.name} ${n}`, { stack: 1, armor: { slot, pts: a.pts[slot] }, dur: a.dur * d, mat: m });
  });
}

// fuels for block items
const FUEL = {
  [B.PLANKS]: 300, [B.BIRCH_PLANKS]: 300, [B.SPRUCE_PLANKS]: 300, [B.LOG]: 300, [B.BIRCH_LOG]: 300, [B.SPRUCE_LOG]: 300,
  [B.SAPLING]: 100, [B.BIRCH_SAPLING]: 100, [B.SPRUCE_SAPLING]: 100, [B.COAL_BLOCK]: 16000, [B.CRAFTING_TABLE]: 300,
  [B.CHEST]: 300, [B.BOOKSHELF]: 300, [B.FENCE]: 300, [B.OAK_SLAB]: 150, [B.BIRCH_SLAB]: 150, [B.SPRUCE_SLAB]: 150,
  [B.OAK_STAIRS]: 300, [B.BIRCH_STAIRS]: 300, [B.SPRUCE_STAIRS]: 300, [B.DOOR]: 200, [B.LADDER]: 300,
};
for (let i = 0; i < 16; i++) FUEL[B.WOOL + i] = 100;
FUEL[B.ACACIA_PLANKS] = 300; FUEL[B.ACACIA_LOG] = 300; FUEL[B.ACACIA_SAPLING] = 100; FUEL[B.ACACIA_FENCE] = 300;
FUEL[B.JUNGLE_PLANKS] = 300; FUEL[B.JUNGLE_LOG] = 300; FUEL[B.JUNGLE_SAPLING] = 100; FUEL[B.JUNGLE_FENCE] = 300;
FUEL[B.ACACIA_TRAPDOOR] = 200; FUEL[B.TRAPDOOR_OAK] = 200; FUEL[B.TRAPDOOR_SPRUCE] = 200; FUEL[B.TRAPDOOR_JUNGLE] = 200;
FUEL[B.DOOR_SPRUCE] = 200; FUEL[B.DOOR_ACACIA] = 200; FUEL[B.DOOR_JUNGLE] = 200;
FUEL[B.FENCE_GATE_OAK] = 300; FUEL[B.FENCE_GATE_SPRUCE] = 300; FUEL[B.FENCE_GATE_ACACIA] = 300; FUEL[B.FENCE_GATE_JUNGLE] = 300;
FUEL[B.SLAB_ACACIA] = 150; FUEL[B.SLAB_JUNGLE] = 150; FUEL[B.STAIRS_ACACIA] = 300; FUEL[B.STAIRS_JUNGLE] = 300;
FUEL[B.SIGN] = 300; FUEL[B.BANNER] = 100; FUEL[B.HAY_BLOCK] = 100; FUEL[B.LECTERN] = 300;
FUEL[B.ACACIA_WOOD] = 300; FUEL[B.SPRUCE_WOOD] = 300; FUEL[B.STRIPPED_OAK_LOG] = 300; FUEL[B.STRIPPED_OAK_WOOD] = 300;
FUEL[B.STRIPPED_SPRUCE_LOG] = 300; FUEL[B.STRIPPED_SPRUCE_WOOD] = 300; FUEL[B.STRIPPED_ACACIA_LOG] = 300;
FUEL[B.JUNGLE_WOOD] = 300;
export const fuelTime = (id) => (id < BMAX ? FUEL[id] || 0 : items[id]?.fuel || 0);

// ---- smelting -------------------------------------------------------------------
export const SMELT = new Map([
  [B.IRON_ORE, I.IRON_INGOT], [B.GOLD_ORE, I.GOLD_INGOT], [B.SAND, B.GLASS], [B.COBBLESTONE, B.STONE], [B.STONE, B.SMOOTH_STONE],
  [B.LOG, I.CHARCOAL], [B.BIRCH_LOG, I.CHARCOAL], [B.SPRUCE_LOG, I.CHARCOAL], [I.CLAY_BALL, I.BRICK],
  [I.PORKCHOP, I.COOKED_PORKCHOP], [I.BEEF, I.STEAK], [I.CHICKEN, I.COOKED_CHICKEN], [I.MUTTON, I.COOKED_MUTTON],
  [B.COAL_ORE, I.COAL], [B.DIAMOND_ORE, I.DIAMOND], [B.REDSTONE_ORE, I.REDSTONE], [B.LAPIS_ORE, I.LAPIS],
  [B.CLAY, B.TERRACOTTA],
  // iteration 5
  [B.NETHERRACK, I.NETHER_BRICK], [B.RESIN_CLUMP, I.RESIN_BRICK], [B.GLOWSTONE, I.GLOWSTONE_DUST],
]);
for (let i = 0; i < 16; i++) SMELT.set(192 + i, 224 + i); // coloured terracotta -> coloured glazed terracotta
SMELT.set(I.POTATO, I.BAKED_POTATO); // potato -> baked potato

// ---- crafting -------------------------------------------------------------------
const G = {
  planks: [B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS, B.ACACIA_PLANKS, B.JUNGLE_PLANKS],
  logs: [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.ACACIA_LOG, B.JUNGLE_LOG],
  wool: Array.from({ length: 16 }, (_, i) => B.WOOL + i),
  coal: [I.COAL, I.CHARCOAL],
  stone: [B.STONE, B.COBBLESTONE, B.GRANITE, B.DIORITE, B.ANDESITE, B.STONE_BRICKS],
};
export const recipes = [];
const norm = (x) => (typeof x === 'string' ? G[x.slice(1)] : x);
function shaped(out, count, pattern, key, meta) {
  const h = pattern.length, w = pattern[0].length, grid = [];
  for (const row of pattern) for (const ch of row) grid.push(ch === ' ' ? 0 : norm(key[ch]));
  recipes.push({ w, h, grid, out, count, outMeta: meta && meta.out, sameColor: !!(meta && meta.same) });
}
function shapeless(out, count, list, meta) {
  recipes.push({ shapeless: list.map(norm), out, count, outMeta: meta && meta.out, sameColor: !!(meta && meta.same) });
}
const P = '#planks';

shaped(B.PLANKS, 4, ['L'], { L: B.LOG });
shaped(B.BIRCH_PLANKS, 4, ['L'], { L: B.BIRCH_LOG });
shaped(B.SPRUCE_PLANKS, 4, ['L'], { L: B.SPRUCE_LOG });
shaped(I.STICK, 4, ['P', 'P'], { P });
shaped(B.CRAFTING_TABLE, 1, ['PP', 'PP'], { P });
shaped(B.FURNACE, 1, ['CCC', 'C C', 'CCC'], { C: B.COBBLESTONE });
shaped(B.CHEST, 1, ['PPP', 'P P', 'PPP'], { P });
shaped(B.TORCH, 4, ['C', 'S'], { C: '#coal', S: I.STICK });
const TOOL_MAT = { wooden: P, stone: B.COBBLESTONE, iron: I.IRON_INGOT, golden: I.GOLD_INGOT, diamond: I.DIAMOND };
for (const m in TOOL_MAT) {
  const k = { M: TOOL_MAT[m], S: I.STICK };
  shaped(I[`${m}_PICKAXE`.toUpperCase()], 1, ['MMM', ' S ', ' S '], k);
  shaped(I[`${m}_AXE`.toUpperCase()], 1, ['MM', 'MS', ' S'], k);
  shaped(I[`${m}_SHOVEL`.toUpperCase()], 1, ['M', 'S', 'S'], k);
  shaped(I[`${m}_SWORD`.toUpperCase()], 1, ['M', 'M', 'S'], k);
  shaped(I[`${m}_HOE`.toUpperCase()], 1, ['MM', ' S', ' S'], k);
}
const ARMOR_MAT = { leather: I.LEATHER, iron: I.IRON_INGOT, golden: I.GOLD_INGOT, diamond: I.DIAMOND };
for (const m in ARMOR_MAT) {
  const k = { M: ARMOR_MAT[m] };
  shaped(I[`${m}_HELMET`.toUpperCase()], 1, ['MMM', 'M M'], k);
  shaped(I[`${m}_CHESTPLATE`.toUpperCase()], 1, ['M M', 'MMM', 'MMM'], k);
  shaped(I[`${m}_LEGGINGS`.toUpperCase()], 1, ['MMM', 'M M', 'M M'], k);
  shaped(I[`${m}_BOOTS`.toUpperCase()], 1, ['M M', 'M M'], k);
}
shaped(B.STONE_BRICKS, 4, ['SS', 'SS'], { S: B.STONE });
shaped(B.SANDSTONE, 1, ['SS', 'SS'], { S: B.SAND });
shaped(B.BRICKS, 1, ['BB', 'BB'], { B: I.BRICK });
shaped(B.SNOW_BLOCK, 1, ['SS', 'SS'], { S: I.SNOWBALL });
shaped(B.CLAY, 1, ['CC', 'CC'], { C: I.CLAY_BALL });
shaped(B.WOOL, 1, ['SS', 'SS'], { S: I.STRING });
shaped(B.STONE_SLAB, 6, ['SSS'], { S: B.SMOOTH_STONE });
shaped(B.STONE_SLAB, 6, ['SSS'], { S: B.STONE });
shaped(B.OAK_SLAB, 6, ['SSS'], { S: B.PLANKS });
shaped(B.BIRCH_SLAB, 6, ['SSS'], { S: B.BIRCH_PLANKS });
shaped(B.SPRUCE_SLAB, 6, ['SSS'], { S: B.SPRUCE_PLANKS });
shaped(B.COBBLESTONE_SLAB, 6, ['SSS'], { S: B.COBBLESTONE });
shaped(B.BRICK_SLAB, 6, ['SSS'], { S: B.BRICKS });
shaped(B.STONE_BRICK_SLAB, 6, ['SSS'], { S: B.STONE_BRICKS });
shaped(B.SANDSTONE_SLAB, 6, ['SSS'], { S: B.SANDSTONE });
const stairsOf = (out, m) => shaped(out, 4, ['M  ', 'MM ', 'MMM'], { M: m });
stairsOf(B.OAK_STAIRS, B.PLANKS);
stairsOf(B.BIRCH_STAIRS, B.BIRCH_PLANKS);
stairsOf(B.SPRUCE_STAIRS, B.SPRUCE_PLANKS);
stairsOf(B.COBBLESTONE_STAIRS, B.COBBLESTONE);
stairsOf(B.STONE_BRICK_STAIRS, B.STONE_BRICKS);
stairsOf(B.BRICK_STAIRS, B.BRICKS);
stairsOf(B.SANDSTONE_STAIRS, B.SANDSTONE);
shaped(B.TNT, 1, ['GSG', 'SGS', 'GSG'], { G: I.GUNPOWDER, S: B.SAND });
shaped(B.BOOKSHELF, 1, ['PPP', 'BBB', 'PPP'], { P, B: I.BOOK });
shaped(I.PAPER, 3, ['SSS'], { S: B.SUGAR_CANE });
shapeless(I.BOOK, 1, [I.PAPER, I.PAPER, I.PAPER, I.LEATHER]);
shaped(B.BED, 1, ['WWW', 'PPP'], { W: '#wool', P });
shaped(B.DOOR, 3, ['PP', 'PP', 'PP'], { P });
shaped(B.LADDER, 3, ['S S', 'SSS', 'S S'], { S: I.STICK });
shaped(B.FENCE, 3, ['PSP', 'PSP'], { P, S: I.STICK });
shaped(I.BUCKET, 1, ['I I', ' I '], { I: I.IRON_INGOT });
shaped(I.SHEARS, 1, [' I', 'I '], { I: I.IRON_INGOT });
shapeless(I.FLINT_AND_STEEL, 1, [I.IRON_INGOT, I.FLINT]);
shaped(I.BOW, 1, [' SW', 'S W', ' SW'], { S: I.STICK, W: I.STRING });
shaped(I.ARROW, 4, ['F', 'S', 'E'], { F: I.FLINT, S: I.STICK, E: I.FEATHER });
shaped(I.BREAD, 1, ['WWW'], { W: I.WHEAT });
shapeless(I.BONE_MEAL, 3, [I.BONE]);
shaped(I.BOWL, 4, ['P P', ' P '], { P });
shapeless(I.MUSHROOM_STEW, 1, [B.RED_MUSHROOM, B.BROWN_MUSHROOM, I.BOWL]);
shaped(I.GOLDEN_APPLE, 1, ['GGG', 'GAG', 'GGG'], { G: I.GOLD_INGOT, A: I.APPLE });
shaped(B.JACK_O_LANTERN, 1, ['P', 'T'], { P: B.PUMPKIN, T: B.TORCH });
shaped(B.GLOWSTONE, 1, ['RG', 'GR'], { R: I.REDSTONE, G: I.GOLD_INGOT });
shapeless(B.MOSSY_COBBLESTONE, 1, [B.COBBLESTONE, B.TALL_GRASS]);
shapeless(B.MOSSY_STONE_BRICKS, 1, [B.STONE_BRICKS, B.TALL_GRASS]);
const blockOf = (block, item) => {
  shaped(block, 1, ['XXX', 'XXX', 'XXX'], { X: item });
  shapeless(item, 9, [block]);
};
blockOf(B.IRON_BLOCK, I.IRON_INGOT);
blockOf(B.GOLD_BLOCK, I.GOLD_INGOT);
blockOf(B.DIAMOND_BLOCK, I.DIAMOND);
blockOf(B.COAL_BLOCK, I.COAL);
blockOf(B.LAPIS_BLOCK, I.LAPIS);
blockOf(B.REDSTONE_BLOCK, I.REDSTONE);

// ---- iteration 3: 26.3 Wilderness Bound recipes ------------------------------
// poplar wood family
shaped(B.POPLAR_PLANKS, 4, ['L'], { L: B.POPLAR_LOG });
shaped(B.POPLAR_PLANKS, 4, ['L'], { L: B.POPLAR_WOOD });
shaped(B.POPLAR_PLANKS, 4, ['L'], { L: B.STRIPPED_POPLAR_LOG });
shaped(B.POPLAR_PLANKS, 4, ['L'], { L: B.STRIPPED_POPLAR_WOOD });
shaped(B.POPLAR_LOG, 4, ['LL', 'LL'], { L: B.POPLAR_WOOD }); // wood <-> log recombination follows house style
shaped(B.POPLAR_WOOD, 4, ['LL', 'LL'], { L: B.POPLAR_LOG });
shaped(B.POPLAR_SLAB, 6, ['SSS'], { S: B.POPLAR_PLANKS });
shaped(B.POPLAR_STAIRS, 4, ['M  ', 'MM ', 'MMM'], { M: B.POPLAR_PLANKS });
shaped(B.POPLAR_FENCE, 3, ['PSP', 'PSP'], { P: B.POPLAR_PLANKS, S: I.STICK });
shaped(B.POPLAR_FENCE_GATE, 1, ['P P', 'PSP', 'P P'], { P: B.POPLAR_PLANKS, S: I.STICK }); // 6 planks + 2 sticks
shaped(B.POPLAR_DOOR, 3, ['PP', 'PP', 'PP'], { P: B.POPLAR_PLANKS });
shaped(B.POPLAR_TRAPDOOR, 2, ['PP', 'PP'], { P: B.POPLAR_PLANKS });
shaped(B.POPLAR_PRESSURE_PLATE, 1, ['PP'], { P: B.POPLAR_PLANKS });
shaped(B.POPLAR_BUTTON, 1, ['P'], { P: B.POPLAR_PLANKS });
// straw bed: 3 hay bales in a row -> 4 (vanilla 26.3)
shaped(B.STRAW_BED, 4, ['HHH'], { H: B.HAY_BLOCK });
items[B.STRAW_BED].stack = 16;
// wool stairs/slabs: 3 wool of one colour -> 6 (colour preserved, vanilla 26.3)
{
  const WID = [96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
  for (let c = 0; c < 16; c++) {
    shaped(B.WOOL_SLAB, 6, ['SSS'], { S: WID[c] }, { out: c });
    shaped(B.WOOL_STAIRS, 4, ['M  ', 'MM ', 'MMM'], { M: WID[c] }, { out: c });
  }
}
// cushion: 3 wool slabs of the same colour -> 1 (vanilla 26.3)
shaped(B.CUSHION, 1, ['SSS'], { S: B.WOOL_SLAB }, { same: true });
// concrete: 4 sand + 1 dye of the colour -> 1 concrete (vanilla 26.3 uses cement)
{
  const DYED = {
    white: I.WHITE_DYE, orange: I.ORANGE_DYE, magenta: I.MAGENTA_DYE, light_blue: I.LIGHT_BLUE_DYE,
    yellow: I.YELLOW_DYE, lime: I.LIME_DYE, pink: I.PINK_DYE, gray: I.GRAY_DYE, light_gray: I.LIGHT_GRAY_DYE,
    cyan: I.CYAN_DYE, purple: I.PURPLE_DYE, blue: I.BLUE_DYE, brown: I.BROWN_DYE, green: I.GREEN_DYE,
    red: I.RED_DYE, black: I.BLACK_DYE,
  };
  for (const [k, c] of WOOL_COLORS.entries()) {
    shapeless(B.CONCRETE, 1, [B.SAND, B.SAND, B.SAND, B.SAND, DYED[k]], { out: c });
  }
}
// concrete stairs/slab: 6 concrete of one colour -> 4 stairs / 6 slabs (colour preserved)
{
  for (let c = 0; c < 16; c++) {
    shaped(B.CONCRETE_STAIRS, 4, ['M  ', 'MM ', 'MMM'], { M: B.CONCRETE }, { same: true });
    shaped(B.CONCRETE_SLAB, 6, ['SSS'], { S: B.CONCRETE }, { same: true });
  }
}

// ---- iteration 4: 26.3 trial chambers + copper recipes (vanilla) ---------------
// tuff processing
shaped(B.POLISHED_TUFF, 4, ['TT', 'TT'], { T: B.TUFF });
shaped(B.TUFF_BRICKS, 4, ['PP', 'PP'], { P: B.POLISHED_TUFF });
shaped(B.CHISELED_TUFF_BRICKS, 1, ['T', 'T'], { T: B.TUFF_BRICKS });
shaped(B.CHISELED_TUFF, 1, ['C', 'C'], { C: B.CHISELED_TUFF_BRICKS });
// copper processing (vanilla 26.3 counts; fablecraft has no oxidation stages,
// no stonecutter, and no blaze rod — the bulb drops its blaze-rod ingredient)
shaped(B.COPPER_BLOCK, 1, ['III', 'III', 'III'], { I: I.COPPER_INGOT });
shaped(B.CUT_COPPER, 4, ['CC', 'CC'], { C: B.COPPER_BLOCK });
shaped(B.CHISELED_COPPER, 1, ['C', 'C'], { C: B.CUT_COPPER });
shaped(B.COPPER_GRATE, 4, [' C ', 'C C', ' C '], { C: B.COPPER_BLOCK });
shapeless(B.COPPER_BULB, 4, [B.COPPER_BLOCK, B.COPPER_BLOCK, B.COPPER_BLOCK, I.REDSTONE]);
shaped(B.COPPER_DOOR, 3, ['II', 'II', 'II'], { I: I.COPPER_INGOT });
shaped(B.COPPER_TRAPDOOR, 2, ['II', 'II', 'II'], { I: I.COPPER_INGOT });
// trial chamber items
shaped(I.WIND_CHARGE, 4, ['R'], { R: I.BREEZE_ROD });
shaped(I.MACE, 1, ['C', 'R'], { C: B.HEAVY_CORE, R: I.BREEZE_ROD });

// ---- iteration 5: creaking, pale garden, nether structure recipes (vanilla) --
// wood processing
shaped(B.PALE_OAK_PLANKS, 4, ['L'], { L: B.PALE_OAK_LOG });
shaped(B.PALE_OAK_SLAB, 6, ['SSS'], { S: B.PALE_OAK_PLANKS });
shaped(B.PALE_OAK_STAIRS, 4, ['M  ', 'MM ', 'MMM'], { M: B.PALE_OAK_PLANKS });
shaped(B.DARK_OAK_PLANKS, 4, ['L'], { L: B.DARK_OAK_LOG });
shaped(B.DARK_OAK_SLAB, 6, ['SSS'], { S: B.DARK_OAK_PLANKS });
shaped(B.DARK_OAK_STAIRS, 4, ['M  ', 'MM ', 'MMM'], { M: B.DARK_OAK_PLANKS });
shaped(B.DARK_OAK_FENCE, 3, ['PPP', 'PPP'], { P: B.DARK_OAK_PLANKS });
// resin (vanilla: smelt clump -> brick item; 4 brick items -> resin bricks block;
// 9 clumps -> block of resin; vertical heart = 2 pale oak logs + block of resin)
shaped(B.RESIN_BRICKS, 1, ['RR', 'RR'], { R: I.RESIN_BRICK });
shaped(B.BLOCK_OF_RESIN, 1, ['RRR', 'RRR', 'RRR'], { R: B.RESIN_CLUMP });
shaped(B.CREAKING_HEART, 1, ['L', 'R', 'L'], { L: B.PALE_OAK_LOG, R: B.BLOCK_OF_RESIN });
// pale moss (vanilla: 2 blocks -> 3 carpet; the block itself is not craftable)
shaped(B.PALE_MOSS_CARPET, 3, ['M', 'M'], { M: B.PALE_MOSS_BLOCK });
// nether (vanilla: smelt netherrack -> brick item; 2x2 bricks -> block)
shaped(I.NETHER_BRICK, 1, ['NN', 'NN'], { N: B.NETHERRACK });
shaped(B.NETHER_BRICKS, 1, ['BB', 'BB'], { B: I.NETHER_BRICK });
shaped(B.CHISELED_NETHER_BRICKS, 1, ['B', 'B'], { B: B.NETHER_BRICKS });
// stone brick variants (vanilla 1.14+ stack recipes)
shaped(B.CHISELED_STONE_BRICKS, 1, ['S', 'S'], { S: B.STONE_BRICKS });
shaped(B.CRACKED_STONE_BRICKS, 1, ['C', 'C'], { C: B.CHISELED_STONE_BRICKS });
// brewing & misc (vanilla)
shaped(I.GLASS_BOTTLE, 3, ['G G', ' G '], { G: B.GLASS });
shapeless(I.GOLD_NUGGET, 9, [I.GOLD_INGOT]);
shaped(I.GOLD_INGOT, 1, ['NN', 'NN', 'NN'], { N: I.GOLD_NUGGET });
shaped(B.GLOWSTONE, 1, ['DD', 'DD'], { D: I.GLOWSTONE_DUST });
// soul lantern: vanilla uses a soul torch (not in fablecraft) — coal stands in for the soul fuel
shaped(B.SOUL_LANTERN, 4, [' I ', 'ICI', ' I '], { I: I.IRON_INGOT, C: I.COAL });
// stained glass (vanilla 1.14+: 1 glass + 1 dye -> 8)
shapeless(B.PURPLE_STAINED_GLASS, 8, [B.GLASS, I.PURPLE_DYE]);
// sugar (vanilla)
shapeless(I.SUGAR, 1, [B.SUGAR_CANE]);
// nether brick item is also crafted 2x2 from netherrack (vanilla smelt OR craft)

// ---- modern (village-age) recipes -------------------------------------------
shaped(B.ACACIA_PLANKS, 4, ['L'], { L: B.ACACIA_LOG });
shaped(B.JUNGLE_PLANKS, 4, ['L'], { L: B.JUNGLE_LOG });
shaped(B.ACACIA_PLANKS, 4, ['L'], { L: B.ACACIA_WOOD });
shaped(B.JUNGLE_PLANKS, 4, ['L'], { L: B.JUNGLE_WOOD });
shaped(B.SPRUCE_PLANKS, 4, ['L'], { L: B.SPRUCE_WOOD });
shaped(B.PLANKS, 4, ['L'], { L: B.STRIPPED_OAK_LOG });
shaped(B.SPRUCE_PLANKS, 4, ['L'], { L: B.STRIPPED_SPRUCE_LOG });
shaped(B.ACACIA_PLANKS, 4, ['L'], { L: B.STRIPPED_ACACIA_LOG });
// wood (4 logs -> 4 wood), stripped wood (4 stripped logs -> 4)
const woodOf = (out, m) => shaped(out, 4, ['LL', 'LL'], { L: m });
const logOf = (out, m) => shapeless(out, 1, [m]); // strip with crafting (axe-stripping approximation)
woodOf(B.ACACIA_WOOD, B.ACACIA_LOG);
woodOf(B.SPRUCE_WOOD, B.SPRUCE_LOG);
woodOf(B.STRIPPED_OAK_WOOD, B.STRIPPED_OAK_LOG);
woodOf(B.STRIPPED_SPRUCE_WOOD, B.STRIPPED_SPRUCE_LOG);
woodOf(B.STRIPPED_ACACIA_WOOD, B.STRIPPED_ACACIA_LOG);
woodOf(B.JUNGLE_WOOD, B.JUNGLE_LOG);
logOf(B.STRIPPED_OAK_LOG, B.LOG);
logOf(B.STRIPPED_SPRUCE_LOG, B.SPRUCE_LOG);
logOf(B.STRIPPED_ACACIA_LOG, B.ACACIA_LOG);
// doors
shaped(B.DOOR_SPRUCE, 3, ['PP', 'PP', 'PP'], { P: B.SPRUCE_PLANKS });
shaped(B.DOOR_ACACIA, 3, ['PP', 'PP', 'PP'], { P: B.ACACIA_PLANKS });
shaped(B.DOOR_JUNGLE, 3, ['PP', 'PP', 'PP'], { P: B.JUNGLE_PLANKS });
// fences / gates / trapdoors / plates / buttons (per wood)
const fenceOf = (out, m) => shaped(out, 3, ['PSP', 'PSP'], { P: m, S: I.STICK });
const gateOf = (out, m) => shaped(out, 1, ['S S', 'PPP', 'PSP'], { P: m, S: I.STICK });
const trapdoorOf = (out, m) => shaped(out, 4, ['PP', 'PP'], { P: m });
const plateOf = (out, m) => shaped(out, 2, ['PP'], { P: m });
const buttonOf = (out, m) => shaped(out, 1, ['P'], { P: m });
fenceOf(B.SPRUCE_FENCE, B.SPRUCE_PLANKS);
fenceOf(B.ACACIA_FENCE, B.ACACIA_PLANKS);
fenceOf(B.JUNGLE_FENCE, B.JUNGLE_PLANKS);
gateOf(B.FENCE_GATE_OAK, B.PLANKS);
gateOf(B.FENCE_GATE_SPRUCE, B.SPRUCE_PLANKS);
gateOf(B.FENCE_GATE_ACACIA, B.ACACIA_PLANKS);
gateOf(B.FENCE_GATE_JUNGLE, B.JUNGLE_PLANKS);
trapdoorOf(B.TRAPDOOR_OAK, B.PLANKS);
trapdoorOf(B.TRAPDOOR_SPRUCE, B.SPRUCE_PLANKS);
trapdoorOf(B.TRAPDOOR_ACACIA, B.ACACIA_PLANKS);
trapdoorOf(B.TRAPDOOR_JUNGLE, B.JUNGLE_PLANKS);
plateOf(B.PRESSURE_PLATE_OAK, B.PLANKS);
plateOf(B.PRESSURE_PLATE_SPRUCE, B.SPRUCE_PLANKS);
plateOf(B.PRESSURE_PLATE_ACACIA, B.ACACIA_PLANKS);
plateOf(B.PRESSURE_PLATE_JUNGLE, B.JUNGLE_PLANKS);
buttonOf(B.BUTTON_OAK, B.PLANKS);
buttonOf(B.BUTTON_SPRUCE, B.SPRUCE_PLANKS);
buttonOf(B.BUTTON_ACACIA, B.ACACIA_PLANKS);
buttonOf(B.BUTTON_JUNGLE, B.JUNGLE_PLANKS);
buttonOf(B.STONE_BUTTON, B.STONE);
// slabs & stairs
shaped(B.SLAB_ACACIA, 6, ['SSS'], { S: B.ACACIA_PLANKS });
shaped(B.SLAB_JUNGLE, 6, ['SSS'], { S: B.JUNGLE_PLANKS });
shaped(B.DIORITE_SLAB, 6, ['SSS'], { S: B.DIORITE });
shaped(B.GRANITE_SLAB, 6, ['SSS'], { S: B.GRANITE });
shaped(B.SMOOTH_SANDSTONE_SLAB, 6, ['SSS'], { S: B.SMOOTH_SANDSTONE });
stairsOf(B.STAIRS_ACACIA, B.ACACIA_PLANKS);
stairsOf(B.STAIRS_JUNGLE, B.JUNGLE_PLANKS);
stairsOf(B.DIORITE_STAIRS, B.DIORITE);
stairsOf(B.GRANITE_STAIRS, B.GRANITE);
stairsOf(B.SMOOTH_SANDSTONE_STAIRS, B.SMOOTH_SANDSTONE);
// sandstone family
shaped(B.SMOOTH_SANDSTONE, 2, ['S'], { S: B.SANDSTONE });
shaped(B.CUT_SANDSTONE, 4, ['SS', 'SS'], { S: B.SANDSTONE });
shaped(B.CHISELED_SANDSTONE, 2, ['C', 'C'], { C: B.CUT_SANDSTONE });
// walls
const wallOf = (out, m) => shaped(out, 6, ['SS', 'SS'], { S: m });
wallOf(B.COBBLESTONE_WALL, B.COBBLESTONE);
wallOf(B.DIORITE_WALL, B.DIORITE);
wallOf(B.GRANITE_WALL, B.GRANITE);
wallOf(B.SANDSTONE_WALL, B.SANDSTONE);
// glass / bars
shaped(B.GLASS_PANE, 16, ['G', 'G', 'G'], { G: B.GLASS });
shapeless(B.STAINED_GLASS_PANE_ORANGE, 1, [B.GLASS_PANE, I.ORANGE_DYE]);
shapeless(B.STAINED_GLASS_PANE_YELLOW, 1, [B.GLASS_PANE, I.YELLOW_DYE]);
shapeless(B.STAINED_GLASS_PANE_WHITE, 1, [B.GLASS_PANE, I.WHITE_DYE]);
shaped(B.IRON_BARS, 1, ['II', 'II', 'II'], { I: I.IRON_INGOT });
// ice
shaped(B.PACKED_ICE, 1, ['II', 'II'], { I: B.ICE });
shaped(B.BLUE_ICE, 1, ['PP', 'PP'], { P: B.PACKED_ICE });
// terracotta colours & carpets & dyed panes
for (let i = 0; i < 16; i++) {
  const [ck] = WOOL_COLORS[i];
  shapeless(192 + i, 1, [B.TERRACOTTA, I[(ck + '_dye').toUpperCase()]]);
  shaped(208 + i, 2, ['W', 'W'], { W: B.WOOL + i });
}
// farm
shaped(B.HAY_BLOCK, 1, ['WWW', 'WWW', 'WWW'], { W: I.WHEAT });
shaped(B.FLOWER_POT, 1, ['B B', 'BBB'], { B: I.BRICK });
// signs & banners
shaped(B.SIGN, 1, ['PPP', 'PPP', ' S'], { P: B.SPRUCE_PLANKS, S: I.STICK });
shaped(B.BANNER, 1, ['PPP', 'PPP', 'SS'], { P: B.SPRUCE_PLANKS, S: I.STICK });
// dyes
shapeless(I.WHITE_DYE, 2, [I.BONE_MEAL]);
shapeless(I.ORANGE_DYE, 1, [B.PUMPKIN]);
shapeless(I.MAGENTA_DYE, 1, [B.ALLIUM, I.WHITE_DYE]);
shapeless(I.LIGHT_BLUE_DYE, 1, [B.CORNFLOWER, I.WHITE_DYE]);
shapeless(I.YELLOW_DYE, 1, [B.DANDELION]);
shapeless(I.LIME_DYE, 1, [B.TALL_GRASS]);
shapeless(I.PINK_DYE, 1, [B.POPPY, I.WHITE_DYE]);
shapeless(I.GRAY_DYE, 1, [I.BONE_MEAL, I.BLACK_DYE]);
shapeless(I.LIGHT_GRAY_DYE, 1, [I.GRAY_DYE, I.WHITE_DYE]);
shapeless(I.CYAN_DYE, 1, [I.LIGHT_BLUE_DYE, I.GREEN_DYE]);
shapeless(I.PURPLE_DYE, 1, [I.MAGENTA_DYE, I.BLUE_DYE]);
shapeless(I.BLUE_DYE, 1, [I.LAPIS]);
shapeless(I.BROWN_DYE, 1, [I.COAL]);
shapeless(I.GREEN_DYE, 1, [B.CACTUS]);
shapeless(I.RED_DYE, 1, [B.POPPY]);
shapeless(I.RED_DYE, 1, [I.BEETROOT]);
shapeless(I.BLACK_DYE, 1, [B.OBSIDIAN]);
// light sources & village furniture
shaped(B.LANTERN, 4, ['II', 'IT', 'I '], { I: I.IRON_INGOT, T: B.TORCH });
shaped(B.CAULDRON, 1, ['I I', 'I I', 'III'], { I: I.IRON_INGOT });
shaped(B.CAMPFIRE, 1, ['LCL', 'LFL'], { L: '#logs', C: '#coal', F: I.FLINT });
shaped(B.BELL, 1, ['GGG', 'IGI', 'III'], { G: I.GOLD_INGOT, I: I.IRON_INGOT });
shaped(B.BARREL, 1, ['PIP', 'PPP', 'PIP'], { P: B.PLANKS, I: I.IRON_INGOT });
shaped(B.BLAST_FURNACE, 1, ['III', 'CFC', 'ICI'], { I: I.IRON_INGOT, C: B.COBBLESTONE, F: B.FURNACE });
shaped(B.BREWING_STAND, 1, ['C C', 'CCC', 'S S'], { C: B.COBBLESTONE, S: I.STICK });
shaped(B.CARTOGRAPHY_TABLE, 1, ['PP', 'ATA'], { P: B.PLANKS, A: I.PAPER, T: B.CRAFTING_TABLE });
shaped(B.COMPOSTER, 1, ['PPP', 'P P', 'PPP'], { P: B.PLANKS });
shaped(B.FLETCHING_TABLE, 1, ['PP', 'SS', ' B'], { P: B.PLANKS, S: I.STICK, B: I.BOW });
shaped(B.GRINDSTONE, 1, ['SS', 'PP', ' X'], { S: I.STICK, P: B.PLANKS, X: B.STONE });
shaped(B.LOOM, 1, ['PP', 'WAW'], { P: B.PLANKS, W: I.STRING, A: B.CRAFTING_TABLE });
shaped(B.SMITHING_TABLE, 1, ['II', 'SS', 'TC'], { I: I.IRON_INGOT, S: B.STONE, T: B.CRAFTING_TABLE, C: B.STONECUTTER });
shaped(B.SMOKER, 1, ['LLL', 'LFL'], { L: '#logs', F: B.FURNACE });
shaped(B.STONECUTTER, 1, ['SIS', 'BBS'], { S: B.STONE, I: I.IRON_INGOT, B: B.STONE_BRICKS });
shaped(B.LECTERN, 1, ['BBB', 'BBB', ' B'], { B: B.BOOKSHELF });

const ingMatch = (ing, id) => (Array.isArray(ing) ? ing.includes(id) : ing === id);

// grid: array of item ids (0 = empty), size gw*gw; metas: parallel dmg values (optional).
// Returns {id,count,meta} or null. meta = output colour (item dmg) when the recipe carries one.
export function matchRecipe(grid, gw, metas) {
  let x0 = gw, y0 = gw, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < gw; y++) for (let x = 0; x < gw; x++) {
    if (grid[y * gw + x]) {
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!n) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of recipes) {
    if (r.shapeless) {
      if (r.shapeless.length !== n) continue;
      const used = new Array(gw * gw).fill(false);
      let ok = true;
      for (const ing of r.shapeless) {
        let found = false;
        for (let i = 0; i < grid.length; i++) {
          if (grid[i] && !used[i] && ingMatch(ing, grid[i])) { used[i] = found = true; break; }
        }
        if (!found) { ok = false; break; }
      }
      if (ok) return { id: r.out, count: r.count, meta: r.outMeta };
      continue;
    }
    if (r.w !== w || r.h !== h) continue;
    for (let flip = 0; flip < 2; flip++) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w; x++) {
        const want = r.grid[y * w + (flip ? w - 1 - x : x)];
        const have = grid[(y0 + y) * gw + x0 + x];
        if (want === 0 ? have !== 0 : !ingMatch(want, have)) { ok = false; break; }
      }
      if (ok && r.sameColor && metas) {
        let cm = -1;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w; x++) {
          const want = r.grid[y * w + (flip ? w - 1 - x : x)];
          if (!want) continue;
          const m = metas[(y0 + y) * gw + x0 + x] & 15;
          if (cm < 0) cm = m; else if (cm !== m) { ok = false; break; }
        }
        if (ok) return { id: r.out, count: r.count, meta: cm };
      } else if (ok) return { id: r.out, count: r.count, meta: r.outMeta };
    }
  }
  return null;
}

// ---- mining -----------------------------------------------------------------------
export function canHarvest(blockId, tool) {
  const b = blocks[blockId];
  if (!b.need) return true;
  return !!tool && tool.tool === b.tool && tool.tier >= b.level;
}

export function digSpeed(blockId, tool) {
  const b = blocks[blockId];
  if (!tool || !tool.tool) return 1;
  if (tool.tool === 'sword') return isLeaves(blockId) ? 1.5 : 1.5;
  if (tool.tool === 'shears') return isLeaves(blockId) ? 15 : b.tool === 'shears' ? 5 : 1;
  return tool.tool === b.tool ? tool.speed : 1;
}

const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));

// Items dropped when a block is broken. tool = item def of the held item (or null).
export function getDrops(id, meta, tool, rand = Math.random) {
  const b = blocks[id];
  if (!b || !canHarvest(id, tool)) return [];
  const one = (i, c = 1) => [{ id: i, count: c }];
  const shears = tool && tool.tool === 'shears';
  switch (id) {
    case B.STONE: return one(B.COBBLESTONE);
    case B.GRASS: case B.FARMLAND: return one(B.DIRT);
    case B.COAL_ORE: return one(I.COAL);
    case B.DIAMOND_ORE: return one(I.DIAMOND);
    case B.REDSTONE_ORE: return one(I.REDSTONE, ri(rand, 4, 5));
    case B.LAPIS_ORE: return one(I.LAPIS, ri(rand, 4, 8));
    case B.LEAVES: case B.BIRCH_LEAVES: case B.SPRUCE_LEAVES: case B.ACACIA_LEAVES: case B.JUNGLE_LEAVES:
    case B.POPLAR_LEAVES_RED: case B.POPLAR_LEAVES_ORANGE: case B.POPLAR_LEAVES_YELLOW: case B.PALE_OAK_LEAVES: {
      if (shears) return one(id);
      const out = [];
      const sap = (id === B.LEAVES || id >= B.POPLAR_LEAVES_RED && id <= B.POPLAR_LEAVES_YELLOW) ? (id === B.LEAVES ? B.SAPLING : B.POPLAR_SAPLING)
        : id === B.BIRCH_LEAVES ? B.BIRCH_SAPLING : id === B.SPRUCE_LEAVES ? B.SPRUCE_SAPLING : id === B.ACACIA_LEAVES ? B.ACACIA_SAPLING
        : id === B.PALE_OAK_LEAVES ? B.PALE_OAK_SAPLING : B.JUNGLE_SAPLING;
      if (rand() < 0.06) out.push({ id: sap, count: 1 });
      if (id === B.LEAVES && rand() < 0.01) out.push({ id: I.APPLE, count: 1 });
      if (rand() < 0.03) out.push({ id: I.STICK, count: 1 });
      return out;
    }
    case B.GLASS: case B.ICE: case B.FIRE: case B.BEDROCK: case B.WATER: case B.LAVA: return [];
    case B.MELON: {
      const out = [];
      for (let i = 0; i < ri(rand, 3, 8); i++) out.push({ id: I.MELON_SLICE, count: 1 });
      for (let i = 0; i < ri(rand, 1, 3); i++) out.push({ id: I.MELON_SEEDS, count: 1 });
      return out;
    }
    case B.PUMPKIN: return rand() < 0.43 ? one(I.PUMPKIN_SEEDS) : one(id);
    case B.CARROTS: return one(I.CARROT, ri(rand, 2, 4));
    case B.POTATOES: return one(I.POTATO, ri(rand, 2, 4));
    case B.BEETROOTS: {
      const out = [one(I.BEETROOT, ri(rand, 2, 3))];
      if (rand() < 0.625) out.push(one(I.BEETROOT_SEEDS, 1));
      return out;
    }
    case B.COBWEB: return [];
    case B.DIRT_PATH: return one(B.DIRT);
    case B.CAMPFIRE: return rand() < 0.5 ? one(I.STICK, ri(rand, 1, 2)) : [];
    case B.TALL_GRASS: return shears ? one(id) : rand() < 0.15 ? one(I.WHEAT_SEEDS) : [];
    case B.DEAD_BUSH: return shears ? one(id) : rand() < 0.7 ? one(I.STICK, ri(rand, 1, 2)) : [];
    case B.GRAVEL: return rand() < 0.1 ? one(I.FLINT) : one(id);
    case B.GLOWSTONE: return one(I.GLOWSTONE_DUST, 4); // vanilla: 4 dust
    case B.BOOKSHELF: return one(I.BOOK, 3);
    case B.CLAY: return one(I.CLAY_BALL, 4);
    case B.SNOW_LAYER: return one(I.SNOWBALL);
    case B.SNOW_BLOCK: return one(I.SNOWBALL, 4);
    case B.WHEAT:
      return (meta & 7) === 7 ? [{ id: I.WHEAT, count: 1 }, { id: I.WHEAT_SEEDS, count: ri(rand, 1, 3) }] : one(I.WHEAT_SEEDS);
    case B.FURNACE_LIT: return one(B.FURNACE);
    case B.DOOR: return meta & 8 ? [] : one(B.DOOR);
    case B.BED: return meta & 4 ? [] : one(B.BED);
    case B.COPPER_DOOR: return meta & 8 ? [] : one(B.COPPER_DOOR);
    case B.COPPER_BLOCK: return one(I.COPPER_INGOT, 9); // like other storage blocks in Java
    case B.TRIAL_SPAWNER: case B.VAULT: case B.OMINOUS_VAULT: return []; // not obtainable, as in Java
    // iteration 5
    case B.NETHER_BRICKS: return one(I.NETHER_BRICK, 4); // vanilla: 4 nether brick items
    case B.CREAKING_HEART: { // vanilla: 1-3 resin clumps + 20-24 XP, kills linked creaking
      return one(B.RESIN_CLUMP, ri(rand, 1, 3));
    }
  }
  return one(id);
}

// xp granted for mining
export function blockXp(id, rand = Math.random) {
  switch (id) {
    case B.COAL_ORE: return ri(rand, 0, 2);
    case B.DIAMOND_ORE: return ri(rand, 3, 7);
    case B.LAPIS_ORE: return ri(rand, 2, 5);
    case B.REDSTONE_ORE: return ri(rand, 1, 5);
    case B.CREAKING_HEART: return ri(rand, 20, 24); // 26.3 creaking heart
  }
  return 0;
}

export const maxStack = (id) => items[id]?.stack ?? 64;
export const itemName = (id) => items[id]?.name ?? 'Unknown';

// creative inventory order
export const CREATIVE = (() => {
  const out = [];
  const add = (...ids) => ids.forEach((i) => i !== undefined && !out.includes(i) && out.push(i));
  add(B.STONE, B.GRASS, B.DIRT, B.COBBLESTONE, B.MOSSY_COBBLESTONE, B.GRANITE, B.DIORITE, B.ANDESITE, B.SMOOTH_STONE);
  add(B.STONE_BRICKS, B.MOSSY_STONE_BRICKS, B.BRICKS, B.SAND, B.SANDSTONE, B.GRAVEL, B.CLAY, B.OBSIDIAN, B.BEDROCK);
  add(B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS, B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES);
  add(B.GLASS, B.ICE, B.SNOW_BLOCK, B.SNOW_LAYER, B.GLOWSTONE, B.BOOKSHELF, B.PUMPKIN, B.JACK_O_LANTERN, B.CACTUS);
  add(B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.REDSTONE_ORE, B.LAPIS_ORE);
  add(B.COAL_BLOCK, B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK, B.REDSTONE_BLOCK, B.LAPIS_BLOCK);
  add(B.STONE_SLAB, B.COBBLESTONE_SLAB, B.STONE_BRICK_SLAB, B.BRICK_SLAB, B.SANDSTONE_SLAB, B.OAK_SLAB, B.BIRCH_SLAB, B.SPRUCE_SLAB);
  add(B.COBBLESTONE_STAIRS, B.STONE_BRICK_STAIRS, B.BRICK_STAIRS, B.SANDSTONE_STAIRS, B.OAK_STAIRS, B.BIRCH_STAIRS, B.SPRUCE_STAIRS);
  for (let i = 0; i < 16; i++) add(B.WOOL + i);
  add(B.CRAFTING_TABLE, B.FURNACE, B.CHEST, B.TORCH, B.LADDER, B.DOOR, B.FENCE, B.BED, B.TNT);
  add(B.SAPLING, B.BIRCH_SAPLING, B.SPRUCE_SAPLING, B.TALL_GRASS, B.DEAD_BUSH, B.DANDELION, B.POPPY, B.CORNFLOWER, B.ALLIUM, B.DAISY);
  add(B.BROWN_MUSHROOM, B.RED_MUSHROOM, B.SUGAR_CANE);
  // modern (village-age) blocks
  add(B.LOG, B.ACACIA_LOG, B.JUNGLE_LOG, B.PLANKS, B.ACACIA_PLANKS, B.JUNGLE_PLANKS);
  add(B.ACACIA_WOOD, B.SPRUCE_WOOD, B.JUNGLE_WOOD, B.STRIPPED_OAK_LOG, B.STRIPPED_OAK_WOOD, B.STRIPPED_SPRUCE_LOG, B.STRIPPED_SPRUCE_WOOD, B.STRIPPED_ACACIA_LOG);
  add(B.ACACIA_LEAVES, B.JUNGLE_LEAVES, B.ACACIA_SAPLING, B.JUNGLE_SAPLING);
  add(B.TERRACOTTA, B.SMOOTH_SANDSTONE, B.CUT_SANDSTONE, B.CHISELED_SANDSTONE);
  add(B.SMOOTH_SANDSTONE_SLAB, B.SMOOTH_SANDSTONE_STAIRS, B.DIORITE_SLAB, B.GRANITE_SLAB, B.DIORITE_STAIRS, B.GRANITE_STAIRS);
  add(B.COBBLESTONE_WALL, B.DIORITE_WALL, B.GRANITE_WALL, B.SANDSTONE_WALL, B.GLASS_PANE, B.IRON_BARS);
  add(B.PACKED_ICE, B.BLUE_ICE, B.SEA_PICKLE, B.MELON, B.MELON_STEM, B.PUMPKIN_STEM, B.DIRT_PATH, B.HAY_BLOCK, B.FLOWER_POT);
  add(B.SIGN, B.BANNER, B.CAMPFIRE, B.LANTERN, B.CAULDRON, B.LECTERN);
  add(B.BARREL, B.BELL, B.BLAST_FURNACE, B.BREWING_STAND, B.CARTOGRAPHY_TABLE, B.COMPOSTER, B.FLETCHING_TABLE, B.GRINDSTONE, B.LOOM, B.SMITHING_TABLE, B.SMOKER, B.STONECUTTER);
  add(B.DOOR_SPRUCE, B.DOOR_ACACIA, B.DOOR_JUNGLE, B.SPRUCE_FENCE, B.ACACIA_FENCE, B.JUNGLE_FENCE);
  add(B.FENCE_GATE_OAK, B.FENCE_GATE_SPRUCE, B.FENCE_GATE_ACACIA, B.FENCE_GATE_JUNGLE);
  add(B.PRESSURE_PLATE_OAK, B.PRESSURE_PLATE_SPRUCE, B.PRESSURE_PLATE_ACACIA, B.PRESSURE_PLATE_JUNGLE);
  add(B.TRAPDOOR_OAK, B.TRAPDOOR_SPRUCE, B.TRAPDOOR_ACACIA, B.TRAPDOOR_JUNGLE);
  add(B.BUTTON_OAK, B.BUTTON_SPRUCE, B.BUTTON_ACACIA, B.BUTTON_JUNGLE, B.STONE_BUTTON);
  add(B.SLAB_ACACIA, B.SLAB_JUNGLE, B.STAIRS_ACACIA, B.STAIRS_JUNGLE);
  add(B.STAINED_GLASS_PANE_ORANGE, B.STAINED_GLASS_PANE_YELLOW, B.STAINED_GLASS_PANE_WHITE);
  for (let i = 0; i < 16; i++) add(192 + i); // terracotta colours
  for (let i = 0; i < 16; i++) add(208 + i); // carpets
  for (let i = 0; i < 16; i++) add(224 + i); // glazed terracotta
  // iteration 3: 26.3 Wilderness Bound blocks
  add(B.POPLAR_LOG, B.STRIPPED_POPLAR_LOG, B.POPLAR_WOOD, B.STRIPPED_POPLAR_WOOD, B.POPLAR_PLANKS);
  add(B.POPLAR_LEAVES_RED, B.POPLAR_LEAVES_ORANGE, B.POPLAR_LEAVES_YELLOW, B.POPLAR_SAPLING);
  add(B.POPLAR_SLAB, B.POPLAR_STAIRS, B.POPLAR_DOOR, B.POPLAR_TRAPDOOR, B.POPLAR_FENCE, B.POPLAR_FENCE_GATE);
  add(B.POPLAR_PRESSURE_PLATE, B.POPLAR_BUTTON);
  add(B.LEAF_LITTER, B.RED_SHRUB, B.SHELF_MUSHROOM, B.BIG_SHELF_MUSHROOM);
  add(B.CUSHION, B.STRAW_BED, B.COPPER_CHEST, 280, 281, 282);
  add(B.WOOL_STAIRS, B.WOOL_SLAB, B.CONCRETE, B.CONCRETE_STAIRS, B.CONCRETE_SLAB);
  add(B.TUFF, B.TUFF_BRICKS, B.CHISELED_TUFF_BRICKS, B.POLISHED_TUFF, B.CHISELED_TUFF);
  add(B.COPPER_BLOCK, B.CUT_COPPER, B.CHISELED_COPPER, B.OXIDIZED_COPPER, B.OXIDIZED_CUT_COPPER, B.OXIDIZED_CHISELED_COPPER);
  add(B.COPPER_GRATE, B.COPPER_BULB, B.COPPER_DOOR, B.COPPER_TRAPDOOR, B.HEAVY_CORE);
  // iteration 5: creaking, pale garden, nether structures
  add(B.PALE_OAK_LOG, B.PALE_OAK_PLANKS, B.PALE_OAK_LEAVES, B.PALE_OAK_SAPLING, B.PALE_OAK_SLAB, B.PALE_OAK_STAIRS);
  add(B.PALE_MOSS_BLOCK, B.PALE_MOSS_CARPET, B.RESIN_CLUMP, B.BLOCK_OF_RESIN, B.RESIN_BRICKS, B.CREAKING_HEART);
  add(B.NETHERRACK, B.NETHER_BRICKS, B.CRYING_OBSIDIAN, B.CHISELED_STONE_BRICKS, B.CRACKED_STONE_BRICKS);
  add(B.DARK_OAK_LOG, B.DARK_OAK_PLANKS, B.DARK_OAK_FENCE, B.DARK_OAK_SLAB, B.DARK_OAK_STAIRS);
  add(B.PURPUR_BLOCK, B.PURPUR_PILLAR, B.SOUL_LANTERN, B.PURPLE_STAINED_GLASS, B.CHISELED_NETHER_BRICKS);
  for (let i = BMAX; i < nextId; i++) add(i);
  return out;
})();

// Regenerates src/skins_extra.js from the 26.3 "Wilderness Bound" asset pack.
//
// Sheet format (must match models.js getSheet + renderer):
//   [w, h, palette, base64Indices]
//   palette[i] = (R<<24) | (G<<16) | (B<<8) | A     <- R in the HIGH byte!
//   base64 decodes to one palette index per pixel.
//
// This replaces tools/skins.mjs (1.21.5, source pack deleted) and
// tools/skins-breeze.mjs. Both of those had two bugs:
//   1. `palette = [...pal.entries()].map(([pi, argb]) => argb)` — the Map is
//      color->index, so entries are [color, index] and this produced an
//      identity palette [0,1,2,...]; every extra skin lost its colours.
//   2. the palette key was built as A<<24|R<<16|G<<8|B while the renderer
//      reads R<<24|G<<16|B<<8|A — channels were swapped.
// Both are fixed here.
//
// The 26.3 pack ships 2x humanoid skins (64x64 / 64x128). fablecraft box
// models use the classic 1x 64x32 layout (head front (16,0) via
// boxStd(sheet, 0,0,8,8,8), body (16,16,8,12,4), armR (40,16,4,12,4),
// armL (32,48,4,12,4), legR (0,16,4,12,4), legL (16,48,4,12,4)), so the
// packer remaps each 2x region onto that layout. wolf.png is already 1x
// 64x32 and is packed raw.
//   node tools/skins-263.mjs
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const ENT = '/home/user/proof/assets263/assets/minecraft/textures/entity/';
const OUT = path.join(process.cwd(), 'src/skins_extra.js');

function read(f, w, h) {
  const p = PNG.sync.read(fs.readFileSync(path.join(ENT, f)));
  if (p.width !== w || p.height !== h) throw new Error(`bad size ${f}: ${p.width}x${p.height}, want ${w}x${h}`);
  return { w: p.width, h: p.height, data: p.data };
}
// composite layers bottom-to-top (later layers win where opaque)
function compose(...imgs) {
  const [base] = imgs;
  const out = new Uint8Array(base.w * base.h * 4);
  for (const p of imgs) {
    for (let i = 0; i < base.w * base.h; i++) {
      const o = i * 4;
      if (p.data[o + 3] > 0) { out[o] = p.data[o]; out[o + 1] = p.data[o + 1]; out[o + 2] = p.data[o + 2]; out[o + 3] = p.data[o + 3]; }
    }
  }
  return { w: base.w, h: base.h, data: out };
}
function toEntry(img) {
  const pal = new Map(); // colour -> index
  const idx = new Uint8Array(img.w * img.h);
  for (let i = 0; i < img.w * img.h; i++) {
    const o = i * 4;
    const key = ((img.data[o] << 24) | (img.data[o + 1] << 16) | (img.data[o + 2] << 8) | img.data[o + 3]) >>> 0;
    let pi = pal.get(key);
    if (pi === undefined) {
      if (pal.size >= 255) throw new Error('palette overflow');
      pi = pal.size;
      pal.set(key, pi);
    }
    idx[i] = pi;
  }
  const palette = new Array(pal.size);
  for (const [argb, pi] of pal) palette[pi] = argb;
  return [img.w, img.h, palette, Buffer.from(idx).toString('base64')];
}
// alpha-aware blit: only copies source pixels that are opaque
function blitA(src, dst, sx, sy, sw, sh, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    const sy2 = sy + Math.min(sh - 1, Math.floor((y / dh) * sh));
    for (let x = 0; x < dw; x++) {
      const sx2 = sx + Math.min(sw - 1, Math.floor((x / dw) * sw));
      const so = (sy2 * src.w + sx2) * 4;
      if (src.data[so + 3] === 0) continue;
      const do2 = ((dy + y) * dst.w + dx + x) * 4;
      dst.data[do2] = src.data[so]; dst.data[do2 + 1] = src.data[so + 1]; dst.data[do2 + 2] = src.data[so + 2]; dst.data[do2 + 3] = src.data[so + 3];
    }
  }
}
// solid fill
function fillRect(img, dx, dy, dw, dh, r, g, b) {
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const o = ((dy + y) * img.w + dx + x) * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
}
// nearest-neighbour copy of src rect (sx,sy,sw,sh) into dst rect (dx,dy,dw,dh)
function blit(src, dst, sx, sy, sw, sh, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    const sy2 = sy + Math.min(sh - 1, Math.floor((y / dh) * sh));
    for (let x = 0; x < dw; x++) {
      const sx2 = sx + Math.min(sw - 1, Math.floor((x / dw) * sw));
      const so = (sy2 * src.w + sx2) * 4, do2 = ((dy + y) * dst.w + dx + x) * 4;
      dst.data[do2] = src.data[so]; dst.data[do2 + 1] = src.data[so + 1]; dst.data[do2 + 2] = src.data[so + 2]; dst.data[do2 + 3] = src.data[so + 3];
    }
  }
}
const sheet = (w, h) => ({ w, h, data: new Uint8Array(w * h * 4) });
// apply a remap table [[sx,sy,sw,sh, dx,dy,dw,dh], ...]
function remap(src, w, h, table) {
  const dst = sheet(w, h);
  for (const [sx, sy, sw, sh, dx, dy, dw, dh] of table) blit(src, dst, sx, sy, sw, sh, dx, dy, dw, dh);
  return dst;
}

const out = {};

// ---------------------------------------------------------------------------
// villager — 26.3 64x64 (2x) -> 1x 64x64 layout (the villager SKINS function
// samples armL at (32,48) and legL at (16,48), so the sheet needs the bottom
// strips too).
// 2x source layout (measured from the 26.3 pack):
//   head front (8,0,16,16)  head right (24,0,16,16)
//   body back (16,24,16,24) body front (24,24,16,24) body sides (40,24,16,24)
//   arm/sleeve (0,24,8,24)  legs skin (40,40,16,16)
const VILLAGE_REMAP = [
  // head: box3(32,0,8,8,8): front(48,0) back(40,0) right(40,8) left(56,8) top(48,8) bottom(32,8)
  [16, 0, 16, 16, 48, 0, 8, 8],   // front (face: eyes+mouth at y13-15)
  [0, 8, 16, 16, 40, 0, 8, 8],    // back (plain skin)
  [0, 8, 16, 16, 40, 8, 8, 8],    // right
  [0, 8, 16, 16, 56, 8, 8, 8],    // left
  [16, 0, 16, 8, 48, 8, 8, 8],    // top (forehead)
  [0, 8, 16, 16, 32, 8, 8, 8],    // bottom (chin)
  // body: box3(16,16,8,12,4): back(20,16) front(28,16) right(20,20) left(36,20) top(28,20) bottom(16,20,4,12)
  [16, 24, 16, 24, 20, 16, 8, 12],
  [32, 24, 16, 24, 28, 16, 8, 12],
  [16, 24, 16, 8, 20, 20, 8, 4],
  [32, 24, 16, 8, 36, 20, 8, 4],
  [24, 24, 16, 8, 28, 20, 8, 4],
  [40, 32, 8, 16, 16, 20, 4, 12],
  // armR: box3(40,16,4,12,4): back(44,16) front(48,16) right(44,20) left(48,20) bottom(40,20) top(48,20)
  [0, 32, 8, 16, 44, 16, 4, 12],
  [8, 32, 8, 16, 48, 16, 4, 12],
  [0, 32, 8, 8, 44, 20, 4, 4],
  [8, 32, 8, 8, 48, 20, 4, 4],
  [0, 32, 4, 16, 40, 20, 4, 12],
  [8, 32, 8, 4, 48, 20, 4, 4],
  // armL: box3(32,48,4,12,4): back(36,48) front(40,48) right(36,52) left(40,52) bottom(32,52) top(40,52)
  [0, 32, 8, 16, 36, 48, 4, 12],
  [8, 32, 8, 16, 40, 48, 4, 12],
  [0, 32, 8, 8, 36, 52, 4, 4],
  [8, 32, 8, 8, 40, 52, 4, 4],
  [0, 32, 4, 16, 32, 52, 4, 12],
  [8, 32, 8, 4, 40, 52, 4, 4],
  // legR: box3(0,16,4,12,4): back(4,16) front(8,16) right(4,20) left(8,20) bottom(0,20) top(8,20)
  [40, 40, 8, 16, 4, 16, 4, 12],
  [48, 40, 8, 16, 8, 16, 4, 12],
  [40, 40, 8, 8, 4, 20, 4, 4],
  [56, 40, 8, 8, 8, 20, 4, 4],
  [40, 40, 4, 16, 0, 20, 4, 12],
  [48, 40, 8, 4, 8, 20, 4, 4],
  // legL: box3(16,48,4,12,4): back(20,48) front(24,48) right(20,52) left(24,52) bottom(16,52) top(24,52)
  [40, 40, 8, 16, 20, 48, 4, 12],
  [48, 40, 8, 16, 24, 48, 4, 12],
  [40, 40, 8, 8, 20, 52, 4, 4],
  [56, 40, 8, 8, 24, 52, 4, 4],
  [40, 40, 4, 16, 16, 52, 4, 12],
  [48, 40, 8, 4, 24, 52, 4, 4],
];
out.villager_base = toEntry(remap(read('villager/villager.png', 64, 64), 64, 64, VILLAGE_REMAP));
const VILLAGE_TYPES = ['plains', 'desert', 'savanna', 'snow', 'taiga'];
for (const t of VILLAGE_TYPES) out['villager_type_' + t] = toEntry(remap(read('villager/type/' + t + '.png', 64, 64), 64, 64, VILLAGE_REMAP));
const VILLAGE_PROFS = ['armorer', 'butcher', 'cartographer', 'cleric', 'farmer', 'fisherman', 'fletcher', 'leatherworker', 'librarian', 'mason', 'nitwit', 'shepherd', 'toolsmith', 'weaponsmith'];
for (const p of VILLAGE_PROFS) out['villager_prof_' + p] = toEntry(remap(read('villager/profession/' + p + '.png', 64, 64), 64, 64, VILLAGE_REMAP));

// ---------------------------------------------------------------------------
// iron golem — painted mottled iron (128x128 non-standard UV in 26.3; fablecraft
// needs the classic cube layout, so paint vanilla's iron palette instead).
{
  const w = 64, h = 32;
  const data = new Uint8Array(w * h * 4);
  let s = 123456789;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    let v = 128 + Math.floor(rnd() * 22 - 11);
    if (rnd() < 0.06) v -= 26;
    if (rnd() < 0.04) v += 18;
    data[o] = data[o + 1] = data[o + 2] = v;
    data[o + 3] = 255;
  }
  out.iron_golem = toEntry({ w, h, data });
}

// ---------------------------------------------------------------------------
// cat — 64x32 1x, layout unchanged since classic; pack raw.
out.cat = toEntry(read('cat/cat_tabby.png', 64, 32));

// ---------------------------------------------------------------------------
// breeze — 32x32 1x ghost layout, pack raw (SKINS.breeze in models.js already
// maps this layout onto the custom rig).
out.breeze = toEntry(read('breeze/breeze.png', 32, 32));

// ---------------------------------------------------------------------------
// witch — 64x128 (2x of the legacy 32x32 layout + second robe variant at y64+).
// Target: 1x 64x32 with the standard boxStd layout (armL/legL mirror armR/legR
// in code, so only one strip of each limb is needed).
// 2x source (measured): head front (0,0,16,16) face, hood right (0,16,16,16),
// hood left (16,16,16,16), hood back (32,16,16,16), hood top (16,0,16,16),
// chin (16,32,16,16); body back (32,32,16,24) front (40,32,16,24) sides
// (32/40,56,16,24); armL (0,48,8,24)+(8,48,8,24), armR (32,48,8,24)+(40,48,8,24);
// legs (0/8,72,8,24).
const WITCH_REMAP = [
  // head (0,0,8,8,8): front(16,0) back(8,0) right(8,8) left(24,8) top(16,8) bottom(0,8)
  [0, 0, 16, 16, 16, 0, 8, 8],   // front (face)
  [32, 16, 16, 16, 8, 0, 8, 8],  // back (hood)
  [0, 16, 16, 16, 8, 8, 8, 8],   // right
  [16, 16, 16, 16, 24, 8, 8, 8], // left
  [16, 0, 16, 16, 16, 8, 8, 8],  // top (hood)
  [16, 32, 16, 16, 0, 8, 8, 8],  // bottom
  // body (16,16,8,12,4): back(20,16) front(28,16) right(20,20) left(36,20) top(28,20) bottom(16,20,4,12)
  [32, 32, 16, 24, 20, 16, 8, 12],
  [40, 32, 16, 24, 28, 16, 8, 12],
  [32, 56, 16, 8, 20, 20, 8, 4],
  [40, 56, 16, 8, 36, 20, 8, 4],
  [40, 32, 16, 8, 28, 20, 8, 4],
  [32, 32, 8, 24, 16, 20, 4, 12],
  // armR (40,16,4,12,4): back(44,16) front(48,16) right(44,20) left(48,20) bottom(40,20) top(48,20)
  [32, 48, 8, 24, 44, 16, 4, 12],
  [40, 48, 8, 24, 48, 16, 4, 12],
  [32, 48, 8, 12, 44, 20, 4, 4],
  [32, 60, 8, 12, 48, 20, 4, 4],
  [32, 48, 4, 24, 40, 20, 4, 12],
  [40, 48, 8, 8, 48, 20, 4, 4],
  // legR (0,16,4,12,4): back(4,16) front(8,16) right(4,20) left(8,20) bottom(0,20) top(8,20)
  [0, 72, 8, 24, 4, 16, 4, 12],
  [8, 72, 8, 24, 8, 16, 4, 12],
  [0, 72, 8, 12, 4, 20, 4, 4],
  [0, 84, 8, 12, 8, 20, 4, 4],
  [0, 72, 4, 24, 0, 20, 4, 12],
  [8, 72, 8, 8, 8, 20, 4, 4],
];
out.witch = toEntry(remap(read('witch/witch.png', 64, 128), 64, 32, WITCH_REMAP));

// ---------------------------------------------------------------------------
// wolf — 64x32 1x, classic layout, pack raw. SKINS.wolf in models.js maps the
// vanilla wolf UVs (head front (0,0,8,6), body (24,0..47,0..13), legs y16-20).
out.wolf = toEntry(read('wolf/wolf.png', 64, 32));

// ---------------------------------------------------------------------------
// snow golem — 64x64 (2x). Source regions (measured):
//   white head/snow 2x(8,0,16,16), face strip (coal eyes/mouth dark px at
//   x9-13 y9-14) on white 2x(0,8,32,8), body snow 2x(10,16,22,10) +
//   2x(0,26,40,6), brown stick arms 2x(32,0,24,8).
// Target 64x32: head (0,0,8,8,8), body (16,16,8,12,4), limbs mirrored.
{
  const g = sheet(64, 32);
  const S = read('snow_golem/snow_golem.png', 64, 64);
  const WHITE = [243, 252, 252];
  // head (0,0,8,8,8): front(16,0) back(8,0) right(8,8) left(24,8) top(16,8) bottom(0,8)
  fillRect(g, 16, 0, 8, 8, WHITE[0], WHITE[1], WHITE[2]);          // front base
  blitA(S, g, 0, 8, 16, 8, 16, 0, 8, 8);                            // face pixels (eyes+mouth)
  blit(S, g, 8, 0, 16, 16, 8, 0, 8, 8);                             // back
  blit(S, g, 8, 0, 16, 16, 8, 8, 8, 8);                             // right
  blit(S, g, 8, 0, 16, 16, 24, 8, 8, 8);                            // left
  blit(S, g, 8, 0, 16, 8, 16, 8, 8, 8);                             // top
  blit(S, g, 8, 0, 16, 16, 0, 8, 8, 8);                             // bottom
  // body (16,16,8,12,4): back(20,16) front(28,16) right(20,20) left(36,20) top(28,20) bottom(16,20,4,12)
  blit(S, g, 10, 16, 22, 10, 20, 16, 8, 12);
  blit(S, g, 10, 16, 22, 10, 28, 16, 8, 12);
  blit(S, g, 10, 16, 22, 5, 20, 20, 8, 4);
  blit(S, g, 10, 16, 22, 5, 36, 20, 8, 4);
  blit(S, g, 0, 26, 40, 6, 28, 20, 8, 4);
  blit(S, g, 0, 26, 8, 6, 16, 20, 4, 12);
  // armR (40,16,4,12,4): brown sticks
  fillRect(g, 44, 16, 4, 12, 126, 94, 36);
  fillRect(g, 48, 16, 4, 12, 126, 94, 36);
  fillRect(g, 44, 20, 4, 4, 126, 94, 36);
  fillRect(g, 48, 20, 4, 4, 126, 94, 36);
  fillRect(g, 40, 20, 4, 12, 126, 94, 36);
  fillRect(g, 48, 20, 4, 4, 126, 94, 36);
  // legR (0,16,4,12,4): white snow stubs
  blit(S, g, 10, 16, 8, 8, 4, 16, 4, 12);
  blit(S, g, 18, 16, 8, 8, 8, 16, 4, 12);
  blit(S, g, 10, 16, 8, 4, 4, 20, 4, 4);
  blit(S, g, 18, 16, 8, 4, 8, 20, 4, 4);
  blit(S, g, 10, 16, 4, 8, 0, 20, 4, 12);
  blit(S, g, 18, 16, 8, 4, 8, 20, 4, 4);
  out.snow_golem = toEntry(g);
}

// ---------------------------------------------------------------------------
// creaking — 64x64 (2x). Eyes overlay (creaking_eyes.png, dark pixels inside
// the 2x head-front (0,0,16,16)) are composited in so the head front glows.
// Target 64x32 standard layout, limbs mirrored in code.
const CREAKING_REMAP = [
  // head (0,0,8,8,8)
  [0, 0, 16, 16, 16, 0, 8, 8],   // front (with eyes)
  [16, 0, 16, 16, 8, 0, 8, 8],   // back
  [32, 0, 16, 16, 8, 8, 8, 8],   // right
  [32, 16, 16, 16, 24, 8, 8, 8], // left
  [16, 16, 16, 16, 16, 8, 8, 8], // top
  [0, 16, 16, 16, 0, 8, 8, 8],   // bottom
  // body (16,16,8,12,4)
  [16, 32, 16, 16, 20, 16, 8, 12],
  [32, 32, 16, 16, 28, 16, 8, 12],
  [16, 32, 16, 8, 20, 20, 8, 4],
  [32, 32, 16, 8, 36, 20, 8, 4],
  [32, 32, 16, 8, 28, 20, 8, 4],
  [16, 32, 8, 16, 16, 20, 4, 12],
  // armR (40,16,4,12,4): branchy arms
  [48, 16, 8, 24, 44, 16, 4, 12],
  [56, 16, 8, 24, 48, 16, 4, 12],
  [48, 16, 8, 12, 44, 20, 4, 4],
  [56, 16, 8, 12, 48, 20, 4, 4],
  [48, 16, 4, 24, 40, 20, 4, 12],
  [56, 16, 8, 8, 48, 20, 4, 4],
  // legR (0,16,4,12,4): short stubs
  [16, 48, 8, 16, 4, 16, 4, 12],
  [24, 48, 8, 16, 8, 16, 4, 12],
  [16, 48, 8, 8, 4, 20, 4, 4],
  [24, 48, 8, 8, 8, 20, 4, 4],
  [16, 48, 4, 16, 0, 20, 4, 12],
  [24, 48, 8, 8, 8, 20, 4, 4],
];
out.creaking = toEntry(remap(compose(read('creaking/creaking.png', 64, 64), read('creaking/creaking_eyes.png', 64, 64)), 64, 32, CREAKING_REMAP));

// ---------------------------------------------------------------------------
const js = `// GENERATED by tools/skins-263.mjs — do not edit.
// Vanilla 26.3 entity skins in fablecraft sheet format
// [w, h, palette(R<<24|G<<16|B<<8|A), base64 indices].
export const EXTRA_SHEETS = ${JSON.stringify(out)};
`;
fs.writeFileSync(OUT, js);
console.log('wrote', OUT, (js.length / 1024).toFixed(1), 'KB,', Object.keys(out).length, 'sheets:');
for (const k of Object.keys(out)) console.log('  ' + k, out[k][0] + 'x' + out[k][1], 'pal', out[k][2].length);

// Village structure generation — a faithful port of the vanilla 1.21.5 algorithm,
// driven by vanilla 1.21.5 village jigsaw data (src/structure_data.js).
//
// Placement (vanilla RandomSpreadPlacement, LINEAR spread, frequency 1):
//   region  = (floorDiv(cx, spacing), floorDiv(cz, spacing))          spacing 34
//   lcg     = java.util.Random seeded with
//             regionX*341873128712 + regionZ*132897987541 + worldSeed + salt  (salt 10387312)
//   start   = (regionX*34 + nextInt(spacing-separation), regionZ*34 + nextInt(spacing-separation))
// A village is generated iff its start chunk is the chunk being generated and the
// start position's biome is allowed for some village type.
//
// Assembly (vanilla JigsawPlacement):
//   one java.util.Random threads through everything: setLargeFeatureSeed(seed, scx, scz),
//   start rotation (nextInt(4)), weighted start-pool pick (expand by weight, one nextInt),
//   then Fisher-Yates shuffles of pool elements / jigsaws / rotations.
//   Start piece: its bottom row lands on the WORLD_SURFACE_WG heightmap (top solid block).
//   Expansion: FIFO queue, 6 depth rounds; jigsaw `target` must equal the candidate's
//   `name` with opposing fronts (rollable joints); rigid pieces keep relative Y,
//   terrain_matching pieces re-seat on the heightmap at the join; free-space tracking
//   (no two piece boxes may overlap) and the expansion hack (use_expansion_hack: true)
//   reserve child-pool height above short pieces.
//   Processors (mossify, farms, zombie streets) apply per cell during stamping.

import { B, SEA, WH, CH } from './blocks.js';
import { mulberry32, hash2 } from './noise.js';
import { VILLAGES, PLACEMENT, POOLS, PROCS, TPLS, PAL, VNAME_ID, GENTS, GPROFS } from './structure_data.js';

// fablecraft B keys are UPPERCASE; vanilla names are lowercase
const BLC = {};
for (const [k, v] of Object.entries(B)) BLC[k.toLowerCase()] = v;

// ---------------------------------------------------------------------------
// java.util.Random (48-bit LCG) — exactly as vanilla uses it for structure rng
// ---------------------------------------------------------------------------
const R_MASK = (1n << 48n) - 1n, R_MULT = 25214903917n, R_INC = 11n;
class JRand {
  constructor(seed) { this.setSeed(seed); }
  setSeed(seed) {
    const b = typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed));
    this.s = (b ^ R_MULT) & R_MASK;
  }
  next(bits) { this.s = (this.s * R_MULT + R_INC) & R_MASK; return Number(this.s >> BigInt(48 - bits)); }
  // exactly java.util.Random.nextInt(bound) (JDK 8-16), with 32-bit signed wrap
  nextInt(bound) {
    if (bound <= 0) throw new Error('bound must be positive');
    let r = this.next(31), m = bound - 1;
    if ((bound & m) === 0) return Math.floor((bound * r) / 0x80000000); // (bound * (long) r) >> 31
    let u = r;
    for (;;) {
      r = u % bound;
      if (((u - r + m) | 0) >= 0) return r; // signed-int overflow is the reject signal
      u = this.next(31);
    }
  }
  nextLong() { return (BigInt(this.next(32)) << 32n) | BigInt(this.next(32)); }
  setLargeFeatureSeed(seed, x, z) {
    this.setSeed(seed);
    const xs = this.nextLong(), zs = this.nextLong();
    this.setSeed(BigInt(Math.trunc(x)) * xs ^ BigInt(Math.trunc(z)) * zs ^ BigInt(Math.trunc(seed)));
  }
}
// vanilla java.util.Random.setLargeFeatureWithSalt (structure placement)
function spreadRand(regionX, regionZ, seed, salt) {
  const r = new JRand(0);
  r.setSeed(BigInt(regionX) * 341873128712n + BigInt(regionZ) * 132897987541n + BigInt(seed) + BigInt(salt));
  return r;
}
// vanilla Util.shuffle: Fisher-Yates copy
function shuffle(list, r) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.nextInt(i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ---------------------------------------------------------------------------
// template decode (cached)
// ---------------------------------------------------------------------------
function b64bytes(s) {
  const bin = (typeof atob === 'function') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const PALU = new Uint32Array(b64bytes(PAL).buffer, 0, Math.floor(b64bytes(PAL).length / 4));

const tplCache = new Map();
function getTpl(i) {
  const c = tplCache.get(i);
  if (c) return c;
  const [w, h, d, cellsRLE, jigs, ents, palB64] = TPLS[i];
  const raw = b64bytes(cellsRLE);
  const n = w * h * d;
  const palIdx = new Uint16Array(n);
  let p = 0, idx = 0;
  while (p + 1 < raw.length && idx < n) {
    const run = raw[p++], v = raw[p++];
    for (let k = 0; k < run && idx < n; k++) palIdx[idx++] = v;
  }
  const locRaw = b64bytes(palB64);
  const local = new Uint16Array(locRaw.buffer, 0, Math.floor(locRaw.length / 2));
  const cells = new Uint32Array(n);
  for (let k = 0; k < n; k++) cells[k] = PALU[local[palIdx[k]]];
  const t = { w, h, d, cells, jigs, ents };
  tplCache.set(i, t);
  return t;
}

// ---------------------------------------------------------------------------
// rotations (vanilla StructureTemplate.rotate)
// ---------------------------------------------------------------------------
function rotXZ(rot, x, z, w, d) {
  if (rot === 1) return [d - 1 - z, x];
  if (rot === 2) return [d - 1 - x, w - 1 - z];
  if (rot === 3) return [z, w - 1 - x];
  return [x, z];
}
function rotSize(rot, w, d) { return rot & 1 ? [d, w] : [w, d]; }
const DIRV = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0], [0, -1, 0]];
const DIR_LOOKUP = new Map(DIRV.map((v, i) => [v.join(','), i]));
// rotate a jigsaw front direction (0=S 1=W 2=N 3=E 4=up 5=down) by piece rotation
function rotDir(rot, dir) {
  const [x, y, z] = DIRV[dir];
  if (rot === 1) return DIR_LOOKUP.get((-z) + ',' + y + ',' + x);   // (x,z) -> (-z, x)
  if (rot === 2) return DIR_LOOKUP.get(-x + ',' + y + ',' + (-z));
  if (rot === 3) return DIR_LOOKUP.get(z + ',' + y + ',' + (-x));   // (x,z) -> (z, -x)
  return dir;
}
const OPP_DIR = [2, 3, 0, 1, 5, 4];

// vanilla JigsawBlock.canAttach: fronts oppose, target == other's name,
// aligned joints must share their top direction (all village joints are rollable)
function canAttach(sDir, s, tDir, t) {
  return sDir === OPP_DIR[tDir] && (s[8] === 0 || s[4] === t[4]) && s[7] === t[6];
}

// ---------------------------------------------------------------------------
// pools (elements expanded by weight, as vanilla's StructureTemplatePool does)
// ---------------------------------------------------------------------------
const EMPTY_POOL_IDX = POOLS.findIndex((p) => p[1].length === 0);
const poolFlat = new Map();
function poolElements(poolIdx) {
  let f = poolFlat.get(poolIdx);
  if (f) return f;
  const flat = [];
  for (const el of POOLS[poolIdx][1]) for (let i = 0; i < el[0]; i++) flat.push(el);
  f = flat;
  poolFlat.set(poolIdx, f);
  return f;
}
const poolMaxH = new Map();
function poolMaxY(poolIdx) {
  if (poolIdx < 0 || poolIdx === EMPTY_POOL_IDX) return 0;
  let m = poolMaxH.get(poolIdx);
  if (m !== undefined) return m;
  let max = 0;
  for (const el of POOLS[poolIdx][1]) {
    if (el[1] < 0) continue;
    const t = getTpl(el[1]);
    if (t.h > max) max = t.h;
  }
  m = max;
  poolMaxH.set(poolIdx, m);
  return max;
}

// ---------------------------------------------------------------------------
// placement
// ---------------------------------------------------------------------------
const SPACING = PLACEMENT.spacing, SEPARATION = PLACEMENT.separation, SALT = PLACEMENT.salt;

// start chunk of the region containing (cx, cz); [ -1, -1 ] if none (frequency gate)
function villageStartChunk(cx, cz, seed) {
  const rx = Math.floor(cx / SPACING), rz = Math.floor(cz / SPACING);
  const r = spreadRand(rx, rz, seed, SALT);
  const b = SPACING - SEPARATION;
  return [rx * SPACING + r.nextInt(b), rz * SPACING + r.nextInt(b)];
}

// ---------------------------------------------------------------------------
// assembly
// ---------------------------------------------------------------------------
// deterministic positional random for processor probability rolls
function procRand(wx, wy, wz, seed) {
  return mulberry32((hash2(wx, wz, (seed ^ 0x5a5a) | 0) ^ (wy * 7919)) | 0)();
}

// entity local (rotated) positions: ents[k] = [x, y, z, entI, extra]
function pieceEnts(ents, pos, rot, w, d) {
  const out = [];
  for (const e of ents) {
    const [rx2, rz2] = rotXZ(rot, Math.floor(e[0]), Math.floor(e[2]), w, d);
    out.push([e[3], pos[0] + rx2 + (e[0] - Math.floor(e[0])), pos[1] + e[1], pos[2] + rz2 + (e[2] - Math.floor(e[2])), e[4]]);
  }
  return out;
}

function assembleVillage(scx, scz, vt, seed, gen) {
  const cfg = VILLAGES[vt];
  const r = new JRand(0);
  r.setLargeFeatureSeed(seed, scx, scz);

  const cx0 = scx << 4, cz0 = scz << 4;

  // start rotation + weighted start-pool pick (vanilla getRandomTemplate: one nextInt over the weight-expanded list)
  const rot0 = r.nextInt(4);
  const flat0 = poolElements(cfg.sp);
  if (!flat0.length) return null;
  const startEl = flat0[r.nextInt(flat0.length)];
  if (startEl[1] < 0) return null;

  const t0 = getTpl(startEl[1]);
  const [w0, d0] = rotSize(rot0, t0.w, t0.d);
  const centerX = cx0 + ((w0 - 1) >> 1), centerZ = cz0 + ((d0 - 1) >> 1);
  // WORLD_SURFACE_WG: the top solid block (vanilla getFirstFreeHeight = min(heightmap, maxY))
  const groundY = (x, z) => Math.max(2, Math.min(gen.heightAt(x, z), WH - 4));
  const baseY = groundY(centerX, centerZ);

  const p0 = {
    tpl: startEl[1], proc: startEl[2], proj: startEl[3],
    pos: [cx0, baseY, cz0], rot: rot0,
    box: [cx0, baseY, cz0, cx0 + w0 - 1, baseY + t0.h - 1, cz0 + d0 - 1],
    ents: pieceEnts(t0.ents, [cx0, baseY, cz0], rot0, t0.w, t0.d),
  };
  const pieces = [p0];
  const boxes = [p0.box];

  // free space around the center (vanilla maxDistanceFromCenter AABB)
  const md = cfg.md;
  const freeBox = [centerX - md, Math.max(0, baseY - md), centerZ - md, centerX + md, Math.min(WH - 1, baseY + md), centerZ + md];
  const collides = (box) => {
    if (box[0] < freeBox[0] || box[3] > freeBox[3] || box[1] < freeBox[1] || box[4] > freeBox[4] || box[2] < freeBox[2] || box[5] > freeBox[5]) return true;
    for (const b of boxes) {
      if (Math.min(b[3], box[3]) - Math.max(b[0], box[0]) >= 1 &&
          Math.min(b[4], box[4]) - Math.max(b[1], box[1]) >= 1 &&
          Math.min(b[5], box[5]) - Math.max(b[2], box[2]) >= 1) return true;
    }
    return false;
  };

  const queue = [{ p: p0, depth: 0 }];
  let guard = 0;
  while (queue.length) {
    if (++guard > 400) break; // safety (vanilla runs unbounded but data is finite)
    const { p, depth } = queue.shift();
    const tp = getTpl(p.tpl);
    const srcRigid = p.proj === 0;
    const srcBoxY = p.box[1];
    let srcBaseH = -1;

    for (const sj of shuffle(tp.jigs, r)) {
      const sDir = rotDir(p.rot, sj[3]);
      const [svx, svy, svz] = DIRV[sDir];
      const [srx, srz] = rotXZ(p.rot, sj[0], sj[2], tp.w, tp.d);
      const sjx = p.pos[0] + srx, sjy = p.pos[1] + sj[1], sjz = p.pos[2] + srz;
      const txp = sjx + svx, typ = sjy + svy, tzp = sjz + svz;

      const targetPoolIdx = sj[5];
      if (targetPoolIdx === EMPTY_POOL_IDX) continue;
      if (!POOLS[targetPoolIdx] || !POOLS[targetPoolIdx][1].length) continue;
      const fbIdx = POOLS[targetPoolIdx][0];
      if (fbIdx >= 0 && fbIdx !== EMPTY_POOL_IDX && (!POOLS[fbIdx] || !POOLS[fbIdx][1].length)) continue;

      // candidate elements: pool (unless at max depth) + fallback, both weight-expanded & shuffled
      const cands = [];
      if (depth < cfg.d) cands.push(...shuffle(poolElements(targetPoolIdx), r));
      if (fbIdx >= 0) cands.push(...shuffle(poolElements(fbIdx), r));

      placed:
      for (const el of cands) {
        if (el[1] < 0) continue; // empty pool element
        const tt = getTpl(el[1]);
        const targetRigid = el[3] === 0;
        for (const rot of shuffle([0, 1, 2, 3], r)) {
          const [tw, td] = rotSize(rot, tt.w, tt.d);
          const tjigs = shuffle(tt.jigs, r);

          // expansion hack (use_expansion_hack: true in all village JSONs):
          // reserve child-pool height above short pieces whose fronts face inward
          let expandTo = 0;
          if (tt.h <= 16) {
            for (const t2 of tt.jigs) {
              const d2 = rotDir(rot, t2[3]);
              const v2 = DIRV[d2];
              const [lx2, lz2] = rotXZ(rot, t2[0], t2[2], tt.w, tt.d);
              if (lx2 + v2[0] < 0 || lx2 + v2[0] >= tw || t2[1] + v2[1] < 0 || t2[1] + v2[1] >= tt.h || lz2 + v2[2] < 0 || lz2 + v2[2] >= td) continue;
              const cp = t2[5];
              const fb2 = cp >= 0 ? POOLS[cp] : null;
              const sz1 = cp !== EMPTY_POOL_IDX && cp >= 0 ? poolMaxY(cp) : 0;
              const sz2 = fb2 && fb2[0] >= 0 ? poolMaxY(fb2[0]) : 0;
              if (sz1 > expandTo) expandTo = sz1;
              if (sz2 > expandTo) expandTo = sz2;
            }
          }

          for (const tj of tjigs) {
            const tDir = rotDir(rot, tj[3]);
            if (!canAttach(sDir, sj, tDir, tj)) continue;

            const [rtx, rtz] = rotXZ(rot, tj[0], tj[2], tt.w, tt.d);
            const rawX = txp - rtx, rawZ = tzp - rtz;
            const rawY = typ - tj[1];
            const deltaY = (sjy - srcBoxY) - tj[1] + svy;
            let targetBoxY;
            if (srcRigid && targetRigid) {
              targetBoxY = srcBoxY + deltaY;
            } else {
              if (srcBaseH < 0) srcBaseH = groundY(sjx, sjz);
              targetBoxY = srcBaseH - tj[1];
            }
            const yOff = targetBoxY - rawY;
            const box = [rawX, targetBoxY, rawZ, rawX + tw - 1, targetBoxY + tt.h - 1, rawZ + td - 1];
            if (expandTo > 0) {
              const span = box[4] - box[1];
              if (expandTo > span) box[4] = box[1] + expandTo;
            }
            if (collides(box)) continue;

            boxes.push(box);
            const piece = {
              tpl: el[1], proc: el[2], proj: el[3],
              pos: [rawX, rawY + yOff, rawZ], rot,
              box,
              ents: pieceEnts(tt.ents, [rawX, rawY + yOff, rawZ], rot, tt.w, tt.d),
            };
            pieces.push(piece);
            if (depth + 1 <= cfg.d) queue.push({ p: piece, depth: depth + 1 });
            break placed;
          }
        }
      }
    }
  }

  // village bounds (for cheap chunk overlap tests)
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  for (const b of boxes) {
    if (b[0] < minX) minX = b[0]; if (b[3] > maxX) maxX = b[3];
    if (b[1] < minY) minY = b[1]; if (b[4] > maxY) maxY = b[4];
    if (b[2] < minZ) minZ = b[2]; if (b[5] > maxZ) maxZ = b[5];
  }
  return { pieces, bounds: [minX, minY, minZ, maxX, maxY, maxZ], type: vt };
}

// ---------------------------------------------------------------------------
// stamping
// ---------------------------------------------------------------------------
// apply the piece's processor list to one cell; returns [id, meta]
function procCell(u, wx, wy, wz, proc, seed) {
  let id = (u >>> 24) & 0xff, meta = (u >>> 16) & 0xff, v = u & 0xffff;
  for (const rule of proc) {
    if (v !== rule[1]) continue;
    if (rule[0] === 1 || procRand(wx, wy, wz, seed) < rule[2]) {
      v = rule[3];
      id = VNAME_ID[v] !== undefined ? VNAME_ID[v] : 0;
      meta = 0;
    }
  }
  return [id, meta];
}

function stampPiece(p, cx, cz, blocks, meta, seed) {
  const t = getTpl(p.tpl);
  const proc = PROCS[p.proc] || null;
  const x0 = cx * CH, z0 = cz * CH;
  let lx0 = x0 - p.pos[0], lx1 = lx0 + CH - 1;
  if (lx0 < 0) lx0 = 0;
  if (lx1 > t.w - 1) lx1 = t.w - 1;
  let lz0 = z0 - p.pos[2], lz1 = lz0 + CH - 1;
  if (lz0 < 0) lz0 = 0;
  if (lz1 > t.d - 1) lz1 = t.d - 1;
  const ly0 = Math.max(0, -p.pos[1]), ly1 = Math.min(t.h - 1, WH - 1 - p.pos[1]);
  if (lx0 > lx1 || lz0 > lz1 || ly0 > ly1) return;
  for (let ly = ly0; ly <= ly1; ly++) {
    for (let lz = lz0; lz <= lz1; lz++) {
      for (let lx = lx0; lx <= lx1; lx++) {
        const [rx2, rz2] = rotXZ(p.rot, lx, lz, t.w, t.d);
        const u = t.cells[lx + lz * t.w + ly * t.w * t.d];
        let id, mt;
        if (proc) {
          const [i2, m2] = procCell(u, p.pos[0] + rx2, p.pos[1] + ly, p.pos[2] + rz2, proc, seed);
          id = i2; mt = m2;
        } else {
          id = (u >>> 24) & 0xff;
          mt = (u >>> 16) & 0xff;
        }
        if (!id) continue; // air / structure_void / unmapped: legacy elements leave terrain
        const bx = p.pos[0] + rx2, by = p.pos[1] + ly, bz = p.pos[2] + rz2;
        const dx = bx - x0, dz = bz - z0;
        if (dx < 0 || dx >= CH || dz < 0 || dz >= CH || by < 0 || by >= WH) continue;
        const i = (dx << 11) | (dz << 7) | by;
        blocks[i] = id;
        meta[i] = mt;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------
const villageCache = new Map(); // "seed:scx,scz" -> village | null

// fablecraft biome id -> village type (vanilla has_structure/village_* biomes)
const VT_BIOMES = {
  plains: [2, 13], // plains, meadow
  taiga: [5],
  desert: [8],
  savanna: [9],
  snowy: [6], // snowy tundra
};
function villageTypeForBiome(bi) {
  for (const vt in VT_BIOMES) if (VT_BIOMES[vt].includes(bi)) return vt;
  return null;
}

/**
 * Stamp all villages overlapping chunk (cx, cz) into blocks/meta.
 * Returns the structure entities inside the chunk: [[type, x, y, z, extra], ...]
 */
export function stampVillages(cx, cz, seed, gen, blocks, meta) {
  const out = [];
  const x0 = cx * CH, z0 = cz * CH;
  const rx = Math.floor(cx / SPACING), rz = Math.floor(cz / SPACING);
  const seen = new Set();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const [scx, scz] = villageStartChunk((rx + dx) * SPACING, (rz + dz) * SPACING, seed);
      const key = scx + ',' + scz;
      if (seen.has(key)) continue;
      seen.add(key);
      const vt = villageTypeForBiome(gen.biomeAt(scx << 4, scz << 4));
      if (!vt) continue;
      const ck = seed + ':' + key;
      let v = villageCache.get(ck);
      if (v === undefined) {
        try {
          v = assembleVillage(scx, scz, vt, seed, gen);
        } catch (e) {
          v = null;
        }
        if (villageCache.size > 256) villageCache.clear();
        villageCache.set(ck, v);
      }
      if (!v) continue;
      const b = v.bounds;
      if (b[0] > x0 + CH - 1 || b[3] < x0 || b[2] > z0 + CH - 1 || b[5] < z0) continue;
      for (const p of v.pieces) {
        if (p.box[0] > x0 + CH - 1 || p.box[3] < x0 || p.box[2] > z0 + CH - 1 || p.box[5] < z0) continue;
        stampPiece(p, cx, cz, blocks, meta, seed);
        for (const e of p.ents) {
          const ex = Math.floor(e[1]), ey = Math.floor(e[2]), ez = Math.floor(e[3]);
          if (ex >= x0 && ex < x0 + CH && ez >= z0 && ez < z0 + CH) out.push(e);
        }
      }
    }
  }
  return out;
}

/** List villages near the player (for debug/proof tooling). */
export function villagesNear(px, pz, seed, gen, range = 6) {
  const found = [];
  const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
  for (let dx = -range; dx <= range; dx++) {
    for (let dz = -range; dz <= range; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      const [scx, scz] = villageStartChunk(cx, cz, seed);
      const vt = villageTypeForBiome(gen.biomeAt(scx << 4, scz << 4));
      if (!vt) continue;
      const ck = seed + ':' + scx + ',' + scz;
      let v = villageCache.get(ck);
      if (v === undefined) {
        try { v = assembleVillage(scx, scz, vt, seed, gen); } catch (e) { v = null; }
        villageCache.set(ck, v);
      }
      if (!v) continue;
      const b = v.bounds;
      if (b[0] <= pcx * CH + CH && b[3] >= pcx * CH - CH && b[2] <= pcz * CH + CH && b[5] >= pcz * CH - CH) {
        found.push({ cx: scx, cz: scz, type: vt, center: [Math.floor((b[0] + b[3]) / 2), Math.floor((b[2] + b[5]) / 2)] });
      }
    }
  }
  // dedupe
  const seen = new Set(), out = [];
  for (const f of found) {
    const k = f.cx + ',' + f.cz;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

export { GENTS, GPROFS };

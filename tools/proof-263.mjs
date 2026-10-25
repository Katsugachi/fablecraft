// Browser proof for the 26.3 content (iterations 4-5).
//
// Launches a real (headless) Chromium via Playwright, opens the built
// single-file build, creates a new world with the fixed ground-truth seed
// 20240229 and verifies, from inside the page:
//
//   1. the page ran without page errors and without any "missing texture"
//      warnings (the atlas paints every block texture at startup and every
//      item icon is swept through getTex, so a missing 26.3 texture shows);
//   2. world generation actually ran in the browser: the three trial-chamber
//      spawners sit at their exact ground-truth coordinates for the seed;
//   3. every iteration-5 block id (307-334) exists in the bundled block
//      table with a name and a resolvable face texture;
//   4. the iteration-5 vanilla recipes craft correctly inside the bundle
//      (resin chain, creaking heart, pale moss carpet) and vanilla drops /
//      smelting behave;
//   5. the player spawned and is alive and the canvas is sized.
//
// Usage:
//   node tools/proof-263.mjs [path/to/fablecraft.html]
// (defaults to dist/fablecraft.html; build it first with tools/build-single.mjs)
//
// Requires (gitignored): npm i playwright @sparticuz/chromium
// @sparticuz/chromium bundles a headless Chromium binary inside the npm
// package, which works where browser CDNs are unreachable.

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(join(root, 'tools', 'proof-263.mjs'));

const SEED = 20240229; // ground-truth seed (see tools/test-gen-263b.mjs)
// trial-chamber spawners for SEED, from the strict node test:
const SPAWNERS = [[110, 32, 63], [129, 32, 63], [119, 32, 71]];
const NEW_BLOCK_IDS = []; // 307..334 = iteration-5 blocks
for (let id = 307; id <= 334; id++) NEW_BLOCK_IDS.push(id);

// ---------------------------------------------------------------- chromium
// The Lambda chromium build needs libnspr4/libnss3; the npm package ships
// them in bin/al2023.tar.br (brotli). Extract once to /tmp/al2023.
function ensureLambdaLibs() {
  const libDir = '/tmp/al2023/lib';
  if (existsSync(join(libDir, 'libnspr4.so'))) return libDir;
  const pkg = join(dirname(req.resolve('@sparticuz/chromium')), '..');
  const zlib = req('zlib');
  const tar = zlib.brotliDecompressSync(readFileSync(join(pkg, 'bin', 'al2023.tar.br')));
  writeFileSync('/tmp/al2023.tar', tar);
  mkdirSync(libDir, { recursive: true });
  execFileSync('tar', ['-xf', '/tmp/al2023.tar', '-C', '/tmp/al2023']);
  return libDir;
}

const htmlPath = process.argv[2] || join(root, 'dist', 'fablecraft.html');
if (!existsSync(htmlPath)) {
  console.error(`proof: build not found at ${htmlPath} - run: node tools/build-single.mjs`);
  process.exit(2);
}

const libDir = ensureLambdaLibs();
const { default: sp } = req('@sparticuz/chromium');
const exe = process.env.FC_CHROME && existsSync(process.env.FC_CHROME)
  ? process.env.FC_CHROME
  : await sp.executablePath();
console.log(`proof: chromium ${exe}`);
const args = sp.args.filter((a) => !a.startsWith('--user-data-dir'));

const { chromium } = req('playwright');
const failures = [];
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
  if (!cond) failures.push(name);
};

const browser = await chromium.launch({ executablePath: exe, args, env: { ...process.env, LD_LIBRARY_PATH: libDir } });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleMsgs = [];
  const pageErrors = [];
  page.on('console', (m) => consoleMsgs.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  console.log('proof: navigating to', htmlPath);
  await page.goto(pathToFileURL(htmlPath).href + '?test', { waitUntil: 'load', timeout: 60000 });

  // ---- bundle boot -----------------------------------------------------------
  await page.waitForFunction(
    () => window.game && window.__fc && window.__fc.B && window.__fc.B.TRIAL_SPAWNER,
    null,
    { timeout: 30000 },
  );
  ok('bundle booted (window.game + __fc hook present)', true);
  await page.waitForTimeout(2500); // menu world + first atlas work

  // ---- texture audit: block atlas + every item icon through getTex ----------
  const texAudit = await page.evaluate(() => {
    const F = window.__fc;
    const seen = new Set();
    for (let id = 1; id < F.items.length; id++) {
      const it = F.items[id];
      if (it && it.icon) seen.add(it.icon);
    }
    for (const b of F.blocks) if (b && b.flat) seen.add(b.flat);
    const names = [...seen];
    F.getTex('grass_side'); // warm the cache
    return names;
  });
  const before = consoleMsgs.length;
  await page.evaluate((names) => {
    const F = window.__fc;
    for (const n of names) F.getTex(n);
  }, texAudit);
  const missingTex = consoleMsgs.slice(before).filter((t) => t.includes('missing texture'));
  ok(`no missing textures in bundle (${texAudit.length} names swept)`,
     missingTex.length === 0, missingTex.slice(0, 3).join(' | '));

  // ---- block table audit inside the bundle -----------------------------------
  const blockAudit = await page.evaluate((ids) => {
    const { blocks } = window.__fc;
    const bad = [];
    for (const id of ids) {
      const b = blocks[id];
      if (!b || !b.name) bad.push(id + ':no def');
      else if (!b.faces || !(b.faces[0] >= 0)) bad.push(id + ':no face tex');
    }
    return { bad, named: ids.filter((id) => blocks[id]?.name).length };
  }, NEW_BLOCK_IDS);
  ok('iteration-5 blocks 307-334 all defined with face textures',
     blockAudit.bad.length === 0 && blockAudit.named === NEW_BLOCK_IDS.length,
     blockAudit.bad.join(' '));

  // ---- create a world through the real UI ------------------------------------
  // title -> singleplayer -> worlds -> create new world (seed) -> create
  const single = page.locator('div.btn', { hasText: 'Singleplayer' });
  await single.waitFor({ timeout: 30000 });
  await single.click();
  const btn = page.locator('div.btn', { hasText: 'Create New World' }).first();
  await btn.waitFor({ timeout: 30000 });
  await btn.click();
  const fields = page.locator('input.field');
  await fields.nth(1).waitFor({ timeout: 10000 }); // seed input
  await fields.nth(1).fill(String(SEED));
  await page.locator('div.btn', { hasText: 'Create New World' }).last().click();

  await page.waitForFunction(() => window.game && window.game.inWorld, null, { timeout: 300000 });
  ok('new world generated, player in world (UI flow)', true);

  // ---- generation ground truth: trial-chamber spawners -----------------------
  await page.waitForFunction(
    (spawners) => {
      const w = window.game.world, B = window.__fc.B;
      return spawners.every(([x, y, z]) => w.getBlock(x, y, z) === B.TRIAL_SPAWNER);
    },
    SPAWNERS,
    { timeout: 300000, polling: 1000 },
  );
  ok('trial-chamber spawners at exact ground-truth coords', true);

  await page.waitForTimeout(4000); // frames of rendering

  // ---- in-game assertions -----------------------------------------------------
  const state = await page.evaluate(() => {
    const g = window.game, w = g.world, F = window.__fc, B = F.B, I = F.I;
    const out = {};
    out.player = {
      alive: !!g.player?.alive,
      pos: g.player ? [g.player.x, g.player.y, g.player.z] : null,
      uiScreen: g.ui ? g.ui.screen : 'no-ui',
    };
    const c = document.querySelector('canvas');
    out.canvas = c ? [c.width, c.height] : null;
    out.entities = g.entities && g.entities.list ? g.entities.list.length : 'n/a';
    const R = (pattern, expect) => {
      const grid = new Array(9).fill(0);
      pattern.forEach((row, y) => row.forEach((cell, x) => { if (cell) grid[y * 3 + x] = cell; }));
      const r = F.matchRecipe(grid, 3);
      return r && r.id === expect ? 'ok' : `${r ? r.id : 'null'}!=${expect}`;
    };
    out.recipes = {
      resinBlock9Clumps: R([[B.RESIN_CLUMP, B.RESIN_CLUMP, B.RESIN_CLUMP], [B.RESIN_CLUMP, B.RESIN_CLUMP, B.RESIN_CLUMP], [B.RESIN_CLUMP, B.RESIN_CLUMP, B.RESIN_CLUMP]], B.BLOCK_OF_RESIN),
      resinBricks2x2: R([[I.RESIN_BRICK, I.RESIN_BRICK], [I.RESIN_BRICK, I.RESIN_BRICK]], B.RESIN_BRICKS),
      paleMossCarpet: R([[B.PALE_MOSS_BLOCK], [B.PALE_MOSS_BLOCK]], B.PALE_MOSS_CARPET),
      creakingHeart: R([[B.PALE_OAK_LOG], [B.BLOCK_OF_RESIN], [B.PALE_OAK_LOG]], B.CREAKING_HEART),
    };
    const one = (id, extra) => { const d = F.getDrops(id, 0, null, () => 0.5); return d; };
    const dE = one(B.EYEBLOSSOM), dN = one(B.NETHER_BRICKS), dH = one(B.CREAKING_HEART);
    out.drops = {
      eyeblossomSelf: dE.length === 1 && dE[0].id === B.EYEBLOSSOM && dE[0].count === 1,
      netherBricks4: dN.length === 1 && dN[0].id === I.NETHER_BRICK && dN[0].count === 4,
      heartClumps1to3: dH.length === 1 && dH[0].id === B.RESIN_CLUMP && dH[0].count >= 1 && dH[0].count <= 3,
    };
    out.smelt = {
      netherrack: F.SMELT.get(B.NETHERRACK) === I.NETHER_BRICK,
      resinClump: F.SMELT.get(B.RESIN_CLUMP) === I.RESIN_BRICK,
    };
    return out;
  });

  const alive = state.player && state.player.alive && state.player.pos && state.player.pos.every(Number.isFinite);
  ok('player spawned and alive', !!alive, JSON.stringify(state.player?.pos));
  ok('canvas sized for rendering', !!state.canvas && state.canvas[0] > 0 && state.canvas[1] > 0,
     state.canvas ? state.canvas.join('x') : 'no canvas');
  ok('menu cleared (HUD, not a menu screen)', state.player.uiScreen === null || state.player.uiScreen === 'none',
     String(state.player.uiScreen));
  const recOk = Object.values(state.recipes).every((v) => v === 'ok');
  ok('iteration-5 recipes craft inside the bundle', recOk, JSON.stringify(state.recipes));
  const dropOk = Object.values(state.drops).every(Boolean);
  ok('vanilla drops (eyeblossom self, nether bricks 4, heart 1-3 clumps)', dropOk, JSON.stringify(state.drops));
  ok('smelting (netherrack->brick, resin clump->brick)', state.smelt.netherrack && state.smelt.resinClump);

  console.log('proof: entities present:', state.entities);
  ok('no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  const missingLate = consoleMsgs.slice(before).filter((t) => t.includes('missing texture'));
  ok('no missing textures during world generation', missingLate.length === 0,
     missingLate.slice(0, 3).join(' | '));

  const shot = '/tmp/proof-263.png';
  await page.screenshot({ path: shot });
  console.log('proof: screenshot ->', shot);
} finally {
  await browser.close();
}

console.log(failures.length ? `\nPROOF FAILED (${failures.length}): ${failures.join('; ')}` : '\nALL BROWSER PROOF CHECKS PASSED');
process.exit(failures.length ? 1 : 0);

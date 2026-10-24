# Looped Path — FableCraft → modern "26.3" Minecraft

One structured loop, iterated until the game matches modern vanilla as closely as a
single-HTML file allows. Every iteration goes through the same four phases:

```
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   RESEARCH    │ → │   PROGRAM     │ → │   TEXTURING   │ → │     PROOF     │
│ find the real │   │ re-implement  │   │ find every    │   │ Chromium +    │
│ vanilla       │   │ the exact     │   │ real 16×16    │   │ Playwright:   │
│ method (wiki  │   │ method in     │   │ texture +     │   │ actually      │
│ + the vanilla │   │ fablecraft,   │   │ crafting      │   │ navigate the  │
│ data pack)    │   │ same params   │   │ recipes       │   │ generated     │
│               │   │               │   │               │   │ world and     │
│               │   │               │   │               │   │ assert it     │
└───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
        ↑                                                        │
        └────────────────── next iteration ──────────────────────┘
```

## Standing invariants (every iteration)

1. **Single-HTML deliverable.** `node tools/build-single.mjs` must keep producing one
   self-contained `fablecraft.html` (no external requests).
2. **No stand-in textures.** Every new block uses the real modern vanilla 16×16 PNG from
   `src-assets/vanilla` (the actual 1.21.5-era default Java resource pack, the closest
   public source to "26.3"), converted to fablecraft's `[ARGB palette, base64]` format.
3. **Real crafting recipes** for every new block (vanilla recipes, vanilla ingredient
   groups), plus drops/harvest rules.
4. **Proof = driven navigation, not just a screenshot.** Playwright loads the build,
   spawns at/teleports to the generated structure, moves the camera through it, asserts
   block IDs / biome names / mob presence from the game state, and fails on any
   "missing texture" console warning.

## Sources of truth (RESEARCH inputs)

- **Vanilla data pack** (cloned: `/home/user/src-assets/vanilla`, 1.21.5-era jar):
  - `data/minecraft/worldgen/structure_set/*.json` — exact placement sets
  - `data/minecraft/worldgen/structure/*.json` — structure configs (size/depth, pools, terrain adaptation)
  - `data/minecraft/worldgen/template_pool/**/*.json` — piece pools, weights, fallbacks, processors
  - `data/minecraft/worldgen/biome/*.json` — biomes: climate, features, **mob spawn tables**
  - `data/minecraft/worldgen/processor_list/*.json` — randomization rules (mossify, zombie-village…)
  - `data/minecraft/structure/**/*.nbt` — the actual structure templates (1.21.5 compact NBT:
    `{size, entities, blocks:[{pos,state,nbt?}], palette:[{Name,Properties}]}`; jigsaw
    connection data = `orientation` block state + `nbt.{pool,name,target,final_state,joint}`)
  - `assets/minecraft/textures/**` — every texture + every mob skin
- **minecraft.wiki** (fetched per iteration for the algorithm prose where the data pack
  only holds parameters): Placed_feature, Structure_set (random_spread), Jigsaw_structure
  (placement steps), Jigsaw_block (orientation/joint), Template_pool, biome pages,
  Mob_spawning (light level 0 rule, group size 4, mob caps).

### Key vanilla parameters already extracted (iteration 2+)

| Structure set | spacing | separation | salt | notes |
|---|---|---|---|---|
| villages | 34 | 8 | 10387312 | 5 weighted village types (plains/desert/savanna/snowy/taiga), biome-tag filtered; ~2% zombie variant via town_centers pool |
| trial_chambers | 34 | 12 | 94251327 | `encapsulate` terrain adaptation, dimension padding 10 |
| abandoned_camp | 37 | 8 | 91231127 | new in 26.3 |
| ancient_cities | 24 | 8 | 20083232 | |
| igloos | 32 | 8 | 1435254 | |
| pillager_outposts | 32 | 8 | 165745296 | |
| woodland_mansions | 80 | 20 | 94195254 | swamp/windswept |
| ruined_portals | 40 | 15 | 34222641 | 5 biome-filtered variants |
| buried_treasures | 1 | 0 | — | 1% rarity, locate offset (9,9) |

Village growth (village_plains.json): `type: jigsaw`, `size: 6` (expansion depth),
`start_pool: village/plains/town_centers`, `project_start_to_heightmap: WORLD_SURFACE_WG`,
`terrain_adaptation: beard_thin`, `max_distance_from_center: 80`,
`use_expansion_hack: true` (no village merge / vertical cutoff).

Placement (random_spread, verified against wiki + set JSONs):
world tiled into `spacing×spacing` chunk regions from (0,0); per region one attempt at
`(region*spacing + offset, …)` where offset = seeded `rand(spacing - separation + 1)`
(Java `Random` LCG, salt-mixed per region); biome at the center must reference the
structure, else the region is skipped.

Jigsaw growth (villages): start piece from start pool; per piece, each jigsaw block
(skipping names "up"/"down"… i.e. the root connectors) picks a weighted element from its
target pool (fallback pool when depth exhausted), candidate jigsaw in the new piece must
match `target`/`name`, face the right edge, and respect joint rotation; pieces overlap-rejected;
depth = `size` rounds; `beard_thin` = non-air blocks placed, air never carves terrain;
`terrain_matching` pieces get per-column gravity (village roads hug slopes); jigsaw blocks
are replaced by `final_state`; villager pieces (nitwit/baby/unemployed pools) supply the
initial villagers with their professions.

## Iterations

### Iteration 1 — Foundation: modern worldgen core
- **Research:** biome JSONs (climate, features, spawn tables) for: meadow, cherry grove,
  bamboo jungle, mangrove swamp, mushroom fields, pale garden, grove / stony peaks /
  snowy slopes / jagged peaks (mountain subtypes), deep dark, dripstone caves, lush caves,
  badlands; mountain/peak noise shape from World_generation wiki.
- **Program:** extend `src/worldgen.js` — mountain subtypes (grove/trees, stony peaks/no
  trees, snowy slopes, jagged), meadow variant, cherry grove (flat, low), pale garden
  patches (rare), mushroom field islands, mangrove coast + bamboo jungle variants,
  cave biomes (deep dark w/ sculk + no hostiles, dripstone columns, lush w/ moss &
  spores); modern mob spawning: hostiles only at light 0 (1.18+), group of 4,
  per-biome weighted tables from the JSONs, mob caps.
- **Texturing:** wave 1 block set (~120 blocks) with real PNGs: deepslate family, tuff
  family, mud/packed mud/muddy roots, moss block/carpet/hanging, pale moss, calcite,
  basalt family, blackstone family, gilded, dripstone (block/pointy/smooth), amethyst
  (block/budding/cluster), glow lichen, cave vines, sculk, froglights, packed ice,
  mycelium + giant mushrooms, azalea, cherry/acacia/jungle/mangrove/pale oak logs +
  planks + leaves + saplings, bamboo (stalk/block/mosaic/planks), torchflower, lily pad,
  spore blossom, pale orchid + new flowers, copper family (raw→block→exposed→oxidized,
  bulb, door, torch, lantern, grindstone-era), tuff bricks, vault, heavy core, trial
  spawner, breeze rod, creaking heart, hay bale, job-site blocks (barrel, composter,
  grindstone, loom, smithing table, stonecutter, tanning trap, smoker, cartography +
  fletching tables), ladders, carpet/slab/door/trapdoor/fence/gate for new woods.
  + crafting recipes, smelting, drops, creative-list entries.
- **Proof:** load world in headless Chromium, fly over a fixed seed grid, assert each new
  biome name + its signature vegetation blocks; assert hostile spawns only at light 0.

### Iteration 2 — Villages (the flagship ask)
- **Research:** (done this session) structure_set/structure/pool JSONs for all 5 village
  types, jigsaw algorithm (wiki + data), villager entity NBT (VillagerData professions),
  zombie-village processor, mossify processors.
- **Program:**
  - `src/structures.js`: 1.21.5 compact-NBT template loader (already built in
    `tools/nbt.mjs`), random_spread placement (Java-identical LCG), jigsaw growth
    (weighted pools, fallback, name/target matching, joint/rotation, overlap + bounding
    box checks, beard_thin + gravity/terrain matching, jigsaw→final_state, processor
    rules incl. mossify + zombie variant), per-biome village type selection,
    villager spawning from villager pieces (professions, nitwit, baby), zombie
    villagers when the zombie processor fires.
  - `src/mobs.js`: **villager AI** (wander, look-at, work-at-job-block + nudge, panic &
    flee, sleep in beds at night, baby grow-up), **iron golem** (village defense,
    summonable via 4-iron+pumpkin pattern), zombie-villager cure by splash? (simplified:
    potion item → cure), trading UI (right-click villager: profession offers, emerald
    prices from vanilla offer tables, restock/XP levels).
  - Bed/farmland/crop behavior already exists; add hay bale, job-site block
    interactions (professions from the 12 real job blocks).
- **Texturing:** every block in the 483 village templates (the converter reports the
  exact set — plains/taiga/desert/savanna/snowy houses, streets, well, farms, pens,
  stables, lamp posts, fountain/town center) + villager skins per type/profession +
  iron golem + zombie villager (real skins from `textures/entity/`).
- **Proof:** (DONE, real Chromium + Playwright, seed 20240229) fresh world → wait
  `inWorld` → teleport to the placed village (chunks stream in) → 48×48×18 block
  histogram around town center + mob census within 80 blocks + 3 screenshots.
  Confirmed: village chunks load; village-specific blocks present (dirt_path 14,
  mossy_cobblestone 18, torch 4, oak_trapdoor 11, oak_stairs 4, **bell 1**); 17–27
  mobs incl. 4 distinct villager professions (butcher/weaponsmith/fletcher/armorer —
  real profession model names), iron_golem, cats, village cows/sheep/pigs/chickens,
  all `persistent`; **zero page errors**. Shots: village_wide (aerial), village_front,
  villager_close.

### ✅ Iteration 2 STATUS: COMPLETE
- Village jigsaw assembly (5 biomes, processors, villager + golem + animal spawns,
  professions) verified in-browser with zero errors. Single-file build: 1,191,315 B.
- Next: Iteration 3 (Trial Chambers, Breeze, Creaking, Pale Garden).

### Iteration 3 — 26.3 flagships: Trial Chambers, Creaking, Pale Garden
- **Research:** trial_chambers.json + pools + templates; breeze/creaking mob behavior
  (wiki), creaking heart spawn rules, pale garden biome.
- **Program:** trial chamber jigsaw placement (`encapsulate` carve-out, deep Y, tuff
  terrain), vaults/heavy core (drop calibrite → loot), trial spawner (periodic breeze
  wave), **breeze mob** (charge/dash AI, breeze rod projectile), **creaking mob**
  (moves only when unobsused → line-of-sight check; breaks on observation change,
  chance to drop creaking heart), creaking heart block (periodic spawn), pale garden
  biome + vegetation.
- **Texturing:** tuff/brick/polished, copper bulbs/lanterns, vault, heavy core,
  trial spawner, breeze rod, creaking heart, pale moss/orchid/froglight, sculk,
  amethyst — breeze + creaking skins.
- **Proof:** locate trial chamber (deterministic per seed), navigate the entry→chamber→
  vault path with the camera, assert heavy core + breezes; assert creaking only moves
  when camera is away.

### Iteration 4 — Other common structures
- **Program:** ruined portals (5 variants, small static templates + obsidian frames),
  pillager outposts (jigsaw, watchtower + cages), woodland manor (jigsaw, witches),
  igloo (jigsaw, tent + wolf + snow golem), buried treasure (small static + loot chest).
  Witches: ranged hostile (simple thrown potion), self-heal; add crossbow-less
  pillager variant? (keep skeleton with crossbow → add crossbow item if cheap).
- **Texturing:** all blocks used by these template sets + witch/wolf/snow-golem skins.
- **Proof:** each structure located via its random_spread params, camera tour, asserts.

### Iteration 5 — Biome expansion (the rest)
- **Program:** mushroom fields (mycelium, no light-based hostile spawns, giant
  mushrooms), mangrove swamp (muddy banks, roots), bamboo jungle, cherry grove
  (if not done in iter 1), meadow (torchflowers, donkeys→keep sheep/rabbit stand-in?
  donkey model is cheap → add), badlands/eroded badlands (1.22-style mesa canyons),
  mountain peaks variants polish, cave biome decoration pass (dripstone columns,
  glow berries, spore blossoms, sculk in deep dark).
- **Mobs:** goat (ram charge), camel, sniffer, frog (+ hop), axolotl (water),
  armadillo (rolls into ball), wolf (follow/attack), bat, rabbit (meadow table wants it),
  slime (monster tables want it — small, bouncy, cheap).
- **Texturing:** all their blocks + skins (all present in the pack).
- **Proof:** biome-by-biome camera sweep per fixed seed; spawn-table assertions.

### Iteration 6 — Integration & polish
- Save format update (new block IDs, village/villager data), world size scaling,
  performance (mesher pass for new block shapes), README documentation of the new
  systems, full regression proof run (all structures + biomes + mobs, one pass).

## Proof harness (built in iteration 1, reused always)

- Browser: `@sparticuz/chromium` (npm, bundles its own libs — no apt/CDN needed) +
  `playwright-core`, launched with the package's `executablePath()` and `env`.
- `test/proof.mjs`:
  1. serve `fablecraft.html` (static server, 0.0.0.0), open with Playwright;
  2. capture console (fail on "missing texture");
  3. use a debug hook exposed on `window.__FC` (seed override, teleport, spawn,
     `getBiome(x,z)`, `getBlock(x,y,z)`, entity list) — tiny, dev-only, stripped by the
     single-file build if needed (it's inside the bundle either way, gated by URL param);
  4. per-iteration scenario scripts: navigate, wait, assert, screenshot to `test/out/`.

## Done-when (per iteration)

- Build passes (`node tools/build-single.mjs`) and the single HTML loads in the harness
  without console errors/missing textures.
- The RESEARCH method is mirrored in code (same parameters, same selection order).
- PROOF scenario for the iteration's feature passes end-to-end in Chromium.

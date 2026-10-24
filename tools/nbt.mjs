// NBT reader for Minecraft 1.21.5+ compact structure files (gzip, big-endian).
// Tag ids: 1=Byte 2=Short 3=Int 4=Long 5=Float 6=Double 7=ByteArray 8=String
//          9=List 10=Compound 11=IntArray 12=LongArray  0=End
import { gunzipSync } from 'node:zlib';

export function readNBT(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const r = new Reader(buf);
  const t = r.u8();
  if (t !== 10) throw new Error('expected compound root, got tag ' + t);
  r.str(); // root name (usually empty)
  return r.compound();
}

class Reader {
  constructor(b) { this.b = b; this.o = 0; }
  u8() { return this.b[this.o++]; }
  i8() { const v = this.b[this.o++]; return v > 127 ? v - 256 : v; }
  i16() { const v = this.b.readUInt16BE(this.o); this.o += 2; return v > 32767 ? v - 65536 : v; }
  u16() { const v = this.b.readUInt16BE(this.o); this.o += 2; return v; }
  u32() { const v = this.b.readUInt32BE(this.o); this.o += 4; return v; }
  i32() { return this.u32() | 0; }
  i64() { let v = 0n; for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(this.b[this.o + i]); this.o += 8; return v; }
  f32() { const v = this.b.readFloatBE(this.o); this.o += 4; return v; }
  f64() { const v = this.b.readDoubleBE(this.o); this.o += 8; return v; }
  str() { const n = this.u16(); const s = this.b.toString('utf8', this.o, this.o + n); this.o += n; return s; }
  value(t) {
    switch (t) {
      case 1: return this.i8();
      case 2: return this.i16();
      case 3: return this.i32();
      case 4: return this.i64();
      case 5: return this.f32();
      case 6: return this.f64();
      case 7: { const n = this.u32(); const a = this.b.subarray(this.o, this.o + n); this.o += n; return a; }
      case 8: return this.str();
      case 9: { const et = this.u8(); const n = this.u32(); const a = []; for (let i = 0; i < n; i++) a.push(this.value(et)); return a; }
      case 10: return this.compound();
      case 11: { const n = this.u32(); const a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = this.i32(); return a; }
      case 12: { const n = this.u32(); const a = []; for (let i = 0; i < n; i++) a.push(this.i64()); return a; }
      default: throw new Error('bad tag ' + t);
    }
  }
  compound() {
    const o = {};
    for (;;) {
      const t = this.u8();
      if (t === 0) return o;
      const name = this.str();
      o[name] = this.value(t);
    }
  }
}

// 1.21.5 structure template:
//   { size: [w,h,d], entities: [{nbt:{...}}], blocks: [{pos:[x,y,z], state: paletteIdx, nbt?}],
//     palette: [{Name, Properties?}], DataVersion }
// Jigsaw blocks: palette entry Name==="minecraft:jigsaw" + Properties.orientation
//   (north|south|east|west|up|down)_<north|south|east|west>; block nbt has
//   { pool, name, target, final_state, joint, selection_priority, placement_priority }.
// Entity positions are stored absolute; relative = pos - floor(pos) (origin is integral).
export function parseTemplate(root) {
  const [w, h, d] = [...root.size];
  const palette = root.palette.map((p) => ({
    name: p.Name.replace(/^minecraft:/, ''),
    props: p.Properties || {},
  }));
  const blocks = [];
  for (const b of root.blocks) {
    const e = { x: b.pos[0], y: b.pos[1], z: b.pos[2], s: b.state };
    if (b.nbt) e.nbt = b.nbt;
    blocks.push(e);
  }
  const ents = [];
  for (const e of root.entities || []) {
    const n = e.nbt || {};
    const P = n.Pos || [0, 0, 0];
    ents.push({
      id: (n.id || '').replace(/^minecraft:/, ''),
      x: P[0] - Math.floor(P[0]), y: P[1] - Math.floor(P[1]), z: P[2] - Math.floor(P[2]),
      yaw: (n.Rotation && n.Rotation[1]) || 0,
      data: n.VillagerData || null,
      age: n.Age || 0,
    });
  }
  return { size: [w, h, d], palette, blocks, ents };
}

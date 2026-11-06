/**
 * Eigene, Minecraft-inspirierte Pixel-Icons.
 * – Blöcke werden als isometrische Würfel mit prozedural erzeugten 16×16-Texturen gezeichnet.
 * – Items sind handgezeichnete 16×16-Pixelkarten, die pro Item eingefärbt werden.
 * Jedes Icon wird einmal auf ein Canvas gerendert und als Data-URL zwischengespeichert.
 */

type Pal = Record<string, string>;

/* ─────────────── Hilfsfunktionen ─────────────── */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(c: string, f: number): string {
  const [r, g, b] = hex(c);
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}
function pick(r: () => number, colors: string[]) { return colors[Math.floor(r() * colors.length)]; }

type Tex = string[][]; // [y][x] Farbe oder ''
const N = 16;
const blank = (): Tex => Array.from({ length: N }, () => Array(N).fill(''));

/* ─────────────── Texturgeneratoren ─────────────── */

function noise(colors: string[], seed: number): Tex {
  const r = rng(seed); const t = blank();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) t[y][x] = pick(r, colors);
  return t;
}

function cells(colors: string[], border: string, seed: number, count = 9): Tex {
  const r = rng(seed);
  const pts = Array.from({ length: count }, () => ({ x: r() * N, y: r() * N, c: pick(r, colors) }));
  const owner: number[][] = blank().map((row) => row.map(() => 0));
  const t = blank();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let best = 0, bd = 1e9;
    pts.forEach((p, i) => {
      const dx = Math.min(Math.abs(p.x - x), N - Math.abs(p.x - x));
      const dy = Math.min(Math.abs(p.y - y), N - Math.abs(p.y - y));
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    owner[y][x] = best;
    t[y][x] = r() < 0.18 ? shade(pts[best].c, 0.88) : pts[best].c;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (owner[y][x] !== owner[y][(x + 1) % N] || owner[y][x] !== owner[(y + 1) % N][x]) t[y][x] = border;
  }
  return t;
}

function planks(base: string, seed: number): Tex {
  const r = rng(seed); const t = blank();
  for (let y = 0; y < N; y++) {
    const board = Math.floor(y / 4);
    const seamX = (board * 7 + 3) % N;
    for (let x = 0; x < N; x++) {
      let c = shade(base, 0.92 + r() * 0.16);
      if (y % 4 === 3) c = shade(base, 0.62);
      else if (x === seamX) c = shade(base, 0.7);
      else if (r() < 0.06) c = shade(base, 0.8);
      t[y][x] = c;
    }
  }
  return t;
}

function bricks(brick: string, mortar: string, seed: number, h = 4, w = 8): Tex {
  const r = rng(seed); const t = blank();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const row = Math.floor(y / h);
    const off = row % 2 ? w / 2 : 0;
    const isMortar = y % h === h - 1 || (x + off) % w === w - 1;
    t[y][x] = isMortar ? mortar : shade(brick, 0.9 + r() * 0.2);
  }
  return t;
}

function stripesV(colors: string[], seed: number): Tex {
  const r = rng(seed); const t = blank();
  const colOf = Array.from({ length: N }, () => pick(r, colors));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) t[y][x] = r() < 0.22 ? pick(r, colors) : colOf[x];
  return t;
}

function rings(outer: string, ring1: string, ring2: string, seed: number): Tex {
  const r = rng(seed); const t = blank();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.5) t[y][x] = shade(outer, 0.9 + r() * 0.2);
    else t[y][x] = Math.floor(d) % 2 ? ring1 : ring2;
  }
  return t;
}

function ore(stone: Tex, color: string, seed: number): Tex {
  const r = rng(seed); const t = stone.map((row) => [...row]);
  const clusters = 4;
  for (let i = 0; i < clusters; i++) {
    const cx = 2 + Math.floor(r() * 11), cy = 2 + Math.floor(r() * 11);
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].slice(0, 3 + Math.floor(r() * 3));
    for (const [dx, dy] of pts) t[cy + dy][cx + dx] = (dx + dy) % 2 ? shade(color, 0.75) : color;
  }
  return t;
}

function overlay(base: Tex, fn: (x: number, y: number, c: string) => string): Tex {
  return base.map((row, y) => row.map((c, x) => fn(x, y, c)));
}

function frame(base: Tex, color: string, width = 1): Tex {
  return overlay(base, (x, y, c) => (x < width || y < width || x >= N - width || y >= N - width ? color : c));
}

/* ─────────────── Blockdefinitionen ─────────────── */

const STONE = ['#7f7f7f', '#888888', '#767676', '#8f8f8f', '#6e6e6e'];
const stoneTex = (seed: number) => noise(STONE, seed);

interface CubeDef { top: Tex; left: Tex; right?: Tex }

function grassSide(seed: number): Tex {
  const r = rng(seed);
  const t = noise(['#866043', '#79553a', '#966c4a', '#6c4a30'], seed);
  for (let x = 0; x < N; x++) {
    const depth = 3 + Math.floor(r() * 3);
    for (let y = 0; y < depth; y++) t[y][x] = pick(r, ['#5d9b37', '#6aab3f', '#558f33', '#4f8a2c']);
  }
  return t;
}

const BLOCKS: Record<string, () => CubeDef> = {
  grass_block: () => ({ top: noise(['#5d9b37', '#6aab3f', '#558f33', '#4f8a2c', '#72b347'], 11), left: grassSide(12) }),
  dirt: () => { const d = noise(['#866043', '#79553a', '#966c4a', '#6c4a30'], 3); return { top: d, left: d }; },
  cobblestone: () => { const c = cells(['#8a8a8a', '#7a7a7a', '#9a9a9a', '#6f6f6f'], '#4f4f4f', 21, 10); return { top: c, left: c }; },
  stone: () => { const s = stoneTex(5); return { top: s, left: s }; },
  oak_log: () => ({ top: rings('#6b5131', '#b08a52', '#9c7742', 7), left: stripesV(['#6b5131', '#5a4428', '#7a5d39', '#4e3a22'], 8) }),
  glass: () => {
    const t = overlay(blank(), (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return '#d4ecf5';
      if ((x - y === 3 || x - y === 4) && x > 5 && x < 13) return 'rgba(255,255,255,.85)';
      if (x === 2 && y === 2) return '#ffffff';
      return 'rgba(190,225,240,.18)';
    });
    return { top: t, left: t };
  },
  obsidian: () => { const t = noise(['#14101f', '#1d1530', '#100c18', '#271c40', '#3b2a5c'], 31); return { top: t, left: t }; },
  deepslate: () => {
    const r = rng(41);
    const t = overlay(noise(['#4d4d52', '#45454a', '#57575c', '#3d3d42'], 41), (x, y, c) => (y % 5 === 4 && r() < 0.7 ? '#2f2f33' : c));
    return { top: rings('#4d4d52', '#45454a', '#57575c', 42), left: t };
  },
  stone_bricks: () => { const t = bricks('#7d7d7d', '#555555', 51, 8, 16); return { top: t, left: t }; },
  quartz_block: () => { const t = noise(['#ece6df', '#e7e0d8', '#f2ede7', '#e3dbd2'], 61); return { top: frame(t, '#d7cec4'), left: frame(t, '#d7cec4') }; },
  white_concrete: () => { const t = noise(['#cfd5d6', '#d3d9da', '#cbd1d2'], 71); return { top: t, left: t }; },
  sandstone: () => {
    const side = overlay(noise(['#d8cb9b', '#d2c393', '#e0d3a4'], 81), (x, y, c) => (y < 3 ? '#e2d6a8' : y === 3 || y === 11 ? '#bfae7a' : c));
    return { top: noise(['#dbd0a1', '#d6ca98', '#e1d6a8'], 82), left: side };
  },
  bricks: () => { const t = bricks('#9b4f3e', '#b9ada5', 91); return { top: t, left: t }; },
  terracotta: () => { const t = noise(['#985e43', '#925a40', '#a06548', '#8c563d'], 101); return { top: t, left: t }; },
  redstone_block: () => { const t = frame(noise(['#ab1b09', '#c42a14', '#9c1607', '#d33a22', '#ff5a3c'], 111), '#7e1104'); return { top: t, left: t }; },
  pumpkin: () => ({
    top: overlay(stripesV(['#c07615', '#d8871c'], 121), (x, y, c) => (x >= 7 && x <= 8 && y >= 6 && y <= 9 ? '#5b4320' : c)),
    left: overlay(stripesV(['#c07615', '#d8871c', '#e3961f', '#b06a12'], 122), (x, _y, c) => (x % 4 === 0 ? '#9c5b0d' : c)),
  }),
  melon: () => ({
    top: rings('#3d7f1c', '#6aa52e', '#57951f', 131),
    left: overlay(stripesV(['#6aa52e', '#57951f'], 132), (x, _y, c) => (x % 3 === 0 ? '#2f6d14' : c)),
  }),
  hay_bale: () => ({
    top: rings('#a68b10', '#c9ab1d', '#b5970f', 141),
    left: overlay(stripesV(['#c9ab1d', '#b5970f', '#d6b829'], 142), (_x, y, c) => (y >= 2 && y <= 3 || y >= 12 && y <= 13 ? '#8c3b1c' : c)),
  }),
  piston: () => ({
    top: planks('#b8945f', 151),
    left: overlay(stoneTex(152), (_x, y, c) => (y < 4 ? (y === 3 ? '#6b5132' : '#b8945f') : c)),
  }),
  observer: () => ({
    top: overlay(noise(['#4f4f4f', '#5a5a5a', '#464646'], 161), (x, y, c) => (x === 7 || x === 8 ? '#3a3a3a' : c)),
    left: overlay(noise(['#5c5c5c', '#545454', '#636363'], 162), (x, y, c) => {
      if (y >= 4 && y <= 7 && (x >= 2 && x <= 5 || x >= 10 && x <= 13)) return '#262626';
      if (y === 11 && x >= 3 && x <= 12) return '#262626';
      if (y === 5 && (x === 4 || x === 11)) return '#d33a22';
      return c;
    }),
  }),
  glowstone: () => { const t = cells(['#f9d49c', '#e8b05e', '#ffe9b8', '#d6943f'], '#8b6131', 171, 11); return { top: t, left: t }; },
  soul_sand: () => {
    const t = overlay(noise(['#513e32', '#4a382c', '#5b463a', '#443327'], 181), (x, y, c) => {
      const spots = [[3, 4], [4, 4], [3, 6], [5, 6], [10, 9], [11, 9], [10, 11], [12, 11], [12, 3], [13, 3]];
      return spots.some(([sx, sy]) => sx === x && sy === y) ? '#2c211a' : c;
    });
    return { top: t, left: t };
  },
  ancient_debris: () => ({
    top: rings('#5e4440', '#6f514a', '#54392f', 191),
    left: overlay(noise(['#5e4440', '#4f3833', '#6c4f48', '#3f2c28'], 192), (x, y, c) => (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 3 ? '#8a6b5d' : c)),
  }),
  end_stone: () => { const t = cells(['#dbdea0', '#e2e5ab', '#d1d494', '#e8ebb6'], '#bfc27f', 201, 12); return { top: t, left: t }; },
  purpur_block: () => {
    const t = overlay(noise(['#a97ea9', '#b088b0', '#a275a2', '#b994b9'], 211), (x, y, c) => (x % 8 === 7 || y % 8 === 7 ? '#835a83' : c));
    return { top: t, left: t };
  },
  shulker_box: () => ({
    top: frame(noise(['#956c95', '#8c628c', '#9e769e'], 221), '#6d496d'),
    left: overlay(noise(['#956c95', '#8c628c', '#9e769e'], 222), (_x, y, c) => (y === 6 ? '#5d3c5d' : y < 6 ? shade('#a77fa7', 1) : c)),
  }),
  chest: () => ({
    top: frame(planks('#a5742f', 231), '#4e3412'),
    left: overlay(frame(planks('#a5742f', 232), '#4e3412'), (x, y, c) => {
      if (y === 5) return '#4e3412';
      if (y >= 4 && y <= 7 && x >= 7 && x <= 8) return y === 4 ? '#d2d2d2' : '#a3a3a3';
      return c;
    }),
  }),
  diamond_ore: () => { const t = ore(stoneTex(241), '#5decf5', 242); return { top: t, left: t }; },
};

/* ─────────────── Item-Pixelkarten ─────────────── */

const M: Record<string, string[]> = {
  ingot: [
    '................', '................', '................', '................',
    '................', '....oooooooo....', '...o55555544o...', '..o5444444443o..',
    '.o544444444433o.', '.oooooooooooooo.', '.o433333333322o.', '.o333333333222o.',
    '.o222222222211o.', '.oooooooooooooo.', '................', '................',
  ],
  gem: [
    '................', '................', '.....oooooo.....', '....o554433o....',
    '...o55444333o...', '..o5544443332o..', '.o554444433322o.', '.o444443333222o.',
    '..o4443333222o..', '...o44333222o...', '....o433322o....', '.....o4332o.....',
    '......o32o......', '.......oo.......', '................', '................',
  ],
  emerald: [
    '................', '.......oo.......', '......o54o......', '.....o5543o.....',
    '....o554433o....', '....o544332o....', '...o55443322o...', '...o54443322o...',
    '...o44433221o...', '...o44333221o...', '....o433221o....', '....o433211o....',
    '.....o3321o.....', '......o32o......', '.......oo.......', '................',
  ],
  chunk: [
    '................', '................', '................', '.....ooo........',
    '....o544oo......', '...o54443oooo...', '..o5444433443o..', '..o4443333332o..',
    '.o44433333222o..', '.o34333322221o..', '.o23333222211o..', '..o222222111o...',
    '...oo2221111o...', '.....oooooo.....', '................', '................',
  ],
  shard: [
    '................', '..........oo....', '.........o5o....', '....oo..o54o....',
    '...o54oo543o....', '...o544o433o.oo.', '....o443433oo54o', '....o4433322o43o',
    '.....o433322333o', '.....o33322232o.', '......o332222o..', '......o322221o..',
    '.......o2211o...', '........oooo....', '................', '................',
  ],
  dust: [
    '................', '................', '................', '................',
    '................', '........4.......', '......3..4......', '....4.343.3.....',
    '...3.44543.4....', '..4.3455543.3...', '.3.345555443.4..', '..23444444332...',
    '.1.2233333221.1.', '...1122222111...', '................', '................',
  ],
  ball: [
    '................', '................', '................', '.....oooooo.....',
    '....o445443o....', '...o45554433o...', '..o4555444332o..', '..o4554444332o..',
    '..o3444444332o..', '..o3344443322o..', '..o2333333221o..', '...o22222211o...',
    '....o111111o....', '.....oooooo.....', '................', '................',
  ],
  eye: [
    '................', '................', '................', '.....oooooo.....',
    '....o445443o....', '...o45pppp33o...', '..o455pqqp432o..', '..o45pqqqqp32o..',
    '..o34pqqqqp32o..', '..o334pqqp322o..', '..o2333pp3221o..', '...o22222211o...',
    '....o111111o....', '.....oooooo.....', '................', '................',
  ],
  rod: [
    '................', '..............o.', '.............o5o', '............o54o',
    '...........o54o.', '..........o43o..', '.........o43o...', '........o43o....',
    '.......o43o.....', '......o43o......', '.....o32o.......', '....o32o........',
    '...o32o.........', '..o21o..........', '.o21o...........', '..oo............',
  ],
  pickaxe: [
    '................', '....oooooo......', '...o544433o.....', '....oo44433o....',
    '......oo433o....', '.......oH433o...', '......oHho43o...', '.....oHho.o43o..',
    '....oHho...o3o..', '...oHho....o3o..', '..oHho......o2o.', '.oHho.......o2o.',
    'oHho.........oo.', 'oho.............', '.o..............', '................',
  ],
  sword: [
    '............ooo.', '...........o54o.', '..........o543o.', '.........o543o..',
    '........o543o...', '.......o543o....', '......o543o.....', '..o..o543o......',
    '..ogo543o.......', '...og43o........', '...oHgog........', '..oHho.oo.......',
    '.oHho...........', 'oHho............', 'oho.............', '.o..............',
  ],
  axe: [
    '................', '........ooo.....', '.......o543o....', '......o54433o...',
    '.......o44333o..', '......oHo4332o..', '.....oHho.o32o..', '....oHho...oo...',
    '...oHho.........', '..oHho..........', '.oHho...........', 'oHho............',
    'oho.............', '.o..............', '................', '................',
  ],
  shovel: [
    '................', '..........ooo...', '.........o544o..', '........o54433o.',
    '........o44333o.', '.........o3332o.', '........oHo22o..', '.......oHho.oo..',
    '......oHho......', '.....oHho.......', '....oHho........', '...oHho.........',
    '..oHho..........', '.oHho...........', '.oho............', '..o.............',
  ],
  bow: [
    '................', '...oooooo.......', '..oHHHHhho......', '...oooo..oho....',
    '...s.....oHho...', '....s.....oHo...', '.....s.....oHo..', '......s....oHo..',
    '.......s...oHo..', '........s..oHo..', '.........s.oho..', '..........soHo..',
    '...........sHo..', '...........oho..', '............o...', '................',
  ],
  shield: [
    '................', '..oooooooooooo..', '..o4444444443o..', '..o4HHHHHHHH3o..',
    '..o4HHHhHHHH3o..', '..o4HHHHHHHH3o..', '..o4HHHHHhHH3o..', '..o4HHhHHHHH3o..',
    '..o4HHHHHHHH3o..', '..o3HHHHHHHH2o..', '...o3HHHHHH2o...', '...o3HHhHHH2o...',
    '....o3HHHH2o....', '.....o3HH2o.....', '......o22o......', '.......oo.......',
  ],
  fishing_rod: [
    '................', '.............oo.', '............oHo.', '...........oHos.',
    '..........oHo.s.', '.........oHo..s.', '........oHo...s.', '.......oHo....s.',
    '......oHo.....s.', '.....oHo......s.', '....oHo......o2o', '...oHo.......o3o',
    '..oHo.........o.', '.oho............', '.oo.............', '................',
  ],
  shears: [
    '................', '................', '........oo......', '.......o54o.....',
    '......o543o.....', '.....o543o..oo..', '....o543o..o54o.', '...o543oo.o543o.',
    '...o43o..o543o..', '..ohho..o543o...', '.ohrho.o543o....', '.orrho.o43o.....',
    '.ohho.ohho......', '..oo.ohrho......', '.....orrho......', '......ooo.......',
  ],
  bottle: [
    '................', '......oooo......', '......oHHo......', '.......oo.......',
    '......o55o......', '......o.5o......', '.....o.5..o.....', '....o.5....o....',
    '...o.lllllllo...', '...ollllllllo...', '...olLllllllo...', '...olLlllllko...',
    '...ollllllkko...', '....okkkkkko....', '.....oooooo.....', '................',
  ],
  apple: [
    '................', '........oo......', '.......oho.gg...', '.......ohoggo...',
    '....oooohooo....', '...o5433o3332o..', '..o543333333o...', '..o4333333332o..',
    '..o4333333332o..', '..o3333333322o..', '..o3333333222o..', '..o3333332221o..',
    '...o33322221o...', '....oo2oo21o....', '......o..oo.....', '................',
  ],
  bread: [
    '................', '................', '................', '................',
    '.....oooooooo...', '...oo54545454o..', '..o5444444443o..', '.o543434343433o.',
    '.o444444444432o.', 'o34444444443322o', 'o33333333332221o', '.o222222222211o.',
    '..oooooooooooo..', '................', '................', '................',
  ],
  steak: [
    '................', '................', '.......ooooo....', '.....oo44433o...',
    '....o4443333oo..', '...o443332333o..', '..o4433r3233332o', '..o433rr332222o.',
    '.o4333r33322211o', '.o33333332221o..', '.o3333322211o...', 'oBBo322221o.....',
    'oBBo22211o......', '.oo.o111o.......', '.....ooo........', '................',
  ],
  carrot: [
    '................', '...........g.g..', '..........gGgg..', '...........gG...',
    '.........oooog..', '........o5443o..', '.......o54433o..', '......o54433o...',
    '.....o44332o....', '....o4433o2o....', '...o4332o.......', '..o4322o........',
    '.o332o..........', 'o321o...........', 'o2o.............', '.o..............',
  ],
  potato: [
    '................', '................', '................', '......oooo......',
    '....oo5443oo....', '...o54434433o...', '..o5443443333o..', '..o4434333333o..',
    '..o4333333332o..', '..o3343333322o..', '...o333332221o..', '....oo32221o....',
    '......oooo......', '................', '................', '................',
  ],
  wheat: [
    '................', '...4...4..4.....', '..434.343.434...', '..343.434.343...',
    '...4.434..43....', '...34.43.434....', '....343434......', '.....4343.......',
    '......g4g.......', '.....gGgGg......', '......gGg.......', '......gGg.......',
    '.....gG.Gg......', '....gG...Gg.....', '...g.......g....', '................',
  ],
  sugar_cane: [
    '................', '..gg.....g......', '..Gg....gG......', '..gG..g.Gg..g...',
    '..Gg..Gg.gG.Gg..', '..ooo.gG.oooGg..', '..gG..Gg.gG.gG..', '..Gg..ooo.Gg.Gg.',
    '..gG..gG.gG.ooo.', '..ooo.Gg.Gg.gG..', '..gG..gG.ooo.Gg.', '..Gg..ooo.Gg.gG.',
    '..gG..gG.gG..Gg.', '..Gg..Gg.Gg..gG.', '..gG..gG.gG..Gg.', '................',
  ],
  bamboo: [
    '................', '.........gG.....', '........gGg.....', '.....l..oGo.....',
    '....lL..gGg.....', '.....lL.gGg.....', '......loooo.....', '........gGg.....',
    '........gGg.....', '........gGg.....', '........oGo.....', '........gGg.....',
    '........gGg.....', '........gGg.....', '........ooo.....', '................',
  ],
  nether_wart: [
    '................', '................', '.....oo...oo....', '....o54o.o54o...',
    '....o43o.o43o...', '..oo.oo.oo.oo...', '.o54o.o54o.o54o.', '.o43o.o43o.o43o.',
    '..oo..soo..oo...', '......s..s......', '.......s.s......', '........s.......',
    '........s.......', '.......sss......', '................', '................',
  ],
  bone: [
    '................', '...........oo...', '..........o55o..', '..........o544o.',
    '.........o544o..', '........o44oo...', '.......o43o.....', '......o43o......',
    '.....o43o.......', '....o32o........', '..oo32o.........', '.o432o..........',
    'o322o...........', '.o22o...........', '..oo............', '................',
  ],
  string: [
    '................', '................', '..........oo....', '.........o44o...',
    '........o4oo4o..', '........o4..o4o.', '.........o4o.o4.', '..........o4oo4.',
    '.......oo..o44o.', '......o44o..oo..', '.....o4..o4.....', '....o4....o4....',
    '...o4......o4...', '..o4........o...', '..o.............', '................',
  ],
  feather: [
    '................', '.............oo.', '............o54o', '..........oo544o',
    '.........o55443o', '........o554433o', '.......o554433o.', '......o544433o..',
    '.....o544333o...', '....o54433oo....', '...o4433oo......', '...o43oo........',
    '..ooo...........', '.oH.............', 'oH..............', '................',
  ],
  leather: [
    '................', '................', '..oo........oo..', '.o54oooooooo43o.',
    '.o44444444443o..', '..o4433343333o..', '..o4433333332o..', '.o44333333332o..',
    '.o43333333322o..', '..o3333332222o..', '..o3333322221o..', '.o33222222211o..',
    '.o2oo222211oo1o.', '..o..oooooo..o..', '................', '................',
  ],
  totem: [
    '................', '.....oooooo.....', '....o554443o....', '....o4gg4gg3o...',
    '....o4kk4kk3o...', '....o4444433o...', '....o43oo333o...', '.oooo444443oooo.',
    'o5443o4443o3332o', '.ooo3o4433o3oo..', '....oo4433oo....', '.....o4332o.....',
    '.....o4o32o.....', '....o43oo32o....', '....oooo.ooo....', '................',
  ],
  elytra: [
    '................', '...oo......oo...', '..o54o....o45o..', '..o543o..o345o..',
    '.o5443o..o3445o.', '.o4433o..o3344o.', '.o4433o..o3344o.', 'o54333o..o33345o',
    'o44332o..o23344o', 'o43322o..o22334o', 'o3322o....o2233o', 'o322o......o223o',
    'o21o........o12o', '.oo..........oo.', '................', '................',
  ],
  nether_star: [
    '................', '.......o........', '......o5o.......', '......o4o.......',
    '.....o545o......', 'oooooo454oooooo.', '.o544455544445o.', '..oo4455544oo...',
    '....o45554o.....', '...o4445443o....', '...o44o.o44o....', '..o43o...o34o...',
    '..o3o.....o3o...', '.o2o.......o2o..', '.oo.........oo..', '................',
  ],
  name_tag: [
    '................', '................', '..ss............', '.s..s...........',
    '.s...oooooooooo.', '..s.o5444444443o', '...so4ookooko43o', '....o4444444443o',
    '....o4ookkoo433o', '....o4444444332o', '.....o33333322o.', '......ooooooooo.',
    '................', '................', '................', '................',
  ],
  saddle: [
    '................', '................', '................', '.....oooooooo...',
    '...oo54444443o..', '..o5443333333o..', '.o543oooooo33o..', '.o43o......o3o..',
    '.o3o........oo..', '.oko........oko.', '.o.o........o.o.', '.o.o........o.o.',
    'oqqqo......oqqqo', '.ooo........ooo.', '................', '................',
  ],
  book: [
    '................', '..oooooooooo....', '.o54444444443o..', '.o4p44444444o3o.',
    '.o4p4444q444o3o.', '.o4p44444444o3o.', '.o4p444444q4o3o.', '.o4p44q44444o3o.',
    '.o4p44444444o3o.', '.o4p4444444qo3o.', '.o3p33333333o3o.', '.oooooooooooo3o.',
    '.o555555555553o.', '..ooooooooooooo.', '................', '................',
  ],
  tear: [
    '................', '................', '........o.......', '.......o5o......',
    '.......o54o.....', '......o544o.....', '.....o5443o.....', '.....o4443o.....',
    '....o544433o....', '....o444333o....', '....o443332o....', '....o433322o....',
    '.....o33322o....', '......oooo......', '................', '................',
  ],
  shell: [
    '................', '................', '................', '.....oooooo.....',
    '...oo544443oo...', '..o54444443333o.', '.o5444444433332o', '.o4443333333322o',
    '.o4333333333222o', '.o3333333332221o', '.oooooooooooooo.', '.o2222222222221o',
    '..oooooooooooo..', '................', '................', '................',
  ],
  chorus: [
    '................', '................', '.......oo.......', '....oo.o4o.oo...',
    '...o54oo3oo45o..', '...o4o5433o4o...', '....o554433o....', '...o5544p333o...',
    '..o5444p43332o..', '..o44p443p322o..', '..o34433p3222o..', '...o333332221o..',
    '....o3p32211o...', '.....oooooo.....', '................', '................',
  ],
  firework: [
    '................', '.........ooo....', '........o5r4o...', '........or44o...',
    '.......ooooooo..', '.......o5r4r3o..', '.......or4r43o..', '.......o5r4r3o..',
    '.......or4r43o..', '.......o5r4r3o..', '.......ooooooo..', '.........oHo....',
    '.........oHo....', '.........oHo....', '.........oho....', '..........o.....',
  ],
  torch: [
    '................', '................', '.......ff.......', '......fFFf......',
    '......fYYf......', '......oYYo......', '......oHho......', '......oHho......',
    '......oHho......', '......oHho......', '......oHho......', '......oHho......',
    '......oHho......', '......oHho......', '.......oo.......', '................',
  ],
  lantern: [
    '................', '.......oo.......', '......o..o......', '......oooo......',
    '.....o4444o.....', '....oooooooo....', '....o2YYYY2o....', '....o2YffY2o....',
    '....o2YFFY2o....', '....o2YffY2o....', '....o2YYYY2o....', '....oooooooo....',
    '.....o3333o.....', '......oooo......', '................', '................',
  ],
  compass: [
    '................', '.....oooooo.....', '....o333333o....', '...o3qqqqqq3o...',
    '..o3qqqqqrqq3o..', '..o3qqqqrrqq3o..', '..o3qqqrrrqq3o..', '..o3qqq4oqqq3o..',
    '..o3qqbbbqqq3o..', '..o3qqbbqqqq3o..', '..o3qbqqqqqq3o..', '...o3qqqqqq3o...',
    '....o333333o....', '.....oooooo.....', '................', '................',
  ],
  bucket: [
    '................', '................', '...oooooooooo...', '..o5444444443o..',
    '..o3o222222o3o..', '..o4oooooooo3o..', '..o5444444333o..', '...o44443333o...',
    '...o44433332o...', '...o44333322o...', '....o433322o....', '....o433222o....',
    '....o322221o....', '.....oooooo.....', '................', '................',
  ],
  hopper: [
    '................', '.oooooooooooooo.', '.o544444444443o.', '.o4oooooooooo3o.',
    '.o3o22222222o2o.', '.o33oooooooo22o.', '..o4444444333o..', '...o44443333o...',
    '....o443332o....', '....o433322o....', '.....o3322o.....', '.....o3222o.....',
    '......o32o......', '......o21o......', '.......oo.......', '................',
  ],
  repeater: [
    '................', '................', '................', '.....rr....rr...',
    '....rRRr..rRRr..', '.....oo....oo...', '.....hH....hH...', '...oooooooooooo.',
    '..o544444444443o', '.o5r444r4444433o', 'oooooooooooooo3o', 'o4444444444443oo',
    'o3333333333332o.', 'oooooooooooooo..', '................', '................',
  ],
};

/* ─────────────── Item-Definitionen (Karte + Palette) ─────────────── */

const O = '#1c1c1c';
const WOOD: Pal = { H: '#9a6e3a', h: '#5f4220' };
const p = (o: string, c1: string, c2: string, c3: string, c4: string, c5: string, extra: Pal = {}): Pal =>
  ({ o, 1: c1, 2: c2, 3: c3, 4: c4, 5: c5, ...extra });

const ITEMS: Record<string, { map: string; pal: Pal; glint?: boolean }> = {
  diamond: { map: 'gem', pal: p('#0c3a3c', '#0d6e72', '#1aa7a6', '#32d7d0', '#7cf3ec', '#d7fffb') },
  emerald: { map: 'emerald', pal: p('#063b19', '#0b6d2b', '#17a346', '#2ed163', '#7cf09e', '#d6ffe1') },
  iron_ingot: { map: 'ingot', pal: p('#3a3a3a', '#6b6b6b', '#9a9a9a', '#c4c4c4', '#e2e2e2', '#ffffff') },
  gold_ingot: { map: 'ingot', pal: p('#5a3b06', '#a0670a', '#d79a14', '#f3c932', '#fbe57a', '#fffbd9') },
  copper_ingot: { map: 'ingot', pal: p('#4a1f10', '#8a3b1d', '#b8592f', '#df7c48', '#f2a575', '#ffd8bf') },
  netherite_ingot: { map: 'ingot', pal: p('#120f10', '#2a2426', '#3d3437', '#544a4d', '#6d6164', '#948689') },
  lapis: { map: 'chunk', pal: p('#0b1a4d', '#122a7a', '#1d42ad', '#2c5fd6', '#5a8af0', '#a8c4ff') },
  coal: { map: 'chunk', pal: p('#050505', '#121212', '#1f1f1f', '#2e2e2e', '#454545', '#6a6a6a') },
  quartz: { map: 'shard', pal: p('#6d625a', '#a59a90', '#cfc6bd', '#e6dfd8', '#f6f1ec', '#ffffff') },
  redstone_dust: { map: 'dust', pal: p(O, '#5e0700', '#8e0d00', '#c51a06', '#f0381c', '#ff8a6b') },
  gunpowder: { map: 'dust', pal: p(O, '#2e2e2e', '#474747', '#626262', '#7c7c7c', '#a0a0a0') },
  bone_meal: { map: 'dust', pal: p(O, '#a8a8a0', '#c7c7c0', '#dcdcd4', '#efefe8', '#ffffff') },
  ender_pearl: { map: 'ball', pal: p('#062d2a', '#0b4a44', '#106b60', '#1e9384', '#4fc7b4', '#a8f3e6') },
  slime_ball: { map: 'ball', pal: p('#2d5e22', '#4f9a3a', '#6cbf55', '#85d86c', '#a7ec8f', '#e2ffd6') },
  magma_cream: { map: 'ball', pal: p('#4a1e04', '#8c3c08', '#d06a11', '#f2a02a', '#ffd25e', '#fff3c2') },
  eye_of_ender: { map: 'eye', pal: p('#062d2a', '#0b4a44', '#106b60', '#1e9384', '#4fc7b4', '#a8f3e6', { p: '#2f7d33', q: '#0f2e12' }) },
  heart_of_the_sea: { map: 'eye', pal: p('#0a2147', '#123a78', '#1d5bb0', '#2e83db', '#6cb7f5', '#cdeaff', { p: '#7ff0ff', q: '#e8ffff' }) },
  blaze_rod: { map: 'rod', pal: p('#6a3300', '#9b4d00', '#d27600', '#f4a700', '#ffd84a', '#fff6b5') },
  diamond_pickaxe: { map: 'pickaxe', pal: p('#0c3a3c', '#0d6e72', '#1aa7a6', '#32d7d0', '#7cf3ec', '#d7fffb', WOOD) },
  diamond_axe: { map: 'axe', pal: p('#0c3a3c', '#0d6e72', '#1aa7a6', '#32d7d0', '#7cf3ec', '#d7fffb', WOOD) },
  netherite_sword: { map: 'sword', pal: p('#120f10', '#2a2426', '#3d3437', '#5a4f52', '#7a6c6f', '#a99a9d', { ...WOOD, g: '#2a2426' }) },
  iron_shovel: { map: 'shovel', pal: p('#3a3a3a', '#6b6b6b', '#9a9a9a', '#c4c4c4', '#e2e2e2', '#ffffff', WOOD) },
  bow: { map: 'bow', pal: { o: '#3b2812', ...WOOD, s: '#e8e8e8' } },
  shield: { map: 'shield', pal: p('#2b2b2b', '#5a5a5a', '#7d7d7d', '#9a9a9a', '#c4c4c4', '#ffffff', { H: '#a87b46', h: '#7a5629' }) },
  fishing_rod: { map: 'fishing_rod', pal: p(O, '#6b6b6b', '#9a9a9a', '#c4c4c4', '#e2e2e2', '#fff', { ...WOOD, s: '#dcdcdc' }) },
  shears: { map: 'shears', pal: p('#2e2e2e', '#6b6b6b', '#9a9a9a', '#c4c4c4', '#e2e2e2', '#ffffff', { h: '#7a1f1f', r: '#b83232' }) },
  dragon_breath: { map: 'bottle', pal: { o: '#3a2b3e', H: '#8a6a45', 5: '#ffffff', l: '#e9a2d6', L: '#ffd6f2', k: '#b85fa2' } },
  experience_bottle: { map: 'bottle', pal: { o: '#24324a', H: '#8a6a45', 5: '#ffffff', l: '#9ce35b', L: '#e6ffb0', k: '#5aa52a' } },
  apple: { map: 'apple', pal: p('#3d0a07', '#6e0f0a', '#a3150e', '#d52818', '#f05a3c', '#ffb3a1', { h: '#5f4220', g: '#3f8f2a' }) },
  golden_apple: { map: 'apple', pal: p('#5a3b06', '#a0670a', '#d79a14', '#f3c932', '#fbe57a', '#fffbd9', { h: '#5f4220', g: '#3f8f2a' }) },
  enchanted_golden_apple: { map: 'apple', pal: p('#5a3b06', '#a0670a', '#d79a14', '#f3c932', '#fbe57a', '#fffbd9', { h: '#5f4220', g: '#3f8f2a' }), glint: true },
  bread: { map: 'bread', pal: p('#4a2b0e', '#7a4a17', '#a86b25', '#cf9440', '#e8b866', '#f8dca0') },
  cooked_beef: { map: 'steak', pal: p('#2b1308', '#4a2210', '#6d3418', '#8f4a24', '#b06838', '#cf8c5a', { r: '#e2c3a0', B: '#efe7d6' }) },
  golden_carrot: { map: 'carrot', pal: p('#5a3b06', '#a0670a', '#d79a14', '#f3c932', '#fbe57a', '#fffbd9', { g: '#2f7d1f', G: '#58b83a' }) },
  baked_potato: { map: 'potato', pal: p('#3e2508', '#7a4f17', '#b07a2f', '#d4a04b', '#e8c27a', '#f8e2b0') },
  wheat: { map: 'wheat', pal: { 3: '#b08a1a', 4: '#e2c24a', g: '#6b8a1e', G: '#9cb52f' } },
  sugar_cane: { map: 'sugar_cane', pal: { o: '#5e8a2a', g: '#7cb342', G: '#a5d36b' } },
  bamboo: { map: 'bamboo', pal: { o: '#3e6b1a', g: '#5a9a28', G: '#86c43f', l: '#5a9a28', L: '#86c43f' } },
  nether_wart: { map: 'nether_wart', pal: p('#3b0607', '#5e0b0d', '#7f1416', '#a32023', '#cc3a3a', '#f07070', { s: '#6e1b12' }) },
  bone: { map: 'bone', pal: p('#4a4a40', '#8a8a7c', '#b9b9ab', '#d7d7cb', '#ecece2', '#ffffff') },
  string: { map: 'string', pal: { o: '#7a7a7a', 4: '#f2f2f2' } },
  feather: { map: 'feather', pal: p('#5a5a5a', '#9a9a9a', '#c4c4c4', '#dedede', '#f2f2f2', '#ffffff', { H: '#8a8a8a' }) },
  leather: { map: 'leather', pal: p('#3a1d0b', '#5a2f12', '#7d431b', '#a35b27', '#c27b3f', '#e3a56d') },
  totem: { map: 'totem', pal: p('#5a3b06', '#a0670a', '#d79a14', '#f3c932', '#fbe57a', '#fffbd9', { g: '#2fae4a', k: '#0f4a1d' }) },
  elytra: { map: 'elytra', pal: p('#2b2533', '#4b4258', '#6c6080', '#8d82a3', '#b1a8c4', '#e0dbea') },
  nether_star: { map: 'nether_star', pal: p('#5a5a6a', '#a0a0b8', '#c8c8dc', '#e4e4f2', '#f6f6ff', '#ffffff'), glint: true },
  name_tag: { map: 'name_tag', pal: p('#4a3a24', '#8a7048', '#b49466', '#d6bb8a', '#ecd8b0', '#fff2d8', { s: '#cfcfcf', k: '#5a4a34' }) },
  saddle: { map: 'saddle', pal: p('#2e170a', '#4e2a12', '#6e3d1b', '#8f5427', '#b0703a', '#d29a62', { k: '#9a9a9a', q: '#c4c4c4' }) },
  enchanted_book: { map: 'book', pal: p('#2a0f0a', '#4a1d14', '#6e2e1c', '#8f3e24', '#b5532f', '#f2e9d8', { p: '#d8c48a', q: '#e8a2ff' }), glint: true },
  ghast_tear: { map: 'tear', pal: p('#4a6a7a', '#8fb3c4', '#b9d6e2', '#d6ecf4', '#ecf8fc', '#ffffff') },
  shulker_shell: { map: 'shell', pal: p('#3e2340', '#6b416d', '#8a5a8c', '#a77aa9', '#c49cc6', '#e6cfe8') },
  chorus_fruit: { map: 'chorus', pal: p('#2e1638', '#4e2a5e', '#6d4183', '#8d5ea3', '#ad83c2', '#d6bfe2', { p: '#d8c0f0' }) },
  firework_rocket: { map: 'firework', pal: { o: '#2b2b2b', 3: '#c4c4c4', 4: '#e8e8e8', 5: '#ffffff', r: '#c62828', H: '#9a6e3a', h: '#5f4220' } },
  torch: { map: 'torch', pal: { o: '#3b2812', ...WOOD, f: '#ff9a1a', F: '#ffd84a', Y: '#fff3a0' } },
  redstone_torch: { map: 'torch', pal: { o: '#3b2812', ...WOOD, f: '#8e0d00', F: '#f0381c', Y: '#ff8a6b' } },
  lantern: { map: 'lantern', pal: p('#1e1e24', '#2f2f38', '#3c3c48', '#545464', '#6c6c80', '#9a9ab0', { Y: '#ffcf5a', f: '#ffe28a', F: '#fff6d0' }) },
  compass: { map: 'compass', pal: { o: '#2a2a2a', 3: '#8a8a8a', 4: '#5a5a5a', q: '#d9d2c0', r: '#c62828', b: '#3a3a3a' } },
  bucket: { map: 'bucket', pal: p('#2e2e2e', '#555555', '#7a7a7a', '#a0a0a0', '#c4c4c4', '#e6e6e6') },
  hopper: { map: 'hopper', pal: p('#1e1e1e', '#353535', '#4a4a4a', '#5f5f5f', '#777777', '#999999') },
  repeater: { map: 'repeater', pal: p('#2e2e2e', '#5a5a5a', '#7a7a7a', '#9a9a9a', '#b8b8b8', '#d8d8d8', { r: '#8e0d00', R: '#f0381c', h: '#5f4220', H: '#9a6e3a' }) },
};

/* ─────────────── Rendering ─────────────── */

const cache = new Map<string, string>();

function texCanvas(t: Tex): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d')!;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!t[y][x]) continue;
    g.fillStyle = t[y][x];
    g.fillRect(x, y, 1, 1);
  }
  return c;
}

function drawCube(g: CanvasRenderingContext2D, S: number, def: CubeDef) {
  const u = S / 16;
  const faces: { tex: Tex; m: [number, number, number, number, number, number]; dark: number }[] = [
    // links (Vorderseite links)
    { tex: def.left, m: [7 * u / 16, 3.5 * u / 16, 0, 7.5 * u / 16, 1 * u, 4.5 * u], dark: 0.18 },
    // rechts
    { tex: def.right || def.left, m: [7 * u / 16, -3.5 * u / 16, 0, 7.5 * u / 16, 8 * u, 8 * u], dark: 0.36 },
    // oben
    { tex: def.top, m: [7 * u / 16, -3.5 * u / 16, 7 * u / 16, 3.5 * u / 16, 1 * u, 4.5 * u], dark: 0 },
  ];
  for (const f of faces) {
    g.save();
    g.setTransform(...f.m);
    g.imageSmoothingEnabled = false;
    g.drawImage(texCanvas(f.tex), 0, 0);
    if (f.dark) { g.fillStyle = `rgba(0,0,0,${f.dark})`; g.fillRect(0, 0, N, N); }
    g.restore();
  }
  // feine Kanten
  g.save();
  g.strokeStyle = 'rgba(0,0,0,.45)';
  g.lineWidth = Math.max(1, S / 64);
  g.beginPath();
  g.moveTo(8 * u, 1 * u); g.lineTo(15 * u, 4.5 * u); g.lineTo(15 * u, 12 * u); g.lineTo(8 * u, 15.5 * u);
  g.lineTo(1 * u, 12 * u); g.lineTo(1 * u, 4.5 * u); g.closePath();
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.18)';
  g.beginPath(); g.moveTo(1 * u, 4.5 * u); g.lineTo(8 * u, 8 * u); g.lineTo(15 * u, 4.5 * u); g.moveTo(8 * u, 8 * u); g.lineTo(8 * u, 15.5 * u); g.stroke();
  g.restore();
}

function drawSprite(g: CanvasRenderingContext2D, S: number, map: string[], pal: Pal, glint: boolean) {
  const u = S / 16;
  // weicher Schatten
  g.save();
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = S / 24;
  g.shadowOffsetY = S / 48;
  for (let y = 0; y < 16; y++) {
    const row = (map[y] || '').padEnd(16, '.').slice(0, 16);
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = pal[ch];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(Math.floor(x * u), Math.floor(y * u), Math.ceil(u), Math.ceil(u));
    }
  }
  g.restore();
  if (glint) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, 'rgba(200,120,255,0)');
    grad.addColorStop(0.35, 'rgba(200,120,255,.45)');
    grad.addColorStop(0.5, 'rgba(255,200,255,.15)');
    grad.addColorStop(0.65, 'rgba(160,90,255,.45)');
    grad.addColorStop(1, 'rgba(200,120,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.restore();
  }
}

function drawFallback(g: CanvasRenderingContext2D, S: number, key: string) {
  const h = hashStr(key);
  const hue = h % 360;
  const col = `hsl(${hue} 55% 55%)`;
  const def: CubeDef = { top: noise([col, `hsl(${hue} 55% 60%)`, `hsl(${hue} 55% 50%)`], h), left: noise([col, `hsl(${hue} 55% 45%)`], h + 1) };
  drawCube(g, S, def);
}

export const BLOCK_KEYS = Object.keys(BLOCKS);
export const ITEM_KEYS = Object.keys(ITEMS);
export const ALL_ICON_KEYS = [...BLOCK_KEYS, ...ITEM_KEYS].sort();

export function iconUrl(key: string, size = 64): string {
  const k = `${key}@${size}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  g.imageSmoothingEnabled = false;
  if (BLOCKS[key]) drawCube(g, size, BLOCKS[key]());
  else if (ITEMS[key]) drawSprite(g, size, M[ITEMS[key].map], ITEMS[key].pal, !!ITEMS[key].glint);
  else drawFallback(g, size, key);
  const url = c.toDataURL('image/png');
  cache.set(k, url);
  return url;
}

export const ICON_LABELS: Record<string, string> = {
  grass_block: 'Grasblock', dirt: 'Erde', cobblestone: 'Bruchstein', stone: 'Stein', oak_log: 'Eichenstamm', glass: 'Glas',
  obsidian: 'Obsidian', deepslate: 'Tiefenschiefer', stone_bricks: 'Steinziegel', quartz_block: 'Quarzblock',
  white_concrete: 'Beton', sandstone: 'Sandstein', bricks: 'Ziegel', terracotta: 'Terrakotta', redstone_block: 'Redstone-Block',
  pumpkin: 'Kürbis', melon: 'Melone', hay_bale: 'Strohballen', piston: 'Kolben', observer: 'Beobachter', glowstone: 'Glowstone',
  soul_sand: 'Seelensand', ancient_debris: 'Antiker Schrott', end_stone: 'Endstein', purpur_block: 'Purpur', shulker_box: 'Shulker-Kiste',
  chest: 'Truhe', diamond_ore: 'Diamanterz',
};

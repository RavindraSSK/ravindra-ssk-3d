// Procedural particle formations. Every shape has the same particle count so
// the vertex shader can morph any particle from one formation to another.
//   0 — neural sphere  (intro, about, contact)
//   1 — neural network (experience)
//   2 — spiral galaxy  (projects)
//   3 — terrain point cloud (research)
//   4 — six skill clusters (skills)

export const SHAPE_COUNT = 5;
export const CLUSTERS = 6;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Cheap smooth value-noise for the terrain height field.
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    sum += amp * valueNoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

export const NETWORK_LAYERS = [5, 8, 10, 10, 8, 4];

export function networkNodes() {
  const nodes: [number, number, number][][] = [];
  const width = 5.6;
  NETWORK_LAYERS.forEach((count, li) => {
    const x = -width / 2 + (li / (NETWORK_LAYERS.length - 1)) * width;
    const layer: [number, number, number][] = [];
    const spacing = 0.52;
    for (let i = 0; i < count; i++) {
      const y = (i - (count - 1) / 2) * spacing;
      const z = Math.sin(li * 1.7 + i) * 0.25;
      layer.push([x, y, z]);
    }
    nodes.push(layer);
  });
  return nodes;
}

export function buildShapes(n: number) {
  const rand = mulberry32(1304);
  const shapes = Array.from({ length: SHAPE_COUNT }, () => new Float32Array(n * 3));
  const aRand = new Float32Array(n);
  const aScale = new Float32Array(n);
  const aCluster = new Float32Array(n);

  // 0 — sphere (fibonacci shell + sparse inner core)
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const inner = i % 7 === 0;
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const R = inner ? 0.6 + rand() * 1.2 : 2.25 * (0.94 + rand() * 0.08);
    shapes[0][i * 3] = Math.cos(theta) * r * R;
    shapes[0][i * 3 + 1] = y * R;
    shapes[0][i * 3 + 2] = Math.sin(theta) * r * R;
  }

  // 1 — neural network: particles clump around layer nodes
  const layers = networkNodes();
  const flat = layers.flat();
  for (let i = 0; i < n; i++) {
    const node = flat[i % flat.length];
    const tight = rand() < 0.75;
    const s = tight ? 0.07 : 0.2;
    shapes[1][i * 3] = node[0] + gaussian(rand) * s;
    shapes[1][i * 3 + 1] = node[1] + gaussian(rand) * s;
    shapes[1][i * 3 + 2] = node[2] + gaussian(rand) * s;
  }

  // 2 — galaxy: three spiral arms, tilted toward the camera
  const tilt = -0.95;
  for (let i = 0; i < n; i++) {
    const arm = i % 3;
    const r = Math.pow(rand(), 0.7) * 4.2 + 0.15;
    const angle = r * 1.35 + (arm * Math.PI * 2) / 3 + gaussian(rand) * 0.22;
    const spread = 0.12 + r * 0.05;
    const x = Math.cos(angle) * r + gaussian(rand) * spread;
    const z = Math.sin(angle) * r + gaussian(rand) * spread;
    const y = gaussian(rand) * 0.14 * (1.4 - r / 4.2);
    shapes[2][i * 3] = x;
    shapes[2][i * 3 + 1] = y * Math.cos(tilt) - z * Math.sin(tilt);
    shapes[2][i * 3 + 2] = y * Math.sin(tilt) + z * Math.cos(tilt);
  }

  // 3 — terrain point cloud (grid + fbm height)
  const cols = Math.ceil(Math.sqrt(n * 1.5));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const cx = i % cols;
    const cz = Math.floor(i / cols);
    const x = (cx / (cols - 1) - 0.5) * 10;
    const z = (cz / Math.max(rows - 1, 1) - 0.5) * 6.5;
    const h = fbm(x * 0.35 + 3.1, z * 0.35 + 7.7);
    shapes[3][i * 3] = x + (rand() - 0.5) * 0.03;
    shapes[3][i * 3 + 1] = (h - 0.5) * 2.2 - 1.2;
    shapes[3][i * 3 + 2] = z;
  }

  // 4 — six skill clusters on a ring
  for (let i = 0; i < n; i++) {
    const c = i % CLUSTERS;
    aCluster[i] = c;
    const a = (c / CLUSTERS) * Math.PI * 2 + Math.PI / 2;
    const cx = Math.cos(a) * 2.5;
    const cy = Math.sin(a) * 2.0;
    const cz = Math.sin(a * 2) * 0.6;
    const s = rand() < 0.8 ? 0.32 : 0.7;
    shapes[4][i * 3] = cx + gaussian(rand) * s;
    shapes[4][i * 3 + 1] = cy + gaussian(rand) * s;
    shapes[4][i * 3 + 2] = cz + gaussian(rand) * s;
  }

  for (let i = 0; i < n; i++) {
    aRand[i] = rand();
    aScale[i] = 0.4 + Math.pow(rand(), 3) * 1.6;
  }

  return { shapes, aRand, aScale, aCluster };
}

/** Line segments between nearby points on the sphere ("synapses"). */
export function sphereSynapses(sphere: Float32Array, sampleEvery = 9, maxDist = 0.62) {
  const pts: number[][] = [];
  for (let i = 0; i < sphere.length / 3; i += sampleEvery) {
    const x = sphere[i * 3];
    const y = sphere[i * 3 + 1];
    const z = sphere[i * 3 + 2];
    if (Math.hypot(x, y, z) > 2) pts.push([x, y, z]); // shell only
  }
  const pos: number[] = [];
  const t: number[] = [];
  const seed: number[] = [];
  const rand = mulberry32(42);
  for (let i = 0; i < pts.length; i++) {
    let links = 0;
    for (let j = i + 1; j < pts.length && links < 3; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      if (d < maxDist) {
        pos.push(...pts[i], ...pts[j]);
        t.push(0, 1);
        const s = rand();
        seed.push(s, s);
        links++;
      }
    }
  }
  return {
    position: new Float32Array(pos),
    aT: new Float32Array(t),
    aSeed: new Float32Array(seed),
  };
}

/** Fully-connected edges between adjacent network layers. */
export function networkEdges() {
  const layers = networkNodes();
  const pos: number[] = [];
  const t: number[] = [];
  const seed: number[] = [];
  const rand = mulberry32(7);
  for (let l = 0; l < layers.length - 1; l++) {
    for (const a of layers[l]) {
      for (const b of layers[l + 1]) {
        pos.push(...a, ...b);
        t.push(0, 1);
        const s = rand();
        seed.push(s, s);
      }
    }
  }
  return {
    position: new Float32Array(pos),
    aT: new Float32Array(t),
    aSeed: new Float32Array(seed),
  };
}

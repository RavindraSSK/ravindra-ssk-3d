"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";
import { Backdrop, ChapterGroups, Poly, Segs, V, lineGeo, lineMat, rng, useChapterRig, type Vec3 } from "./kit";

/*
 * Blueprint theme: where it started. A civil-engineering drafting sheet
 * (B.Tech in Civil Engineering, SSKS Home Designs) whose drawings turn into AI:
 *   house elevation → truss bridge whose joints fire like neurons →
 *   five-storey frame (one floor per role) → site plan (one block per project) →
 *   laser-scanner survey (TLS research) → six structural columns (skills) → house
 */

const BG = "#0e3158";
const LINE = "#e8f1ff";
const ACCENT = "#ffd166";
const LINE_C = new THREE.Color(LINE);
const ACCENT_C = new THREE.Color(ACCENT);

const OFFSETS: Vec3[] = [
  [2.4, -0.1, 0],
  [-2.3, 0, 0],
  [2.3, -0.2, 0],
  [0, -0.3, -1.5],
  [2.2, -0.2, 0],
  [-2.5, -0.1, 0],
  [0, -0.1, 0],
];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
float gridLine(vec2 p, float cell, float w){
  vec2 g = abs(fract(p / cell - 0.5) - 0.5) * cell;
  return 1.0 - smoothstep(0.0, w, min(g.x, g.y));
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float s = uRes.y / 900.0;
  vec2 p = gl_FragCoord.xy - uMouse * 10.0 * s + vec2(0.0, uChapter * 40.0 * s);
  vec3 col = mix(vec3(0.047, 0.17, 0.31), vec3(0.07, 0.22, 0.38), uv.y);
  col += 0.06 * (1.0 - distance(uv, vec2(0.62, 0.55)));
  float fine = gridLine(p, 22.0 * s, 1.0);
  float major = gridLine(p, 110.0 * s, 1.3);
  col += vec3(0.55, 0.72, 1.0) * (fine * 0.035 + major * 0.075);
  // sheet border like a drawing frame
  vec2 m = min(gl_FragCoord.xy, uRes - gl_FragCoord.xy) / s;
  float frame = (1.0 - smoothstep(0.0, 1.2, abs(m.x - 14.0))) * step(14.0, m.y) + (1.0 - smoothstep(0.0, 1.2, abs(m.y - 14.0))) * step(14.0, m.x);
  col += vec3(0.6, 0.75, 1.0) * frame * 0.12;
  // paper grain
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

function useMats() {
  return useMemo(
    () => ({
      line: lineMat(LINE, 0.9),
      mid: lineMat(LINE, 0.5),
      faint: lineMat(LINE, 0.2),
      accent: lineMat(ACCENT, 0.95),
      node: new THREE.MeshBasicMaterial({ color: LINE }),
      nodeAccent: new THREE.MeshBasicMaterial({ color: ACCENT }),
      fill: new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    }),
    []
  );
}
type Mats = ReturnType<typeof useMats>;

/** Dimension line with end ticks (drafting style), offset from a→b. */
function dim(s: Segs, a: THREE.Vector3, b: THREE.Vector3, off: THREE.Vector3) {
  const a2 = a.clone().add(off);
  const b2 = b.clone().add(off);
  const n = off.clone().normalize().multiplyScalar(0.08);
  s.seg(a.clone().addScaledVector(off.clone().normalize(), 0.05), a2.clone().add(n));
  s.seg(b.clone().addScaledVector(off.clone().normalize(), 0.05), b2.clone().add(n));
  s.seg(a2, b2);
  const d = b2.clone().sub(a2).normalize().multiplyScalar(0.07);
  const t = new THREE.Vector3().crossVectors(d, off).normalize().multiplyScalar(0.07);
  // architectural 45° ticks
  s.seg(a2.clone().sub(d).sub(t), a2.clone().add(d).add(t));
  s.seg(b2.clone().sub(d).sub(t), b2.clone().add(d).add(t));
}

// ---------- 0 / 6: house ----------
function House({ m }: { m: Mats }) {
  const ref = useRef<THREE.Group>(null);
  const cut = useRef<THREE.Group>(null);
  const { body, detail, dims } = useMemo(() => {
    const W = 3.2, D = 2.2, H = 1.1; // two floors of 1.1
    const body = new Segs();
    body.box(V(0, H / 2, 0), W, H, D).box(V(-0.35, H * 1.5, 0), W - 0.7, H, D);
    // gable roof over upper floor
    const rw = (W - 0.7) / 2 + 0.15, ry = H * 2, rz = D / 2 + 0.15, rx = -0.35;
    const ridge = ry + 0.75;
    const rp = [V(rx - rw, ry, -rz), V(rx + rw, ry, -rz), V(rx + rw, ry, rz), V(rx - rw, ry, rz)];
    body.poly(rp, true);
    body.seg(V(rx - rw, ridge, 0), V(rx + rw, ridge, 0));
    rp.forEach((p) => body.seg(p, V(p.x, ridge, 0)));
    // flat roof slab over ground floor overhang
    body.rect(V(W / 2 - 0.35, H + 0.02, 0), V(1, 0, 0), V(0, 0, 1), 0.9, D + 0.2);

    const detail = new Segs();
    const f = D / 2 + 0.001;
    // windows front, ground + first
    [-1.1, 0.1].forEach((x) => detail.rect(V(x, 0.62, f), V(1, 0, 0), V(0, 1, 0), 0.55, 0.45));
    [-1.1, -0.2, 0.55].forEach((x) => detail.rect(V(x, H + 0.6, f), V(1, 0, 0), V(0, 1, 0), 0.45, 0.45));
    // mullions
    [-1.1, 0.1].forEach((x) => detail.seg(V(x, 0.4, f), V(x, 0.85, f)));
    // door
    detail.rect(V(1.05, 0.45, f), V(1, 0, 0), V(0, 1, 0), 0.42, 0.9);
    // balcony rail on the ground-floor roof
    for (let i = 0; i <= 8; i++) {
      const x = W / 2 - 0.8 + i * 0.1;
      detail.seg(V(x, H + 0.02, f + 0.1), V(x, H + 0.3, f + 0.1));
    }
    detail.seg(V(W / 2 - 0.8, H + 0.3, f + 0.1), V(W / 2, H + 0.3, f + 0.1));
    // ground line
    detail.seg(V(-W / 2 - 0.8, 0, f), V(W / 2 + 0.8, 0, f));

    const dims = new Segs();
    dim(dims, V(-W / 2, 0, f), V(W / 2, 0, f), V(0, -0.35, 0));
    dim(dims, V(W / 2, 0, f), V(W / 2, H * 2, f), V(0.45, 0, 0));
    dim(dims, V(W / 2, 0, -D / 2), V(W / 2, 0, D / 2), V(0.45, -0.001, 0));
    return { body: body.geo(), detail: detail.geo(), dims: dims.geo() };
  }, []);
  const plane = useMemo(() => {
    const s = new Segs().rect(V(0, 0, 0), V(0, 1, 0), V(0, 0, 1), 3.5, 2.8);
    return s.geo();
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    if (ref.current) ref.current.rotation.y = -0.65 + Math.sin(t * 0.18) * 0.35;
    if (cut.current) cut.current.position.x = Math.sin(t * 0.45) * 1.7;
  });

  return (
    <group position={[0.35, -0.8, 0]} rotation={[0.28, 0, 0]} scale={0.74}>
      <group ref={ref}>
        <lineSegments geometry={body} material={m.line} />
        <lineSegments geometry={detail} material={m.mid} />
        <lineSegments geometry={dims} material={m.faint} />
        {/* section plane sweeping through the building */}
        <group ref={cut} position={[0, 1.2, 0]}>
          <lineSegments geometry={plane} material={m.accent} />
          <mesh material={m.fill} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.8, 3.5]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------- 1: truss bridge whose joints fire like neurons ----------
function Truss({ m }: { m: Mats }) {
  const nodes = useRef<THREE.Mesh[]>([]);
  const { geo, joints } = useMemo(() => {
    const s = new Segs();
    const N = 8, L = 4.6, h = 0.8, d = 0.9;
    const joints: THREE.Vector3[] = [];
    for (const z of [-d / 2, d / 2]) {
      const bottom = Array.from({ length: N + 1 }, (_, i) => V(-L / 2 + (i * L) / N, 0, z));
      const top = Array.from({ length: N }, (_, i) => V(-L / 2 + ((i + 0.5) * L) / N, h, z));
      s.poly(bottom).poly(top);
      top.forEach((t, i) => s.seg(bottom[i], t).seg(t, bottom[i + 1]));
      joints.push(...bottom, ...top);
    }
    // cross bracing between the two trusses
    for (let i = 0; i <= N; i++) s.seg(V(-L / 2 + (i * L) / N, 0, -d / 2), V(-L / 2 + (i * L) / N, 0, d / 2));
    for (let i = 0; i < N; i++) {
      const x = -L / 2 + ((i + 0.5) * L) / N;
      s.seg(V(x, h, -d / 2), V(x, h, d / 2));
    }
    // piers + deck line
    s.box(V(-L / 2, -0.55, 0), 0.25, 1.1, d + 0.3).box(V(L / 2, -0.55, 0), 0.25, 1.1, d + 0.3);
    s.dashed(V(-L / 2 - 0.9, -1.1, 0.8), V(L / 2 + 0.9, -1.1, 0.8), 0.18, 0.1);
    return { geo: s.geo(), joints };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    // a signal travels across the span like activations through a network
    const front = ((t * 0.6) % 1.6) * 4.6 - 2.3 - 0.6;
    nodes.current.forEach((n) => {
      if (!n) return;
      const k = Math.exp(-((n.position.x - front) ** 2) * 6);
      n.scale.setScalar(1 + k * 1.4);
      n.material = k > 0.3 ? m.nodeAccent : m.node;
    });
  });

  return (
    <group rotation={[0.35, -0.55, 0]}>
      <lineSegments geometry={geo} material={m.line} />
      {joints.map((p, i) => (
        <mesh
          key={i}
          position={p}
          material={m.node}
          ref={(el) => {
            if (el) nodes.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.035, 10, 10]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- 2: frame building, one storey per role ----------
const FLOORS = 5;
function Storeys({ m }: { m: Mats }) {
  const slabs = useRef<THREE.Mesh[]>([]);
  const { frame, grid } = useMemo(() => {
    const s = new Segs();
    const w = 2.2, d = 1.6, fh = 0.55;
    const xs = [-w / 2, 0, w / 2];
    const zs = [-d / 2, d / 2];
    for (const x of xs) for (const z of zs) s.seg(V(x, 0, z), V(x, FLOORS * fh, z));
    for (let f = 0; f <= FLOORS; f++) s.rect(V(0, f * fh, 0), V(1, 0, 0), V(0, 0, 1), w, d);
    // diagonal bracing in the core bay
    for (let f = 0; f < FLOORS; f++) s.seg(V(0, f * fh, d / 2), V(w / 2, (f + 1) * fh, d / 2));
    const g = new Segs();
    for (let i = -3; i <= 3; i++) {
      g.seg(V(i * 0.55, 0, -1.6), V(i * 0.55, 0, 1.6));
      g.seg(V(-1.65, 0, i * 0.5), V(1.65, 0, i * 0.5));
    }
    return { frame: s.geo(), grid: g.geo() };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const lit = Math.floor(t * 0.9) % (FLOORS + 2);
    slabs.current.forEach((sl, i) => {
      if (!sl) return;
      const mat = sl.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, i <= lit - 1 ? 0.2 : 0.03, 0.08);
    });
  });

  return (
    <group rotation={[0.42, -0.7, 0]} position={[0, -1.35, 0]}>
      <lineSegments geometry={grid} material={m.faint} />
      <lineSegments geometry={frame} material={m.line} />
      {Array.from({ length: FLOORS }).map((_, i) => (
        <mesh
          key={i}
          position={[0, (i + 1) * 0.55 - 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={(el) => {
            if (el) slabs.current[i] = el;
          }}
        >
          <planeGeometry args={[2.2, 1.6]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.03} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- 3: site plan, one block per project ----------
const BLOCKS = [
  { x: -2.6, z: -0.3, w: 1.1, d: 0.9, h: 1.3 },
  { x: -1.2, z: 0.6, w: 0.9, d: 0.8, h: 0.8 },
  { x: 0.1, z: -0.5, w: 1.2, d: 1.0, h: 1.8 },
  { x: 1.5, z: 0.5, w: 0.8, d: 0.9, h: 1.0 },
  { x: 2.7, z: -0.2, w: 1.0, d: 0.8, h: 0.6 },
];
function SitePlan({ m }: { m: Mats }) {
  const hi = useRef<THREE.Group>(null);
  const { blocks, roads } = useMemo(() => {
    const b = new Segs();
    BLOCKS.forEach((k) => b.box(V(k.x, k.h / 2, k.z), k.w, k.h, k.d));
    const r = new Segs();
    r.rect(V(0, 0, 0), V(1, 0, 0), V(0, 0, 1), 7, 3);
    r.dashed(V(-3.5, 0, 1.2), V(3.5, 0, 1.2), 0.2, 0.12).dashed(V(-3.5, 0, -1.2), V(3.5, 0, -1.2), 0.2, 0.12);
    // north arrow
    r.poly([V(3.1, 0, -0.9), V(3.2, 0, -1.3), V(3.3, 0, -0.9), V(3.2, 0, -1.0)], true);
    return { blocks: b.geo(), roads: r.geo() };
  }, []);
  const outline = useMemo(() => new Segs().box(V(0, 0.5, 0), 1, 1, 1).geo(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const i = Math.floor(t * 0.5) % BLOCKS.length;
    const k = BLOCKS[i];
    if (hi.current) {
      hi.current.position.set(k.x, 0, k.z);
      hi.current.scale.set(k.w + 0.08, k.h + 0.06, k.d + 0.08);
    }
  });

  return (
    <group rotation={[0.62, -0.25, 0]} position={[0, -0.6, 0]}>
      <lineSegments geometry={roads} material={m.faint} />
      <lineSegments geometry={blocks} material={m.mid} />
      <group ref={hi}>
        <lineSegments geometry={outline} material={m.accent} />
      </group>
    </group>
  );
}

// ---------- 4: terrestrial laser scan of a facade ----------
const scanVertex = /* glsl */ `
uniform float uSweep; uniform float uSize;
attribute float aAng;
varying float vHit;
void main(){
  float d = mod(uSweep - aAng, 6.2831853);
  vHit = exp(-d * 1.4);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (1.0 + vHit * 1.5) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const scanFragment = /* glsl */ `
uniform vec3 uA; uniform vec3 uB;
varying float vHit;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  if(dot(c,c) > 0.25) discard;
  gl_FragColor = vec4(mix(uA, uB, vHit), 0.35 + vHit * 0.65);
}`;
function Scan({ m }: { m: Mats }) {
  const head = useRef<THREE.Group>(null);
  const { geo, mat, tripod } = useMemo(() => {
    const r = rng(7);
    const pts: number[] = [];
    const ang: number[] = [];
    const add = (x: number, y: number, z: number) => {
      pts.push(x + (r() - 0.5) * 0.02, y, z + (r() - 0.5) * 0.02);
      ang.push(Math.atan2(z, x) + Math.PI);
    };
    // U-shaped courtyard: three facades with window openings
    const walls = [
      { a: V(-1.8, 0, -1.4), b: V(1.8, 0, -1.4) },
      { a: V(-1.8, 0, -1.4), b: V(-1.8, 0, 1.2) },
      { a: V(1.8, 0, -1.4), b: V(1.8, 0, 1.2) },
    ];
    for (const w of walls) {
      const len = w.a.distanceTo(w.b);
      for (let i = 0; i < 1500; i++) {
        const u = r();
        const y = r() * 2.2 - 0.9;
        const p = w.a.clone().lerp(w.b, u);
        const lx = (u * len) % 0.9;
        const window = lx > 0.3 && lx < 0.62 && ((y > -0.35 && y < 0.15) || (y > 0.55 && y < 1.0));
        if (!window) add(p.x, y, p.z);
      }
    }
    // ground
    for (let i = 0; i < 900; i++) add((r() - 0.5) * 3.6, -0.9, -1.4 + r() * 2.6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute("aAng", new THREE.Float32BufferAttribute(ang, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSweep: { value: 0 },
        uSize: { value: 22 },
        uA: { value: new THREE.Color(LINE).multiplyScalar(0.8) },
        uB: { value: new THREE.Color(ACCENT) },
      },
      vertexShader: scanVertex,
      fragmentShader: scanFragment,
      transparent: true,
      depthWrite: false,
    });
    const tp = new Segs();
    [0, 2.1, 4.2].forEach((a) => tp.seg(V(0, -0.35, 0.2), V(Math.cos(a) * 0.35, -0.9, 0.2 + Math.sin(a) * 0.35)));
    return { geo, mat, tripod: tp.geo() };
  }, []);
  const beam = useMemo(() => lineGeo([V(0, 0, 0), V(-2.6, 0, 0)]), []);
  const headBox = useMemo(() => new Segs().box(V(0, 0, 0), 0.16, 0.26, 0.16).geo(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const sweep = (t * 1.1) % (Math.PI * 2);
    mat.uniforms.uSweep.value = sweep;
    mat.uniforms.uSize.value = 22 * Math.min(state.gl.getPixelRatio(), 1.5);
    if (head.current) head.current.rotation.y = -sweep + Math.PI;
  });

  return (
    <group rotation={[0.45, -0.25, 0]}>
      <points geometry={geo} material={mat} />
      <lineSegments geometry={tripod} material={m.mid} />
      <group ref={head} position={[0, -0.22, 0.2]}>
        <lineSegments geometry={headBox} material={m.line} />
        <Poly geometry={beam} material={m.accent} />
      </group>
    </group>
  );
}

// ---------- 5: six structural columns (skill groups) ----------
function Columns({ m }: { m: Mats }) {
  const cols = useRef<THREE.Group[]>([]);
  const fills = useMemo(
    () => Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.0, depthWrite: false })),
    []
  );
  const lines = useMemo(() => Array.from({ length: 6 }, () => lineMat(LINE, 0.75)), []);
  const col = useMemo(() => {
    const s = new Segs();
    s.box(V(0, 0.5, 0), 0.36, 1, 0.36); // shaft (scaled in y)
    return s.geo();
  }, []);
  const fillGeo = useMemo(() => new THREE.BoxGeometry(0.36, 1, 0.36).translate(0, 0.5, 0), []);
  const caps = useMemo(() => new Segs().box(V(0, 0, 0), 0.56, 0.12, 0.56).geo(), []);
  const base = useMemo(() => {
    const s = new Segs().rect(V(0, 0, 0), V(1, 0, 0), V(0, 0, 1), 4.2, 2.6);
    for (let i = -2; i <= 2; i++) s.dashed(V(i * 0.95, 0, -1.3), V(i * 0.95, 0, 1.3), 0.1, 0.08);
    return s.geo();
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    cols.current.forEach((g, i) => {
      if (!g) return;
      const on = store.hoverCluster === i ? 1 : 0;
      const h = THREE.MathUtils.lerp(g.userData.h ?? 1, 1 + on * 0.9 + Math.sin(t * 0.9 + i) * 0.04, 0.12);
      g.userData.h = h;
      const shaft = g.children[0];
      shaft.scale.y = h;
      g.children[1].position.y = h + 0.06;
      g.children[2].scale.y = h;
      fills[i].opacity = THREE.MathUtils.lerp(fills[i].opacity, on * 0.35, 0.15);
      lines[i].color.lerp(on ? ACCENT_C : LINE_C, 0.15);
    });
  });

  return (
    <group rotation={[0.32, -0.42, 0]} position={[0, -1.0, 0]}>
      <lineSegments geometry={base} material={m.faint} />
      {Array.from({ length: 6 }).map((_, i) => {
        const x = ((i % 3) - 1) * 1.25;
        const z = i < 3 ? -0.6 : 0.6;
        return (
          <group
            key={i}
            position={[x + (i < 3 ? 0 : 0.3), 0, z]}
            ref={(el) => {
              if (el) cols.current[i] = el;
            }}
          >
            <lineSegments geometry={col} material={lines[i]} />
            <lineSegments geometry={caps} material={lines[i]} position={[0, 1.06, 0]} />
            <mesh material={fills[i]} geometry={fillGeo} />
          </group>
        );
      })}
    </group>
  );
}

export default function BlueprintScene() {
  const m = useMats();
  const groups = useRef<(THREE.Group | null)[]>([]);
  useChapterRig(groups, OFFSETS, { camZ: 8.2, camZNarrow: 10.5 });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ChapterGroups groups={groups}>
        {[
          <House key="b0" m={m} />,
          <Truss key="b1" m={m} />,
          <Storeys key="b2" m={m} />,
          <SitePlan key="b3" m={m} />,
          <Scan key="b4" m={m} />,
          <Columns key="b5" m={m} />,
          <House key="b6" m={m} />,
        ]}
      </ChapterGroups>
    </>
  );
}

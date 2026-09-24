"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";
import { Backdrop, ChapterGroups, Poly, Segs, V, lineGeo, lineMat, rng, useChapterRig, type Vec3 } from "./kit";

/*
 * Arena theme: a floodlit handball court (university team captain).
 *   match ball → full court → tactics board (one play per role) →
 *   striped goal + net (projects fly in) → shot-tracking arcs (research) →
 *   3-2-1 defence: six court players = six skill groups → match ball
 */

const BG = "#080b10";
const LINE = "#f1f4f8";
const ACCENT = "#ff7a1f";
const BLUE = "#4f8cff";

// Court units: 1 unit = 1/7 of 40 m court (so 6 m ≈ 0.86)
const M = 0.14;

const OFFSETS: Vec3[] = [
  [2.5, 0.1, 0],
  [-2.3, -0.1, 0],
  [2.4, 0, 0],
  [0, -0.2, -1.5],
  [2.3, -0.1, 0],
  [-2.4, -0.1, 0],
  [0, 0.1, 0],
];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 col = mix(vec3(0.02, 0.028, 0.04), vec3(0.045, 0.06, 0.085), uv.y);
  // two floodlight beams from the stands
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    vec2 src = vec2(asp * 0.5 + side * asp * 0.42 + uMouse.x * 0.03, 1.08);
    vec2 dir = normalize(vec2(-side * 0.55, -1.0));
    vec2 d = p - src;
    float along = dot(d, dir);
    float across = abs(d.x * dir.y - d.y * dir.x);
    float beam = smoothstep(0.0, 0.15, along) * exp(-across * across / (0.012 + along * 0.05)) * exp(-along * 0.9);
    col += vec3(0.5, 0.55, 0.62) * beam * 0.16;
    col += vec3(1.0, 0.97, 0.9) * exp(-dot(d, d) * 90.0) * 0.6;
  }
  // blurred crowd / stand lights near the top
  vec2 g = vec2(p.x * 26.0, uv.y * 14.0);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float r = hash(id);
  float band = smoothstep(0.62, 0.8, uv.y) * (1.0 - smoothstep(0.93, 1.0, uv.y));
  float bokeh = smoothstep(0.34, 0.2, length(f + (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.4));
  float tw = 0.6 + 0.4 * sin(uTime * (0.5 + r) + r * 20.0);
  col += mix(vec3(1.0, 0.55, 0.2), vec3(0.4, 0.6, 1.0), step(0.5, hash(id + 1.3))) * bokeh * band * step(0.72, r) * 0.07 * tw;
  // floor haze
  col += vec3(0.1, 0.16, 0.28) * smoothstep(0.35, 0.0, uv.y) * 0.25;
  float vig = smoothstep(1.25, 0.35, distance(uv, vec2(0.5, 0.55)));
  col *= 0.65 + 0.35 * vig;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- ball ----------
const ballVertex = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vV;
void main(){
  vObj = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const ballFragment = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
varying vec3 vObj; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 p = vObj;
  // twist the panels so they curve like a match ball
  float a = p.y * 0.9;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  // 12 panels around the icosahedron directions: nearest direction = panel
  const float PHI = 1.618034;
  vec3 dirs[6];
  dirs[0] = vec3(0.0, 1.0, PHI); dirs[1] = vec3(0.0, 1.0, -PHI);
  dirs[2] = vec3(1.0, PHI, 0.0); dirs[3] = vec3(1.0, -PHI, 0.0);
  dirs[4] = vec3(PHI, 0.0, 1.0); dirs[5] = vec3(-PHI, 0.0, 1.0);
  float best = -2.0, second = -2.0; int idx = 0;
  for (int i = 0; i < 6; i++) {
    vec3 d = normalize(dirs[i]);
    float v = dot(p, d);
    float av = abs(v);
    int id = i * 2 + (v < 0.0 ? 1 : 0);
    if (av > best) { second = best; best = av; idx = id; }
    else if (av > second) { second = av; }
  }
  float seam = smoothstep(0.028, 0.008, best - second);
  int k = idx - (idx / 3) * 3;
  vec3 base = k == 0 ? uA : (k == 1 ? uB : uC);
  vec3 L = normalize(vec3(0.4, 0.9, 0.6));
  float diff = max(dot(vN, L), 0.0);
  float spec = pow(max(dot(reflect(-L, vN), vV), 0.0), 24.0);
  float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
  vec3 col = base * (0.25 + 0.85 * diff) + spec * 0.35 + rim * vec3(0.35, 0.5, 0.9) * 0.5;
  col = mix(col, vec3(0.05), seam * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

function useMats() {
  return useMemo(
    () => ({
      line: lineMat(LINE, 0.85),
      mid: lineMat(LINE, 0.45),
      faint: lineMat(LINE, 0.18),
      accent: lineMat(ACCENT, 0.95),
      blue: lineMat(BLUE, 0.8),
      ball: new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: new THREE.Color(ACCENT) },
          uB: { value: new THREE.Color("#f4f6fa") },
          uC: { value: new THREE.Color("#1d3f8f") },
        },
        vertexShader: ballVertex,
        fragmentShader: ballFragment,
      }),
      shadow: new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.45, depthWrite: false }),
      white: new THREE.MeshStandardMaterial({ color: "#f4f6fa", roughness: 0.45 }),
      orange: new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.45 }),
      dot: new THREE.MeshBasicMaterial({ color: LINE }),
      dotAccent: new THREE.MeshBasicMaterial({ color: ACCENT }),
    }),
    []
  );
}
type Mats = ReturnType<typeof useMats>;

/** Arc points of radius r around centre (cx, cz), angles a0→a1, clipped to |z| <= zMax. */
function arc(cx: number, cz: number, r: number, a0: number, a1: number, n = 40, zMax = Infinity) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const z = cz + Math.sin(a) * r;
    if (Math.abs(z) <= zMax) pts.push(V(cx + Math.cos(a) * r, 0, z));
  }
  return pts;
}

/** Goal-area "D" lines for a goal on the line x = gx facing +x (dir = 1) or -x (dir = -1). */
function goalArea(s: Segs, gx: number, dir: 1 | -1, zMax: number, dashed9 = true) {
  const post = 1.5 * M;
  const six = 6 * M;
  const nine = 9 * M;
  const flip = (pts: THREE.Vector3[]) => pts.map((p) => V(gx + (p.x - gx) * dir, 0, p.z));
  // 6 m line
  s.poly(flip(arc(gx, post, six, 0, Math.PI / 2, 30, zMax)));
  s.poly(flip(arc(gx, -post, six, 0, -Math.PI / 2, 30, zMax)));
  s.seg(V(gx + six * dir, 0, -post), V(gx + six * dir, 0, post));
  // 9 m dashed
  if (dashed9) {
    const a = flip(arc(gx, post, nine, 0, Math.PI / 2, 40, zMax));
    const b = flip(arc(gx, -post, nine, 0, -Math.PI / 2, 40, zMax));
    for (let i = 0; i < a.length - 1; i += 2) s.seg(a[i], a[i + 1]);
    for (let i = 0; i < b.length - 1; i += 2) s.seg(b[i], b[i + 1]);
    for (let z = -post; z < post; z += 0.12) s.seg(V(gx + nine * dir, 0, z), V(gx + nine * dir, 0, Math.min(z + 0.06, post)));
  }
  // 7 m mark + 4 m keeper line
  s.seg(V(gx + 7 * M * dir, 0, -0.5 * M), V(gx + 7 * M * dir, 0, 0.5 * M));
  s.seg(V(gx + 4 * M * dir, 0, -0.075 * M * 2), V(gx + 4 * M * dir, 0, 0.075 * M * 2));
}

function goalFrame(s: Segs, gx: number, dir: 1 | -1, depth = 1 * M) {
  const w = 1.5 * M;
  const h = 2 * M;
  const back = gx - depth * dir;
  s.poly([V(gx, 0, -w), V(gx, h, -w), V(gx, h, w), V(gx, 0, w)]);
  s.poly([V(gx, h, -w), V(back, h * 0.7, -w), V(back, 0, -w)]);
  s.poly([V(gx, h, w), V(back, h * 0.7, w), V(back, 0, w)]);
  s.seg(V(back, h * 0.7, -w), V(back, h * 0.7, w));
}

function Ball({ m, r = 0.8 }: { m: Mats; r?: number }) {
  return (
    <mesh material={m.ball}>
      <sphereGeometry args={[r, 64, 48]} />
    </mesh>
  );
}

// ---------- 0 / 6: match ball ----------
function MatchBall({ m }: { m: Mats }) {
  const ball = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const floor = useMemo(() => {
    const s = new Segs();
    goalArea(s, -2.2, 1, 3);
    return s.geo();
  }, []);
  const trail = useMemo(() => {
    const s = new Segs();
    const pts = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39;
      return V(-3.2 + t * 3.2, -1.2 + Math.sin(t * Math.PI) * 2.3 + t * 0.9, -1.2 + t * 1.2);
    });
    for (let i = 0; i < pts.length - 1; i += 2) s.seg(pts[i], pts[i + 1]);
    return s.geo();
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const bounce = Math.abs(Math.sin(t * 1.5));
    if (ball.current) {
      ball.current.position.y = -0.55 + bounce * 0.85;
      ball.current.rotation.y = t * 0.9;
      ball.current.rotation.x = t * 0.35;
      const squash = 1 - Math.max(0, 0.18 - bounce) * 0.6;
      ball.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }
    if (shadow.current) {
      shadow.current.scale.setScalar(1.1 - bounce * 0.35);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.5 - bounce * 0.25;
    }
  });

  return (
    <group rotation={[0.12, -0.3, 0]}>
      <group position={[0, -1.4, 0]} rotation={[0.08, 0.4, 0]}>
        <lineSegments geometry={floor} material={m.mid} />
      </group>
      <lineSegments geometry={trail} material={m.accent} />
      <mesh ref={shadow} material={m.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.38, 0]}>
        <circleGeometry args={[0.75, 48]} />
      </mesh>
      <group ref={ball}>
        <Ball m={m} r={0.8} />
      </group>
    </group>
  );
}

// ---------- 1: the court ----------
function Court({ m }: { m: Mats }) {
  const ref = useRef<THREE.Group>(null);
  const { lines, dLines } = useMemo(() => {
    const L = 20 * M, W = 10 * M;
    const s = new Segs();
    s.rect(V(0, 0, 0), V(1, 0, 0), V(0, 0, 1), L * 2, W * 2);
    s.seg(V(0, 0, -W), V(0, 0, W));
    const d = new Segs();
    goalArea(d, -L, 1, W);
    goalArea(d, L, -1, W);
    goalFrame(s, -L, 1);
    goalFrame(s, L, -1);
    // substitution lines
    [-4.5 * M, 4.5 * M].forEach((x) => s.seg(V(x, 0, W), V(x, 0, W + 0.15)));
    return { lines: s.geo(), dLines: d.geo() };
  }, []);
  const areaShape = useMemo(() => {
    const shape = new THREE.Shape();
    const post = 1.5 * M, six = 6 * M;
    shape.moveTo(0, -post - six);
    shape.absarc(0, -post, six, -Math.PI / 2, 0, false);
    shape.lineTo(six, post);
    shape.absarc(0, post, six, 0, Math.PI / 2, false);
    shape.lineTo(0, -post - six);
    return new THREE.ShapeGeometry(shape, 24);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    if (ref.current) ref.current.rotation.y = -0.5 + Math.sin(t * 0.15) * 0.25;
  });

  return (
    <group rotation={[0.72, 0, 0]}>
      <group ref={ref}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
          <planeGeometry args={[40 * M, 20 * M]} />
          <meshBasicMaterial color="#123763" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        {[-1, 1].map((d) => (
          <mesh key={d} geometry={areaShape} rotation={[-Math.PI / 2, 0, d === 1 ? 0 : Math.PI]} position={[-20 * M * d, -0.002, 0]}>
            <meshBasicMaterial color={ACCENT} transparent opacity={0.22} depthWrite={false} />
          </mesh>
        ))}
        <lineSegments geometry={lines} material={m.line} />
        <lineSegments geometry={dLines} material={m.line} />
        <mesh position={[1.2, 0.08, 0.5]} material={m.ball}>
          <sphereGeometry args={[0.08, 24, 16]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- 2: tactics board ----------
const PLAYS: { from: [number, number]; ctrl: [number, number]; to: [number, number] }[] = [
  { from: [-1.1, -0.4], ctrl: [-0.6, 0.5], to: [0.1, 0.35] },
  { from: [0.1, 0.35], ctrl: [0.6, 0.9], to: [1.0, 0.1] },
  { from: [1.0, 0.1], ctrl: [0.6, -0.5], to: [0.2, -0.75] },
  { from: [0.2, -0.75], ctrl: [-0.4, -0.2], to: [-0.2, 0.95] },
];
function Tactics({ m }: { m: Mats }) {
  const arrows = useRef<THREE.Line[]>([]);
  const heads = useRef<THREE.Mesh[]>([]);
  const { board, marks, curves } = useMemo(() => {
    const s = new Segs();
    s.rect(V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), 3.4, 2.6);
    // half court drawn on the board: goal at the top
    const d = new Segs();
    goalArea(d, 0, 1, 99, true);
    // court (x = depth from goal, z = lateral) -> board (x = lateral, y = up from the goal line)
    d.pts.forEach((p) => p.set(p.z, 1.3 - p.x, 0));
    s.pts.push(...d.pts);
    const marks = new Segs();
    // attackers (X) and defenders (O)
    const X = [[-1.1, -0.4], [0.1, 0.35], [1.0, 0.1], [0.2, -0.75], [-1.3, 0.55], [1.35, 0.8]];
    X.forEach(([x, y]) => {
      marks.seg(V(x - 0.07, y - 0.07, 0), V(x + 0.07, y + 0.07, 0)).seg(V(x - 0.07, y + 0.07, 0), V(x + 0.07, y - 0.07, 0));
    });
    const O = [[-0.8, 0.85], [-0.25, 0.7], [0.35, 0.7], [0.85, 0.85], [-0.5, 0.2], [0.5, 0.25]];
    O.forEach(([x, y]) => {
      const c = Array.from({ length: 25 }, (_, i) => V(x + Math.cos((i / 24) * Math.PI * 2) * 0.075, y + Math.sin((i / 24) * Math.PI * 2) * 0.075, 0));
      marks.poly(c);
    });
    const curves = PLAYS.map((p) => {
      const c = new THREE.QuadraticBezierCurve3(V(p.from[0], p.from[1], 0.01), V(p.ctrl[0], p.ctrl[1], 0.01), V(p.to[0], p.to[1], 0.01));
      return { geo: lineGeo(c.getPoints(60)), curve: c };
    });
    return { board: s.geo(), marks: marks.geo(), curves };
  }, []);

  useFrame((state) => {
    const t = (state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1) * 0.55) % (PLAYS.length + 1.2);
    curves.forEach((c, i) => {
      const k = Math.min(Math.max(t - i, 0), 1);
      const line = arrows.current[i];
      if (line) line.geometry.setDrawRange(0, Math.floor(k * 61));
      const h = heads.current[i];
      if (h) {
        h.visible = k > 0.02;
        const p = c.curve.getPoint(k);
        const tan = c.curve.getTangent(Math.max(k, 0.01));
        h.position.copy(p);
        h.rotation.z = Math.atan2(tan.y, tan.x) - Math.PI / 2;
      }
    });
  });

  return (
    <group rotation={[-0.25, -0.35, 0.04]}>
      <lineSegments geometry={board} material={m.mid} />
      <lineSegments geometry={marks} material={m.line} />
      {curves.map((c, i) => (
        <group key={i}>
          <Poly
            geometry={c.geo}
            material={i % 2 ? m.blue : m.accent}
            ref={(el: THREE.Line | null) => {
              if (el) arrows.current[i] = el;
            }}
          />
          <mesh
            material={i % 2 ? m.dot : m.dotAccent}
            visible={false}
            ref={(el) => {
              if (el) heads.current[i] = el;
            }}
          >
            <coneGeometry args={[0.05, 0.13, 3]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- 3: striped goal + net ----------
function Goal({ m }: { m: Mats }) {
  const ball = useRef<THREE.Group>(null);
  const W = 3, H = 2, D = 1;
  const net = useMemo(() => {
    const s = new Segs();
    const step = 0.2;
    for (let x = -W / 2; x <= W / 2 + 1e-6; x += step) {
      s.seg(V(x, H, 0), V(x, H * 0.75, -D)).seg(V(x, H * 0.75, -D), V(x, 0, -D));
    }
    for (let y = 0; y <= H * 0.75 + 1e-6; y += step) s.seg(V(-W / 2, y, -D), V(W / 2, y, -D));
    for (let k = 0; k <= 1.0001; k += 0.2) {
      const y = H - (H * 0.25) * k;
      const z = -D * k;
      s.seg(V(-W / 2, y, z), V(W / 2, y, z));
    }
    for (const x of [-W / 2, W / 2]) {
      for (let y = 0; y <= H; y += step) s.seg(V(x, y, 0), V(x, Math.min(y, H * 0.75), -D));
    }
    return s.geo();
  }, []);
  const stripes = useMemo(() => {
    const out: { pos: Vec3; len: number; rot: Vec3; orange: boolean }[] = [];
    const n = 10;
    for (const x of [-W / 2, W / 2]) for (let i = 0; i < n; i++) out.push({ pos: [x, (i + 0.5) * (H / n), 0], len: H / n, rot: [0, 0, 0], orange: i % 2 === 0 });
    const nb = 15;
    for (let i = 0; i < nb; i++) out.push({ pos: [-W / 2 + (i + 0.5) * (W / nb), H, 0], len: W / nb, rot: [0, 0, Math.PI / 2], orange: i % 2 === 0 });
    return out;
  }, []);

  useFrame((state) => {
    const t = (state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1) * 0.45) % 1;
    if (!ball.current) return;
    const k = Math.min(t / 0.55, 1);
    ball.current.position.set(1.8 - k * 2.4, 0.5 + Math.sin(k * Math.PI) * 0.9 + k * 0.6, 3.5 - k * 4.1);
    ball.current.visible = t < 0.85;
    ball.current.rotation.x += 0.2;
  });

  return (
    <group position={[0, -1.2, 0]} rotation={[0.1, -0.35, 0]}>
      <lineSegments geometry={net} material={m.faint} />
      {stripes.map((st, i) => (
        <mesh key={i} position={st.pos} rotation={st.rot} material={st.orange ? m.orange : m.white}>
          <cylinderGeometry args={[0.055, 0.055, st.len, 16]} />
        </mesh>
      ))}
      <group ref={ball}>
        <Ball m={m} r={0.13} />
      </group>
    </group>
  );
}

// ---------- 4: shot tracking ----------
function Shots({ m }: { m: Mats }) {
  const ball = useRef<THREE.Group>(null);
  const { floor, frame, arcs, dots, hero } = useMemo(() => {
    const f = new Segs();
    goalArea(f, 0, 1, 99);
    const fr = new Segs();
    goalFrame(fr, 0, 1, 0.14);
    // 3x3 target grid inside the goal mouth
    const w = 1.5 * M, h = 2 * M;
    for (let i = 1; i < 3; i++) {
      fr.seg(V(0, (h * i) / 3, -w), V(0, (h * i) / 3, w));
      fr.seg(V(0, 0, -w + (2 * w * i) / 3), V(0, h, -w + (2 * w * i) / 3));
    }
    const r = rng(11);
    const arcs = new Segs();
    const dotPts: number[] = [];
    let hero: THREE.CatmullRomCurve3 | null = null;
    for (let i = 0; i < 8; i++) {
      const ang = -0.9 + (i / 7) * 1.8;
      const dist = (8.5 + r() * 2) * M;
      const start = V(Math.cos(ang) * dist, 0.28, Math.sin(ang) * dist);
      const end = V(0.01, 0.04 + r() * 0.22, (r() - 0.5) * 0.36);
      const mid = start.clone().lerp(end, 0.5).add(V(0, 0.25 + r() * 0.25, 0));
      const c = new THREE.CatmullRomCurve3([start, mid, end]);
      const pts = c.getPoints(30);
      arcs.poly(pts);
      pts.forEach((p, k) => k % 3 === 0 && dotPts.push(p.x, p.y, p.z));
      if (i === 5) hero = c;
    }
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.Float32BufferAttribute(dotPts, 3));
    return { floor: f.geo(), frame: fr.geo(), arcs: arcs.geo(), dots, hero: hero! };
  }, []);
  const heroGeo = useMemo(() => lineGeo(hero.getPoints(60)), [hero]);

  useFrame((state) => {
    const t = (state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1) * 0.5) % 1;
    if (ball.current) ball.current.position.copy(hero.getPoint(t));
  });

  return (
    <group rotation={[0.45, 2.5, 0]} scale={2.6} position={[1.1, -0.9, 0]}>
      <lineSegments geometry={floor} material={m.faint} />
      <lineSegments geometry={frame} material={m.line} />
      <lineSegments geometry={arcs} material={m.mid} />
      <points geometry={dots}>
        <pointsMaterial color={BLUE} size={0.04} sizeAttenuation transparent opacity={0.9} />
      </points>
      <Poly geometry={heroGeo} material={m.accent} />
      <group ref={ball}>
        <Ball m={m} r={0.045} />
      </group>
    </group>
  );
}

// ---------- 5: 3-2-1 defence, one player per skill group ----------
const FORMATION: [number, number][] = [
  [-1.05, -0.2],
  [0, 0.25],
  [1.05, -0.2],
  [-0.62, 0.95],
  [0.62, 0.95],
  [0, 1.6],
];
const pillarVertex = /* glsl */ `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const pillarFragment = /* glsl */ `uniform vec3 uColor; uniform float uOn; varying float vY; void main(){ gl_FragColor = vec4(uColor, (1.0 - vY) * (0.18 + uOn * 0.5)); }`;
function Defence({ m }: { m: Mats }) {
  const players = useRef<THREE.Group[]>([]);
  const lines = useMemo(() => {
    const s = new Segs();
    goalArea(s, -1.25, 1, 99);
    goalFrame(s, -1.25, 1);
    const rot = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
    s.pts.forEach((p) => p.applyMatrix4(rot));
    return s.scale(1.55).geo();
  }, []);
  const pillars = useMemo(
    () =>
      FORMATION.map(
        () =>
          new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(LINE) }, uOn: { value: 0 } },
            vertexShader: pillarVertex,
            fragmentShader: pillarFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          })
      ),
    []
  );
  const discs = useMemo(() => FORMATION.map(() => new THREE.MeshStandardMaterial({ color: "#c9d2e0", roughness: 0.4 })), []);
  const ring = useMemo(() => lineGeo(Array.from({ length: 49 }, (_, i) => V(Math.cos((i / 48) * Math.PI * 2) * 0.3, 0, Math.sin((i / 48) * Math.PI * 2) * 0.3))), []);
  const accent = useMemo(() => new THREE.Color(ACCENT), []);
  const white = useMemo(() => new THREE.Color("#c9d2e0"), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    players.current.forEach((g, i) => {
      if (!g) return;
      const on = store.hoverCluster === i ? 1 : 0;
      const u = pillars[i].uniforms;
      u.uOn.value = THREE.MathUtils.lerp(u.uOn.value, on, 0.15);
      (u.uColor.value as THREE.Color).lerp(on ? accent : new THREE.Color(LINE), 0.15);
      discs[i].color.lerp(on ? accent : white, 0.15);
      const pillar = g.children[1];
      pillar.scale.y = THREE.MathUtils.lerp(pillar.scale.y, 1 + on * 1.4, 0.15);
      g.position.y = Math.sin(t * 1.2 + i) * 0.03 + on * 0.06;
    });
  });

  return (
    <group rotation={[0.62, 0.35, 0]} position={[0, -0.5, 0]}>
      <lineSegments geometry={lines} material={m.mid} />
      {FORMATION.map(([x, z], i) => (
        <group key={i} position={[x, 0, -0.55 + z * 0.95]}>
          <group
            ref={(el) => {
              if (el) players.current[i] = el;
            }}
          >
            <mesh material={discs[i]}>
              <cylinderGeometry args={[0.2, 0.2, 0.07, 32]} />
            </mesh>
            <mesh material={pillars[i]} position={[0, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 1.1, 32, 1, true]} />
            </mesh>
            <Poly geometry={ring} material={m.faint} position={[0, -0.03, 0]} />
          </group>
        </group>
      ))}
    </group>
  );
}

export default function ArenaScene() {
  const m = useMats();
  const groups = useRef<(THREE.Group | null)[]>([]);
  useChapterRig(groups, OFFSETS, { camZ: 8.2, camZNarrow: 10.5 });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2, -2]} intensity={0.6} color={BLUE} />
      <ChapterGroups groups={groups}>
        {[
          <MatchBall key="a0" m={m} />,
          <Court key="a1" m={m} />,
          <Tactics key="a2" m={m} />,
          <Goal key="a3" m={m} />,
          <Shots key="a4" m={m} />,
          <Defence key="a5" m={m} />,
          <MatchBall key="a6" m={m} />,
        ]}
      </ChapterGroups>
    </>
  );
}

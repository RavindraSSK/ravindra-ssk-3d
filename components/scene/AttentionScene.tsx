"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineMaterial } from "three-stdlib";
import { store } from "@/lib/store";
import { Backdrop, ChapterGroups, Poly, Segs, V, labelTexture, lineGeo, lineMat, rng, useChapterRig, type Vec3 } from "./kit";

/*
 * Attention theme (advanced): a walk through a transformer reading the tagline.
 *   tokens on a ring with causal attention arcs (the query sweeps, heads change) →
 *   the attention matrix as 3D bars → six stacked layers with the residual stream →
 *   a grid of heads (projects) → the output vocabulary wheel (research) →
 *   six heads = six skill groups (hover one) → token ring
 * The weights are hand-designed head patterns (previous token, sink, local,
 * semantic...), softmaxed with a causal mask, so they behave like real heads.
 */

const BG = "#07060c";
const PINK = "#f472b6";
const BLUE = "#60a5fa";
const INK = "#f1eef8";

const TOKENS = ["I", "build", "and", "evaluate", "production", "ML", "systems", "."];
const N = TOKENS.length;

const OFFSETS: Vec3[] = [
  [2.75, 0, 0],
  [-2.4, -0.1, 0],
  [2.4, 0, 0],
  [0, -0.1, -1.5],
  [2.4, -0.1, 0],
  [-2.6, -0.1, 0],
  [0, 0, 0],
];

// ---------- heads ----------
const RELATED: [number, number][] = [
  [3, 1],
  [2, 1],
  [5, 4],
  [6, 5],
  [6, 4],
  [7, 6],
  [4, 3],
];
const HEADS: { name: string; score: (q: number, k: number) => number }[] = [
  { name: "previous-token head", score: (q, k) => (k === q - 1 ? 3.2 : k === q ? 0.8 : 0) },
  { name: "attention-sink head", score: (q, k) => (k === 0 ? 2.6 : 0.4) },
  { name: "semantic head", score: (q, k) => (RELATED.some(([a, b]) => a === q && b === k) ? 3 : k === q ? 1 : 0) },
  { name: "local-window head", score: (q, k) => 2.5 - (q - k) * 0.9 },
  { name: "self head", score: (q, k) => (k === q ? 3 : 0.2) },
  { name: "broad head", score: () => 1 },
];
/** Causal softmax attention matrix for a head: rows = queries, cols = keys. */
function attn(h: number) {
  return Array.from({ length: N }, (_, q) => {
    const ex = Array.from({ length: N }, (_, k) => (k <= q ? Math.exp(HEADS[h].score(q, k)) : 0));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((e) => e / sum);
  });
}
const MATS = HEADS.map((_, h) => attn(h));

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float s = uRes.y / 900.0;
  vec3 col = mix(vec3(0.02, 0.018, 0.04), vec3(0.045, 0.035, 0.08), uv.y);
  col += vec3(0.5, 0.15, 0.35) * exp(-distance(uv, vec2(0.75 + uMouse.x * 0.02, 0.6)) * 3.0) * 0.12;
  col += vec3(0.15, 0.25, 0.55) * exp(-distance(uv, vec2(0.15, 0.2)) * 3.0) * 0.12;
  // faint lower-triangular matrix pattern drifting with scroll
  vec2 p = (gl_FragCoord.xy + vec2(0.0, uChapter * 50.0 * s)) / (48.0 * s);
  vec2 c = floor(p);
  vec2 f = fract(p);
  float cell = step(c.x, mod(c.y, 24.0)) * (1.0 - smoothstep(0.42, 0.46, max(abs(f.x - 0.5), abs(f.y - 0.5))));
  float h = fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
  col += vec3(0.9, 0.4, 0.7) * cell * h * h * 0.02;
  gl_FragColor = vec4(col, 1.0);
}
`;

function useChips() {
  return useMemo(
    () =>
      TOKENS.map((t) => {
        const font = `600 40px "JetBrains Mono Variable", ui-monospace, monospace`;
        const off = labelTexture(t, { color: INK, bg: "rgba(20,17,32,0.95)", border: "rgba(255,255,255,0.18)", radius: 14, font });
        const on = labelTexture(t, { color: "#1a0612", bg: PINK, radius: 14, font });
        return {
          aspect: off.aspect,
          off: new THREE.MeshBasicMaterial({ map: off.tex, transparent: true, depthWrite: false }),
          on: new THREE.MeshBasicMaterial({ map: on.tex, transparent: true, depthWrite: false }),
        };
      }),
    []
  );
}

const ringPos = (i: number, r = 1.75) => {
  const a = (i / N) * Math.PI * 2 - Math.PI / 2;
  return V(Math.cos(a) * r, 0, Math.sin(a) * r);
};

// ---------- 0 / 6: token ring with causal attention arcs ----------
const QUERY_S = 1.1;
function TokenRing() {
  const chips = useChips();
  const chipMeshes = useRef<THREE.Mesh[]>([]);
  const arcs = useRef<Record<string, Line2 | null>>({});
  const headLabel = useRef<THREE.Mesh>(null);
  const cur = useRef({ head: -1, q: -1 });
  const pairs = useMemo(() => {
    const out: { q: number; k: number; pts: THREE.Vector3[] }[] = [];
    for (let q = 1; q < N; q++)
      for (let k = 0; k < q; k++) {
        const a = ringPos(q), b = ringPos(k);
        const mid = a.clone().lerp(b, 0.5).multiplyScalar(0.55).add(V(0, 0.35 + a.distanceTo(b) * 0.35, 0));
        out.push({ q, k, pts: new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(32) });
      }
    return out;
  }, []);
  const headLabels = useMemo(
    () =>
      HEADS.map((h, i) => {
        const { tex, aspect } = labelTexture(`L4 · head ${i + 1} · ${h.name}`, { color: PINK, font: `600 34px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
      }),
    []
  );
  const ringGeo = useMemo(() => lineGeo(Array.from({ length: 97 }, (_, i) => V(Math.cos((i / 96) * Math.PI * 2) * 1.75, 0, Math.sin((i / 96) * Math.PI * 2) * 1.75))), []);
  const faint = useMemo(() => lineMat(INK, 0.12), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.3 : 1);
    const step = Math.floor(t / QUERY_S);
    const q = 1 + (step % (N - 1));
    const head = Math.floor(step / (N - 1)) % HEADS.length;
    const W = MATS[head];
    if (cur.current.head !== head && headLabel.current) {
      headLabel.current.material = headLabels[head].mat;
      headLabel.current.scale.set(headLabels[head].aspect, 1, 1);
    }
    cur.current = { head, q };
    const grow = Math.min(((t / QUERY_S) % 1) * 2.5, 1);
    pairs.forEach((p) => {
      const l = arcs.current[`${p.q}-${p.k}`];
      if (!l) return;
      const w = p.q === q ? W[q][p.k] : 0;
      l.visible = w > 0.03;
      const m = l.material as LineMaterial;
      m.linewidth = 1 + w * 7 * grow;
      m.opacity = Math.min(1, 0.25 + w * 1.4) * grow;
      m.color.set(w > 0.3 ? PINK : BLUE);
    });
    chipMeshes.current.forEach((c, i) => {
      if (!c) return;
      c.material = i === q ? chips[i].on : chips[i].off;
      const w = i <= q ? W[q][i] : 0;
      c.scale.setScalar(THREE.MathUtils.lerp(c.scale.x, 1 + w * 0.5 + (i === q ? 0.15 : 0), 0.2));
    });
  });

  return (
    <group rotation={[0.42, 0, 0]} scale={0.82}>
      <Poly geometry={ringGeo} material={faint} />
      {pairs.map((p) => (
        <Line
          key={`${p.q}-${p.k}`}
          ref={(el) => {
            arcs.current[`${p.q}-${p.k}`] = el as unknown as Line2 | null;
          }}
          points={p.pts}
          color={PINK}
          lineWidth={2}
          transparent
        />
      ))}
      {TOKENS.map((_, i) => (
        <Billboard key={i} position={ringPos(i).add(V(0, 0, 0))}>
          <mesh
            material={chips[i].off}
            ref={(el) => {
              if (el) chipMeshes.current[i] = el;
            }}
          >
            <planeGeometry args={[0.26 * chips[i].aspect, 0.26]} />
          </mesh>
        </Billboard>
      ))}
      <Billboard position={[0, -0.9, 0]}>
        <mesh ref={headLabel}>
          <planeGeometry args={[0.16, 0.16]} />
        </mesh>
      </Billboard>
    </group>
  );
}

// ---------- 1: attention matrix as bars ----------
function Matrix() {
  const inst = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const heights = useRef(new Float32Array(N * N));
  const cPink = useMemo(() => new THREE.Color(PINK), []);
  const cBlue = useMemo(() => new THREE.Color(BLUE), []);
  const cOff = useMemo(() => new THREE.Color("#221c36"), []);
  const col = useMemo(() => new THREE.Color(), []);
  const frame = useMemo(() => {
    const s = new Segs().rect(V(0, 0, 0), V(1, 0, 0), V(0, 0, 1), N * 0.36 + 0.2, N * 0.36 + 0.2);
    return s.geo();
  }, []);
  const faint = useMemo(() => lineMat(INK, 0.2), []);
  useFrame((state) => {
    const m = inst.current;
    if (!m) return;
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.3 : 1);
    const head = Math.floor(t / 2.6) % HEADS.length;
    const W = MATS[head];
    for (let q = 0; q < N; q++)
      for (let k = 0; k < N; k++) {
        const i = q * N + k;
        const target = k <= q ? W[q][k] : 0;
        heights.current[i] += (target - heights.current[i]) * 0.08;
        const h = 0.03 + heights.current[i] * 1.6;
        tmp.position.set((k - (N - 1) / 2) * 0.36, h / 2, (q - (N - 1) / 2) * 0.36);
        tmp.scale.set(1, h, 1);
        tmp.updateMatrix();
        m.setMatrixAt(i, tmp.matrix);
        if (k > q) col.copy(cOff);
        else col.copy(cBlue).lerp(cPink, Math.min(heights.current[i] * 1.8, 1));
        m.setColorAt(i, col);
      }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group rotation={[0.62, -0.62, 0]} position={[0, -0.6, 0]}>
      <lineSegments geometry={frame} material={faint} />
      <instancedMesh ref={inst} args={[undefined, undefined, N * N]}>
        <boxGeometry args={[0.28, 1, 0.28]} />
        <meshStandardMaterial roughness={0.45} emissive="#2a1030" />
      </instancedMesh>
    </group>
  );
}

// ---------- 2: layer stack + residual stream ----------
const LAYERS = 6;
function Layers() {
  const pulses = useRef<THREE.Mesh[]>([]);
  const { planes, stream, arcs } = useMemo(() => {
    const p = new Segs();
    const st = new Segs();
    const ar = new Segs();
    const r = rng(9);
    for (let l = 0; l < LAYERS; l++) {
      const y = -1.5 + l * 0.6;
      p.rect(V(0, y, 0), V(1, 0, 0), V(0, 0, 1), 3.3, 0.9);
      for (let k = 0; k < 5; k++) {
        const q = 1 + Math.floor(r() * (N - 1));
        const kk = Math.floor(r() * q);
        const a = V((q - (N - 1) / 2) * 0.4, y, 0), b = V((kk - (N - 1) / 2) * 0.4, y, 0);
        const mid = a.clone().lerp(b, 0.5).add(V(0, 0.15 + Math.abs(q - kk) * 0.03, 0));
        ar.poly(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(16));
      }
    }
    for (let i = 0; i < N; i++) st.seg(V((i - (N - 1) / 2) * 0.4, -1.5, 0), V((i - (N - 1) / 2) * 0.4, -1.5 + (LAYERS - 1) * 0.6, 0));
    return { planes: p.geo(), stream: st.geo(), arcs: ar.geo() };
  }, []);
  const mats = useMemo(() => ({ plane: lineMat(INK, 0.25), stream: lineMat(BLUE, 0.45), arcs: lineMat(PINK, 0.55), dot: new THREE.MeshBasicMaterial({ color: PINK }) }), []);
  const nodes = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let l = 0; l < LAYERS; l++) for (let i = 0; i < N; i++) pts.push(V((i - (N - 1) / 2) * 0.4, -1.5 + l * 0.6, 0));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.3 : 1);
    pulses.current.forEach((p, i) => {
      if (!p) return;
      const u = (t * 0.35 + i * 0.13) % 1;
      p.position.set((i - (N - 1) / 2) * 0.4, -1.5 + u * (LAYERS - 1) * 0.6, 0);
      p.scale.setScalar(Math.sin(u * Math.PI) + 0.2);
    });
  });
  return (
    <group rotation={[0.3, -0.55, 0]}>
      <lineSegments geometry={planes} material={mats.plane} />
      <lineSegments geometry={stream} material={mats.stream} />
      <lineSegments geometry={arcs} material={mats.arcs} />
      <points geometry={nodes}>
        <pointsMaterial color={INK} size={0.06} sizeAttenuation />
      </points>
      {TOKENS.map((_, i) => (
        <mesh
          key={i}
          material={mats.dot}
          ref={(el) => {
            if (el) pulses.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.045, 10, 10]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- 3: many heads (behind the project cards) ----------
function HeadGrid() {
  const inst = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const cPink = useMemo(() => new THREE.Color(PINK), []);
  const cBlue = useMemo(() => new THREE.Color("#1d2a52"), []);
  const G = 12;
  useFrame((state) => {
    const m = inst.current;
    if (!m) return;
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.3 : 1);
    let i = 0;
    for (let g = 0; g < G; g++) {
      const head = (g + Math.floor(t / 3)) % HEADS.length;
      const W = MATS[head];
      const gx = ((g % 6) - 2.5) * 1.35;
      const gy = g < 6 ? 0.8 : -0.8;
      for (let q = 0; q < N; q++)
        for (let k = 0; k < N; k++) {
          tmp.position.set(gx + (k - 3.5) * 0.13, gy - (q - 3.5) * 0.13, 0);
          tmp.updateMatrix();
          m.setMatrixAt(i, tmp.matrix);
          const w = k <= q ? W[q][k] : 0;
          col.copy(cBlue).lerp(cPink, Math.min(w * 1.6, 1) * (0.7 + 0.3 * Math.sin(t * 2 + g)));
          m.setColorAt(i, col);
          i++;
        }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group rotation={[-0.25, 0, 0]}>
      <instancedMesh ref={inst} args={[undefined, undefined, G * N * N]}>
        <planeGeometry args={[0.11, 0.11]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

// ---------- 4: output vocabulary wheel ----------
const VOCAB = 60;
const TOP = ["systems", "models", "agents"];
function Vocab() {
  const bars = useRef<THREE.InstancedMesh>(null);
  const wheel = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const base = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: VOCAB }, (_, i) => (i === 0 ? 1.6 : i === 7 ? 1.1 : i === 14 ? 0.8 : 0.08 + r() * 0.35));
  }, []);
  const labels = useMemo(
    () =>
      TOP.map((t, i) => {
        const { tex, aspect } = labelTexture(`${t}  ${[0.58, 0.2, 0.12][i].toFixed(2)}`, { color: i === 0 ? "#1a0612" : INK, bg: i === 0 ? PINK : "rgba(20,17,32,0.95)", border: i ? "rgba(255,255,255,0.2)" : undefined, radius: 14, font: `600 36px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
      }),
    []
  );
  const cPink = useMemo(() => new THREE.Color(PINK), []);
  const cBlue = useMemo(() => new THREE.Color(BLUE), []);
  useFrame((state) => {
    const m = bars.current;
    if (!m) return;
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.3 : 1);
    for (let i = 0; i < VOCAB; i++) {
      const a = (i / VOCAB) * Math.PI * 2;
      const h = base[i] * (1 + 0.12 * Math.sin(t * 2 + i));
      tmp.position.set(Math.cos(a) * 1.5, h / 2, Math.sin(a) * 1.5);
      tmp.rotation.set(0, -a, 0);
      tmp.scale.set(1, h, 1);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      col.copy(cBlue).lerp(cPink, Math.min(base[i] / 1.2, 1));
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (wheel.current) wheel.current.rotation.y = Math.sin(t * 0.2) * 0.5 + 0.9;
  });
  const ring = useMemo(() => lineGeo(Array.from({ length: 97 }, (_, i) => V(Math.cos((i / 96) * Math.PI * 2) * 1.5, 0, Math.sin((i / 96) * Math.PI * 2) * 1.5))), []);
  const faint = useMemo(() => lineMat(INK, 0.2), []);
  return (
    <group rotation={[0.45, 0, 0]} position={[0, -0.6, 0]}>
      <group ref={wheel}>
        <Poly geometry={ring} material={faint} />
        <instancedMesh ref={bars} args={[undefined, undefined, VOCAB]}>
          <boxGeometry args={[0.09, 1, 0.09]} />
          <meshStandardMaterial roughness={0.4} emissive="#200a28" />
        </instancedMesh>
        {TOP.map((_, i) => {
          const a = ((i * 7) / VOCAB) * Math.PI * 2;
          const l = labels[i];
          return (
            <Billboard key={i} position={[Math.cos(a) * 1.5, base[i * 7] + 0.25, Math.sin(a) * 1.5]}>
              <mesh material={l.mat}>
                <planeGeometry args={[0.2 * l.aspect, 0.2]} />
              </mesh>
            </Billboard>
          );
        })}
      </group>
    </group>
  );
}

// ---------- 5: six heads = six skill groups ----------
function Heads() {
  const groups = useRef<THREE.Group[]>([]);
  const { arcs, ring } = useMemo(() => {
    const R = 0.5;
    const pos = (i: number) => {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      return V(Math.cos(a) * R, Math.sin(a) * R, 0);
    };
    const ring = lineGeo(Array.from({ length: 65 }, (_, i) => V(Math.cos((i / 64) * Math.PI * 2) * R, Math.sin((i / 64) * Math.PI * 2) * R, 0)));
    const arcs = HEADS.map((_, h) => {
      const s = new Segs();
      const q = N - 1;
      MATS[h][q].forEach((w, k) => {
        if (k === q || w < 0.04) return;
        const a = pos(q), b = pos(k);
        const c = a.clone().lerp(b, 0.5).multiplyScalar(0.2);
        s.poly(new THREE.QuadraticBezierCurve3(a, c, b).getPoints(16));
      });
      return s.geo();
    });
    return { arcs, ring };
  }, []);
  const mats = useMemo(() => HEADS.map(() => ({ arc: lineMat(BLUE, 0.5), ring: lineMat(INK, 0.25) })), []);
  const dots = useMemo(() => {
    const pts = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      return V(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
    });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const cPink = useMemo(() => new THREE.Color(PINK), []);
  const cBlue = useMemo(() => new THREE.Color(BLUE), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    groups.current.forEach((g, i) => {
      if (!g) return;
      const on = store.hoverCluster === i ? 1 : 0;
      const m = mats[i];
      m.arc.color.lerp(on ? cPink : cBlue, 0.15);
      m.arc.opacity = THREE.MathUtils.lerp(m.arc.opacity, on ? 1 : 0.45, 0.15);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 1 + on * 0.3, 0.15));
      g.rotation.z = Math.sin(t * 0.4 + i) * 0.1;
    });
  });
  return (
    <group rotation={[-0.15, 0.3, 0]}>
      {HEADS.map((_, i) => (
        <group
          key={i}
          position={[((i % 3) - 1) * 1.35, i < 3 ? 0.7 : -0.7, 0]}
          ref={(el) => {
            if (el) groups.current[i] = el;
          }}
        >
          <Poly geometry={ring} material={mats[i].ring} />
          <lineSegments geometry={arcs[i]} material={mats[i].arc} />
          <points geometry={dots}>
            <pointsMaterial color={INK} size={0.07} sizeAttenuation />
          </points>
        </group>
      ))}
    </group>
  );
}

export default function AttentionScene() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useChapterRig(groups, OFFSETS, { camZ: 8.2, camZNarrow: 10.5, spin: 0.2 });
  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} />
      <pointLight position={[-3, 2, 2]} intensity={8} color={PINK} distance={10} />
      <ChapterGroups groups={groups}>
        {[
          <TokenRing key="t0" />,
          <Matrix key="t1" />,
          <Layers key="t2" />,
          <HeadGrid key="t3" />,
          <Vocab key="t4" />,
          <Heads key="t5" />,
          <TokenRing key="t6" />,
        ]}
      </ChapterGroups>
    </>
  );
}

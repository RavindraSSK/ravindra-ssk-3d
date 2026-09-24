"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { store } from "@/lib/store";
import { Backdrop, ChapterGroups, V, chapterWeight, clamp01, useChapterRig, type Vec3 } from "./kit";

/*
 * Muggu theme: Andhra muggulu (rice-flour floor patterns) drawn around dot
 * grids. The patterns are real "mirror curves": a line bouncing diagonally
 * inside a box of dots, looping around the border dots, never lifting the
 * hand. Each pattern draws itself as you scroll into its chapter.
 *   lotus → dot-grid muggu → creeper border (kodi) → five small muggulu →
 *   multi-colour muggu → six diyas (skills) → lotus
 */

const BG = "#17110d";
const CHALK = "#f7efe4";
const TURMERIC = "#f2b53a";
const KUMKUM = "#e0485a";

const OFFSETS: Vec3[] = [
  [2.5, 0, 0],
  [-2.4, 0, 0],
  [2.4, -0.1, 0],
  [0, -0.2, -1.5],
  [2.3, -0.1, 0],
  [-2.6, -0.2, 0],
  [0, 0, 0],
];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = gl_FragCoord.xy / (uRes.y / 900.0);
  // washed earth floor: warm, mottled, a little dusty
  float n = noise(p * 0.004 + uChapter * 0.05) * 0.6 + noise(p * 0.02) * 0.3 + noise(p * 0.12) * 0.1;
  vec3 col = mix(vec3(0.07, 0.05, 0.035), vec3(0.12, 0.085, 0.06), n);
  // oil-lamp warmth from below
  col += vec3(0.35, 0.18, 0.05) * exp(-distance(uv, vec2(0.5 + uMouse.x * 0.03, -0.15)) * 2.4) * 0.35;
  float grain = hash(floor(gl_FragCoord.xy));
  col += (grain - 0.5) * 0.02;
  col *= 0.7 + 0.3 * smoothstep(1.2, 0.3, distance(uv, vec2(0.5)));
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- pattern generators ----------
type Pattern = { loops: THREE.Vector3[][]; dots: THREE.Vector3[] };

/**
 * Mirror-curve muggu around a W×H grid of dots (Gerdes' construction).
 * Dots sit at odd/odd points of a 2W×2H box; the line runs on diagonals
 * through the in-between points, crossing itself between dots and bouncing
 * off the walls, which wraps every border dot in a loop. The result is one
 * or more closed curves that never lift off the floor.
 */
function mirrorMuggu(W: number, H: number): Pattern {
  const X = 2 * W, Y = 2 * H;
  const key = (x: number, y: number, dx: number, dy: number) => `${x},${y},${dx},${dy}`;
  const edgeKey = (x: number, y: number, x2: number, y2: number) => (x < x2 || (x === x2 && y < y2) ? `${x},${y}-${x2},${y2}` : `${x2},${y2}-${x},${y}`);
  const used = new Set<string>();
  const loops: THREE.Vector3[][] = [];
  const dots: THREE.Vector3[] = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) dots.push(V(2 * i + 1, 2 * j + 1, 0));

  for (let sx = 0; sx < X; sx++) {
    for (let sy = 0; sy <= Y; sy++) {
      if ((sx + sy) % 2 !== 1) continue;
      for (const [dx0, dy0] of [
        [1, 1],
        [1, -1],
      ]) {
        const ex = sx + dx0, ey = sy + dy0;
        if (ey < 0 || ey > Y || used.has(edgeKey(sx, sy, ex, ey))) continue;
        let x = sx, y = sy, dx = dx0, dy = dy0;
        const start = key(x, y, dx, dy);
        const ctrl: THREE.Vector3[] = [];
        let guard = 0;
        do {
          const nx = x + dx, ny = y + dy;
          used.add(edgeKey(x, y, nx, ny));
          // curve each step around the dot it passes, so every dot sits in its own ring
          const odd = (v: number) => Math.abs(v % 2) === 1;
          const dot = odd(x) && odd(y + dy) ? V(x, y + dy, 0) : V(x + dx, y, 0);
          const mid = V((x + nx) / 2, (y + ny) / 2, 0);
          ctrl.push(dot.clone().add(mid.sub(dot).normalize().multiplyScalar(0.84)));
          x = nx;
          y = ny;
          const bx = x === 0 || x === X;
          const by = y === 0 || y === Y;
          if (bx) dx = -dx;
          if (by) dy = -dy;
          // wall bounces wrap the border dots
          ctrl.push(V(x + (bx ? (x === 0 ? -0.06 : 0.06) : 0), y + (by ? (y === 0 ? -0.06 : 0.06) : 0), 0));
        } while (key(x, y, dx, dy) !== start && ++guard < 10000);
        const curve = new THREE.CatmullRomCurve3(ctrl, true, "centripetal");
        loops.push(curve.getPoints(ctrl.length * 5));
      }
    }
  }
  const c = V(X / 2, Y / 2, 0);
  loops.forEach((l) => l.forEach((p) => p.sub(c)));
  dots.forEach((d) => d.sub(c));
  return { loops, dots };
}

function transform(p: Pattern, scale: number, rot = 0): Pattern {
  const m = new THREE.Matrix4().makeRotationZ(rot).multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
  return { loops: p.loops.map((l) => l.map((v) => v.clone().applyMatrix4(m))), dots: p.dots.map((v) => v.clone().applyMatrix4(m)) };
}

/** Concentric lotus: rings of petals drawn as single continuous curves. */
function lotus(): Pattern {
  const loops: THREE.Vector3[][] = [];
  const dots: THREE.Vector3[] = [];
  const ring = (n: number, r0: number, r1: number, sharp: number, phase = 0) => {
    const pts: THREE.Vector3[] = [];
    const N = 480;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const k = Math.pow(Math.abs(Math.sin((a * n) / 2 + phase)), sharp);
      const r = r0 + (r1 - r0) * k;
      pts.push(V(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    loops.push(pts);
  };
  const circ = (r: number) => loops.push(Array.from({ length: 161 }, (_, i) => V(Math.cos((i / 160) * Math.PI * 2) * r, Math.sin((i / 160) * Math.PI * 2) * r, 0)));
  circ(0.22);
  ring(8, 0.3, 0.75, 0.7);
  ring(8, 0.55, 1.1, 0.7, Math.PI / 8);
  circ(1.18);
  ring(16, 1.25, 1.62, 0.55);
  ring(24, 1.72, 1.92, 0.4, Math.PI / 24);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    dots.push(V(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    dots.push(V(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0));
  }
  dots.push(V(0, 0, 0));
  return { loops, dots };
}

// ---------- drawing ----------
const dotVertex = /* glsl */ `uniform float uSize; uniform float uShow; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * uShow / -mv.z; gl_Position = projectionMatrix * mv; }`;
const dotFragment = /* glsl */ `uniform vec3 uColor; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(uColor, smoothstep(0.5, 0.3, d)); }`;

/** Draws a pattern; `chapter` drives the hand-drawn reveal as you scroll in. */
function Muggu({ pattern, chapter, colors, width = 2.2, delay = 0 }: { pattern: Pattern; chapter: number; colors: string[]; width?: number; delay?: number }) {
  const lines = useRef<(Line2 | null)[]>([]);
  const dotGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(pattern.dots), [pattern]);
  const dotMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSize: { value: 60 }, uShow: { value: 0 }, uColor: { value: new THREE.Color(CHALK) } },
        vertexShader: dotVertex,
        fragmentShader: dotFragment,
        transparent: true,
        depthWrite: false,
      }),
    []
  );
  useFrame((state) => {
    const w = chapterWeight(store.chapter, chapter);
    const reveal = store.reducedMotion ? (w > 0.05 ? 1 : 0) : clamp01((w - 0.12 - delay * 0.15) / 0.75);
    dotMat.uniforms.uShow.value = clamp01(w * 3);
    dotMat.uniforms.uSize.value = 60 * Math.min(state.gl.getPixelRatio(), 1.5);
    lines.current.forEach((l, i) => {
      if (!l) return;
      const n = pattern.loops[i].length - 1;
      const g = l.geometry as THREE.InstancedBufferGeometry;
      g.instanceCount = Math.max(0, Math.floor(n * reveal));
      l.visible = reveal > 0.002;
    });
  });
  return (
    <group>
      <points geometry={dotGeo} material={dotMat} />
      {pattern.loops.map((pts, i) => (
        <Line
          key={i}
          ref={(el) => {
            lines.current[i] = el as unknown as Line2 | null;
          }}
          points={pts}
          color={colors[i % colors.length]}
          lineWidth={width}
          transparent
          opacity={0.95}
        />
      ))}
    </group>
  );
}

function Spin({ speed, children, tilt = 0.45 }: { speed: number; children: React.ReactNode; tilt?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += Math.min(dt, 0.05) * speed * (store.reducedMotion ? 0.15 : 1);
  });
  return (
    <group rotation={[-tilt, 0, 0]}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

// ---------- 5: diyas ----------
const glowFragment = /* glsl */ `uniform float uOn; varying vec2 vUv; void main(){ float d = length(vUv - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.62, 0.22), a * a * (0.35 + uOn * 0.65)); }`;
function Diyas() {
  const flames = useRef<THREE.Group[]>([]);
  const bowl = useMemo(() => {
    const prof = [V(0.0, 0, 0), V(0.18, 0.0, 0), V(0.3, 0.05, 0), V(0.36, 0.13, 0), V(0.33, 0.16, 0), V(0.26, 0.1, 0), V(0.0, 0.08, 0)].map((v) => new THREE.Vector2(v.x, v.y));
    return new THREE.LatheGeometry(prof, 40);
  }, []);
  const clay = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a8481f", roughness: 0.8 }), []);
  const glows = useMemo(
    () =>
      Array.from({ length: 6 }, () =>
        new THREE.ShaderMaterial({
          uniforms: { uOn: { value: 0 } },
          vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: glowFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      ),
    []
  );
  const small = useMemo(() => transform(mirrorMuggu(3, 3), 0.2), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    flames.current.forEach((f, i) => {
      if (!f) return;
      const on = store.hoverCluster === i ? 1 : 0;
      const flick = 1 + Math.sin(t * 13 + i * 3) * 0.06 + Math.sin(t * 7.3 + i) * 0.05;
      const target = (0.75 + on * 0.6) * flick;
      f.scale.setScalar(THREE.MathUtils.lerp(f.scale.x, target, 0.2));
      glows[i].uniforms.uOn.value = THREE.MathUtils.lerp(glows[i].uniforms.uOn.value, on, 0.12);
    });
  });

  return (
    <group rotation={[0.55, 0, 0]} position={[0, -0.5, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Muggu pattern={small} chapter={5} colors={[CHALK, TURMERIC]} width={1.8} />
      </group>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return (
          <group key={i} position={[Math.cos(a) * 1.75, 0, Math.sin(a) * 1.2]}>
            <mesh geometry={bowl} material={clay} />
            <group
              position={[0, 0.2, 0]}
              ref={(el) => {
                if (el) flames.current[i] = el;
              }}
            >
              <mesh position={[0, 0.1, 0]} scale={[0.055, 0.13, 0.055]}>
                <sphereGeometry args={[1, 16, 12]} />
                <meshBasicMaterial color="#ffd27a" />
              </mesh>
              <Billboard position={[0, 0.12, 0]}>
                <mesh material={glows[i]}>
                  <planeGeometry args={[0.9, 0.9]} />
                </mesh>
              </Billboard>
            </group>
          </group>
        );
      })}
    </group>
  );
}

export default function MugguScene() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useChapterRig(groups, OFFSETS, { camZ: 8.2, camZNarrow: 10.5, spin: 0.2 });

  const P = useMemo(() => {
    const lot = lotus();
    return {
      lotus: lot,
      grid: transform(mirrorMuggu(5, 5), 0.27, Math.PI / 4),
      kodi: transform(mirrorMuggu(2, 9), 0.2),
      five: [3, 4, 3, 4, 3].map((n, i) => ({ p: transform(mirrorMuggu(n, n), 0.15, Math.PI / 4), x: (i - 2) * 1.6 })),
      multi: transform(mirrorMuggu(6, 3), 0.3),
    };
  }, []);

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 1.5, 1.5]} intensity={6} color="#ffb05a" distance={8} />
      <directionalLight position={[2, 4, 3]} intensity={0.8} color="#ffe0c0" />
      <ChapterGroups groups={groups}>
        {[
          <Spin key="m0" speed={0.06}>
            <Muggu pattern={P.lotus} chapter={0} colors={[TURMERIC, CHALK, KUMKUM, CHALK, CHALK, TURMERIC]} />
          </Spin>,
          <Spin key="m1" speed={0.03}>
            <Muggu pattern={P.grid} chapter={1} colors={[CHALK, TURMERIC, KUMKUM]} />
          </Spin>,
          <group key="m2" rotation={[-0.25, -0.4, 0]}>
            <Muggu pattern={P.kodi} chapter={2} colors={[CHALK, TURMERIC]} />
          </group>,
          <group key="m3" rotation={[-0.5, 0, 0]}>
            {P.five.map((f, i) => (
              <group key={i} position={[f.x, 0, 0]}>
                <Muggu pattern={f.p} chapter={3} colors={[i % 2 ? TURMERIC : CHALK, KUMKUM]} width={1.8} delay={i * 0.4} />
              </group>
            ))}
          </group>,
          <Spin key="m4" speed={-0.03}>
            <Muggu pattern={P.multi} chapter={4} colors={[CHALK, TURMERIC, KUMKUM, "#7fb7a4"]} />
          </Spin>,
          <Diyas key="m5" />,
          <Spin key="m6" speed={0.06}>
            <Muggu pattern={P.lotus} chapter={6} colors={[TURMERIC, CHALK, KUMKUM, CHALK, CHALK, TURMERIC]} />
          </Spin>,
        ]}
      </ChapterGroups>
    </>
  );
}

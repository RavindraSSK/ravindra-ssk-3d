"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineMaterial } from "three-stdlib";
import { store } from "@/lib/store";
import { skillGroups } from "@/lib/content";
import { Backdrop, V, clamp01, labelTexture, smooth } from "./kit";

/*
 * Chip to Cluster theme: the six stages of building with AI, told as hardware
 * and zooming out one level per chapter.
 *   MODEL    → a silicon die
 *   PROMPT   → the input traces feeding its pins
 *   CONTEXT  → memory stacks wired in beside it
 *   HARNESS  → the whole board: ports for tools, tests, sandbox, evals, a shield (we are here)
 *   LOOP     → a feedback bus running laps around the board
 *   GRAPH    → the board becomes one node in a cluster of six more (next)
 * Labels are printed on the board like PCB silkscreen.
 */

const BG = "#050a09";
const COPPER = "#e8955b";
const TEAL = "#5eead4";
const SILK = "#e9efe9";

type View = { center: [number, number]; extent: number; width: number; offset: [number, number, number] };
const VIEWS: View[] = [
  { center: [0, 0], extent: 1.7, width: 2.2, offset: [3.05, 0.15, 0] }, // model: the die
  { center: [-1.6, 0], extent: 5.6, width: 4.4, offset: [-2.4, 0.2, 0] }, // prompt: traces into the pins
  { center: [0.7, 0.55], extent: 4.4, width: 3.9, offset: [2.85, 0, 0] }, // context: memory stacks
  { center: [0, -0.2], extent: 9.4, width: 9.4, offset: [0, -0.2, -0.6] }, // harness: the board (behind cards)
  { center: [0, 0], extent: 13, width: 4.8, offset: [2.5, 0, 0] }, // loop: bus around the board
  { center: [0, 0], extent: 44, width: 4.3, offset: [-2.9, -0.1, 0] }, // graph: the cluster
  { center: [0, 0], extent: 44, width: 8.4, offset: [0, 0.1, -0.5] }, // contact
];

const BOARD = { w: 9.0, h: 6.2 };
const LOOP = { w: 12.2, h: 8.8 };
const PORTS = ["tools", "tests", "sandbox", "evals", "guardrails"];
const RACK_R = 17;

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float s = uRes.y / 900.0;
  vec3 col = mix(vec3(0.012, 0.028, 0.024), vec3(0.025, 0.05, 0.044), uv.y);
  col += vec3(0.5, 0.28, 0.12) * exp(-distance(uv, vec2(0.7 + uMouse.x * 0.02, 0.5)) * 3.0) * 0.08;
  vec2 g = mod(gl_FragCoord.xy, 28.0 * s) - 14.0 * s;
  col += vec3(0.3, 0.6, 0.5) * smoothstep(1.2 * s, 0.4 * s, length(g)) * 0.05;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- shaders ----------
const dieFragment = /* glsl */ `
uniform float uTime; uniform float uGlow;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  // bond-pad ring
  vec2 e = min(uv, 1.0 - uv);
  float edge = min(e.x, e.y);
  float pads = step(edge, 0.06) * step(0.5, fract((uv.x + uv.y) * 24.0)) * step(0.015, edge);
  // functional blocks: cores, cache, interconnect
  vec2 g = uv * 12.0;
  vec2 id = floor(g), f = fract(g);
  float r = h(id);
  float cell = step(0.08, f.x) * step(0.08, f.y) * step(f.x, 0.92) * step(f.y, 0.92);
  float fine = step(0.5, fract(f.x * (r > 0.5 ? 6.0 : 3.0))) * 0.3;
  float pulse = 0.5 + 0.5 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (uv.x * 0.6 + uv.y * 0.4 + vec3(0.0, 0.33, 0.67)));
  vec3 base = mix(vec3(0.03, 0.05, 0.06), irid * 0.35, 0.55);
  vec3 col = base * (0.35 + cell * (0.5 + fine)) + irid * cell * pulse * 0.25 * uGlow;
  col = mix(col, vec3(0.85, 0.7, 0.35), pads * 0.8);
  col *= step(0.015, edge);
  gl_FragColor = vec4(col, 1.0);
}`;
const boardFragment = /* glsl */ `
uniform float uTime; uniform float uAlpha;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 p = vUv * vec2(90.0, 62.0);
  vec2 id = floor(p), f = fract(p);
  float r = h(id);
  // manhattan traces: each cell carries a horizontal or vertical run, some carry vias
  float hor = step(r, 0.34) * smoothstep(0.1, 0.0, abs(f.y - 0.5));
  float ver = step(0.66, r) * smoothstep(0.1, 0.0, abs(f.x - 0.5));
  float via = step(0.93, h(id + 7.0)) * smoothstep(0.22, 0.16, length(f - 0.5)) * (1.0 - smoothstep(0.1, 0.05, length(f - 0.5)));
  vec3 col = vec3(0.028, 0.075, 0.058);
  col += vec3(0.12, 0.2, 0.15) * max(hor, ver) * 0.55;
  col += vec3(0.75, 0.55, 0.3) * via * 0.55;
  // board edge
  vec2 e = min(vUv, 1.0 - vUv);
  col = mix(vec3(0.6, 0.45, 0.25), col, smoothstep(0.0, 0.006, min(e.x, e.y * 1.45)));
  gl_FragColor = vec4(col, uAlpha);
}`;
const planeVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function silk(text: string, color = SILK, bg?: string) {
  const { tex, aspect } = labelTexture(text, { color, bg, radius: 10, pad: bg ? 18 : 4, font: `600 40px "JetBrains Mono Variable", ui-monospace, monospace` });
  return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
}

/** Rounded rectangle outline in the XY plane. */
function rrect(w: number, h: number, r: number, seg = 10) {
  const pts: THREE.Vector3[] = [];
  const x = w / 2, y = h / 2;
  const c = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 - (i / seg) * (Math.PI / 2);
      pts.push(V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  };
  c(-x + r, y - r, Math.PI);
  c(x - r, y - r, Math.PI / 2);
  c(x - r, -y + r, 0);
  c(-x + r, -y + r, -Math.PI / 2);
  pts.push(pts[0].clone());
  return pts;
}
function pathOf(pts: THREE.Vector3[]) {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = lens[lens.length - 1];
  return (u: number, out: THREE.Vector3) => {
    const d = ((((u % 1) + 1) % 1)) * total;
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const k = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    return out.copy(pts[i - 1]).lerp(pts[i], k);
  };
}

export default function SiliconScene() {
  const { camera, size } = useThree();
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const stages = useRef<(THREE.Group | null)[]>([]);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);
  const ctxPulses = useRef<(THREE.Mesh | null)[]>([]);
  const leds = useRef<(THREE.Mesh | null)[]>([]);
  const loopPk = useRef<(THREE.Mesh | null)[]>([]);
  const racks = useRef<(THREE.Group | null)[]>([]);
  const fibers = useRef<(Line2 | null)[]>([]);
  const msgs = useRef<(THREE.Mesh | null)[]>([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const sim = useRef({ spawn: 0, pk: Array.from({ length: 16 }, () => ({ r: -1, t: 0, dir: 1 })) });

  const mats = useMemo(() => {
    const die = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uGlow: { value: 1 } }, vertexShader: planeVertex, fragmentShader: dieFragment });
    const board = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } }, vertexShader: planeVertex, fragmentShader: boardFragment, transparent: true });
    return {
      die,
      board,
      pkg: new THREE.MeshStandardMaterial({ color: "#161a19", roughness: 0.55, metalness: 0.2 }),
      gold: new THREE.MeshStandardMaterial({ color: "#d4a24c", roughness: 0.3, metalness: 0.9, emissive: "#3a2508" }),
      hbm: new THREE.MeshStandardMaterial({ color: "#1d2322", roughness: 0.4, metalness: 0.4 }),
      port: new THREE.MeshStandardMaterial({ color: "#8c969a", roughness: 0.3, metalness: 0.85 }),
      pulse: new THREE.MeshBasicMaterial({ color: TEAL }),
      pulseCu: new THREE.MeshBasicMaterial({ color: COPPER }),
      ledOn: new THREE.MeshBasicMaterial({ color: TEAL }),
      ledOff: new THREE.MeshBasicMaterial({ color: "#13302a" }),
      hole: new THREE.MeshBasicMaterial({ color: "#caa36a" }),
    };
  }, []);

  const fog = useMemo(() => new THREE.MeshBasicMaterial({ color: BG, transparent: true, opacity: 0, depthTest: false, depthWrite: false }), []);
  const geo = useMemo(() => {
    // prompt traces: six lanes that jog 45° into the package's left pins
    const traces = Array.from({ length: 6 }, (_, i) => {
      const y0 = -1.25 + i * 0.5;
      const y1 = -0.62 + i * 0.25;
      return [V(-4.3, y0, 0.01), V(-2.7, y0, 0.01), V(-2.7 + Math.abs(y0 - y1), y1, 0.01), V(-1.0, y1, 0.01)];
    });
    const hbmPos = [V(2.05, 0.62, 0), V(2.05, -0.62, 0), V(-0.55, 2.05, 0), V(0.55, 2.05, 0)];
    const hbmLinks = hbmPos.map((p) => {
      const toward = p.x > 1 ? V(1.0, p.y * 0.8, 0.01) : V(p.x * 0.8, 1.0, 0.01);
      return [V(p.x > 1 ? p.x - 0.35 : p.x, p.x > 1 ? p.y : p.y - 0.45, 0.01), toward];
    });
    // board traces from package to each port
    const portX = PORTS.map((_, i) => -3.4 + i * 1.7);
    const portLinks = portX.map((x, i) => [V(-0.6 + i * 0.3, -1.0, 0.01), V(-0.6 + i * 0.3, -1.9, 0.01), V(x, -1.9 - Math.abs(x - (-0.6 + i * 0.3)) * 0.2, 0.01), V(x, -2.55, 0.01)]);
    const loop = rrect(LOOP.w, LOOP.h, 0.8);
    const shield = rrect(5.6, 5.3, 0.25);
    const rackPos = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      return V(Math.cos(a) * RACK_R, Math.sin(a) * RACK_R * 0.78, 0);
    });
    const fiberCurves = rackPos.map((p) => new THREE.QuadraticBezierCurve3(V(0, 0, 0.2), p.clone().multiplyScalar(0.5).add(V(0, 0, 3.5)), p.clone().setZ(0.2)));
    const ringCurves = rackPos.map((p, i) => {
      const q = rackPos[(i + 1) % 6];
      return new THREE.QuadraticBezierCurve3(p.clone().setZ(0.2), p.clone().lerp(q, 0.5).setZ(2.5), q.clone().setZ(0.2));
    });
    return {
      traces,
      tracePaths: traces.map(pathOf),
      hbmPos,
      hbmLinks,
      hbmPaths: hbmLinks.map(pathOf),
      portX,
      portLinks,
      portPaths: portLinks.map(pathOf),
      loop,
      loopPath: pathOf(loop),
      shield,
      rackPos,
      fiberCurves,
      ringCurves,
      allCurves: [...fiberCurves, ...ringCurves],
    };
  }, []);

  const labels = useMemo(
    () => ({
      model: silk("U1 · MODEL"),
      prompt: silk("PROMPT IN →"),
      context: silk("CONTEXT · HBM"),
      harness: silk("HARNESS"),
      now: silk("WE ARE HERE", "#1a0c03", COPPER),
      loop: silk("LOOP · plan → act → observe"),
      graph: silk("GRAPH · NEXT", "#041310", TEAL),
      ports: PORTS.map((p) => silk(p)),
      racks: skillGroups.map((g) => silk(g.name.toUpperCase())),
    }),
    []
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    const s = Math.min(Math.max(store.chapter, 0), 6);
    const a = Math.floor(s), b = Math.min(a + 1, 6);
    const f = smooth(0, 1, s - a);
    const narrow = size.width < 900;
    const on = [1, 1, 2, 3, 4, 5].map((_, i) => (i === 0 ? 1 : clamp01((s - i + 0.8) / 0.6)));

    // zoom: fit the newest stage beside the text (log-space blend)
    const va = VIEWS[a], vb = VIEWS[b];
    const wA = narrow ? Math.min(va.width, 5) : va.width;
    const wB = narrow ? Math.min(vb.width, 5) : vb.width;
    const scA = wA / va.extent, scB = wB / vb.extent;
    const sc = Math.exp(Math.log(scA) + (Math.log(scB) - Math.log(scA)) * f);
    const cx = va.center[0] + (vb.center[0] - va.center[0]) * f;
    const cy = va.center[1] + (vb.center[1] - va.center[1]) * f;
    const off = va.offset.map((v, i) => v + (vb.offset[i] - v) * f);
    if (root.current) {
      root.current.scale.setScalar(sc);
      root.current.position.set(narrow ? 0 : off[0], off[1], off[2]);
    }
    if (tilt.current) {
      const rm = store.reducedMotion ? 0.2 : 1;
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, -0.72 - store.mouse.y * 0.12 * rm, 4, dt);
      tilt.current.rotation.z = THREE.MathUtils.damp(tilt.current.rotation.z, 0.08 + store.mouse.x * 0.1 * rm, 4, dt);
      tilt.current.position.set(-cx, -cy * Math.cos(0.72), 0);
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, narrow ? 10.5 : 8.2, 5, dt);
    camera.lookAt(0, 0, 0);

    // stages switch on
    stages.current.forEach((g, i) => {
      if (!g) return;
      const e = on[i];
      g.visible = e > 0.01;
      g.scale.set(1, 1, Math.max(e, 0.001));
      g.position.z = (1 - e) * -0.4;
    });
    mats.board.uniforms.uAlpha.value = on[3];
    fog.opacity = clamp01(s - 5.2) * 0.6;
    mats.die.uniforms.uTime.value = t;

    // prompt tokens stream into the pins
    pulses.current.forEach((m, i) => {
      if (!m) return;
      const lane = i % 6;
      geo.tracePaths[lane]((t * 0.28 + i * 0.137) % 1, tmp);
      m.position.copy(tmp);
    });
    ctxPulses.current.forEach((m, i) => {
      if (!m) return;
      const k = i % 4;
      const u = (t * 0.6 + i * 0.31) % 1;
      geo.hbmPaths[k](i < 4 ? u : 1 - u, tmp);
      m.position.copy(tmp);
    });
    // ports: LEDs light in turn (tests pass, tools called...)
    leds.current.forEach((m, i) => m && (m.material = Math.floor(t * 1.4) % PORTS.length === i || (i === 1 && Math.sin(t * 6) > 0) ? mats.ledOn : mats.ledOff));
    loopPk.current.forEach((m, i) => {
      if (!m) return;
      geo.loopPath(t * 0.09 + i / 3, tmp);
      m.position.copy(tmp);
    });

    // cluster: hovered skill gets the traffic
    const hov = store.hoverCluster;
    racks.current.forEach((g, i) => {
      if (!g) return;
      const lit = hov === i ? 1 : 0;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 1 + lit * 0.12, 0.15));
    });
    fibers.current.forEach((l, i) => {
      if (!l) return;
      const m = l.material as LineMaterial;
      const lit = i < 6 && hov === i;
      m.color.set(lit ? TEAL : COPPER);
      m.opacity = on[5] * (lit ? 1 : 0.45);
      m.linewidth = lit ? 3 : 1.6;
    });
    const S = sim.current;
    S.spawn -= dt;
    if (on[5] > 0.6 && S.spawn <= 0) {
      const free = S.pk.find((p) => p.r < 0);
      if (free) {
        free.r = hov >= 0 && Math.random() < 0.8 ? hov : Math.floor(Math.random() * geo.allCurves.length);
        free.t = 0;
        free.dir = Math.random() < 0.5 ? 1 : -1;
      }
      S.spawn = hov >= 0 ? 0.07 : 0.2;
    }
    S.pk.forEach((p, i) => {
      const m = msgs.current[i];
      if (!m) return;
      if (p.r < 0) {
        m.visible = false;
        return;
      }
      p.t += dt * 0.7;
      if (p.t >= 1) {
        p.r = -1;
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.copy(geo.allCurves[p.r].getPoint(p.dir > 0 ? p.t : 1 - p.t));
    });
  });

  const L = (m: { mat: THREE.Material; aspect: number }, h: number, pos: [number, number, number], left = true) => (
    <mesh material={m.mat} position={[pos[0] + (left ? (h * m.aspect) / 2 : 0), pos[1], pos[2]]}>
      <planeGeometry args={[h * m.aspect, h]} />
    </mesh>
  );

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 6]} intensity={2} />
      <pointLight position={[-3, 2, 3]} intensity={10} color={COPPER} distance={12} />
      <mesh material={fog} position={[0, 0, 4]} renderOrder={10}>
        <planeGeometry args={[60, 40]} />
      </mesh>
      <group ref={root}>
        <group ref={tilt}>
          {/* MODEL: the die on its package */}
          <group
            ref={(el) => {
              stages.current[0] = el;
            }}
          >
            <mesh material={mats.pkg} position={[0, 0, 0.08]}>
              <boxGeometry args={[2, 2, 0.16]} />
            </mesh>
            <mesh material={mats.die} position={[0, 0, 0.17]}>
              <planeGeometry args={[1, 1]} />
            </mesh>
            {Array.from({ length: 40 }).map((_, i) => {
              const side = Math.floor(i / 10), k = (i % 10) - 4.5;
              const p: [number, number, number] = side === 0 ? [k * 0.17, 1.03, 0.04] : side === 1 ? [k * 0.17, -1.03, 0.04] : side === 2 ? [1.03, k * 0.17, 0.04] : [-1.03, k * 0.17, 0.04];
              return (
                <mesh key={i} material={mats.gold} position={p}>
                  <boxGeometry args={side < 2 ? [0.08, 0.1, 0.03] : [0.1, 0.08, 0.03]} />
                </mesh>
              );
            })}
            {L(labels.model, 0.14, [-1.0, -1.18, 0.02])}
          </group>
          {/* PROMPT: input traces and streaming tokens */}
          <group
            ref={(el) => {
              stages.current[1] = el;
            }}
          >
            {geo.traces.map((pts, i) => (
              <Line key={i} points={pts} color={COPPER} lineWidth={1.6} transparent opacity={0.9} />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <mesh
                key={i}
                material={mats.pulse}
                ref={(el) => {
                  pulses.current[i] = el;
                }}
              >
                <boxGeometry args={[0.16, 0.06, 0.04]} />
              </mesh>
            ))}
            {L(labels.prompt, 0.2, [-4.3, 1.55, 0.02])}
          </group>
          {/* CONTEXT: memory stacks beside the package */}
          <group
            ref={(el) => {
              stages.current[2] = el;
            }}
          >
            {geo.hbmPos.map((p, i) => (
              <group key={i} position={p}>
                {Array.from({ length: 5 }).map((_, k) => (
                  <mesh key={k} material={mats.hbm} position={[0, 0, 0.04 + k * 0.075]}>
                    <boxGeometry args={i < 2 ? [0.7, 0.9, 0.06] : [0.9, 0.7, 0.06]} />
                  </mesh>
                ))}
              </group>
            ))}
            {geo.hbmLinks.map((pts, i) => (
              <Line key={i} points={pts} color={TEAL} lineWidth={1.4} transparent opacity={0.7} />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <mesh
                key={i}
                material={i < 4 ? mats.pulse : mats.pulseCu}
                ref={(el) => {
                  ctxPulses.current[i] = el;
                }}
              >
                <sphereGeometry args={[0.045, 8, 8]} />
              </mesh>
            ))}
            {L(labels.context, 0.16, [1.7, 1.35, 0.02])}
          </group>
          {/* HARNESS: the board, its ports and a shield */}
          <group
            ref={(el) => {
              stages.current[3] = el;
            }}
          >
            <mesh material={mats.board} position={[0, 0, -0.02]}>
              <planeGeometry args={[BOARD.w, BOARD.h]} />
            </mesh>
            <Line points={geo.shield} color={SILK} lineWidth={1} dashed dashSize={0.12} gapSize={0.1} transparent opacity={0.45} />
            {geo.portLinks.map((pts, i) => (
              <Line key={i} points={pts} color={COPPER} lineWidth={1.2} transparent opacity={0.65} />
            ))}
            {geo.portX.map((x, i) => (
              <group key={i} position={[x, -2.8, 0]}>
                <mesh material={mats.port} position={[0, 0, 0.16]}>
                  <boxGeometry args={[1.05, 0.5, 0.32]} />
                </mesh>
                <mesh
                  material={mats.ledOff}
                  position={[0.62, 0.3, 0.04]}
                  ref={(el) => {
                    leds.current[i] = el;
                  }}
                >
                  <sphereGeometry args={[0.06, 10, 10]} />
                </mesh>
                {L(labels.ports[i], 0.15, [-0.52, 0.42, 0.01])}
              </group>
            ))}
            {[
              [-4.2, 2.8],
              [4.2, 2.8],
              [-4.2, -2.8],
              [4.2, -2.8],
            ].map(([x, y], i) => (
              <mesh key={i} material={mats.hole} position={[x, y, 0]}>
                <ringGeometry args={[0.1, 0.16, 20]} />
              </mesh>
            ))}
            {L(labels.harness, 0.3, [-4.25, 2.62, 0.01])}
            {L(labels.now, 0.3, [-2.4, 2.62, 0.01])}
          </group>
          {/* LOOP: feedback bus lapping the board */}
          <group
            ref={(el) => {
              stages.current[4] = el;
            }}
          >
            <Line points={geo.loop} color={TEAL} lineWidth={2.4} transparent opacity={0.85} />
            {Array.from({ length: 3 }).map((_, i) => (
              <mesh
                key={i}
                material={mats.pulseCu}
                ref={(el) => {
                  loopPk.current[i] = el;
                }}
              >
                <sphereGeometry args={[0.16, 14, 14]} />
              </mesh>
            ))}
            {L(labels.loop, 0.36, [-LOOP.w / 2, LOOP.h / 2 + 0.4, 0])}
          </group>
          {/* GRAPH: six more nodes, fibre between them */}
          <group
            ref={(el) => {
              stages.current[5] = el;
            }}
          >
            {geo.allCurves.map((c, i) => (
              <Line
                key={i}
                ref={(el) => {
                  fibers.current[i] = el as unknown as Line2 | null;
                }}
                points={c.getPoints(40)}
                color={COPPER}
                lineWidth={1.6}
                transparent
                opacity={0.45}
              />
            ))}
            {geo.rackPos.map((p, i) => (
              <group
                key={i}
                position={p}
                ref={(el) => {
                  racks.current[i] = el;
                }}
              >
                <mesh material={mats.board}>
                  <planeGeometry args={[BOARD.w, BOARD.h]} />
                </mesh>
                <mesh material={mats.pkg} position={[0, 0, 0.1]}>
                  <boxGeometry args={[2, 2, 0.2]} />
                </mesh>
                <mesh material={mats.die} position={[0, 0, 0.21]}>
                  <planeGeometry args={[1, 1]} />
                </mesh>
                <Line points={geo.loop} color={TEAL} lineWidth={1.2} transparent opacity={0.6} />
                {L(labels.racks[i], 0.95, [-BOARD.w / 2, -BOARD.h / 2 - 1.3, 0])}
              </group>
            ))}
            {Array.from({ length: 16 }).map((_, i) => (
              <mesh
                key={i}
                visible={false}
                material={mats.pulse}
                ref={(el) => {
                  msgs.current[i] = el;
                }}
              >
                <sphereGeometry args={[0.45, 12, 12]} />
              </mesh>
            ))}
            {L(labels.graph, 1.4, [-5, RACK_R * 0.78 + 5.4, 0])}
          </group>
        </group>
      </group>
    </>
  );
}

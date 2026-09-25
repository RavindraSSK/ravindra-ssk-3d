"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { store } from "@/lib/store";
import { skillGroups } from "@/lib/content";
import { Backdrop, V, clamp01, labelTexture, lineGeo, smooth } from "./kit";

/*
 * Ascent theme: the stages of building with AI as a climb.
 * Six floating platforms spiral upward through a dawn-to-night sky, one per stage:
 *   MODEL (a monolith) → PROMPT (a screen) → CONTEXT (stacked cards) →
 *   HARNESS (a gantry around the monolith, beacon lit: we are here) →
 *   LOOP (a ring with an orbiting spark) → GRAPH (a constellation of agents)
 * Stages you have reached are solid stone; stages ahead are holograms still
 * being built. Each chapter climbs one step; the contact view shows the tower.
 */

const BG = "#0d0b22";
const CORAL = "#ff8a65";
const LAV = "#a78bfa";
const STONE = "#ece6f7";

const N = 6;
const R = 3.2;
const H = 1.55;
const TH = 1.1;
const plat = (i: number) => V(Math.cos(i * TH) * R, i * H, Math.sin(i * TH) * R);

// where each chapter puts its platform on screen
const OFFSETS: [number, number, number][] = [
  [2.5, -0.6, 0],
  [-2.3, -0.6, 0],
  [2.4, -0.7, 0],
  [0, -0.9, -1],
  [2.4, -0.7, 0],
  [-2.5, -0.9, 0],
  [0, -0.4, -1.5],
];

const INFO = [
  { name: "MODEL", line: "raw capability" },
  { name: "PROMPT", line: "ask it well" },
  { name: "CONTEXT", line: "feed it the right facts" },
  { name: "HARNESS", line: "tools · tests · guardrails" },
  { name: "LOOP", line: "let it iterate" },
  { name: "GRAPH", line: "agents working together" },
];
const NOW = 3;

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  // dawn at the bottom of the climb, night sky at the top
  float k = clamp(uChapter / 6.0, 0.0, 1.0);
  vec3 top = mix(vec3(0.1, 0.08, 0.24), vec3(0.03, 0.025, 0.09), k);
  vec3 mid = mix(vec3(0.42, 0.2, 0.36), vec3(0.09, 0.06, 0.2), k);
  vec3 low = mix(vec3(1.0, 0.56, 0.4), vec3(0.3, 0.14, 0.3), k);
  float y = uv.y + uMouse.y * 0.02;
  vec3 col = mix(low, mid, smoothstep(0.0, 0.45, y));
  col = mix(col, top, smoothstep(0.4, 1.0, y));
  // soft cloud bands low in the sky
  float c = n2(vec2(uv.x * 4.0 + uTime * 0.02, uv.y * 10.0)) * n2(vec2(uv.x * 9.0 - uTime * 0.015, uv.y * 22.0));
  col += vec3(1.0, 0.75, 0.7) * c * smoothstep(0.55, 0.05, y) * (0.18 - k * 0.12);
  // stars fade in as we climb
  vec2 g = gl_FragCoord.xy / 3.0;
  float st = step(0.9975, h(floor(g))) * (0.6 + 0.4 * sin(uTime * 2.0 + h(floor(g)) * 30.0));
  col += st * smoothstep(0.35, 0.9, y) * (0.25 + k * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;

function label(text: string, color: string, size = 40, weight = 700) {
  const { tex, aspect } = labelTexture(text, { color, pad: 6, font: `${weight} ${size}px "JetBrains Mono Variable", ui-monospace, monospace` });
  return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
}

export default function AscentScene() {
  const { camera, size } = useThree();
  const world = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const monuments = useRef<(THREE.Group | null)[]>([]);
  const nameMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const promptScreen = useRef<THREE.Mesh>(null);
  const orb = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const nodes = useRef<(THREE.Mesh | null)[]>([]);
  const cards = useRef<THREE.Group>(null);
  const typed = useRef(-1);

  const platMats = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        solid: new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.75, metalness: 0.05, transparent: true, opacity: 1 }),
        holo: new THREE.LineBasicMaterial({ color: LAV, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
        glass: new THREE.MeshBasicMaterial({ color: LAV, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      })),
    []
  );
  const geo = useMemo(() => {
    const slab = new THREE.CylinderGeometry(1.15, 1.05, 0.2, 48);
    const slabEdges = new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.15, 1.05, 0.2, 12));
    // stairs between consecutive platforms
    const steps: { pos: THREE.Vector3; rot: number; idx: number }[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = plat(i), b = plat(i + 1);
      for (let k = 1; k <= 5; k++) {
        const u = k / 6;
        const ang = (i + u) * TH;
        steps.push({ pos: V(Math.cos(ang) * R, a.y + (b.y - a.y) * u - 0.05, Math.sin(ang) * R), rot: -ang, idx: i + 1 });
      }
    }
    const nodePos = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return V(Math.cos(a) * 0.8, 0.9 + Math.sin(i * 1.9) * 0.3, Math.sin(a) * 0.8);
    });
    const links: THREE.Vector3[] = [];
    nodePos.forEach((p, i) => {
      links.push(V(0, 1.0, 0), p);
      links.push(p, nodePos[(i + 1) % 6]);
    });
    return { slab, slabEdges, steps, nodePos, links: new THREE.BufferGeometry().setFromPoints(links) };
  }, []);

  const mats = useMemo(
    () => ({
      obelisk: new THREE.MeshStandardMaterial({ color: "#221b3d", roughness: 0.35, metalness: 0.3 }),
      coralLine: new THREE.LineBasicMaterial({ color: CORAL }),
      lavLine: new THREE.LineBasicMaterial({ color: LAV, transparent: true, opacity: 0.8 }),
      card: new THREE.MeshStandardMaterial({ color: "#faf7ff", roughness: 0.6 }),
      cardEdge: new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.5 }),
      gantry: new THREE.LineBasicMaterial({ color: "#fcd9cc" }),
      beacon: new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      ring: new THREE.MeshStandardMaterial({ color: "#f0e9ff", roughness: 0.3, metalness: 0.6 }),
      orb: new THREE.MeshBasicMaterial({ color: CORAL }),
      node: new THREE.MeshBasicMaterial({ color: LAV }),
      nodeOn: new THREE.MeshBasicMaterial({ color: CORAL }),
    }),
    []
  );
  const obeliskEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.36, 1.4, 0.36)), []);
  const gantryEdges = useMemo(() => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 1.7, 1.1, 1, 2, 1));
    return g;
  }, []);
  const names = useMemo(
    () =>
      INFO.map((s, i) => ({
        done: label(`${s.name}`, STONE),
        now: label(`${s.name}`, CORAL),
        next: label(`${s.name}`, LAV),
        line: label(s.line, "#d8cfee", 30, 500),
        tag: i === NOW ? label("● WE ARE HERE", CORAL, 30, 700) : i === 5 ? label("NEXT →", LAV, 30, 700) : null,
      })),
    []
  );
  const promptMats = useMemo(() => {
    const text = "› ask it well";
    return Array.from({ length: text.length + 1 }, (_, k) => {
      const cv = document.createElement("canvas");
      cv.width = 440;
      cv.height = 220;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#15112c";
      ctx.fillRect(0, 0, 440, 220);
      ctx.strokeStyle = LAV;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 434, 214);
      ctx.fillStyle = "#f5f0ff";
      ctx.font = `600 40px "JetBrains Mono Variable", ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      ctx.fillText(text.slice(0, k) + (k % 2 ? "▍" : " "), 26, 110);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tex });
    });
  }, []);
  const skillLabels = useMemo(() => skillGroups.map((g) => label(g.name, "#f5f0ff", 30, 600)), []);
  const glowTex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }, []);
  const glow = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: CORAL, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), [glowTex]);
  const fog = useMemo(() => new THREE.MeshBasicMaterial({ color: BG, transparent: true, opacity: 0, depthTest: false, depthWrite: false }), []);
  const trail = useMemo(() => lineGeo(Array.from({ length: 65 }, (_, i) => V(Math.cos((i / 64) * Math.PI * 2) * 0.62, Math.sin((i / 64) * Math.PI * 2) * 0.62, 0))), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    const s = Math.min(Math.max(store.chapter, 0), 6);
    const a = Math.floor(s), b = Math.min(a + 1, 6);
    const f = smooth(0, 1, s - a);
    const narrow = size.width < 900;

    // climb: rotate the tower so the current platform faces us, then bring it to its spot
    const climb = Math.min(s, 5);
    const ang = climb * TH;
    const contact = clamp01(s - 5);
    // current platform swings to the front (+z), the rest of the tower curls away behind it
    const rotY = ang - Math.PI / 2 + contact * 0.6;
    if (spin.current) spin.current.rotation.y = rotY;
    const target = plat(climb).applyAxisAngle(V(0, 1, 0), rotY);
    const towerCenter = V(0, (N - 1) * H * 0.5, 0);
    target.lerp(towerCenter, contact);
    const sc = 1 - contact * 0.45;
    const off = OFFSETS[a].map((v, i) => v + (OFFSETS[b][i] - v) * f);
    if (world.current) {
      world.current.scale.setScalar(sc * (narrow ? 0.8 : 1));
      world.current.position.set((narrow ? 0 : off[0]) - target.x * sc, off[1] - target.y * sc, off[2] - target.z * sc);
    }
    fog.opacity = clamp01(s - 5.2) * 0.5;
    const rm = store.reducedMotion ? 0.15 : 1;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, store.mouse.x * 0.5 * rm, 4, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.6 + store.mouse.y * 0.3 * rm, 4, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, narrow ? 10.5 : 8, 4, dt);
    camera.lookAt(0, 0, 0);

    // reached stages are stone; stages ahead are holograms
    for (let i = 0; i < N; i++) {
      const reached = clamp01((s - i + 0.7) / 0.5);
      const m = platMats[i];
      m.solid.opacity = reached;
      m.solid.visible = reached > 0.01;
      m.holo.opacity = (1 - reached) * (0.55 + 0.2 * Math.sin(t * 3 + i));
      m.glass.opacity = (1 - reached) * 0.08;
      const mon = monuments.current[i];
      if (mon) mon.position.y = 0.1 + (1 - reached) * 0.05 * Math.sin(t * 2 + i);
      const nm = nameMeshes.current[i];
      if (nm) {
        const cur = Math.round(Math.min(s, 5)) === i;
        const src = cur ? names[i].now : reached > 0.5 ? names[i].done : names[i].next;
        nm.material = src.mat;
        nm.scale.set(src.aspect, 1, 1);
      }
    }

    // monuments at work
    if (monuments.current[0]) monuments.current[0].rotation.y += dt * 0.3;
    const txt = promptMats.length - 1;
    const k = Math.min(txt, Math.floor((t * 5) % (txt + 10)));
    if (promptScreen.current && k !== typed.current) {
      typed.current = k;
      promptScreen.current.material = promptMats[k];
    }
    if (cards.current) cards.current.rotation.y += dt * 0.35;
    if (beacon.current) {
      beacon.current.scale.y = 1 + 0.08 * Math.sin(t * 3);
      (beacon.current.material as THREE.MeshBasicMaterial).opacity = 0.28 + 0.12 * Math.sin(t * 3);
    }
    if (orb.current) {
      const u = t * 1.6;
      orb.current.position.set(Math.cos(u) * 0.62, 1.0 + Math.sin(u) * 0.62, 0);
    }
    const hov = store.hoverCluster;
    nodes.current.forEach((m, i) => {
      if (!m) return;
      const lit = hov === i;
      m.material = lit ? mats.nodeOn : mats.node;
      m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, lit ? 1.8 : 1 + 0.15 * Math.sin(t * 2 + i), 0.15));
    });
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <hemisphereLight args={["#ffd9cc", "#2a2050", 1.1]} />
      <directionalLight position={[-4, 6, 5]} intensity={1.6} color="#ffd2c2" />
      <mesh material={fog} position={[0, 0, 5]} renderOrder={10}>
        <planeGeometry args={[40, 30]} />
      </mesh>
      <group ref={world}>
        <group ref={spin}>
          {/* stairs */}
          {geo.steps.map((st, i) => (
            <group key={i} position={st.pos} rotation={[0, st.rot, 0]}>
              <mesh material={platMats[st.idx].solid}>
                <boxGeometry args={[0.28, 0.08, 0.7]} />
              </mesh>
              <lineSegments material={platMats[st.idx].holo}>
                <edgesGeometry args={[new THREE.BoxGeometry(0.28, 0.08, 0.7)]} />
              </lineSegments>
            </group>
          ))}
          {INFO.map((info, i) => {
            const p = plat(i);
            const nm = names[i];
            return (
              <group key={info.name} position={p}>
                <mesh geometry={geo.slab} material={platMats[i].solid} />
                <mesh geometry={geo.slab} material={platMats[i].glass} />
                <lineSegments geometry={geo.slabEdges} material={platMats[i].holo} />
                <group
                  ref={(el) => {
                    monuments.current[i] = el;
                  }}
                >
                  {i === 0 && (
                    <group position={[0, 0.8, 0]}>
                      <mesh material={mats.obelisk}>
                        <boxGeometry args={[0.36, 1.4, 0.36]} />
                      </mesh>
                      <lineSegments geometry={obeliskEdges} material={mats.coralLine} />
                    </group>
                  )}
                  {i === 1 && (
                    <group position={[0, 0.2, 0]}>
                      <mesh position={[0, 0.3, 0]}>
                        <cylinderGeometry args={[0.03, 0.05, 0.6, 8]} />
                        <meshStandardMaterial color="#cfc6e6" />
                      </mesh>
                      <mesh ref={promptScreen} position={[0, 0.9, 0]}>
                        <planeGeometry args={[1.1, 0.55]} />
                      </mesh>
                    </group>
                  )}
                  {i === 2 && (
                    <group position={[0, 0.12, 0]} ref={cards}>
                      {Array.from({ length: 7 }).map((_, k) => (
                        <mesh key={k} material={k % 3 === 0 ? mats.cardEdge : mats.card} position={[Math.sin(k) * 0.08, k * 0.1, Math.cos(k) * 0.06]} rotation={[0, k * 0.28, 0]}>
                          <boxGeometry args={[0.8, 0.07, 0.55]} />
                        </mesh>
                      ))}
                      {Array.from({ length: 4 }).map((_, k) => (
                        <mesh key={`f${k}`} material={mats.card} position={[Math.cos(k * 1.57) * 0.85, 1.0 + k * 0.08, Math.sin(k * 1.57) * 0.85]} rotation={[0.3, k * 1.57, 0.2]}>
                          <boxGeometry args={[0.32, 0.02, 0.22]} />
                        </mesh>
                      ))}
                    </group>
                  )}
                  {i === 3 && (
                    <group>
                      <group position={[0, 0.8, 0]}>
                        <mesh material={mats.obelisk}>
                          <boxGeometry args={[0.36, 1.4, 0.36]} />
                        </mesh>
                        <lineSegments geometry={obeliskEdges} material={mats.coralLine} />
                        <lineSegments geometry={gantryEdges} material={mats.gantry} />
                        {[0, 1, 2, 3].map((k) => (
                          <mesh key={k} material={mats.ring} position={[Math.cos(k * 1.57) * 0.55, -0.2 + k * 0.25, Math.sin(k * 1.57) * 0.55]} rotation={[0, -k * 1.57, Math.PI / 2]}>
                            <cylinderGeometry args={[0.04, 0.04, 0.4, 10]} />
                          </mesh>
                        ))}
                      </group>
                      <mesh ref={beacon} material={mats.beacon} position={[0, 2.6, 0]}>
                        <cylinderGeometry args={[0.12, 0.3, 3, 24, 1, true]} />
                      </mesh>
                      <sprite material={glow} position={[0, 1.65, 0]} scale={0.8} />
                    </group>
                  )}
                  {i === 4 && (
                    <group>
                      <mesh material={mats.ring} position={[0, 1.0, 0]}>
                        <torusGeometry args={[0.62, 0.035, 12, 80]} />
                      </mesh>
                      <primitive object={new THREE.Line(trail, mats.lavLine)} position={[0, 1.0, 0.001]} />
                      <mesh ref={orb} material={mats.orb}>
                        <sphereGeometry args={[0.08, 16, 16]} />
                      </mesh>
                    </group>
                  )}
                  {i === 5 && (
                    <group>
                      <lineSegments geometry={geo.links} material={mats.lavLine} />
                      <mesh material={mats.node} position={[0, 1.0, 0]}>
                        <sphereGeometry args={[0.12, 16, 16]} />
                      </mesh>
                      {geo.nodePos.map((np, k) => (
                        <group key={k} position={np}>
                          <mesh
                            material={mats.node}
                            ref={(el) => {
                              nodes.current[k] = el;
                            }}
                          >
                            <sphereGeometry args={[0.08, 14, 14]} />
                          </mesh>
                          <Billboard position={[0, 0.17, 0]}>
                            <mesh material={skillLabels[k].mat}>
                              <planeGeometry args={[0.13 * skillLabels[k].aspect, 0.13]} />
                            </mesh>
                          </Billboard>
                        </group>
                      ))}
                    </group>
                  )}
                </group>
                {/* stage name + one-liner */}
                <Billboard position={[0, i === 3 ? 2.3 : 2.05, 0]}>
                  <mesh
                    ref={(el) => {
                      nameMeshes.current[i] = el;
                    }}
                  >
                    <planeGeometry args={[0.26, 0.26]} />
                  </mesh>
                  <mesh material={nm.line.mat} position={[0, -0.24, 0]}>
                    <planeGeometry args={[0.15 * nm.line.aspect, 0.15]} />
                  </mesh>
                  {nm.tag && (
                    <mesh material={nm.tag.mat} position={[0, 0.27, 0]}>
                      <planeGeometry args={[0.15 * nm.tag.aspect, 0.15]} />
                    </mesh>
                  )}
                </Billboard>
              </group>
            );
          })}
        </group>
      </group>
    </>
  );
}

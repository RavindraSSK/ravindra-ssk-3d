"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { store } from "@/lib/store";
import { Backdrop, Poly, Segs, V, labelTexture, lineGeo, lineMat, smooth } from "./kit";

/*
 * Agent Loop theme (medium): one AI agent, seen from different angles as you scroll.
 *   A planner core runs a plan → act → observe → reflect loop, calls six tools
 *   (your six skill groups) over glowing links, and reads/writes a memory stack.
 *   Hovering a skill group makes the agent hammer that tool.
 */

const BG = "#08090d";
const LIME = "#a3e635";
const CYAN = "#22d3ee";
const INK = "#eef2ea";
const LIME_C = new THREE.Color(LIME);
const INK_C = new THREE.Color(INK);
const DIM = "#3a4150";

type Key = { offset: [number, number, number]; cam: [number, number, number]; look: [number, number, number]; scale?: number };
const KEYS: Key[] = [
  { offset: [2.9, 0.1, 0], cam: [0, 1.0, 8.2], look: [0, 0, 0], scale: 0.78 }, // intro: whole agent
  { offset: [-2.2, 0.2, 0], cam: [0, 0.6, 6.2], look: [0, 0.1, 0] }, // about: the planner "thinking"
  { offset: [2.5, 0.9, 0], cam: [0, -0.3, 7.8], look: [0, -0.3, 0], scale: 0.8 }, // experience: memory stack
  { offset: [0, 0.4, -1.8], cam: [0, 2.2, 8.6], look: [0, 0, 0] }, // projects: behind the cards
  { offset: [2.4, -0.4, 0], cam: [0, 5.6, 5.6], look: [0, -0.4, 0] }, // research: from above, observe
  { offset: [-2.5, -0.1, 0], cam: [0, 1.3, 8.0], look: [0, 0, 0], scale: 0.82 }, // skills: the six tools
  { offset: [0, 0, 0], cam: [0, 1.0, 8.4], look: [0, 0, 0] }, // contact
];

const TOOLS = ["python", "pytorch", "llm", "vision", "docker", "sql"];
const TOOL_R = 2.05;
const RING_R = 1.12;
const PHASES = ["plan", "act", "observe", "reflect"];
const LOG = ["> plan: split the task into steps", "> act: call a tool, run the tests", "> observe: 14 passed, 1 failed", "> reflect: fix step 3, try again"];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float s = uRes.y / 900.0;
  vec3 col = mix(vec3(0.022, 0.025, 0.035), vec3(0.04, 0.045, 0.06), uv.y);
  col += vec3(0.25, 0.42, 0.08) * exp(-distance(uv, vec2(0.72 + uMouse.x * 0.02, 0.55)) * 3.2) * 0.12;
  col += vec3(0.05, 0.3, 0.38) * exp(-distance(uv, vec2(0.1, 0.1)) * 3.0) * 0.1;
  // faint terminal scanlines + dot grid
  col *= 0.97 + 0.03 * sin(gl_FragCoord.y * 3.14159 / (2.0 * s));
  vec2 g = mod(gl_FragCoord.xy + vec2(0.0, uChapter * 40.0 * s), 32.0 * s) - 16.0 * s;
  col += vec3(0.6, 0.9, 0.4) * smoothstep(1.3 * s, 0.4 * s, length(g)) * 0.05;
  gl_FragColor = vec4(col, 1.0);
}
`;

function glowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

function toolPos(i: number) {
  const a = (i / 6) * Math.PI * 2 + 0.3;
  return V(Math.cos(a) * TOOL_R, Math.sin(i * 1.7) * 0.55 + 0.1, Math.sin(a) * TOOL_R * 0.75);
}

function toolEdges(g: THREE.BufferGeometry) {
  return new THREE.EdgesGeometry(g);
}

export default function AgentScene() {
  const { camera, size } = useThree();
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const ringPacket = useRef<THREE.Mesh>(null);
  const phaseNodes = useRef<THREE.Mesh[]>([]);
  const tools = useRef<THREE.Group[]>([]);
  const packets = useRef<THREE.Mesh[]>([]);
  const log = useRef<THREE.Mesh>(null);
  const memPacket = useRef<THREE.Mesh>(null);
  const look = useMemo(() => new THREE.Vector3(), []);
  const sim = useRef({ spawn: 0, logPhase: -1, pk: Array.from({ length: 14 }, () => ({ tool: -1, t: 0, speed: 1 })) });

  const mats = useMemo(() => {
    const glow = glowTexture();
    return {
      lime: lineMat(LIME, 0.9),
      limeFaint: lineMat(LIME, 0.25),
      ink: lineMat(INK, 0.55),
      faint: lineMat(INK, 0.14),
      cyan: lineMat(CYAN, 0.8),
      packet: new THREE.MeshBasicMaterial({ color: LIME }),
      packetCyan: new THREE.MeshBasicMaterial({ color: CYAN }),
      node: new THREE.MeshBasicMaterial({ color: DIM }),
      nodeOn: new THREE.MeshBasicMaterial({ color: LIME }),
      coreFill: new THREE.MeshBasicMaterial({ color: "#132008" }),
      glow: new THREE.SpriteMaterial({ map: glow, color: LIME, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      glowCyan: new THREE.SpriteMaterial({ map: glow, color: CYAN, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  }, []);

  const geo = useMemo(() => {
    const ico = toolEdges(new THREE.IcosahedronGeometry(0.55, 1));
    const inner = toolEdges(new THREE.IcosahedronGeometry(0.3, 0));
    const ringLine = lineGeo(Array.from({ length: 129 }, (_, i) => V(Math.cos((i / 128) * Math.PI * 2) * RING_R, 0, Math.sin((i / 128) * Math.PI * 2) * RING_R)));
    const shapes = [
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.OctahedronGeometry(0.24),
      new THREE.DodecahedronGeometry(0.22),
      new THREE.TorusGeometry(0.17, 0.06, 6, 12),
      new THREE.CylinderGeometry(0.17, 0.17, 0.3, 8),
      new THREE.ConeGeometry(0.2, 0.34, 6),
    ].map(toolEdges);
    const curves = TOOLS.map((_, i) => {
      const p = toolPos(i);
      const mid = p.clone().multiplyScalar(0.5).add(V(0, 0.7, 0));
      return new THREE.QuadraticBezierCurve3(V(0, 0, 0), mid, p);
    });
    const links = curves.map((c) => lineGeo(c.getPoints(40)));
    // memory: stacked discs with stored items
    const mem = new Segs();
    const memItems: THREE.Vector3[] = [];
    for (let k = 0; k < 5; k++) {
      const y = -1.35 - k * 0.2;
      mem.poly(Array.from({ length: 65 }, (_, i) => V(Math.cos((i / 64) * Math.PI * 2) * 0.62, y, Math.sin((i / 64) * Math.PI * 2) * 0.62)));
      for (let j = 0; j < 7; j++) {
        const a = j * 0.9 + k;
        memItems.push(V(Math.cos(a) * 0.4, y + 0.02, Math.sin(a) * 0.4));
      }
    }
    mem.dashed(V(0, -0.6, 0), V(0, -1.3, 0), 0.06, 0.05);
    const memPts = new THREE.BufferGeometry().setFromPoints(memItems);
    return { ico, inner, ringLine, shapes, curves, links, mem: mem.geo(), memPts };
  }, []);

  const labels = useMemo(() => {
    const mk = (t: string, color: string, bg?: string, border?: string) => {
      const { tex, aspect } = labelTexture(t, { color, bg, border, radius: 12, font: `600 38px "JetBrains Mono Variable", ui-monospace, monospace` });
      return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
    };
    return {
      tools: TOOLS.map((t) => ({ off: mk(t, INK, "rgba(16,19,25,0.9)", "rgba(255,255,255,0.16)"), on: mk(t, "#0d1400", LIME) })),
      phases: PHASES.map((t) => mk(t, LIME)),
      log: LOG.map((t) => mk(t, INK, "rgba(12,14,19,0.92)", "rgba(163,230,53,0.35)")),
      memory: mk("memory", CYAN),
    };
  }, []);

  const toolMats = useMemo(() => TOOLS.map(() => lineMat(INK, 0.8)), []);
  const onMats = useMemo(
    () =>
      labels.tools.map((l) => {
        const m = l.on.mat.clone();
        m.opacity = 0;
        return m;
      }),
    [labels]
  );
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    const s = Math.min(Math.max(store.chapter, 0), KEYS.length - 1);
    const a = Math.floor(s);
    const b = Math.min(a + 1, KEYS.length - 1);
    const f = smooth(0, 1, s - a);
    const narrow = size.width < 900;
    const A = KEYS[a], B = KEYS[b];
    const mix = (u: readonly number[], v: readonly number[]) => u.map((x, i) => x + (v[i] - x) * f);

    // place the agent beside the text; on phones centre it and pull back
    const off = mix(A.offset, B.offset);
    if (root.current) {
      root.current.position.set(narrow ? 0 : off[0], off[1], off[2]);
      const sc = (A.scale ?? 1) + ((B.scale ?? 1) - (A.scale ?? 1)) * f;
      root.current.scale.setScalar(narrow ? 0.75 : sc);
    }
    const cam = mix(A.cam, B.cam);
    const lk = mix(A.look, B.look);
    const rm = store.reducedMotion ? 0.15 : 1;
    const cx = (narrow ? 0 : cam[0]) + store.mouse.x * 0.4 * rm;
    const cy = cam[1] + store.mouse.y * 0.3 * rm;
    const cz = cam[2] + (narrow ? 3 : 0);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, cx, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, cy, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cz, 5, dt);
    look.set(narrow ? 0 : lk[0], lk[1], lk[2]);
    camera.lookAt(look);

    // core spins; loop packet runs plan → act → observe → reflect
    if (core.current) {
      core.current.rotation.y += dt * 0.35;
      core.current.rotation.x += dt * 0.12;
    }
    const ang = (t * 0.9) % (Math.PI * 2);
    if (ringPacket.current) ringPacket.current.position.set(Math.cos(ang) * RING_R, 0, Math.sin(ang) * RING_R);
    let active = 0;
    phaseNodes.current.forEach((n, i) => {
      if (!n) return;
      const pa = (i / 4) * Math.PI * 2;
      let d = Math.abs(ang - pa);
      d = Math.min(d, Math.PI * 2 - d);
      const on = d < 0.55;
      if (on) active = i;
      n.material = on ? mats.nodeOn : mats.node;
      n.scale.setScalar(THREE.MathUtils.lerp(n.scale.x, on ? 1.6 : 1, 0.2));
    });
    if (log.current && active !== sim.current.logPhase) {
      sim.current.logPhase = active;
      const l = labels.log[active];
      log.current.material = l.mat;
      log.current.scale.set(l.aspect, 1, 1);
    }

    // tool calls: packets fly out along the links and come back
    const hover = store.hoverCluster;
    const S = sim.current;
    S.spawn -= dt;
    if (S.spawn <= 0) {
      const free = S.pk.find((p) => p.tool < 0);
      if (free) {
        free.tool = hover >= 0 && Math.random() < 0.85 ? hover : Math.floor(Math.random() * 6);
        free.t = 0;
        free.speed = 0.7 + Math.random() * 0.4;
      }
      S.spawn = hover >= 0 ? 0.12 : 0.55;
    }
    S.pk.forEach((p, i) => {
      const m = packets.current[i];
      if (!m) return;
      if (p.tool < 0) {
        m.visible = false;
        return;
      }
      p.t += dt * p.speed * (store.reducedMotion ? 0.3 : 1);
      if (p.t >= 2) {
        p.tool = -1;
        m.visible = false;
        return;
      }
      const u = p.t < 1 ? p.t : 2 - p.t;
      m.visible = true;
      m.position.copy(geo.curves[p.tool].getPoint(u));
      m.material = p.t < 1 ? mats.packet : mats.packetCyan;
    });
    tools.current.forEach((g, i) => {
      if (!g) return;
      const on = hover === i ? 1 : 0;
      const busy = S.pk.some((p) => p.tool === i && Math.abs(p.t - 1) < 0.15) ? 1 : 0;
      const k = Math.max(on, busy * 0.7);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 1 + k * 0.35, 0.2));
      g.children[0].rotation.y += dt * (0.4 + on * 2);
      const lblOn = onMats[i];
      lblOn.opacity = THREE.MathUtils.lerp(lblOn.opacity, on, 0.2);
    });
    // memory: a read/write packet every few seconds
    if (memPacket.current) {
      const m = (t * 0.45) % 1;
      memPacket.current.position.set(0, m < 0.5 ? -0.55 - m * 2 * 0.9 : -1.45 + (m - 0.5) * 2 * 0.9, 0);
    }
  });

  useFrame(() => {
    toolMats.forEach((m, i) => m.color.lerp(store.hoverCluster === i ? LIME_C : INK_C, 0.15));
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <group ref={root}>
        {/* planner core */}
        <group ref={core}>
          <lineSegments geometry={geo.ico} material={mats.lime} />
          <lineSegments geometry={geo.inner} material={mats.cyan} />
          <mesh material={mats.coreFill}>
            <icosahedronGeometry args={[0.28, 1]} />
          </mesh>
        </group>
        <sprite material={mats.glow} scale={2.6} />
        {/* the loop */}
        <group ref={ring} rotation={[0.35, 0, 0.12]}>
          <Poly geometry={geo.ringLine} material={mats.limeFaint} />
          <mesh ref={ringPacket} material={mats.packet}>
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
          {PHASES.map((_, i) => {
            const a = (i / 4) * Math.PI * 2;
            const lb = labels.phases[i];
            return (
              <group key={i} position={[Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R]}>
                <mesh
                  material={mats.node}
                  ref={(el) => {
                    if (el) phaseNodes.current[i] = el;
                  }}
                >
                  <octahedronGeometry args={[0.07]} />
                </mesh>
                <Billboard position={[0, 0.2, 0]}>
                  <mesh material={lb.mat}>
                    <planeGeometry args={[0.16 * lb.aspect, 0.16]} />
                  </mesh>
                </Billboard>
              </group>
            );
          })}
        </group>
        {/* tools */}
        {TOOLS.map((_, i) => {
          const p = toolPos(i);
          const lb = labels.tools[i];
          return (
            <group key={i}>
              <Poly geometry={geo.links[i]} material={mats.faint} />
              <group
                position={p}
                ref={(el) => {
                  if (el) tools.current[i] = el;
                }}
              >
                <lineSegments geometry={geo.shapes[i]} material={toolMats[i]} />
                <Billboard position={[0, -0.36, 0]}>
                  <mesh material={lb.off.mat}>
                    <planeGeometry args={[0.2 * lb.off.aspect, 0.2]} />
                  </mesh>
                  <mesh material={onMats[i]} position={[0, 0, 0.002]}>
                    <planeGeometry args={[0.2 * lb.on.aspect, 0.2]} />
                  </mesh>
                </Billboard>
              </group>
            </group>
          );
        })}
        {Array.from({ length: 14 }).map((_, i) => (
          <mesh
            key={i}
            visible={false}
            material={mats.packet}
            ref={(el) => {
              if (el) packets.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.045, 10, 10]} />
          </mesh>
        ))}
        {/* memory */}
        <lineSegments geometry={geo.mem} material={mats.cyan} />
        <points geometry={geo.memPts}>
          <pointsMaterial color={CYAN} size={0.05} sizeAttenuation />
        </points>
        <mesh ref={memPacket} material={mats.packetCyan}>
          <sphereGeometry args={[0.04, 10, 10]} />
        </mesh>
        <sprite material={mats.glowCyan} position={[0, -1.75, 0]} scale={[2.2, 1.2, 1]} />
        <Billboard position={[0.95, -1.45, 0]}>
          <mesh material={labels.memory.mat}>
            <planeGeometry args={[0.16 * labels.memory.aspect, 0.16]} />
          </mesh>
        </Billboard>
        {/* running log of the current step */}
        <Billboard position={[0, 1.35, 0]}>
          <mesh ref={log}>
            <planeGeometry args={[0.17, 0.17]} />
          </mesh>
        </Billboard>
      </group>
    </>
  );
}

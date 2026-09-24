"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { store } from "@/lib/store";
import { Backdrop, Segs, V, labelTexture, lineGeo, lineMat, rng, smooth, clamp01 } from "./kit";

/*
 * Graph Era theme: the same layer story told in 3D, looking forward.
 * One agent is assembled shell by shell as you scroll:
 *   MODEL core → PROMPT ring → CONTEXT tiles → HARNESS cage (we are here) → LOOP track
 * then the camera pulls back and the agent becomes one node in a graph of six
 * more agents (your six skill groups) passing messages: GRAPH, what comes next.
 */

const BG = "#05080c";
const SKY = "#7dd3fc";
const GREEN = "#fbbf24"; // "now" marker (harness)
const INK = "#e6f1f7";

const R = { model: 0.34, prompt: 0.62, context: 0.98, harness: 1.34, loop: 1.74 };
const KEYS: { off: [number, number, number]; z: number }[] = [
  { off: [1.75, 0.05, 0], z: 4.8 },
  { off: [-1.75, 0.05, 0], z: 5.8 },
  { off: [2.05, 0, 0], z: 6.9 },
  { off: [0, -0.2, -0.6], z: 8.2 },
  { off: [2.55, 0, 0], z: 8.8 },
  { off: [-3.7, -0.3, 0], z: 12 },
  { off: [0, 0.3, 0], z: 12.6 },
];
const LABELS = [
  { t: "MODEL", c: INK },
  { t: "PROMPT", c: INK },
  { t: "CONTEXT", c: INK },
  { t: "HARNESS · we are here", c: GREEN },
  { t: "LOOP", c: INK },
  { t: "GRAPH · next", c: SKY },
];
const SAT_NAMES = ["languages", "ml · dl", "llm", "vision", "mlops", "data"];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = mix(vec3(0.015, 0.025, 0.04), vec3(0.03, 0.045, 0.065), uv.y);
  col += vec3(0.2, 0.45, 0.6) * exp(-distance(uv, vec2(0.62 + uMouse.x * 0.03, 0.55)) * 2.6) * 0.12;
  col += vec3(0.1, 0.4, 0.28) * exp(-distance(uv, vec2(0.1, 0.05)) * 3.0) * 0.08;
  gl_FragColor = vec4(col, 1.0);
}
`;

function glowTex() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

const circle = (r: number, n = 96) => lineGeo(Array.from({ length: n + 1 }, (_, i) => V(Math.cos((i / n) * Math.PI * 2) * r, 0, Math.sin((i / n) * Math.PI * 2) * r)));

/** Shared geometry/materials for an agent (main one and the small graph peers). */
function useAgentKit() {
  return useMemo(() => {
    const glow = glowTex();
    // context tiles on a Fibonacci sphere
    const tiles: THREE.Vector3[] = [];
    const n = 46;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = i * 2.39996;
      tiles.push(V(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(R.context));
    }
    const cage = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R.harness, 0));
    const cageVerts: THREE.Vector3[] = [];
    const ico = new THREE.IcosahedronGeometry(R.harness, 0);
    const pos = ico.getAttribute("position");
    const seen = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      const v = V(pos.getX(i), pos.getY(i), pos.getZ(i));
      const k = v.toArray().map((x) => x.toFixed(3)).join(",");
      if (!seen.has(k)) {
        seen.add(k);
        cageVerts.push(v);
      }
    }
    const tokens = new Segs();
    for (let i = 0; i < 14; i++) {
      const a0 = (i / 14) * Math.PI * 2, a1 = a0 + 0.18;
      tokens.seg(V(Math.cos(a0) * R.prompt, 0, Math.sin(a0) * R.prompt), V(Math.cos(a1) * R.prompt, 0, Math.sin(a1) * R.prompt));
    }
    return {
      glow,
      tiles,
      cage,
      cageVerts,
      tokens: tokens.geo(),
      rings: { prompt: circle(R.prompt), loop: circle(R.loop, 128) },
      core: new THREE.IcosahedronGeometry(R.model, 1),
      coreEdges: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R.model * 1.02, 1)),
      mats: {
        core: new THREE.MeshStandardMaterial({ color: "#0c1822", emissive: SKY, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.2, flatShading: true }),
        coreLine: lineMat(SKY, 0.8),
        ink: lineMat(INK, 0.55),
        faint: lineMat(INK, 0.1),
        sky: lineMat(SKY, 0.85),
        green: lineMat(GREEN, 0.9),
        tile: new THREE.MeshBasicMaterial({ color: "#cfe9f7", transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
        socket: new THREE.MeshBasicMaterial({ color: GREEN }),
        packet: new THREE.MeshBasicMaterial({ color: SKY }),
        packetG: new THREE.MeshBasicMaterial({ color: GREEN }),
      },
    };
  }, []);
}
type Kit = ReturnType<typeof useAgentKit>;

/** One agent. `reveal` holds 0..1 per shell (model, prompt, context, harness, loop). */
function Agent({ kit, reveal, spin = 1, glow = 1 }: { kit: Kit; reveal: React.RefObject<number[]>; spin?: number; glow?: number }) {
  const shells = useRef<(THREE.Group | null)[]>([]);
  const promptSpin = useRef<THREE.Group>(null);
  const ctxSpin = useRef<THREE.Group>(null);
  const cageSpin = useRef<THREE.Group>(null);
  const loopPk = useRef<(THREE.Mesh | null)[]>([]);
  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: kit.glow, color: SKY, transparent: true, opacity: 0.5 * glow, blending: THREE.AdditiveBlending, depthWrite: false }), [kit, glow]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    const rv = reveal.current ?? [];
    shells.current.forEach((g, i) => {
      if (!g) return;
      const e = i === 0 ? 1 : rv[i] ?? 0;
      const k = e * e * (3 - 2 * e);
      g.scale.setScalar(Math.max(k, 0.0001));
      g.visible = k > 0.01;
    });
    if (shells.current[0]) shells.current[0].rotation.y += dt * 0.5 * spin;
    if (promptSpin.current) promptSpin.current.rotation.y += dt * 0.9 * spin;
    if (ctxSpin.current) ctxSpin.current.rotation.y -= dt * 0.25 * spin;
    if (cageSpin.current) {
      cageSpin.current.rotation.y += dt * 0.12 * spin;
      cageSpin.current.rotation.x += dt * 0.05 * spin;
    }
    loopPk.current.forEach((m, i) => {
      if (!m) return;
      const a = t * 1.3 * spin - i * 0.07;
      m.position.set(Math.cos(a) * R.loop, 0, Math.sin(a) * R.loop);
      m.scale.setScalar(1 - i / 9);
    });
  });

  return (
    <group>
      {/* MODEL */}
      <group
        ref={(el) => {
          shells.current[0] = el;
        }}
      >
        <mesh geometry={kit.core} material={kit.mats.core} />
        <lineSegments geometry={kit.coreEdges} material={kit.mats.coreLine} />
        <sprite material={glowMat} scale={1.8} />
      </group>
      {/* PROMPT */}
      <group
        rotation={[0.5, 0, 0.25]}
        ref={(el) => {
          shells.current[1] = el;
        }}
      >
        <primitive object={new THREE.Line(kit.rings.prompt, kit.mats.ink)} />
        <group ref={promptSpin}>
          <lineSegments geometry={kit.tokens} material={kit.mats.sky} />
        </group>
      </group>
      {/* CONTEXT */}
      <group
        ref={(el) => {
          shells.current[2] = el;
        }}
      >
        <group ref={ctxSpin}>
          {kit.tiles.map((p, i) => (
            <mesh key={i} position={p} material={kit.mats.tile} onUpdate={(m) => m.lookAt(p.clone().multiplyScalar(2))}>
              <planeGeometry args={[0.12, 0.08]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* HARNESS */}
      <group
        ref={(el) => {
          shells.current[3] = el;
        }}
      >
        <group ref={cageSpin}>
          <lineSegments geometry={kit.cage} material={kit.mats.green} />
          {kit.cageVerts.map((p, i) => (
            <mesh key={i} position={p} material={kit.mats.socket}>
              <boxGeometry args={[0.07, 0.07, 0.07]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* LOOP */}
      <group
        rotation={[0.32, 0, -0.12]}
        ref={(el) => {
          shells.current[4] = el;
        }}
      >
        <primitive object={new THREE.Line(kit.rings.loop, kit.mats.ink)} />
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh
            key={i}
            material={i === 0 ? kit.mats.packetG : kit.mats.packet}
            ref={(el) => {
              loopPk.current[i] = el;
            }}
          >
            <sphereGeometry args={[i === 0 ? 0.06 : 0.035, 10, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function GraphScene() {
  const { camera, size } = useThree();
  const kit = useAgentKit();
  const root = useRef<THREE.Group>(null);
  const reveal = useRef<number[]>([1, 0, 0, 0, 0]);
  const full = useRef<number[]>([1, 1, 1, 1, 1]);
  const graphG = useRef<THREE.Group>(null);
  const sats = useRef<(THREE.Group | null)[]>([]);
  const labelGroup = useRef<THREE.Group>(null);
  const labelMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const satLabels = useRef<(THREE.Mesh | null)[]>([]);
  const packets = useRef<(THREE.Mesh | null)[]>([]);
  const sim = useRef({ spawn: 0, pk: Array.from({ length: 18 }, () => ({ e: -1, t: 0, dir: 1 })) });

  const satPos = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        return V(Math.cos(a) * 2.3, Math.sin(i * 2.1) * 0.75, Math.sin(a) * 1.5);
      }),
    []
  );
  // edges: hub → each peer, plus a ring between peers
  const edgeCurves = useMemo(() => {
    const out: THREE.QuadraticBezierCurve3[] = [];
    satPos.forEach((p) => out.push(new THREE.QuadraticBezierCurve3(V(0, 0, 0), p.clone().multiplyScalar(0.5).add(V(0, 0.8, 0)), p)));
    satPos.forEach((p, i) => {
      const q = satPos[(i + 1) % 6];
      out.push(new THREE.QuadraticBezierCurve3(p, p.clone().lerp(q, 0.5).multiplyScalar(1.15), q));
    });
    return out;
  }, [satPos]);
  const edgeGeo = useMemo(() => {
    const s = new Segs();
    edgeCurves.forEach((c) => s.poly(c.getPoints(30)));
    return s.geo();
  }, [edgeCurves]);
  const edgeMat = useMemo(() => lineMat(SKY, 0), []);
  const ghostRings = useMemo(() => [R.prompt, R.context, R.harness, R.loop].map((r) => circle(r, 64)), []);
  const ghostMat = useMemo(() => new THREE.LineDashedMaterial({ color: INK, transparent: true, opacity: 0.12, dashSize: 0.06, gapSize: 0.06 }), []);
  const ghostLines = useMemo(
    () =>
      ghostRings.map((g) => {
        const l = new THREE.Line(g, ghostMat);
        l.computeLineDistances();
        return l;
      }),
    [ghostRings, ghostMat]
  );
  const labels = useMemo(
    () =>
      LABELS.map((l) => {
        const { tex, aspect } = labelTexture(l.t, { color: l.c, font: `600 40px "JetBrains Mono Variable", ui-monospace, monospace`, pad: 6 });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }), aspect };
      }),
    []
  );
  const satNameMats = useMemo(
    () =>
      SAT_NAMES.map((n, i) => {
        const off = labelTexture(n, { color: INK, bg: "rgba(10,16,23,0.9)", border: "rgba(255,255,255,0.2)", radius: 12, font: `600 34px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: off.tex, transparent: true, depthWrite: false, opacity: 0 }), aspect: off.aspect, i };
      }),
    []
  );
  const fog = useMemo(() => new THREE.MeshBasicMaterial({ color: BG, transparent: true, opacity: 0, depthTest: false, depthWrite: false }), []);
  const stars = useMemo(() => {
    const r = rng(12);
    const pts: number[] = [];
    for (let i = 0; i < 500; i++) {
      const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), d = 18 + r() * 10;
      pts.push(Math.sin(v) * Math.cos(u) * d, Math.cos(v) * d * 0.6, Math.sin(v) * Math.sin(u) * d - 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    const s = Math.min(Math.max(store.chapter, 0), 6);
    const a = Math.floor(s), b = Math.min(a + 1, 6);
    const f = smooth(0, 1, s - a);
    const narrow = store.isMobile || size.width < 900;

    for (let i = 1; i < 5; i++) reveal.current[i] = clamp01((s - i + 0.8) / 0.6);
    const graph = clamp01((s - 5 + 0.8) / 0.6);

    const off = KEYS[a].off.map((v, i) => v + (KEYS[b].off[i] - v) * f);
    const z = KEYS[a].z + (KEYS[b].z - KEYS[a].z) * f;
    if (root.current) {
      root.current.position.set(narrow ? 0 : off[0], off[1], off[2]);
      root.current.rotation.y = Math.sin(t * 0.12) * 0.25;
    }
    const rm = store.reducedMotion ? 0.15 : 1;
    const cz = z * (narrow ? 1.35 : 1);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, store.mouse.x * 0.08 * cz * rm, 4, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.35 + store.mouse.y * 0.06 * cz * rm, 4, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cz, 4, dt);
    camera.lookAt(0, 0, 0);

    // labels stay readable as we pull back
    const k = Math.max(1, cz / 7);
    const radii = [R.model, R.prompt, R.context, R.harness, R.loop, 3.1];
    labelMeshes.current.forEach((m, i) => {
      if (!m) return;
      const e = i === 0 ? 1 : i < 5 ? reveal.current[i] : graph;
      const newest = Math.min(Math.round(s), 5) === i ? 1 : 0.5;
      const fade = i < 5 ? 1 - graph * 0.9 : 1;
      (m.material as THREE.MeshBasicMaterial).opacity = e * newest * fade;
      // each label sits on its own shell, up and to the right
      const r = radii[i];
      m.scale.setScalar(k);
      if (i === 5) m.position.set(-0.4, 2.35, 0); // GRAPH sits above the whole cluster
      else m.position.set(r * 0.77 + 0.06 + (0.19 * labels[i].aspect * k) / 2, r * 0.64 + 0.04, 0);
    });
    fog.opacity = clamp01(s - 5.2) * 0.6;
    ghostMat.opacity = 0.12 * (1 - graph);

    // graph of peers
    if (graphG.current) graphG.current.visible = graph > 0.01;
    edgeMat.opacity = graph * 0.45;
    sats.current.forEach((g, i) => {
      if (!g) return;
      const hov = store.hoverCluster === i ? 1 : 0;
      const e = clamp01((graph - i * 0.06) / 0.6);
      g.scale.setScalar(Math.max(e, 0.0001) * 0.38 * (1 + hov * 0.35));
    });
    satLabels.current.forEach((m, i) => {
      if (!m) return;
      const hov = store.hoverCluster === i ? 1 : 0.7;
      (m.material as THREE.MeshBasicMaterial).opacity = graph * hov;
    });
    // messages between agents; hovered skill gets most of the traffic
    const S = sim.current;
    S.spawn -= dt;
    if (graph > 0.5 && S.spawn <= 0) {
      const free = S.pk.find((p) => p.e < 0);
      if (free) {
        const hov = store.hoverCluster;
        free.e = hov >= 0 && Math.random() < 0.8 ? hov : Math.floor(Math.random() * edgeCurves.length);
        free.t = 0;
        free.dir = Math.random() < 0.5 ? 1 : -1;
      }
      S.spawn = store.hoverCluster >= 0 ? 0.08 : 0.22;
    }
    S.pk.forEach((p, i) => {
      const m = packets.current[i];
      if (!m) return;
      if (p.e < 0) {
        m.visible = false;
        return;
      }
      p.t += dt * 0.8;
      if (p.t >= 1) {
        p.e = -1;
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.copy(edgeCurves[p.e].getPoint(p.dir > 0 ? p.t : 1 - p.t));
    });
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 4]} intensity={20} color={SKY} distance={20} />
      <points geometry={stars}>
        <pointsMaterial color="#9fb7c9" size={0.06} sizeAttenuation transparent opacity={0.6} />
      </points>
      <mesh material={fog} position={[0, 0, 4]} renderOrder={10} onUpdate={(m) => m.lookAt(0, 0, 100)}>
        <planeGeometry args={[80, 60]} />
      </mesh>
      <group ref={root}>
        {ghostLines.map((l, i) => (
          <primitive key={i} object={l} rotation={[i === 3 ? 0 : 0.35, 0, 0]} />
        ))}
        <Agent kit={kit} reveal={reveal} />
        <group ref={labelGroup}>
          {LABELS.map((_, i) => {
            const l = labels[i];
            const y = 0;
            return (
              <mesh
                key={i}
                material={l.mat}
                position={[0, y, 0]}
                ref={(el) => {
                  labelMeshes.current[i] = el;
                }}
              >
                <planeGeometry args={[0.19 * l.aspect, 0.19]} />
              </mesh>
            );
          })}
        </group>
        <group ref={graphG}>
          <lineSegments geometry={edgeGeo} material={edgeMat} />
          {satPos.map((p, i) => (
            <group key={i} position={p}>
              <group
                ref={(el) => {
                  sats.current[i] = el;
                }}
              >
                <Agent kit={kit} reveal={full} spin={1.4} glow={0.8} />
              </group>
              <Billboard position={[0, -0.95, 0]}>
                <mesh
                  material={satNameMats[i].mat}
                  ref={(el) => {
                    satLabels.current[i] = el;
                  }}
                >
                  <planeGeometry args={[0.36 * satNameMats[i].aspect, 0.36]} />
                </mesh>
              </Billboard>
            </group>
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <mesh
              key={i}
              visible={false}
              material={kit.mats.packet}
              ref={(el) => {
                packets.current[i] = el;
              }}
            >
              <sphereGeometry args={[0.07, 10, 10]} />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}


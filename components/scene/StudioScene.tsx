"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { store } from "@/lib/store";

/*
 * Studio theme: light, editorial scene with glass and chrome objects.
 * One object group per chapter; each scales in/out as you scroll
 * (same chapter mapping as the Neural theme, just different visuals).
 */

// Where each chapter's object sits, beside the text (x = 0 on small screens).
const OFFSETS: [number, number, number][] = [
  [2.7, 0, 0], // intro
  [-2.4, 0.1, 0], // about
  [2.2, 0, 0], // experience
  [0, -0.4, -1.5], // projects
  [2.2, -0.1, 0], // research
  [-2.7, 0, 0], // skills
  [0, 0.3, 0], // contact
];

// ---------- materials ----------
function useMaterials() {
  return useMemo(
    () => ({
      glass: new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 1,
        roughness: 0.06,
        thickness: 1.4,
        ior: 1.45,
        attenuationColor: new THREE.Color("#99f6e4"),
        attenuationDistance: 3,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.3,
      }),
      chrome: new THREE.MeshStandardMaterial({ color: "#dfe3e8", metalness: 1, roughness: 0.14 }),
      teal: new THREE.MeshStandardMaterial({ color: "#14b8a6", metalness: 0.9, roughness: 0.22 }),
      ceramic: new THREE.MeshStandardMaterial({ color: "#f7f5f0", roughness: 0.55, metalness: 0 }),
      navy: new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.6, roughness: 0.3 }),
    }),
    []
  );
}
type Mats = ReturnType<typeof useMaterials>;

// ---------- chapter objects ----------
function Crystal({ m }: { m: Mats }) {
  const shell = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const k = store.reducedMotion ? 0.25 : 1;
    if (shell.current) {
      shell.current.rotation.x += dt * 0.12 * k;
      shell.current.rotation.y += dt * 0.18 * k;
    }
    if (orbit.current) orbit.current.rotation.y += dt * 0.35 * k;
  });
  return (
    <group>
      <mesh ref={shell} material={m.glass}>
        <icosahedronGeometry args={[1.55, 0]} />
      </mesh>
      <mesh material={m.teal}>
        <sphereGeometry args={[0.5, 64, 64]} />
      </mesh>
      <group ref={orbit} rotation={[0.4, 0, 0.2]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2.3, Math.sin(a * 2) * 0.3, Math.sin(a) * 2.3]} material={m.chrome}>
              <sphereGeometry args={[0.13, 32, 32]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Ring({ m }: { m: Mats }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    ref.current.rotation.x = 0.6 + Math.sin(t * 0.4) * 0.2;
    ref.current.rotation.y = t * 0.25;
  });
  return (
    <group ref={ref}>
      <mesh material={m.glass}>
        <torusGeometry args={[1.35, 0.46, 64, 160]} />
      </mesh>
      <mesh material={m.chrome}>
        <sphereGeometry args={[0.38, 48, 48]} />
      </mesh>
    </group>
  );
}

const LAYERS = [3, 4, 4, 2];
function Layers({ m }: { m: Mats }) {
  const nodes = useRef<THREE.Mesh[]>([]);
  const layout = useMemo(() => {
    const pts: [number, number, number][][] = LAYERS.map((n, li) => {
      const x = -1.8 + li * 1.2;
      return Array.from({ length: n }, (_, i) => [x, (i - (n - 1) / 2) * 0.62, 0.1] as [number, number, number]);
    });
    const edges: [number, number, number][][] = [];
    for (let l = 0; l < pts.length - 1; l++)
      for (const a of pts[l]) for (const b of pts[l + 1]) edges.push([a, b]);
    return { pts, edges };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.25 : 1);
    nodes.current.forEach((n) => {
      if (!n) return;
      const layer = Number(n.userData.layer);
      // A wave of activation sweeps left → right through the layers.
      const pulse = Math.max(0, Math.sin(t * 2 - layer * 1.1));
      n.scale.setScalar(1 + pulse * 0.45);
    });
  });

  let idx = 0;
  return (
    <group rotation={[0.05, -0.55, 0]}>
      {layout.pts.map((layer, li) => (
        <group key={li}>
          <RoundedBox
            args={[0.1, Math.max(layer.length * 0.62 + 0.3, 1.4), 1.3]}
            radius={0.05}
            position={[layer[0][0], 0, 0]}
            material={m.glass}
          />
          {layer.map((p) => {
            const i = idx++;
            return (
              <mesh
                key={i}
                ref={(el) => {
                  if (el) nodes.current[i] = el;
                }}
                userData={{ layer: li }}
                position={p}
                material={li % 3 === 0 ? m.teal : m.chrome}
              >
                <sphereGeometry args={[0.1, 32, 32]} />
              </mesh>
            );
          })}
        </group>
      ))}
      {layout.edges.map((e, i) => (
        <Line key={i} points={e} color="#0d9488" lineWidth={1} transparent opacity={0.35} />
      ))}
    </group>
  );
}

function Orbit({ m }: { m: Mats }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.12 * (store.reducedMotion ? 0.25 : 1);
  });
  return (
    <group rotation={[0.35, 0, 0]}>
      <group ref={ref}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <RoundedBox
              key={i}
              args={[0.8, 0.8, 0.8]}
              radius={0.12}
              position={[Math.cos(a) * 3.4, Math.sin(a * 3) * 0.3, Math.sin(a) * 3.4]}
              rotation={[a, a * 0.5, 0]}
              material={i % 2 ? m.glass : i % 4 === 0 ? m.teal : m.chrome}
            />
          );
        })}
      </group>
    </group>
  );
}

// Data landscape: a field of ceramic bars, heights from smooth noise (the "terrain").
function Terrain({ m }: { m: Mats }) {
  const COLS = 16;
  const ROWS = 10;
  const ref = useRef<THREE.InstancedMesh>(null);
  const tops = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const h = (x: number, z: number, t: number) =>
    0.25 +
    0.9 * (0.5 + 0.5 * Math.sin(x * 0.55 + t * 0.6) * Math.cos(z * 0.7 - t * 0.4)) +
    0.35 * (0.5 + 0.5 * Math.sin((x + z) * 0.9 + t));

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.1 : 0.5);
    if (!ref.current || !tops.current) return;
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c - (COLS - 1) / 2) * 0.34;
        const z = (r - (ROWS - 1) / 2) * 0.34;
        const y = h(c, r, t);
        dummy.position.set(x, y / 2, z);
        dummy.scale.set(1, y, 1);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 0.02, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tops.current.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
    tops.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group rotation={[0.5, -0.6, 0]} position={[0, -0.8, 0]} scale={0.82}>
      <instancedMesh ref={ref} args={[undefined, undefined, COLS * ROWS]} material={m.ceramic} castShadow>
        <boxGeometry args={[0.26, 1, 0.26]} />
      </instancedMesh>
      <instancedMesh ref={tops} args={[undefined, undefined, COLS * ROWS]} material={m.teal}>
        <boxGeometry args={[0.27, 0.04, 0.27]} />
      </instancedMesh>
    </group>
  );
}

function Clusters({ m }: { m: Mats }) {
  const spheres = useRef<THREE.Mesh[]>([]);
  const halos = useRef<THREE.Mesh[]>([]);
  const halo = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#0d9488", transparent: true, opacity: 0 }),
    []
  );
  const haloMats = useMemo(() => Array.from({ length: 6 }, () => halo.clone()), [halo]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    spheres.current.forEach((s, i) => {
      if (!s) return;
      const on = store.hoverCluster === i ? 1 : 0;
      const target = 1 + on * 0.4;
      s.scale.setScalar(THREE.MathUtils.damp(s.scale.x, target, 6, dt));
      s.position.y = s.userData.y + Math.sin(t * 0.8 + i) * 0.08;
      const hm = haloMats[i];
      hm.opacity = THREE.MathUtils.damp(hm.opacity, on * 0.9, 6, dt);
      const hl = halos.current[i];
      if (hl) {
        hl.position.y = s.position.y;
        hl.rotation.z += dt * 0.6;
      }
    });
  });

  return (
    <group rotation={[0.25, 0, 0]}>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * 1.7;
        const y = Math.sin(a) * 1.45;
        return (
          <group key={i}>
            <mesh
              ref={(el) => {
                if (el) spheres.current[i] = el;
              }}
              userData={{ y }}
              position={[x, y, 0]}
              material={i % 2 ? m.glass : i % 3 === 0 ? m.teal : m.chrome}
            >
              <sphereGeometry args={[0.4, 64, 64]} />
            </mesh>
            <mesh
              ref={(el) => {
                if (el) halos.current[i] = el;
              }}
              position={[x, y, 0]}
              material={haloMats[i]}
            >
              <torusGeometry args={[0.64, 0.012, 8, 96]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------- scene ----------
export default function StudioScene() {
  const m = useMaterials();
  const groups = useRef<(THREE.Group | null)[]>([]);
  const warm = useRef(0);
  const { camera, size, gl } = useThree();
  // Glass refraction buffer at half resolution: big GPU saving, no visible difference.
  useMemo(() => {
    gl.transmissionResolutionScale = 0.5;
  }, [gl]);

  const chapters = [
    <Crystal key="c0" m={m} />,
    <Ring key="c1" m={m} />,
    <Layers key="c2" m={m} />,
    <Orbit key="c3" m={m} />,
    <Terrain key="c4" m={m} />,
    <Clusters key="c5" m={m} />,
    <Crystal key="c6" m={m} />,
  ];

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = store.chapter;
    const narrow = size.width < 900;

    // Warm-up: draw every chapter's objects (tiny) for the first few frames so
    // all shaders compile behind the loader, not mid-scroll.
    warm.current++;
    const warming = warm.current < 5;

    groups.current.forEach((g, k) => {
      if (!g) return;
      const w = Math.min(Math.max(1 - Math.abs(s - k), 0), 1);
      const e = warming ? Math.max(w * w * (3 - 2 * w), 0.02) : w * w * (3 - 2 * w);
      g.visible = warming || e > 0.01;
      const base = narrow ? 0.72 : 1;
      g.scale.setScalar(Math.max(e, 0.0001) * base);
      const [ox, oy, oz] = OFFSETS[k];
      g.position.set(narrow ? 0 : ox, oy - (1 - e) * 0.8, oz);
      g.rotation.y = (1 - e) * (s > k ? -1.2 : 1.2);
    });

    const mx = store.mouse.x * (store.reducedMotion ? 0.1 : 0.45);
    const my = store.mouse.y * (store.reducedMotion ? 0.1 : 0.3);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, mx, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, my, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, narrow ? 10.5 : 8.2, 3, dt);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <color attach="background" args={["#eeebe4"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <directionalLight position={[-6, 2, -3]} intensity={0.5} color="#99f6e4" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#e9e6df"]} />
        <Lightformer form="rect" intensity={4} position={[0, 5, -6]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[6, 1, 1]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="ring" color="#2dd4bf" intensity={2} position={[3, 3, 5]} scale={2.5} />
        <Lightformer form="rect" color="#ffffff" intensity={1} position={[0, -4, 3]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      </Environment>

      {chapters.map((c, k) => (
        <group
          key={k}
          ref={(el) => {
            groups.current[k] = el;
          }}
          visible={k === 0}
        >
          {c}
        </group>
      ))}

    </>
  );
}

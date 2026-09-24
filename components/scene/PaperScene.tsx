"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";

/*
 * Paper / Editorial theme: 3D "ink drawings" on warm paper. Everything is
 * made of thin lines (like a pen sketch) with a single terracotta accent.
 * One drawing per chapter, scaled in/out as you scroll:
 *   globe → orbit rings → layered network → paper planes → contour-map
 *   terrain → six ink circles → globe
 */

const INK = "#1f1a17";
const ACCENT = "#c2410c";

const OFFSETS: [number, number, number][] = [
  [2.5, 0, 0], // intro
  [-2.4, 0, 0], // about
  [2.2, 0, 0], // experience
  [0, -0.2, -1.5], // projects
  [2.1, -0.3, 0], // research
  [-2.6, 0, 0], // skills
  [0, 0.2, 0], // contact
];

function useInk() {
  return useMemo(
    () => ({
      ink: new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }),
      faint: new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.22 }),
      accent: new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 }),
      dot: new THREE.MeshBasicMaterial({ color: INK }),
      dotAccent: new THREE.MeshBasicMaterial({ color: ACCENT }),
    }),
    []
  );
}
type Ink = ReturnType<typeof useInk>;

const circle = (r: number, n = 128, y = 0) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });

function lineGeo(points: THREE.Vector3[]) {
  return new THREE.BufferGeometry().setFromPoints(points);
}


/** A THREE.Line as a primitive (the JSX <line> tag collides with SVG's <line>). */
function InkLine({
  geometry,
  material,
  ...rest
}: { geometry: THREE.BufferGeometry; material: THREE.Material } & Omit<
  React.ComponentProps<"primitive">,
  "object"
>) {
  const obj = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);
  return <primitive object={obj} {...rest} />;
}

// ---------- drawings ----------
function Globe({ ink }: { ink: Ink }) {
  const ref = useRef<THREE.Group>(null);
  const geos = useMemo(() => {
    const R = 1.7;
    const lat = [-60, -40, -20, 0, 20, 40, 60].map((d) => {
      const phi = (d * Math.PI) / 180;
      return lineGeo(circle(R * Math.cos(phi), 128, R * Math.sin(phi)));
    });
    const lon = Array.from({ length: 12 }, (_, i) => {
      const th = (i / 12) * Math.PI;
      const pts = Array.from({ length: 129 }, (_, k) => {
        const a = (k / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * Math.cos(th) * R, Math.sin(a) * R, Math.cos(a) * Math.sin(th) * R);
      });
      return lineGeo(pts);
    });
    const equator = lineGeo(circle(R * 1.001));
    const orbit = lineGeo(circle(R * 1.45));
    return { lat, lon, equator, orbit };
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += Math.min(dt, 0.05) * 0.12 * (store.reducedMotion ? 0.2 : 1);
  });
  return (
    <group rotation={[0.35, 0, 0.18]}>
      <group ref={ref}>
        {geos.lat.map((g, i) => (
          <InkLine key={`a${i}`} geometry={g} material={ink.ink} />
        ))}
        {geos.lon.map((g, i) => (
          <InkLine key={`o${i}`} geometry={g} material={ink.faint} />
        ))}
        <InkLine geometry={geos.equator} material={ink.accent} />
      </group>
      <group rotation={[0.9, 0, 0.3]}>
        <InkLine geometry={geos.orbit} material={ink.faint} />
        <mesh material={ink.dotAccent} position={[1.7 * 1.45, 0, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
        </mesh>
      </group>
    </group>
  );
}

function Rings({ ink }: { ink: Ink }) {
  const ref = useRef<THREE.Group>(null);
  const geos = useMemo(() => [0.7, 1.05, 1.4, 1.75].map((r) => lineGeo(circle(r))), []);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    ref.current.children.forEach((c, i) => {
      c.rotation.x = 1.1 + Math.sin(t * 0.3 + i) * 0.25;
      c.rotation.z = t * (0.08 + i * 0.03) * (i % 2 ? -1 : 1);
    });
  });
  return (
    <group ref={ref}>
      {geos.map((g, i) => (
        <InkLine key={i} geometry={g} material={i === 1 ? ink.accent : ink.ink} />
      ))}
    </group>
  );
}

const LAYERS = [3, 5, 5, 2];
function Network({ ink }: { ink: Ink }) {
  const dots = useRef<THREE.Mesh[]>([]);
  const { nodes, edges, frames } = useMemo(() => {
    const nodes: THREE.Vector3[][] = LAYERS.map((n, l) =>
      Array.from({ length: n }, (_, i) => new THREE.Vector3(-1.8 + l * 1.2, (i - (n - 1) / 2) * 0.55, 0))
    );
    const pts: THREE.Vector3[] = [];
    for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) pts.push(a, b);
    const edges = new THREE.BufferGeometry().setFromPoints(pts);
    const frames = nodes.map((layer) => {
      const x = layer[0].x;
      const h = layer.length * 0.55 / 2 + 0.25;
      return lineGeo([
        new THREE.Vector3(x - 0.22, -h, 0),
        new THREE.Vector3(x + 0.22, -h, 0),
        new THREE.Vector3(x + 0.22, h, 0),
        new THREE.Vector3(x - 0.22, h, 0),
        new THREE.Vector3(x - 0.22, -h, 0),
      ]);
    });
    return { nodes, edges, frames };
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    dots.current.forEach((d) => {
      if (!d) return;
      const pulse = Math.max(0, Math.sin(t * 2 - d.userData.layer * 1.1));
      d.scale.setScalar(1 + pulse * 0.6);
      d.material = pulse > 0.6 ? d.userData.accent : d.userData.base;
    });
  });
  let k = 0;
  return (
    <group rotation={[0.1, -0.45, 0]}>
      <lineSegments geometry={edges} material={ink.faint} />
      {frames.map((g, i) => (
        <InkLine key={i} geometry={g} material={ink.ink} />
      ))}
      {nodes.map((layer, l) =>
        layer.map((p) => {
          const i = k++;
          return (
            <mesh
              key={i}
              ref={(el) => {
                if (el) dots.current[i] = el;
              }}
              position={p}
              material={ink.dot}
              userData={{ layer: l, base: ink.dot, accent: ink.dotAccent }}
            >
              <sphereGeometry args={[0.06, 16, 16]} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// Paper planes gliding in a loose formation (projects "taking off").
function Planes({ ink }: { ink: Ink }) {
  const ref = useRef<THREE.Group>(null);
  const plane = useMemo(() => {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // folded paper-plane outline: two wings + keel
    const pts = [
      v(0, 0, 0.6), v(-0.45, 0.02, -0.4), v(0, 0, -0.25), v(0.45, 0.02, -0.4), v(0, 0, 0.6),
      v(0, -0.14, -0.3), v(0, 0, -0.25),
    ];
    return lineGeo(pts);
  }, []);
  const layout = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: (i - 3) * 1.25,
        y: Math.sin(i * 1.7) * 0.9,
        z: Math.cos(i * 2.1) * 1.2,
        s: 0.7 + ((i * 37) % 10) / 20,
        accent: i === 3,
      })),
    []
  );
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    ref.current.children.forEach((c, i) => {
      const l = layout[i];
      c.position.set(l.x + Math.sin(t * 0.4 + i) * 0.2, l.y + Math.sin(t * 0.8 + i * 2) * 0.15, l.z);
      c.rotation.set(0.15 + Math.sin(t * 0.8 + i) * 0.1, -Math.PI / 2 + 0.35, Math.sin(t * 0.6 + i) * 0.2);
    });
  });
  return (
    <group ref={ref}>
      {layout.map((l, i) => (
        <InkLine key={i} geometry={plane} material={l.accent ? ink.accent : ink.ink} scale={l.s} />
      ))}
    </group>
  );
}

// Topographic contour lines of a smooth height field (the "terrain" chapter).
function Contours({ ink }: { ink: Ink }) {
  const ref = useRef<THREE.Group>(null);
  const geos = useMemo(() => {
    const h = (x: number, z: number) =>
      Math.exp(-((x - 0.8) ** 2 + (z + 0.3) ** 2) / 1.2) * 1.2 +
      Math.exp(-((x + 1.1) ** 2 + (z - 0.6) ** 2) / 0.7) * 0.8 +
      Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.15;
    const out: { geo: THREE.BufferGeometry; accent: boolean }[] = [];
    const N = 90;
    const size = 4.4;
    // marching squares per iso level
    const levels = Array.from({ length: 11 }, (_, i) => 0.05 + i * 0.12);
    for (const [li, lv] of levels.entries()) {
      const seg: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x0 = -size / 2 + (i / N) * size;
          const z0 = -size / 2 + (j / N) * size;
          const d = size / N;
          const c = [h(x0, z0), h(x0 + d, z0), h(x0 + d, z0 + d), h(x0, z0 + d)];
          const p = [
            [x0, z0],
            [x0 + d, z0],
            [x0 + d, z0 + d],
            [x0, z0 + d],
          ];
          const hits: THREE.Vector3[] = [];
          for (let e = 0; e < 4; e++) {
            const a = c[e];
            const b = c[(e + 1) % 4];
            if ((a - lv) * (b - lv) < 0) {
              const t = (lv - a) / (b - a);
              const [ax, az] = p[e];
              const [bx, bz] = p[(e + 1) % 4];
              hits.push(new THREE.Vector3(ax + (bx - ax) * t, lv * 0.9, az + (bz - az) * t));
            }
          }
          if (hits.length >= 2) seg.push(hits[0], hits[1]);
          if (hits.length === 4) seg.push(hits[2], hits[3]);
        }
      }
      out.push({ geo: new THREE.BufferGeometry().setFromPoints(seg), accent: li === 6 });
    }
    // frame of the map sheet
    const s = size / 2;
    const frame = lineGeo([
      new THREE.Vector3(-s, 0, -s),
      new THREE.Vector3(s, 0, -s),
      new THREE.Vector3(s, 0, s),
      new THREE.Vector3(-s, 0, s),
      new THREE.Vector3(-s, 0, -s),
    ]);
    return { levels: out, frame };
  }, []);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = -0.6 + Math.sin(state.clock.elapsedTime * 0.15) * 0.15;
  });
  return (
    <group rotation={[0.55, 0, 0]} position={[0, -0.6, 0]}>
      <group ref={ref}>
        <InkLine geometry={geos.frame} material={ink.faint} />
        {geos.levels.map((l, i) => (
          <lineSegments key={i} geometry={l.geo} material={l.accent ? ink.accent : ink.ink} />
        ))}
      </group>
    </group>
  );
}

function InkCircles({ ink }: { ink: Ink }) {
  const items = useRef<THREE.Group[]>([]);
  const ring = useMemo(() => lineGeo(circle(0.42, 96)), []);
  const fills = useMemo(
    () => Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })),
    []
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    items.current.forEach((g, i) => {
      if (!g) return;
      const on = store.hoverCluster === i ? 1 : 0;
      fills[i].opacity = THREE.MathUtils.lerp(fills[i].opacity, on * 0.9, 0.15);
      const s = THREE.MathUtils.lerp(g.scale.x, 1 + on * 0.3, 0.15);
      g.scale.setScalar(s);
      g.position.y = g.userData.y + Math.sin(t * 0.8 + i) * 0.06;
    });
  });
  return (
    <group>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * 1.7;
        const y = Math.sin(a) * 1.45;
        return (
          <group
            key={i}
            ref={(el) => {
              if (el) items.current[i] = el;
            }}
            position={[x, y, 0]}
            userData={{ y }}
          >
            <InkLine geometry={ring} material={ink.ink} rotation={[Math.PI / 2, 0, 0]} />
            <InkLine geometry={ring} material={ink.faint} rotation={[Math.PI / 2, 0, 0]} scale={1.25} />
            <mesh material={fills[i]}>
              <circleGeometry args={[0.36, 48]} />
            </mesh>
            <mesh material={ink.dot}>
              <circleGeometry args={[0.05, 24]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------- scene ----------
export default function PaperScene() {
  const ink = useInk();
  const groups = useRef<(THREE.Group | null)[]>([]);
  const { camera, size } = useThree();

  const chapters = [
    <Globe key="p0" ink={ink} />,
    <Rings key="p1" ink={ink} />,
    <Network key="p2" ink={ink} />,
    <Planes key="p3" ink={ink} />,
    <Contours key="p4" ink={ink} />,
    <InkCircles key="p5" ink={ink} />,
    <Globe key="p6" ink={ink} />,
  ];

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = store.chapter;
    const narrow = store.isMobile || size.width < 900;
    groups.current.forEach((g, k) => {
      if (!g) return;
      const w = Math.min(Math.max(1 - Math.abs(s - k), 0), 1);
      const e = w * w * (3 - 2 * w);
      g.visible = e > 0.01;
      g.scale.setScalar(Math.max(e, 0.0001) * (narrow ? 0.72 : 1));
      const [ox, oy, oz] = OFFSETS[k];
      g.position.set(narrow ? 0 : ox, oy - (1 - e) * 0.6, oz);
      g.rotation.z = (1 - e) * (s > k ? 0.4 : -0.4);
    });
    const mx = store.mouse.x * (store.reducedMotion ? 0.05 : 0.35);
    const my = store.mouse.y * (store.reducedMotion ? 0.05 : 0.25);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, mx, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, my, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, narrow ? 10.5 : 8.2, 5, dt);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <color attach="background" args={["#f3ede1"]} />
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

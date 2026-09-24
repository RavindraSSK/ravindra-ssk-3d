"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";
import { noiseGLSL } from "./shaders";

/*
 * Orbital theme: a procedural Earth (no texture downloads) with oceans,
 * continents, night-side city lights, clouds and an atmosphere glow,
 * circled by six satellites. Scrolling flies the camera from deep space
 * down to the surface (Research = satellite imagery) and back out.
 */

type Key = {
  offset: [number, number, number]; // where the planet sits (beside the text)
  cam: [number, number, number];
};

const KEYS: Key[] = [
  { offset: [2.3, 0, 0], cam: [0, 0.5, 7.6] }, // intro
  { offset: [-2.4, 0, 0], cam: [0, 1.1, 6.6] }, // about
  { offset: [2.2, -0.2, 0], cam: [0, 2.8, 6.6] }, // experience: from above, orbits visible
  { offset: [0, -3.0, -1], cam: [0, 0.6, 8.0] }, // projects: planet rises as a horizon
  { offset: [1.2, -2.35, 0], cam: [0, 0.1, 4.0] }, // research: skim the surface
  { offset: [-2.4, 0, 0], cam: [0, 0.8, 7.2] }, // skills: six satellites
  { offset: [0, 0, 0], cam: [0, 0.3, 8.6] }, // contact
];

const R = 1.6; // planet radius
const SUN = new THREE.Vector3(1, 0.3, 0.3).normalize(); // side-lit: shows the night side + city lights

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// ---------- planet ----------
const planetVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec2 vUv;
void main(){
  vObj = normalize(position);
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const planetFragment = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
varying vec3 vObj;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec2 vUv;
${noiseGLSL}
float fbm(vec3 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ s += a * snoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main(){
  vec3 p = vObj;
  float h = fbm(p * 1.7 + vec3(3.1, 1.7, 0.4));
  float land = smoothstep(0.02, 0.07, h);
  float mountain = smoothstep(0.28, 0.5, h);
  float ice = smoothstep(0.8, 0.92, abs(p.y));

  vec3 deep = vec3(0.02, 0.07, 0.16);
  vec3 shallow = vec3(0.04, 0.2, 0.33);
  vec3 ocean = mix(deep, shallow, smoothstep(-0.25, 0.04, h));
  vec3 lowland = vec3(0.09, 0.2, 0.14);
  vec3 highland = vec3(0.42, 0.33, 0.2);
  vec3 ground = mix(lowland, highland, mountain);
  vec3 col = mix(ocean, ground, land);
  col = mix(col, vec3(0.85, 0.9, 0.95), ice);

  vec3 N = normalize(vWorldNormal);
  float diff = dot(N, uSun);
  float day = smoothstep(-0.15, 0.35, diff);
  vec3 lit = col * (0.06 + 1.15 * max(diff, 0.0));

  // ocean glint
  vec3 H = normalize(uSun + vViewDir);
  float spec = pow(max(dot(N, H), 0.0), 60.0) * (1.0 - land) * 0.8;
  lit += vec3(1.0, 0.85, 0.6) * spec * day;

  // city lights on the night side (amber)
  float cities = smoothstep(0.55, 0.75, snoise(p * 38.0)) * smoothstep(0.35, 0.6, snoise(p * 6.0 + 4.0));
  cities *= land * (1.0 - mountain) * (1.0 - ice);
  lit += vec3(1.0, 0.62, 0.18) * cities * (1.0 - day) * 1.6;

  // faint graticule (lat/long grid), strongest on the night side
  float gx = abs(fract(vUv.x * 24.0) - 0.5);
  float gy = abs(fract(vUv.y * 12.0) - 0.5);
  float grid = (1.0 - smoothstep(0.0, 0.02, min(gx, gy)));
  lit += vec3(0.96, 0.65, 0.14) * grid * 0.05 * (0.4 + (1.0 - day));

  // rim / atmosphere tint on the lit limb
  float fres = pow(1.0 - max(dot(N, vViewDir), 0.0), 3.0);
  lit += vec3(0.3, 0.6, 1.0) * fres * (0.2 + 0.8 * day) * 0.45;

  gl_FragColor = vec4(lit, 1.0);
}
`;

const cloudFragment = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
varying vec3 vObj;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec2 vUv;
${noiseGLSL}
void main(){
  vec3 p = vObj * 2.6 + vec3(uTime * 0.02, 0.0, 0.0);
  float c = snoise(p) * 0.6 + snoise(p * 2.3) * 0.3 + snoise(p * 5.1) * 0.1;
  float a = smoothstep(0.15, 0.55, c) * 0.55;
  float diff = max(dot(normalize(vWorldNormal), uSun), 0.0);
  vec3 col = vec3(1.0) * (0.08 + diff);
  gl_FragColor = vec4(col, a * (0.15 + 0.85 * smoothstep(-0.1, 0.3, diff)));
}
`;

const atmoVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vWorldNormal;
void main(){
  vN = normalize(normalMatrix * normal);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const atmoFragment = /* glsl */ `
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vWorldNormal;
void main(){
  float i = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0);
  float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(normalize(vWorldNormal), uSun));
  gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * i * 1.25 * lit, clamp(i * 1.25, 0.0, 1.0));
}
`;

function Planet() {
  const planet = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const mats = useMemo(() => {
    const planet = new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
    });
    const clouds = new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: cloudFragment,
      uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    const atmo = new THREE.ShaderMaterial({
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      uniforms: { uSun: { value: SUN } },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { planet, clouds, atmo };
  }, []);

  useFrame((state, delta) => {
    const k = store.reducedMotion ? 0.2 : 1;
    const dt = Math.min(delta, 0.05);
    if (planet.current) planet.current.rotation.y += dt * 0.05 * k;
    if (clouds.current) clouds.current.rotation.y += dt * 0.065 * k;
    mats.clouds.uniforms.uTime.value = state.clock.elapsedTime * k;
  });

  return (
    <group rotation={[0.41, 0, 0.12]}>
      <mesh ref={planet} material={mats.planet}>
        <sphereGeometry args={[R, 128, 96]} />
      </mesh>
      <mesh ref={clouds} material={mats.clouds}>
        <sphereGeometry args={[R * 1.012, 96, 72]} />
      </mesh>
      <mesh material={mats.atmo} scale={1.1}>
        <sphereGeometry args={[R, 64, 48]} />
      </mesh>
    </group>
  );
}

// ---------- satellites ----------
const ORBITS = [
  { r: 2.35, tilt: [0.25, 0, 0.35], speed: 0.22 },
  { r: 2.8, tilt: [-0.5, 0, -0.2], speed: 0.16 },
  { r: 3.25, tilt: [1.05, 0, 0.1], speed: 0.12 },
] as const;

function Satellites() {
  const sats = useRef<THREE.Group[]>([]);
  const rings = useRef<THREE.LineLoop[]>([]);
  const beam = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const { body, panel, glow, ringGeo, ringMats, beamMat } = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    });
    return {
      body: new THREE.MeshStandardMaterial({ color: "#d9dde4", metalness: 0.8, roughness: 0.3 }),
      panel: new THREE.MeshStandardMaterial({
        color: "#1e3a8a",
        metalness: 0.6,
        roughness: 0.35,
        emissive: new THREE.Color("#f5a524"),
        emissiveIntensity: 0.05,
      }),
      glow: new THREE.MeshBasicMaterial({ color: "#f5a524", transparent: true, opacity: 0.9 }),
      ringGeo: new THREE.BufferGeometry().setFromPoints(pts),
      ringMats: ORBITS.map(
        () => new THREE.LineBasicMaterial({ color: "#f5a524", transparent: true, opacity: 0.18 })
      ),
      beamMat: new THREE.MeshBasicMaterial({
        color: "#fbbf24",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    sats.current.forEach((s, i) => {
      if (!s) return;
      const o = ORBITS[i % 3];
      const a = t * o.speed + (i < 3 ? 0 : Math.PI) + i * 0.7;
      s.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
      s.rotation.y = -a;
      const on = store.hoverCluster === i ? 1 : 0;
      const sc = THREE.MathUtils.lerp(s.scale.x, 1 + on * 1.4, 0.15);
      s.scale.setScalar(sc);
    });
    rings.current.forEach((r, i) => {
      if (!r) return;
      const hovered = store.hoverCluster >= 0 && store.hoverCluster % 3 === i;
      ringMats[i].opacity = THREE.MathUtils.lerp(ringMats[i].opacity, hovered ? 0.55 : 0.18, 0.12);
    });

    // Research chapter: satellite 0 "images" the surface with a scan beam
    const s0 = sats.current[0];
    if (beam.current && s0) {
      const w = Math.max(0, 1 - Math.abs(store.chapter - 4));
      beamMat.opacity = w * 0.22;
      s0.getWorldPosition(tmp);
      beam.current.parent?.worldToLocal(tmp);
      const len = tmp.length() - R;
      beam.current.position.copy(tmp).multiplyScalar(1 - len / 2 / tmp.length());
      beam.current.scale.set(1, len, 1);
      beam.current.lookAt(0, 0, 0);
      beam.current.rotateX(-Math.PI / 2); // narrow end at the satellite, wide on the ground
      beam.current.visible = w > 0.01;
    }
  });

  return (
    <group>
      {ORBITS.map((o, i) => (
        <group key={i} rotation={o.tilt as unknown as [number, number, number]}>
          <lineLoop
            ref={(el) => {
              if (el) rings.current[i] = el;
            }}
            geometry={ringGeo}
            material={ringMats[i]}
            scale={o.r}
          />
          {[i, i + 3].map((si) => (
            <group
              key={si}
              ref={(el) => {
                if (el) sats.current[si] = el;
              }}
            >
              <mesh material={body}>
                <boxGeometry args={[0.07, 0.07, 0.1]} />
              </mesh>
              <mesh material={panel} position={[0.13, 0, 0]}>
                <boxGeometry args={[0.16, 0.005, 0.07]} />
              </mesh>
              <mesh material={panel} position={[-0.13, 0, 0]}>
                <boxGeometry args={[0.16, 0.005, 0.07]} />
              </mesh>
              <mesh material={glow} position={[0, 0.05, 0]}>
                <sphereGeometry args={[0.014, 8, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh ref={beam} material={beamMat} visible={false}>
        <cylinderGeometry args={[0.01, 0.28, 1, 32, 1, true]} />
      </mesh>
    </group>
  );
}

function Stars({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const r = 20 + rand() * 25;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
      const warm = rand() < 0.2;
      col.set(warm ? [1, 0.8, 0.55] : [0.75, 0.85, 1], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.07} vertexColors transparent opacity={0.85} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ---------- scene ----------
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();

export default function OrbitalScene() {
  const world = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = Math.min(Math.max(store.chapter, 0), KEYS.length - 1);
    const base = Math.min(Math.floor(s), KEYS.length - 1);
    const next = Math.min(base + 1, KEYS.length - 1);
    const f = smooth(0, 1, s - base);
    const A = KEYS[base];
    const B = KEYS[next];
    const narrow = size.width < 900;

    tA.set(...A.cam).lerp(tB.set(...B.cam), f);
    if (narrow) tA.z += 2.6;
    const px = store.mouse.x * (store.reducedMotion ? 0.05 : 0.3);
    const py = store.mouse.y * (store.reducedMotion ? 0.05 : 0.2);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tA.x + px, 6, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, tA.y + py, 6, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tA.z, 6, dt);
    camera.lookAt(0, 0, 0);

    if (world.current) {
      tA.set(...A.offset).lerp(tB.set(...B.offset), f);
      if (narrow) tA.x = 0;
      world.current.position.lerp(tA, 1 - Math.exp(-6 * dt));
    }
  });

  return (
    <>
      <color attach="background" args={["#050914"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[SUN.x * 10, SUN.y * 10, SUN.z * 10]} intensity={2.2} color="#fff4e0" />
      <Stars count={store.isMobile ? 900 : 2200} />
      <group ref={world}>
        <Planet />
        <Satellites />
      </group>
    </>
  );
}

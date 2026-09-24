"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { emit, store } from "@/lib/store";
import { buildShapes, networkEdges, sphereSynapses } from "./shapes";
import { lineFragment, lineVertex, particleFragment, particleVertex } from "./shaders";

// One entry per chapter: which formation to show and where the camera sits.
type Key = {
  shape: number;
  cam: [number, number, number];
  look: [number, number, number];
  offset: [number, number, number];
};

const KEYS: Key[] = [
  { shape: 0, cam: [0, 0, 8.2], look: [0, 0, 0], offset: [2.2, 0, 0] }, // intro
  { shape: 0, cam: [0.4, 0.3, 5.2], look: [0, 0, 0], offset: [-2.1, 0, 0] }, // about
  { shape: 1, cam: [0, 0.2, 7.8], look: [0, 0, 0], offset: [1.9, 0, 0] }, // experience
  { shape: 2, cam: [0, 1.4, 7.6], look: [0, -0.2, 0], offset: [0, -0.3, 0] }, // projects
  { shape: 3, cam: [0, 1.7, 6.6], look: [0, -1.0, 0], offset: [1.4, 0, 0] }, // research
  { shape: 4, cam: [0, 0, 8.2], look: [0, 0, 0], offset: [-2.2, 0, 0] }, // skills
  { shape: 0, cam: [0, 0, 9.6], look: [0, 0, 0], offset: [0, 0.2, 0] }, // contact
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const lookCurrent = new THREE.Vector3();
const offsetTarget = new THREE.Vector3();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();

type LineData = { position: Float32Array; aT: Float32Array; aSeed: Float32Array };

function makeLines(data: LineData, color: string) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.position, 3));
  g.setAttribute("aT", new THREE.BufferAttribute(data.aT, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(data.aSeed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  const m = new THREE.ShaderMaterial({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uNoiseAmp: { value: 0.1 },
      uOpacity: { value: 0 },
      uSpin: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  return lines;
}

export default function NeuralField({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();
  const intro = useRef(0);
  const mouseStrength = useRef(0);
  const spin = useRef(0);
  const lastMouse = useRef({ x: 0, y: 0, t: 0 });

  const { geometry, material, sphereLines, netLines } = useMemo(() => {
    const { shapes, aRand, aScale, aCluster } = buildShapes(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(shapes[0], 3));
    g.setAttribute("aP1", new THREE.BufferAttribute(shapes[1], 3));
    g.setAttribute("aP2", new THREE.BufferAttribute(shapes[2], 3));
    g.setAttribute("aP3", new THREE.BufferAttribute(shapes[3], 3));
    g.setAttribute("aP4", new THREE.BufferAttribute(shapes[4], 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
    g.setAttribute("aScale", new THREE.BufferAttribute(aScale, 1));
    g.setAttribute("aCluster", new THREE.BufferAttribute(aCluster, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);

    const m = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uA: { value: 0 },
        uB: { value: 0 },
        uMix: { value: 0 },
        uSize: { value: 58 },
        uPixelRatio: { value: 1 },
        uNoiseAmp: { value: 0.1 },
        uMouse: { value: new THREE.Vector3(99, 99, 99) },
        uMouseStrength: { value: 0 },
        uHoverCluster: { value: -1 },
        uIntro: { value: 0 },
        uSpin: { value: 0 },
      },
    });

    return {
      geometry: g,
      material: m,
      sphereLines: makeLines(sphereSynapses(shapes[0], count > 4000 ? 9 : 5), "#2dd4bf"),
      netLines: makeLines(networkEdges(), "#22d3ee"),
    };
  }, [count]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    const u = material.uniforms;
    const mobile = store.isMobile;
    const motion = store.reducedMotion ? 0.25 : 1;

    // --- chapter → formation + camera
    const s = Math.min(Math.max(store.chapter, 0), KEYS.length - 1);
    const base = Math.min(Math.floor(s), KEYS.length - 1);
    const next = Math.min(base + 1, KEYS.length - 1);
    const f = s - base;
    const morph = smooth(0.1, 0.95, f);
    const travel = smooth(0.0, 1.0, f);
    const A = KEYS[base];
    const B = KEYS[next];

    u.uA.value = A.shape;
    u.uB.value = B.shape;
    u.uMix.value = morph;

    const w = (shape: number) =>
      (A.shape === shape ? 1 - morph : 0) + (B.shape === shape ? morph : 0);
    const w0 = Math.min(w(0), 1);
    const w1 = Math.min(w(1), 1);

    // --- intro gather
    const introTarget = store.ready ? 1 : 0;
    intro.current = THREE.MathUtils.damp(intro.current, introTarget, store.introDone ? 2.2 : 1.1, dt);
    u.uIntro.value = intro.current;

    // --- time, spin, noise
    u.uTime.value = time * motion;
    spin.current += dt * 0.07 * motion;
    u.uSpin.value = spin.current;
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uSize.value = mobile ? 40 : 50;

    // --- camera rig
    tmpA.set(...A.cam).lerp(tmpB.set(...B.cam), travel);
    if (mobile) tmpA.z += 3.2;
    const px = store.mouse.x * 0.35 * motion;
    const py = store.mouse.y * 0.25 * motion;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tmpA.x + px, 6, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, tmpA.y + py, 6, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tmpA.z, 6, dt);
    lookTarget.set(...A.look).lerp(tmpB.set(...B.look), travel);
    lookCurrent.lerp(lookTarget, 1 - Math.exp(-6 * dt));
    camera.lookAt(lookCurrent);

    // --- place formation beside the text (centered on small screens)
    if (group.current) {
      offsetTarget.set(...A.offset).lerp(tmpB.set(...B.offset), travel);
      if (mobile || size.width < 900) offsetTarget.x = 0;
      group.current.position.lerp(offsetTarget, 1 - Math.exp(-6 * dt));
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y,
        Math.sin(time * 0.1) * 0.25 * motion + store.mouse.x * 0.12,
        2,
        dt
      );
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -store.mouse.y * 0.08, 2, dt);
    }

    // --- pointer → local position for repulsion
    const m = store.mouse;
    const moved = m.x !== lastMouse.current.x || m.y !== lastMouse.current.y;
    if (moved) lastMouse.current = { x: m.x, y: m.y, t: time };
    const active = !mobile && time - lastMouse.current.t < 2.5 ? 1 : 0;
    mouseStrength.current = THREE.MathUtils.damp(mouseStrength.current, active, 3, dt);
    u.uMouseStrength.value = mouseStrength.current;
    if (group.current) {
      ndc.set(m.x, m.y);
      raycaster.setFromCamera(ndc, camera);
      plane.constant = -group.current.position.z;
      if (raycaster.ray.intersectPlane(plane, hit)) {
        group.current.worldToLocal(hit);
        (u.uMouse.value as THREE.Vector3).copy(hit);
      }
    }

    // --- skills hover
    u.uHoverCluster.value = store.hoverCluster;

    // --- synapses
    const sl = sphereLines.material as THREE.ShaderMaterial;
    sl.uniforms.uTime.value = time * motion;
    sl.uniforms.uSpin.value = spin.current;
    sl.uniforms.uOpacity.value = Math.pow(w0, 3) * intro.current;
    const nl = netLines.material as THREE.ShaderMaterial;
    nl.uniforms.uTime.value = time * motion;
    nl.uniforms.uOpacity.value = Math.pow(w1, 3) * 1.3;

    if (!store.ready && state.clock.elapsedTime > 0.15) {
      store.ready = true;
      emit();
    }
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <primitive object={sphereLines} />
      <primitive object={netLines} />
    </group>
  );
}

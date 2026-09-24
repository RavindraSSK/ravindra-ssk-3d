"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";
import { Backdrop, ChapterGroups, Poly, Segs, V, lineGeo, lineMat, rng, useChapterRig, type Vec3 } from "./kit";

/*
 * Darkroom theme: photography and video editing under a red safelight.
 *   lens + aperture iris → film strip → contact sheet with grease-pencil picks →
 *   edit timeline (projects) → RGB histogram (research) → six prints developing
 *   in trays (skills) → lens
 * Every "photo" is painted procedurally on a canvas: no image downloads.
 */

const BG = "#0d0909";
const INK = "#f4ece7";
const RED = "#ff4d3d";

const OFFSETS: Vec3[] = [
  [2.5, 0, 0],
  [-2.3, 0, 0],
  [2.3, -0.1, 0],
  [0, -0.1, -1.5],
  [2.3, -0.1, 0],
  [-2.75, -0.1, 0],
  [0, 0, 0],
];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec3 col = vec3(0.045, 0.03, 0.03);
  // safelight glow, top left, drifting a touch with the pointer
  vec2 L = vec2(0.12 + uMouse.x * 0.02, 1.05);
  float d = length((uv - L) * vec2(asp, 1.0));
  col += vec3(0.55, 0.06, 0.04) * exp(-d * 2.2) * 0.55;
  col += vec3(0.25, 0.03, 0.02) * exp(-length((uv - vec2(0.9, -0.1)) * vec2(asp, 1.0)) * 3.0) * 0.4;
  // film grain
  float g = hash(floor(gl_FragCoord.xy / 1.5) + floor(uTime * 24.0));
  col += (g - 0.5) * 0.035;
  float vig = smoothstep(1.2, 0.3, distance(uv, vec2(0.5)));
  col *= 0.6 + 0.4 * vig;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- procedural photographs ----------
type Paint = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: number, seed: number, mono?: boolean) => void;

const paintPhoto: Paint = (ctx, x, y, w, h, kind, seed, mono = false) => {
  const r = rng(seed * 97 + 13);
  const c = (rr: number, gg: number, bb: number, a = 1) => {
    if (mono) {
      const l = Math.round(rr * 0.3 + gg * 0.59 + bb * 0.11);
      return `rgba(${l},${l},${l},${a})`;
    }
    return `rgba(${rr},${gg},${bb},${a})`;
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  const k = kind % 6;
  if (k === 0) {
    // sunset over water
    sky.addColorStop(0, c(58, 36, 92));
    sky.addColorStop(0.5, c(240, 120, 70));
    sky.addColorStop(0.55, c(40, 30, 50));
    sky.addColorStop(1, c(12, 10, 20));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c(255, 214, 150);
    ctx.beginPath();
    ctx.arc(x + w * (0.35 + r() * 0.3), y + h * 0.47, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = c(255, 170, 110, 0.5 - i * 0.04);
      ctx.fillRect(x + w * 0.42 - i * 2, y + h * (0.58 + i * 0.045), w * 0.16 + i * 4, 2);
    }
  } else if (k === 1) {
    // layered mountains
    sky.addColorStop(0, c(120, 150, 180));
    sky.addColorStop(1, c(230, 220, 205));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    for (let l = 0; l < 4; l++) {
      const base = y + h * (0.45 + l * 0.14);
      const shade = 110 - l * 28;
      ctx.fillStyle = c(shade * 0.7, shade * 0.8, shade);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      let yy = base;
      for (let i = 0; i <= 24; i++) {
        yy += (r() - 0.5) * h * 0.12;
        yy = Math.min(Math.max(yy, base - h * 0.2), base + h * 0.08);
        ctx.lineTo(x + (i / 24) * w, yy);
      }
      ctx.lineTo(x + w, y + h);
      ctx.fill();
    }
  } else if (k === 2) {
    // city at dusk
    sky.addColorStop(0, c(20, 24, 60));
    sky.addColorStop(1, c(200, 90, 80));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    let bx = x;
    while (bx < x + w) {
      const bw = w * (0.06 + r() * 0.1);
      const bh = h * (0.25 + r() * 0.5);
      ctx.fillStyle = c(18, 16, 24);
      ctx.fillRect(bx, y + h - bh, bw, bh);
      ctx.fillStyle = c(255, 200, 120, 0.8);
      for (let wy = y + h - bh + 6; wy < y + h - 4; wy += 7) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) if (r() > 0.6) ctx.fillRect(wx, wy, 2, 3);
      bx += bw + 2;
    }
  } else if (k === 3) {
    // lone tree in a field
    sky.addColorStop(0, c(170, 200, 220));
    sky.addColorStop(0.62, c(240, 236, 220));
    sky.addColorStop(0.63, c(120, 140, 70));
    sky.addColorStop(1, c(70, 90, 40));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    const tx = x + w * (0.3 + r() * 0.4);
    ctx.fillStyle = c(40, 34, 28);
    ctx.fillRect(tx - 2, y + h * 0.42, 4, h * 0.22);
    ctx.fillStyle = c(46, 70, 40);
    ctx.beginPath();
    ctx.arc(tx, y + h * 0.38, h * 0.14, 0, Math.PI * 2);
    ctx.arc(tx - h * 0.1, y + h * 0.44, h * 0.09, 0, Math.PI * 2);
    ctx.arc(tx + h * 0.1, y + h * 0.44, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (k === 4) {
    // road to the horizon
    sky.addColorStop(0, c(250, 190, 120));
    sky.addColorStop(0.5, c(250, 230, 200));
    sky.addColorStop(0.51, c(90, 80, 70));
    sky.addColorStop(1, c(50, 45, 40));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c(30, 28, 30);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.49, y + h * 0.5);
    ctx.lineTo(x + w * 0.51, y + h * 0.5);
    ctx.lineTo(x + w * 0.85, y + h);
    ctx.lineTo(x + w * 0.15, y + h);
    ctx.fill();
    ctx.fillStyle = c(240, 220, 160);
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const yy = y + h * (0.52 + t * t * 0.48);
      ctx.fillRect(x + w * 0.5 - 1 - t * 2, yy, 2 + t * 4, 2 + t * 8);
    }
  } else {
    // night sky and moon
    sky.addColorStop(0, c(8, 10, 26));
    sky.addColorStop(1, c(40, 40, 80));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c(255, 255, 255, 0.8);
    for (let i = 0; i < 60; i++) ctx.fillRect(x + r() * w, y + r() * h * 0.8, 1, 1);
    ctx.fillStyle = c(245, 240, 220);
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + h * 0.3, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c(10, 10, 16);
    ctx.fillRect(x, y + h * 0.82, w, h * 0.2);
  }
  ctx.restore();
};

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  draw(ctx);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function useMats() {
  return useMemo(
    () => ({
      line: lineMat(INK, 0.8),
      faint: lineMat(INK, 0.22),
      red: lineMat(RED, 0.95),
      metal: new THREE.MeshStandardMaterial({ color: "#2e2828", roughness: 0.32, metalness: 0.45 }),
      metalDark: new THREE.MeshStandardMaterial({ color: "#0f0d0d", roughness: 0.5, metalness: 0.4 }),
    }),
    []
  );
}
type Mats = ReturnType<typeof useMats>;

// ---------- 0 / 6: lens with a nine-blade iris ----------
const BLADES = 9;
function Lens({ m }: { m: Mats }) {
  const iris = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const R = 1.05;
  const blade = useMemo(() => {
    // plate beyond one edge of the opening polygon, skewed into a pinwheel
    const s = new THREE.Shape();
    s.moveTo(-R * 0.35, 0);
    s.lineTo(R * 1.35, 0);
    s.quadraticCurveTo(R * 1.5, R * 0.8, R * 0.9, R * 1.5);
    s.lineTo(-R * 0.6, R * 1.3);
    s.lineTo(-R * 0.35, 0);
    return new THREE.ShapeGeometry(s, 12);
  }, []);
  // blades are clipped to the barrel radius in iris space (uLocal = blade's matrix inside the iris)
  const bladeMats = useMemo(
    () =>
      Array.from(
        { length: BLADES },
        (_, i) =>
          new THREE.ShaderMaterial({
            uniforms: {
              uLocal: { value: new THREE.Matrix4() },
              uR: { value: R + 0.02 },
              uColor: { value: new THREE.Color().setHSL(0.02, 0.08, 0.13 + (i % 3) * 0.025) },
              uEdge: { value: new THREE.Color(RED) },
            },
            vertexShader: /* glsl */ `
              uniform mat4 uLocal; varying vec2 vBlade; varying vec2 vIris;
              void main(){
                vBlade = position.xy;
                vIris = (uLocal * vec4(position, 1.0)).xy;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }`,
            fragmentShader: /* glsl */ `
              uniform float uR; uniform vec3 uColor; uniform vec3 uEdge;
              varying vec2 vBlade; varying vec2 vIris;
              void main(){
                if (length(vIris) > uR) discard;
                vec3 col = uColor * (0.75 + vBlade.y * 0.45);
                col += uEdge * smoothstep(0.03, 0.0, vBlade.y) * 0.35;
                col += vec3(0.9, 0.85, 0.8) * smoothstep(0.012, 0.0, abs(vBlade.y - 0.015)) * 0.08;
                gl_FragColor = vec4(col, 1.0);
              }`,
          })
      ),
    []
  );
  const ticks = useMemo(() => {
    const s = new Segs();
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const l = i % 10 === 0 ? 0.12 : i % 5 === 0 ? 0.08 : 0.045;
      s.seg(V(Math.cos(a) * (R + 0.42), Math.sin(a) * (R + 0.42), 0), V(Math.cos(a) * (R + 0.42 - l), Math.sin(a) * (R + 0.42 - l), 0));
    }
    // knurled grip ridges around the barrel
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      s.seg(V(Math.cos(a) * (R + 0.62), Math.sin(a) * (R + 0.62), -0.35), V(Math.cos(a) * (R + 0.62), Math.sin(a) * (R + 0.62), -0.75));
    }
    return s.geo();
  }, []);
  const rims = useMemo(
    () => [R + 0.62, R + 0.02].map((rr) => lineGeo(Array.from({ length: 129 }, (_, i) => V(Math.cos((i / 128) * Math.PI * 2) * rr, Math.sin((i / 128) * Math.PI * 2) * rr, 0)))),
    []
  );
  const reflections = useMemo(
    () =>
      [
        { r: 0.55, c: RED, z: 0.25, o: 0.6 },
        { r: 0.32, c: "#9b8cff", z: 0.32, o: 0.45 },
        { r: 0.8, c: "#ffb36b", z: 0.18, o: 0.3 },
      ].map((d) => ({ ...d, geo: lineGeo(Array.from({ length: 97 }, (_, i) => V(Math.cos((i / 96) * Math.PI * 2) * d.r, Math.sin((i / 96) * Math.PI * 2) * d.r, 0))) })),
    []
  );
  const reflMats = useMemo(
    () => reflections.map((d) => new THREE.LineBasicMaterial({ color: d.c, transparent: true, opacity: d.o, blending: THREE.AdditiveBlending, depthWrite: false })),
    [reflections]
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    // f-stop "breathes"; the pointer opens it a little
    const open = 0.22 + 0.34 * (0.5 + 0.5 * Math.sin(t * 0.55)) + (store.mouse.x + 1) * 0.05;
    if (iris.current) {
      iris.current.rotation.z = open * 0.9;
      iris.current.children.forEach((b, i) => {
        const a = (i / BLADES) * Math.PI * 2;
        const n = V(Math.cos(a), Math.sin(a), 0);
        b.position.set(n.x * open * R, n.y * open * R, i * 0.004);
        b.rotation.z = a - Math.PI / 2;
        b.updateMatrix();
        bladeMats[i].uniforms.uLocal.value.copy(b.matrix);
      });
    }
    if (tilt.current) {
      const dt = Math.min(delta, 0.05);
      tilt.current.rotation.y = THREE.MathUtils.damp(tilt.current.rotation.y, -0.45 + store.mouse.x * 0.25, 3, dt);
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, 0.15 - store.mouse.y * 0.2, 3, dt);
    }
  });

  return (
    <group ref={tilt}>
      {/* barrel */}
      <mesh material={m.metal} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.55]}>
        <cylinderGeometry args={[R + 0.62, R + 0.55, 1.1, 96, 1, true]} />
      </mesh>
      <mesh material={m.metal} position={[0, 0, 0.05]}>
        <ringGeometry args={[R, R + 0.62, 96]} />
      </mesh>
      <mesh material={m.metalDark} position={[0, 0, -0.9]}>
        <circleGeometry args={[R + 0.1, 64]} />
      </mesh>
      <lineSegments geometry={ticks} material={m.faint} position={[0, 0, 0.06]} />
      <Poly geometry={rims[0]} material={m.faint} position={[0, 0, 0.06]} />
      <Poly geometry={rims[1]} material={m.red} position={[0, 0, 0.061]} />
      <mesh position={[Math.cos(1.2) * (R + 0.5), Math.sin(1.2) * (R + 0.5), 0.07]}>
        <circleGeometry args={[0.035, 16]} />
        <meshBasicMaterial color={RED} />
      </mesh>
      {/* iris: clipped visually by the front ring */}
      <group ref={iris} position={[0, 0, -0.12]}>
        {Array.from({ length: BLADES }).map((_, i) => (
          <mesh key={i} geometry={blade} material={bladeMats[i]} />
        ))}
      </group>
      {/* coating reflections floating in the glass */}
      {reflections.map((d, i) => (
        <Poly key={i} geometry={d.geo} material={reflMats[i]} position={[0.08 * (i - 1), 0.12 * (1 - i), d.z]} />
      ))}
    </group>
  );
}

// ---------- 1: film strip ----------
const FRAMES = 8;
function FilmStrip() {
  const { geo, mat } = useMemo(() => {
    const tex = canvasTex(256 * FRAMES, 190, (ctx) => {
      ctx.fillStyle = "#15100e";
      ctx.fillRect(0, 0, 256 * FRAMES, 190);
      for (let f = 0; f < FRAMES; f++) {
        const x = f * 256;
        paintPhoto(ctx, x + 14, 32, 228, 126, f, f + 3);
        ctx.fillStyle = "#e9d9c8";
        for (let h = 0; h < 8; h++) {
          ctx.fillRect(x + 8 + h * 31, 8, 16, 14);
          ctx.fillRect(x + 8 + h * 31, 168, 16, 14);
        }
        ctx.fillStyle = "#ff8a5a";
        ctx.font = "10px monospace";
        ctx.fillText(`${f * 2 + 12}`, x + 20, 30);
        ctx.fillText(`${f * 2 + 12}A`, x + 120, 166);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    const curve = new THREE.CatmullRomCurve3([V(-3.2, -1.2, -0.6), V(-1.4, -0.2, 0.6), V(0.3, 0.5, -0.2), V(1.8, 1.0, 0.4), V(3.1, 1.6, -0.8)]);
    const N = 200;
    const width = 0.72;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const len = curve.getLength();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      // twist the ribbon slowly along its length
      const up = V(0, 1, 0).applyAxisAngle(tan, Math.sin(t * Math.PI * 1.5) * 0.7);
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();
      const n = new THREE.Vector3().crossVectors(side, tan).normalize();
      const a = p.clone().addScaledVector(n, width / 2);
      const b = p.clone().addScaledVector(n, -width / 2);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const u = (t * len) / (width * (256 / 190)) / FRAMES;
      uv.push(u, 1, u, 0);
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    return { geo, mat };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.1 : 1);
    if (mat.map) mat.map.offset.x = -t * 0.04;
  });

  return <mesh geometry={geo} material={mat} rotation={[0.1, -0.2, 0.15]} />;
}

// ---------- 2: contact sheet with grease-pencil marks ----------
function ContactSheet({ m }: { m: Mats }) {
  const circle = useRef<THREE.Line>(null);
  const loupe = useRef<THREE.Group>(null);
  const W = 3.2, H = 2.4;
  const mat = useMemo(() => {
    const tex = canvasTex(1024, 768, (ctx) => {
      ctx.fillStyle = "#efe9e0";
      ctx.fillRect(0, 0, 1024, 768);
      for (let row = 0; row < 4; row++) {
        const y = 40 + row * 180;
        ctx.fillStyle = "#16110f";
        ctx.fillRect(30, y, 964, 160);
        for (let f = 0; f < 4; f++) {
          const x = 44 + f * 238;
          paintPhoto(ctx, x, y + 22, 222, 116, row * 4 + f + 1, row * 7 + f, true);
          ctx.fillStyle = "#b9a898";
          ctx.font = "11px monospace";
          ctx.fillText(`${row * 4 + f + 1}`, x + 4, y + 154);
        }
        ctx.fillStyle = "#3a302a";
        for (let h = 0; h < 40; h++) {
          ctx.fillRect(38 + h * 24, y + 6, 10, 8);
          ctx.fillRect(38 + h * 24, y + 146, 10, 8);
        }
      }
    });
    return new THREE.MeshBasicMaterial({ map: tex });
  }, []);
  // frame 7 (row 1, col 2) gets circled; convert texture px -> plane units
  const toPlane = (px: number, py: number) => V((px / 1024 - 0.5) * W, (0.5 - py / 768) * H, 0.01);
  const marks = useMemo(() => {
    const c = toPlane(44 + 2 * 238 + 111, 40 + 180 + 22 + 58);
    const pts = Array.from({ length: 81 }, (_, i) => {
      const a = (i / 72) * Math.PI * 2 + 0.4;
      const wob = 1 + Math.sin(i * 0.7) * 0.03;
      return V(c.x + Math.cos(a) * 0.46 * wob, c.y + Math.sin(a) * 0.26 * wob, 0.012);
    });
    const x = toPlane(44 + 111, 40 + 3 * 180 + 80);
    const cross = new Segs().seg(V(x.x - 0.15, x.y - 0.1, 0.012), V(x.x + 0.15, x.y + 0.1, 0.012)).seg(V(x.x - 0.15, x.y + 0.1, 0.012), V(x.x + 0.15, x.y - 0.1, 0.012));
    const k = toPlane(44 + 3 * 238 + 180, 40 + 80);
    const tick = new Segs().poly([V(k.x - 0.1, k.y, 0.012), V(k.x - 0.02, k.y - 0.08, 0.012), V(k.x + 0.14, k.y + 0.12, 0.012)]);
    return { circle: lineGeo(pts), cross: cross.geo(), tick: tick.geo() };
  }, []);
  const ring = useMemo(() => lineGeo(Array.from({ length: 65 }, (_, i) => V(Math.cos((i / 64) * Math.PI * 2) * 0.34, Math.sin((i / 64) * Math.PI * 2) * 0.34, 0))), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const k = Math.min(((t * 0.35) % 1.4) / 1, 1);
    circle.current?.geometry.setDrawRange(0, Math.floor(k * 81));
    if (loupe.current) {
      loupe.current.position.x = Math.sin(t * 0.3) * 1.1 + store.mouse.x * 0.3;
      loupe.current.position.y = Math.cos(t * 0.23) * 0.6 + store.mouse.y * 0.2;
    }
  });

  return (
    <group rotation={[-0.35, -0.4, 0.06]}>
      <mesh material={mat}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <Poly ref={circle} geometry={marks.circle} material={m.red} />
      <lineSegments geometry={marks.cross} material={m.red} />
      <Poly geometry={marks.tick} material={m.red} />
      <group ref={loupe} position={[0, 0, 0.45]}>
        <mesh>
          <torusGeometry args={[0.34, 0.04, 16, 64]} />
          <meshStandardMaterial color="#2a2424" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.32, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <Poly geometry={ring} material={m.faint} position={[0, 0, -0.4]} />
      </group>
    </group>
  );
}

// ---------- 3: edit timeline ----------
function Timeline({ m }: { m: Mats }) {
  const head = useRef<THREE.Group>(null);
  const { clips, wave, grid } = useMemo(() => {
    const r = rng(21);
    const palette = ["#3b4a7a", "#5b3f6e", "#2f5b64", "#6e4a3a", "#44506a"];
    const clips: { x: number; y: number; w: number; c: string }[] = [];
    for (let track = 0; track < 3; track++) {
      let x = -3 + r() * 0.3;
      while (x < 2.8) {
        const w = 0.4 + r() * 1.0;
        if (r() > 0.25 || track === 0) clips.push({ x: x + w / 2, y: 0.95 - track * 0.34, w: Math.min(w, 3 - x) - 0.03, c: track === 1 && r() > 0.7 ? RED : palette[Math.floor(r() * palette.length)] });
        x += w + (track === 0 ? 0.02 : r() * 0.5);
      }
    }
    const s = new Segs();
    for (let a = 0; a < 2; a++) {
      const y0 = -0.25 - a * 0.36;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 300; i++) {
        const x = -3 + (i / 300) * 6;
        const env = 0.1 * (0.4 + 0.6 * Math.abs(Math.sin(x * 1.3 + a)));
        pts.push(V(x, y0 + Math.sin(i * 1.7 + a) * env * (0.5 + r() * 0.5), 0));
      }
      s.poly(pts);
    }
    const g = new Segs();
    for (let i = 0; i <= 5; i++) g.seg(V(-3, 1.13 - i * 0.34 - (i > 3 ? 0.04 : 0), 0), V(3, 1.13 - i * 0.34 - (i > 3 ? 0.04 : 0), 0));
    for (let i = 0; i <= 24; i++) g.seg(V(-3 + i * 0.25, 1.35, 0), V(-3 + i * 0.25, i % 4 === 0 ? 1.23 : 1.29, 0));
    return { clips, wave: s.geo(), grid: g.geo() };
  }, []);
  const headGeo = useMemo(() => lineGeo([V(0, 1.4, 0.02), V(0, -1.0, 0.02)]), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    if (head.current) head.current.position.x = -3 + ((t * 0.35) % 1) * 6;
  });

  return (
    <group rotation={[-0.55, 0.2, 0.05]} position={[0, -0.2, 0]}>
      <lineSegments geometry={grid} material={m.faint} />
      {clips.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, 0.04]}>
          <boxGeometry args={[c.w, 0.26, 0.08]} />
          <meshStandardMaterial color={c.c} roughness={0.6} emissive={c.c} emissiveIntensity={0.35} />
        </mesh>
      ))}
      <lineSegments geometry={wave} material={m.line} />
      <group ref={head}>
        <Poly geometry={headGeo} material={m.red} />
        <mesh position={[0, 1.42, 0.02]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.07, 0.12, 3]} />
          <meshBasicMaterial color={RED} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- 4: RGB histogram ----------
const histFragment = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uSeed;
varying vec2 vUv;
float g(float x, float m, float s){ return exp(-(x - m) * (x - m) / (2.0 * s * s)); }
void main(){
  float x = vUv.x;
  float t = uTime * 0.35 + uSeed;
  float h = 0.55 * g(x, 0.3 + 0.08 * sin(t), 0.1) + 0.8 * g(x, 0.62 + 0.06 * sin(t * 1.3 + 1.0), 0.07) + 0.35 * g(x, 0.85 + 0.03 * sin(t * 0.7), 0.05);
  h += 0.04 * sin(x * 90.0 + uSeed * 10.0) * h;
  float a = step(vUv.y, h) * 0.55 + smoothstep(0.012, 0.0, abs(vUv.y - h)) * 0.6;
  gl_FragColor = vec4(uColor, a);
}`;
function Histogram({ m }: { m: Mats }) {
  const mats = useMemo(
    () =>
      [
        ["#ff3b30", 0.0],
        ["#34d058", 1.7],
        ["#3b82ff", 3.1],
      ].map(
        ([c, seed]) =>
          new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(c as string) }, uSeed: { value: seed } },
            vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: histFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          })
      ),
    []
  );
  const frame = useMemo(() => {
    const s = new Segs().rect(V(0, 0.9, 0), V(1, 0, 0), V(0, 1, 0), 3.6, 1.8);
    for (let i = 1; i < 4; i++) s.seg(V(-1.8 + i * 0.9, 0, 0), V(-1.8 + i * 0.9, 1.8, 0));
    return s.geo();
  }, []);
  useFrame((state) => {
    mats.forEach((mt) => (mt.uniforms.uTime.value = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1)));
  });
  return (
    <group rotation={[0.25, -0.55, 0]} position={[0, -0.9, 0]}>
      <lineSegments geometry={frame} material={m.faint} />
      {mats.map((mt, i) => (
        <mesh key={i} material={mt} position={[0, 0.9, (i - 1) * 0.35]}>
          <planeGeometry args={[3.6, 1.8]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- 5: six prints developing in trays ----------
const printFragment = /* glsl */ `
uniform sampler2D uMap; uniform float uDev; uniform float uTime;
varying vec2 vUv;
void main(){
  vec3 img = texture2D(uMap, vUv).rgb;
  float l = dot(img, vec3(0.3, 0.59, 0.11));
  // developer works unevenly: shadows first, a gentle ripple across the paper
  float ripple = 0.04 * sin(vUv.x * 18.0 + uTime * 1.5) * sin(vUv.y * 14.0 - uTime);
  float d = clamp(uDev * 1.25 - l * 0.35 + ripple, 0.0, 1.0);
  vec3 paper = vec3(0.93, 0.9, 0.86);
  vec3 col = mix(paper, img, d);
  // safelight tint
  col *= vec3(1.0, 0.72, 0.68);
  gl_FragColor = vec4(col, 1.0);
}`;
function Trays() {
  const prints = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const tex = canvasTex(256, 192, (ctx) => paintPhoto(ctx, 0, 0, 256, 192, i, i * 5 + 2));
      return new THREE.ShaderMaterial({
        uniforms: { uMap: { value: tex }, uDev: { value: 0.2 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: printFragment,
      });
    });
  }, []);
  const tray = useMemo(() => new Segs().box(V(0, 0, -0.06), 1.28, 1.02, 0.12).geo(), []);
  const trayMats = useMemo(() => Array.from({ length: 6 }, () => lineMat(INK, 0.35)), []);
  const red = useMemo(() => new THREE.Color(RED), []);
  const ink = useMemo(() => new THREE.Color(INK), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    prints.forEach((p, i) => {
      const on = store.hoverCluster === i ? 1 : 0;
      p.uniforms.uDev.value = THREE.MathUtils.lerp(p.uniforms.uDev.value, on ? 1 : 0.22 + 0.05 * Math.sin(t * 0.5 + i), on ? 0.04 : 0.08);
      p.uniforms.uTime.value = t;
      trayMats[i].color.lerp(on ? red : ink, 0.12);
      trayMats[i].opacity = THREE.MathUtils.lerp(trayMats[i].opacity, on ? 1 : 0.35, 0.12);
    });
  });

  return (
    <group rotation={[-0.75, 0.25, 0.1]} scale={0.8}>
      {prints.map((p, i) => {
        const x = ((i % 3) - 1) * 1.45;
        const y = i < 3 ? 0.62 : -0.62;
        return (
          <group key={i} position={[x, y, 0]}>
            <lineSegments geometry={tray} material={trayMats[i]} />
            <mesh material={p} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.03]}>
              <planeGeometry args={[1.1, 0.82]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function DarkroomScene() {
  const m = useMats();
  const groups = useRef<(THREE.Group | null)[]>([]);
  useChapterRig(groups, OFFSETS, { camZ: 8.2, camZNarrow: 10.5 });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={0.35} />
      <pointLight position={[-3, 3, 3]} intensity={30} color={RED} distance={14} />
      <directionalLight position={[2, 3, 5]} intensity={1.6} color="#ffe2d6" />
      <directionalLight position={[-2, -1, -3]} intensity={0.6} color="#8a7dff" />
      <ChapterGroups groups={groups}>
        {[
          <Lens key="d0" m={m} />,
          <FilmStrip key="d1" />,
          <ContactSheet key="d2" m={m} />,
          <Timeline key="d3" m={m} />,
          <Histogram key="d4" m={m} />,
          <Trays key="d5" />,
          <Lens key="d6" m={m} />,
        ]}
      </ChapterGroups>
    </>
  );
}

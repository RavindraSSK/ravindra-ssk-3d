"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { store } from "@/lib/store";
import { Backdrop, Segs, V, labelTexture, lineMat, rng, smooth } from "./kit";

/*
 * Diffusion theme (advanced): the scene is an image model sampling.
 * Every chapter is a "prompt"; its particles start as Gaussian noise (random
 * positions AND colours) and denoise into the result. Scrolling to the next
 * chapter re-noises and samples again, exactly like a diffusion step schedule.
 * Skills: all six objects stay noisy until you hover one, which then "renders".
 */

const BG = "#09080f";
const INK = "#f2effa";
const PURPLE = "#c084fc";
const CYAN = "#22d3ee";

const CHAPTER_SHAPE = [0, 1, 2, 3, 4, 5, 0];
const OFFSETS: [number, number, number][] = [
  [2.5, 0, 0],
  [-2.3, 0, 0],
  [2.4, 0, 0],
  [0, 0, -1.5],
  [2.4, 0, 0],
  [-2.4, 0, 0],
  [0, 0, 0],
];
const PROMPTS = [
  "prompt: a brain made of light",
  "prompt: a knot of ideas, iridescent",
  "prompt: the helix of a career",
  "prompt: sunset over mountains, 35mm",
  "prompt: earth from orbit, night side",
  "prompt: six objects, one toolkit",
  "prompt: a brain made of light",
];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = mix(vec3(0.03, 0.025, 0.05), vec3(0.055, 0.04, 0.085), uv.y);
  col += vec3(0.45, 0.2, 0.6) * exp(-distance(uv, vec2(0.72 + uMouse.x * 0.02, 0.55)) * 3.0) * 0.14;
  col += vec3(0.05, 0.35, 0.45) * exp(-distance(uv, vec2(0.12, 0.12)) * 3.2) * 0.1;
  // latent noise shimmer that calms down between chapter changes
  float calm = abs(fract(uChapter) - 0.5) * 2.0;
  float n = hash(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 12.0));
  col += (n - 0.5) * mix(0.05, 0.015, calm);
  gl_FragColor = vec4(col, 1.0);
}
`;

const vertex = /* glsl */ `
uniform float uA; uniform float uB; uniform float uF; uniform float uTime;
uniform float uSize; uniform float uIntro; uniform float uSkillW; uniform float uHover;
attribute vec3 p0; attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4; attribute vec3 p5;
// colours are packed as 24-bit integers (r*65536 + g*256 + b), three shapes per attribute
attribute vec3 cA; attribute vec3 cB;
attribute vec3 aNoise; attribute vec2 aInfo;
varying vec3 vColor; varying float vSigma;
vec3 P(float i){ if(i < 0.5) return p0; if(i < 1.5) return p1; if(i < 2.5) return p2; if(i < 3.5) return p3; if(i < 4.5) return p4; return p5; }
vec3 unpack(float v){ float r = floor(v / 65536.0); float g = floor((v - r * 65536.0) / 256.0); float b = v - r * 65536.0 - g * 256.0; return vec3(r, g, b) / 255.0; }
vec3 C(float i){ if(i < 0.5) return unpack(cA.x); if(i < 1.5) return unpack(cA.y); if(i < 2.5) return unpack(cA.z); if(i < 3.5) return unpack(cB.x); if(i < 4.5) return unpack(cB.y); return unpack(cB.z); }
void main(){
  float k = smoothstep(0.35, 0.65, uF);
  // noise level: peaks halfway between chapters (re-noise, then sample again)
  float sigma = pow(sin(3.14159 * uF), 0.8) + uIntro;
  float mine = step(abs(aInfo.x - uHover), 0.5);
  sigma += uSkillW * mix(0.13, (1.0 - mine) * 0.16, step(-0.5, uHover));
  sigma = clamp(sigma, 0.0, 1.4);
  vec3 target = mix(P(uA), P(uB), k);
  vec3 drift = aNoise * (1.0 + 0.15 * sin(uTime * 1.3 + aInfo.y * 30.0));
  vec3 pos = target + drift * sigma * 2.0 + aNoise * 0.012 * sin(uTime * 2.0 + aInfo.y * 50.0);
  vec3 noiseCol = fract(aNoise * 7.31 + 0.5);
  vColor = mix(mix(C(uA), C(uB), k), noiseCol, clamp(sigma * 1.1, 0.0, 1.0));
  vSigma = sigma;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = uSize * (0.6 + aInfo.y) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const fragment = /* glsl */ `
varying vec3 vColor; varying float vSigma;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.15, d);
  gl_FragColor = vec4(vColor, a * (0.9 - vSigma * 0.25));
}`;

// ---------- target generators ----------
type Target = { pos: Float32Array; col: Float32Array; cluster?: Float32Array };
const hex = (h: string) => new THREE.Color(h);

function brain(n: number, r: () => number): Target {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const a = hex(PURPLE), b = hex(CYAN), w = hex("#ffffff"), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1);
    const fold = 1 + 0.1 * Math.sin(u * 9 + v * 7) * Math.sin(v * 11);
    let x = Math.sin(v) * Math.cos(u) * 0.78 * fold;
    const y = Math.cos(v) * 0.95 * fold;
    const z = Math.sin(v) * Math.sin(u) * 1.25 * fold;
    x = Math.abs(x) * side + side * 0.1;
    pos.set([x, y * 0.95, z], i * 3);
    c.copy(a).lerp(b, (y + 1) / 2).lerp(w, Math.max(0, fold - 1.03) * 4);
    col.set([c.r, c.g, c.b], i * 3);
  }
  return { pos, col };
}

function knot(n: number, r: () => number): Target {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = r() * Math.PI * 2;
    const p = 2, q = 3;
    const rr = 0.9 + 0.35 * Math.cos(q * t);
    const center = V(rr * Math.cos(p * t), rr * Math.sin(p * t), 0.4 * Math.sin(q * t));
    const off = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.16 * Math.sqrt(r()));
    pos.set(center.add(off).toArray(), i * 3);
    c.setHSL(0.75 + 0.35 * Math.sin(t * 1.5), 0.8, 0.65);
    col.set([c.r, c.g, c.b], i * 3);
  }
  return { pos, col };
}

function helix(n: number, r: () => number): Target {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const a = hex(PURPLE), b = hex(CYAN), w = hex("#f5f3ff");
  for (let i = 0; i < n; i++) {
    const y = (r() - 0.5) * 3.4;
    const ang = y * 2.2;
    const kind = r();
    let p: THREE.Vector3, c: THREE.Color;
    if (kind < 0.8) {
      const strand = kind < 0.4 ? 0 : Math.PI;
      p = V(Math.cos(ang + strand) * 0.7, y, Math.sin(ang + strand) * 0.7).add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.08));
      c = kind < 0.4 ? a : b;
    } else {
      const step = Math.round(y / 0.22) * 0.22;
      const ang2 = step * 2.2;
      const u = r() * 2 - 1;
      p = V(Math.cos(ang2) * 0.7 * u, step, Math.sin(ang2) * 0.7 * u);
      c = w;
    }
    pos.set(p.toArray(), i * 3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  return { pos, col };
}

function landscape(n: number, r: () => number): Target {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const W = 3.4, H = 2.2;
  const c = new THREE.Color();
  const ridge = (x: number, f: number, amp: number, base: number) => base + amp * (Math.sin(x * f) * 0.5 + Math.sin(x * f * 2.3 + 1.3) * 0.3 + Math.sin(x * f * 5.1) * 0.12);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * W, y = (r() - 0.5) * H;
    const horizon = -0.25;
    let z = 0;
    const m1 = ridge(x, 1.6, 0.35, 0.05), m2 = ridge(x + 3, 2.4, 0.22, -0.12);
    const sun = Math.hypot(x - 0.55, y - 0.25);
    if (y < horizon) {
      // water reflecting the sky, with a sun streak
      const t = (horizon - y) / (H / 2 + horizon);
      c.set("#3b1d5e").lerp(hex("#0b1030"), t);
      if (Math.abs(x - 0.55) < 0.12 * (1 - t) && Math.sin(y * 60) > 0) c.lerp(hex("#ffd27a"), 0.7);
    } else if (y < m2) {
      c.set("#1b1433");
      z = 0.12;
    } else if (y < m1) {
      c.set("#3a2a66");
      z = 0.06;
    } else if (sun < 0.32) {
      c.set("#ffd27a").lerp(hex("#ff8a5b"), sun / 0.32);
      z = -0.02;
    } else {
      const t = (y - horizon) / (H / 2 - horizon);
      c.set("#ff8a5b").lerp(hex("#c084fc"), Math.min(t * 1.6, 1)).lerp(hex("#1e1b4b"), Math.max(0, t - 0.55) * 1.8);
    }
    pos.set([x, y, z], i * 3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  return { pos, col };
}

function globe(n: number, r: () => number): Target {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1);
    const p = V(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)).multiplyScalar(1.35);
    const land = Math.sin(u * 3 + Math.sin(v * 4) * 1.5) * Math.cos(v * 3) + Math.sin(u * 7 + v * 5) * 0.3;
    const lit = p.x * 0.8 + p.y * 0.3 > -0.2;
    if (land > 0.35) c.set(lit ? "#22d3ee" : r() > 0.9 ? "#ffd27a" : "#1f2a44");
    else c.set(lit ? "#3b4fd8" : "#141a3a");
    if (Math.abs(p.y) > 1.22) c.set("#e0e7ff");
    pos.set(p.toArray(), i * 3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  return { pos, col };
}

const OBJ_COLORS = ["#c084fc", "#22d3ee", "#f472b6", "#fbbf24", "#a3e635", "#60a5fa"];
function objects(n: number, r: () => number): Target {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), cluster = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i % 6;
    const center = V(((k % 3) - 1) * 1.35, k < 3 ? 0.72 : -0.72, 0);
    let p: THREE.Vector3;
    const u = r(), v = r(), w = r();
    const s = 0.42;
    if (k === 0) {
      // cube surface
      const face = Math.floor(u * 6), a = v * 2 - 1, b = w * 2 - 1;
      const ax = face % 3, sign = face < 3 ? 1 : -1;
      p = ax === 0 ? V(sign, a, b) : ax === 1 ? V(a, sign, b) : V(a, b, sign);
      p.multiplyScalar(s * 0.8);
    } else if (k === 1) {
      const t = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
      p = V(Math.sin(ph) * Math.cos(t), Math.cos(ph), Math.sin(ph) * Math.sin(t)).multiplyScalar(s);
    } else if (k === 2) {
      const t = u * Math.PI * 2, ph = v * Math.PI * 2;
      p = V((0.32 + 0.12 * Math.cos(ph)) * Math.cos(t), 0.12 * Math.sin(ph), (0.32 + 0.12 * Math.cos(ph)) * Math.sin(t)).applyAxisAngle(V(1, 0, 0), 1.1);
    } else if (k === 3) {
      const h = v, t = u * Math.PI * 2;
      p = V(Math.cos(t) * s * (1 - h), h * 0.8 - 0.4, Math.sin(t) * s * (1 - h));
    } else if (k === 4) {
      // octahedron surface
      const d = V(u - 0.5, v - 0.5, w - 0.5);
      p = d.divideScalar(Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z) || 1).multiplyScalar(s * 1.1);
    } else {
      const t = u * Math.PI * 2;
      p = w < 0.7 ? V(Math.cos(t) * s * 0.7, v * 0.7 - 0.35, Math.sin(t) * s * 0.7) : V(Math.cos(t) * s * 0.7 * Math.sqrt(v), w < 0.85 ? 0.35 : -0.35, Math.sin(t) * s * 0.7 * Math.sqrt(v));
    }
    pos.set(p.add(center).toArray(), i * 3);
    const c = hex(OBJ_COLORS[k]);
    col.set([c.r, c.g, c.b], i * 3);
    cluster[i] = k;
  }
  return { pos, col, cluster };
}

export default function DiffusionScene() {
  const { camera, size } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const hud = useRef<THREE.Mesh>(null);
  const prompt = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Group>(null);
  const cur = useRef({ step: -1, prompt: -1, intro: 1 });
  const count = useMemo(() => (window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ? 7000 : 14000), []);

  const { geo, mat } = useMemo(() => {
    const r = rng(77);
    const gens = [brain, knot, helix, landscape, globe, objects];
    const targets = gens.map((g) => g(count, r));
    const geo = new THREE.BufferGeometry();
    const cA = new Float32Array(count * 3), cB = new Float32Array(count * 3);
    targets.forEach((t, i) => {
      geo.setAttribute(`p${i}`, new THREE.BufferAttribute(t.pos, 3));
      const dst = i < 3 ? cA : cB;
      for (let j = 0; j < count; j++) {
        const q = (x: number) => Math.round(Math.min(Math.max(x, 0), 1) * 255);
        dst[j * 3 + (i % 3)] = q(t.col[j * 3]) * 65536 + q(t.col[j * 3 + 1]) * 256 + q(t.col[j * 3 + 2]);
      }
    });
    geo.setAttribute("cA", new THREE.BufferAttribute(cA, 3));
    geo.setAttribute("cB", new THREE.BufferAttribute(cB, 3));
    geo.setAttribute("position", new THREE.BufferAttribute(targets[0].pos, 3));
    const noise = new Float32Array(count * 3);
    const info = new Float32Array(count * 2);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    for (let i = 0; i < count; i++) {
      noise.set([gauss() * 0.9, gauss() * 0.9, gauss() * 0.9], i * 3);
      info.set([targets[5].cluster![i], r()], i * 2);
    }
    geo.setAttribute("aNoise", new THREE.BufferAttribute(noise, 3));
    geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 2));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: 0 },
        uB: { value: 0 },
        uF: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 30 },
        uIntro: { value: 1 },
        uSkillW: { value: 0 },
        uHover: { value: -1 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
    });
    return { geo, mat };
  }, [count]);

  const hudLabels = useMemo(
    () =>
      Array.from({ length: 51 }, (_, k) => {
        const sigma = (1 - k / 50) ** 2;
        const { tex, aspect } = labelTexture(`step ${String(k).padStart(2, "0")}/50  ·  σ ${sigma.toFixed(2)}`, { color: k === 50 ? "#140720" : INK, bg: k === 50 ? PURPLE : "rgba(18,15,30,0.92)", border: k === 50 ? undefined : "rgba(255,255,255,0.18)", radius: 12, font: `600 34px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
      }),
    []
  );
  const promptLabels = useMemo(
    () =>
      PROMPTS.map((p) => {
        const { tex, aspect } = labelTexture(p, { color: PURPLE, font: `500 34px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
      }),
    []
  );
  const corners = useMemo(() => {
    const s = new Segs();
    const X = 1.95, Y = 1.55, L = 0.3;
    for (const [sx, sy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      s.seg(V(sx * X, sy * Y, 0), V(sx * (X - L), sy * Y, 0)).seg(V(sx * X, sy * Y, 0), V(sx * X, sy * (Y - L), 0));
    }
    return s.geo();
  }, []);
  const cornerMat = useMemo(() => lineMat(INK, 0.35), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const s = Math.min(Math.max(store.chapter, 0), 6);
    const a = Math.floor(s), b = Math.min(a + 1, 6);
    const f = s - a;
    const u = mat.uniforms;
    u.uA.value = CHAPTER_SHAPE[a];
    u.uB.value = CHAPTER_SHAPE[b];
    u.uF.value = f;
    u.uTime.value = t * (store.reducedMotion ? 0.2 : 1);
    u.uSize.value = (store.isMobile ? 22 : 26) * Math.min(state.gl.getPixelRatio(), 1.5);
    // first sample after the loader: noise → image over ~3 s
    if (store.introDone || t > 4) cur.current.intro = Math.max(0, cur.current.intro - dt * (store.reducedMotion ? 3 : 0.5));
    u.uIntro.value = cur.current.intro;
    const skillW = Math.max(0, 1 - Math.abs(s - 5));
    u.uSkillW.value = skillW;
    u.uHover.value = store.hoverCluster;

    // placement
    const narrow = size.width < 900;
    const k = smooth(0, 1, f);
    const off = OFFSETS[a].map((v, i) => v + (OFFSETS[b][i] - v) * k);
    if (pointsRef.current && frameRef.current) {
      const g = frameRef.current;
      g.position.set(narrow ? 0 : off[0], off[1], off[2]);
      g.scale.setScalar(narrow ? 0.72 : 1);
      g.rotation.y = Math.sin(t * 0.25) * 0.35 * (CHAPTER_SHAPE[Math.round(s)] === 3 ? 0.3 : 1);
    }
    const rm = store.reducedMotion ? 0.15 : 1;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, store.mouse.x * 0.35 * rm, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, store.mouse.y * 0.25 * rm, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, narrow ? 10.5 : 8.2, 5, dt);
    camera.lookAt(0, 0, 0);

    // HUD: sampler step and noise level
    const sigmaNow = Math.min(1, Math.pow(Math.sin(Math.PI * f), 0.8) + cur.current.intro + (skillW > 0.5 && store.hoverCluster < 0 ? 0.13 * skillW : 0));
    const step = Math.round((1 - Math.sqrt(sigmaNow)) * 50);
    if (step !== cur.current.step && hud.current) {
      cur.current.step = step;
      const l = hudLabels[step];
      hud.current.material = l.mat;
      hud.current.scale.set(l.aspect, 1, 1);
    }
    const pi = Math.round(s);
    if (pi !== cur.current.prompt && prompt.current) {
      cur.current.prompt = pi;
      const l = promptLabels[pi];
      prompt.current.material = l.mat;
      prompt.current.scale.set(l.aspect, 1, 1);
      prompt.current.position.x = -1.95 + (0.19 * l.aspect) / 2;
    }
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <group ref={frameRef}>
        <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />
        <Billboard>
          <lineSegments geometry={corners} material={cornerMat} />
          <mesh ref={prompt} position={[-1.95, 1.78, 0]}>
            <planeGeometry args={[0.19, 0.19]} />
          </mesh>
          <mesh ref={hud} position={[0, -1.82, 0]}>
            <planeGeometry args={[0.21, 0.21]} />
          </mesh>
        </Billboard>
      </group>
    </>
  );
}

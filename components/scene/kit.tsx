"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";

/* Shared helpers for the line-drawing / per-chapter scenes. */

export type Vec3 = [number, number, number];

export const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Seeded PRNG so geometry is stable between renders. */
export function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const circlePts = (r: number, n = 96, y = 0) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });

export const lineGeo = (points: THREE.Vector3[]) => new THREE.BufferGeometry().setFromPoints(points);

/** Collects line-segment pairs and turns them into one geometry (one draw call). */
export class Segs {
  pts: THREE.Vector3[] = [];
  seg(a: THREE.Vector3, b: THREE.Vector3) {
    this.pts.push(a.clone(), b.clone());
    return this;
  }
  poly(points: THREE.Vector3[], closed = false) {
    for (let i = 0; i < points.length - 1; i++) this.seg(points[i], points[i + 1]);
    if (closed && points.length > 2) this.seg(points[points.length - 1], points[0]);
    return this;
  }
  /** Axis-aligned box edges centred at c. */
  box(c: THREE.Vector3, w: number, h: number, d: number) {
    const x = w / 2, y = h / 2, z = d / 2;
    const p = [
      V(-x, -y, -z), V(x, -y, -z), V(x, -y, z), V(-x, -y, z),
      V(-x, y, -z), V(x, y, -z), V(x, y, z), V(-x, y, z),
    ].map((v) => v.add(c));
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    e.forEach(([a, b]) => this.seg(p[a], p[b]));
    return this;
  }
  /** Rectangle in the plane spanned by u and v around c. */
  rect(c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, w: number, h: number) {
    const a = c.clone().addScaledVector(u, -w / 2).addScaledVector(v, -h / 2);
    const b = c.clone().addScaledVector(u, w / 2).addScaledVector(v, -h / 2);
    const cc = c.clone().addScaledVector(u, w / 2).addScaledVector(v, h / 2);
    const d = c.clone().addScaledVector(u, -w / 2).addScaledVector(v, h / 2);
    return this.poly([a, b, cc, d], true);
  }
  dashed(a: THREE.Vector3, b: THREE.Vector3, dash = 0.12, gap = 0.08) {
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    for (let t = 0; t < len; t += dash + gap) {
      this.seg(a.clone().addScaledVector(dir, t), a.clone().addScaledVector(dir, Math.min(t + dash, len)));
    }
    return this;
  }
  scale(k: number) {
    this.pts.forEach((p) => p.multiplyScalar(k));
    return this;
  }
  geo() {
    return new THREE.BufferGeometry().setFromPoints(this.pts);
  }
}

/** A THREE.Line as a primitive (the JSX <line> tag collides with SVG's <line>). */
export function Poly({
  geometry,
  material,
  ...rest
}: { geometry: THREE.BufferGeometry; material: THREE.Material } & Omit<React.ComponentProps<"primitive">, "object">) {
  const obj = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);
  return <primitive object={obj} {...rest} />;
}

export const lineMat = (color: string, opacity = 1) =>
  new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

/**
 * Full-screen backdrop drawn behind everything with its own fragment shader.
 * Uniforms available: uTime, uRes (px), uMouse (-1..1), uChapter.
 */
export function Backdrop({ fragment }: { fragment: string }) {
  const { size, gl } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uMouse: { value: new THREE.Vector2() },
          uChapter: { value: 0 },
        },
        vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
        fragmentShader: fragment,
        depthWrite: false,
        depthTest: false,
      }),
    [fragment]
  );
  useFrame((state) => {
    const pr = gl.getPixelRatio();
    mat.uniforms.uRes.value.set(size.width * pr, size.height * pr);
    mat.uniforms.uTime.value = state.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    mat.uniforms.uMouse.value.lerp(new THREE.Vector2(store.mouse.x, store.mouse.y), 0.06);
    mat.uniforms.uChapter.value = store.chapter;
  });
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Weight of chapter k at continuous chapter s (0..1, eased). */
export const chapterWeight = (s: number, k: number) => {
  const w = clamp01(1 - Math.abs(s - k));
  return w * w * (3 - 2 * w);
};

/**
 * Drives one group per chapter: scales it in/out with scroll, places it beside the
 * text (centred on narrow screens) and eases the camera toward the pointer.
 * The first few frames render every group once so shaders compile up front.
 */
export function useChapterRig(
  groups: React.RefObject<(THREE.Group | null)[]>,
  offsets: Vec3[],
  opts: { camZ: number; camZNarrow: number; narrowScale?: number; parallax?: [number, number]; camY?: number; spin?: number }
) {
  const { camera, size } = useThree();
  const warm = useMemoRef();
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = store.chapter;
    const narrow = store.isMobile || size.width < 900;
    warm.n++;
    const warming = warm.n < 5;
    groups.current?.forEach((g, k) => {
      if (!g) return;
      const e = warming ? 0.02 : chapterWeight(s, k);
      g.visible = warming || e > 0.01;
      g.scale.setScalar(Math.max(e, 0.0001) * (narrow ? opts.narrowScale ?? 0.72 : 1));
      const [ox, oy, oz] = offsets[k];
      g.position.set(narrow ? 0 : ox, oy - (1 - e) * 0.6, oz);
      g.rotation.z = (1 - e) * (s > k ? 1 : -1) * (opts.spin ?? 0.3);
      g.userData.weight = e;
    });
    const [px, py] = opts.parallax ?? [0.35, 0.25];
    const rm = store.reducedMotion ? 0.15 : 1;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, store.mouse.x * px * rm, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, (opts.camY ?? 0) + store.mouse.y * py * rm, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, narrow ? opts.camZNarrow : opts.camZ, 5, dt);
    camera.lookAt(0, 0, 0);
  });
}

function useMemoRef() {
  return useMemo(() => ({ n: 0 }), []);
}

/** Renders one group per chapter; pair with useChapterRig. */
export function ChapterGroups({
  groups,
  children,
}: {
  groups: React.RefObject<(THREE.Group | null)[]>;
  children: React.ReactNode[];
}) {
  return (
    <>
      {children.map((c, k) => (
        <group
          key={k}
          ref={(el) => {
            if (groups.current) groups.current[k] = el;
          }}
          visible={k === 0}
        >
          {c}
        </group>
      ))}
    </>
  );
}

/** Rounded-rect path helper for canvas drawing. */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A text label painted onto a canvas texture (a "chip"). Returns the texture and
 * its width/height ratio so a plane can be sized to match.
 */
export function labelTexture(
  text: string,
  opts: {
    font?: string;
    color?: string;
    bg?: string;
    border?: string;
    height?: number;
    pad?: number;
    radius?: number;
    align?: "left" | "center";
  } = {}
) {
  const h = opts.height ?? 96;
  const pad = opts.pad ?? h * 0.35;
  const font = opts.font ?? `600 ${Math.round(h * 0.46)}px "JetBrains Mono Variable", ui-monospace, monospace`;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width + pad * 2);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const r = opts.radius ?? h / 2;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    roundRect(ctx, 1, 1, w - 2, h - 2, r);
    ctx.fill();
  }
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, w - 2, h - 2, r);
    ctx.stroke();
  }
  ctx.font = font;
  ctx.fillStyle = opts.color ?? "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = opts.align === "left" ? "left" : "center";
  ctx.fillText(text, opts.align === "left" ? pad : w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

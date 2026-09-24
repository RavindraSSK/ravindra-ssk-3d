"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "@/lib/store";
import { skillGroups } from "@/lib/content";
import { Backdrop, ChapterGroups, V, labelTexture, rng, roundRect, useChapterRig, type Vec3 } from "./kit";

/*
 * Prompt theme (simple): the site as a conversation with a language model.
 *   next-token probabilities writing the tagline → a stream of tokens →
 *   a chat thread → a context window filling up (projects) → temperature
 *   reshaping a softmax (research) → six prompt chips (skills) → prompt box
 */

const BG = "#f4f4f1";
const INK = "#16161a";
const ACCENT = "#5b4cf0";
const SOFT = "#d9d6fb";

const OFFSETS: Vec3[] = [
  [3.0, -0.35, 0],
  [-2.3, 0, 0],
  [2.6, 0, 0],
  [0, -0.2, -1.5],
  [2.4, -0.1, 0],
  [-2.7, -0.1, 0],
  [0, 0, 0],
];

const backdrop = /* glsl */ `
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uChapter;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float s = uRes.y / 900.0;
  vec3 col = vec3(0.957, 0.957, 0.945);
  col += vec3(-0.05, -0.06, 0.02) * exp(-distance(uv, vec2(0.85 + uMouse.x * 0.02, 0.95)) * 3.0) * 0.6;
  col += vec3(-0.06, -0.01, 0.03) * exp(-distance(uv, vec2(0.08, 0.05)) * 3.0) * 0.5;
  // canvas-app dot grid
  vec2 g = mod(gl_FragCoord.xy + vec2(0.0, uChapter * 30.0 * s), 26.0 * s) - 13.0 * s;
  float dotv = smoothstep(1.4 * s, 0.6 * s, length(g));
  col -= dotv * 0.06;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- helpers ----------
const shadowTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, "rgba(22,22,26,0.28)");
    g.addColorStop(1, "rgba(22,22,26,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    t = new THREE.CanvasTexture(cv);
    return t;
  };
})();

function Shadow({ w, h, position }: { w: number; h: number; position: Vec3 }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }), []);
  return (
    <mesh material={mat} position={position}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/** White card with rounded corners (canvas-drawn), optional custom painter. */
function cardTexture(w: number, h: number, paint?: (ctx: CanvasRenderingContext2D, W: number, H: number) => void, fill = "#ffffff", border = "rgba(22,22,26,0.12)") {
  const W = Math.round(w * 200), H = Math.round(h * 200);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  roundRect(ctx, 2, 2, W - 4, H - 4, Math.min(44, H / 2 - 2));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.stroke();
  paint?.(ctx, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- 0 / 6: next-token probabilities ----------
const STEPS: [string, number][][] = [
  [["I", 0.62], ["We", 0.14], ["Ravi", 0.12], ["My", 0.07], ["The", 0.05]],
  [["build", 0.48], ["train", 0.22], ["ship", 0.15], ["design", 0.1], ["test", 0.05]],
  [["and", 0.55], [",", 0.2], ["reliable", 0.12], ["robust", 0.08], ["fast", 0.05]],
  [["evaluate", 0.41], ["test", 0.27], ["ship", 0.18], ["deploy", 0.09], ["scale", 0.05]],
  [["production", 0.44], ["real", 0.25], ["useful", 0.17], ["safe", 0.09], ["new", 0.05]],
  [["ML", 0.5], ["AI", 0.3], ["LLM", 0.1], ["vision", 0.06], ["data", 0.04]],
  [["systems.", 0.58], ["models.", 0.2], ["agents.", 0.12], ["tools.", 0.06], ["apps.", 0.04]],
];
const STEP_S = 1.6;

function NextToken() {
  const bars = useRef<THREE.Mesh[]>([]);
  const labels = useRef<THREE.Mesh[]>([]);
  const answer = useRef<THREE.Mesh>(null);
  const state = useRef({ step: -1 });
  const mats = useMemo(
    () => ({
      top: new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5 }),
      rest: new THREE.MeshStandardMaterial({ color: SOFT, roughness: 0.6 }),
    }),
    []
  );
  // every candidate label, pre-rendered once
  const labelMats = useMemo(
    () =>
      STEPS.map((cands) =>
        cands.map(([w], i) => {
          const { tex, aspect } = labelTexture(w, { color: i === 0 ? ACCENT : "#55556a", font: `${i === 0 ? 700 : 500} 40px "JetBrains Mono Variable", ui-monospace, monospace` });
          return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
        })
      ),
    []
  );
  // the sentence so far, one texture per step
  const answers = useMemo(
    () =>
      STEPS.map((_, k) => {
        const text = STEPS.slice(0, k + 1)
          .map((c) => c[0][0])
          .join(" ");
        const { tex, aspect } = labelTexture(text + " ▍", { color: INK, align: "left", pad: 6, font: `600 46px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
      }),
    []
  );
  const prompt = useMemo(() => {
    const tex = cardTexture(3.6, 0.62, (ctx, W, H) => {
      ctx.font = `500 ${Math.round(H * 0.27)}px "JetBrains Mono Variable", ui-monospace, monospace`;
      ctx.fillStyle = "#8a8a96";
      ctx.textBaseline = "middle";
      ctx.fillText("Ask anything about Ravi…", H * 0.45, H / 2);
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(W - H * 0.5, H / 2, H * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = H * 0.06;
      ctx.beginPath();
      ctx.moveTo(W - H * 0.5, H * 0.66);
      ctx.lineTo(W - H * 0.5, H * 0.34);
      ctx.moveTo(W - H * 0.62, H * 0.46);
      ctx.lineTo(W - H * 0.5, H * 0.34);
      ctx.lineTo(W - H * 0.38, H * 0.46);
      ctx.stroke();
    });
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  }, []);

  useFrame((st) => {
    const t = st.clock.elapsedTime * (store.reducedMotion ? 0.3 : 1);
    const step = Math.floor(t / STEP_S) % STEPS.length;
    const phase = (t / STEP_S) % 1;
    if (step !== state.current.step) {
      state.current.step = step;
      labels.current.forEach((l, i) => {
        if (!l) return;
        const lm = labelMats[step][i];
        l.material = lm.mat;
        l.scale.set(lm.aspect, 1, 1);
      });
      if (answer.current) {
        const a = answers[step];
        answer.current.material = a.mat;
        answer.current.scale.set(a.aspect, 1, 1);
        answer.current.position.x = -1.75 + (a.aspect * 0.26) / 2;
      }
    }
    bars.current.forEach((b, i) => {
      if (!b) return;
      const p = STEPS[step][i][1];
      // bars grow in, the winner pulses when it is "sampled"
      const grow = Math.min(phase * 3, 1);
      const h = Math.max(0.02, p * 2.3 * (0.2 + 0.8 * grow));
      b.scale.y = THREE.MathUtils.lerp(b.scale.y, h, 0.25);
      b.position.y = -0.45 + b.scale.y / 2;
      b.material = i === 0 && phase > 0.55 ? mats.top : mats.rest;
    });
  });

  return (
    <group rotation={[0.08, -0.32, 0]} scale={0.8}>
      <mesh
        ref={answer}
        position={[-1.2, 1.55, 0]}
        scale={[1, 1, 1]}
      >
        <planeGeometry args={[0.26, 0.26]} />
      </mesh>
      {STEPS[0].map((_, i) => (
        <group key={i} position={[-1.3 + i * 0.66, 0, 0]}>
          <mesh
            material={mats.rest}
            ref={(el) => {
              if (el) bars.current[i] = el;
            }}
          >
            <boxGeometry args={[0.44, 1, 0.22]} />
          </mesh>
          <mesh
            position={[0, -0.64, 0.12]}
            ref={(el) => {
              if (el) labels.current[i] = el;
            }}
          >
            <planeGeometry args={[0.17, 0.17]} />
          </mesh>
        </group>
      ))}
      <Shadow w={4.4} h={1.2} position={[0, -1.5, -0.2]} />
      <mesh material={prompt} position={[0, -1.3, 0.2]}>
        <planeGeometry args={[3.6, 0.62]} />
      </mesh>
    </group>
  );
}

// ---------- 1: token stream ----------
const TOKENS = ["Engineer", "by", "training", ".", "Researcher", "by", "habit", ".", "PyTorch", "→", "FastAPI", "→", "Docker", "→", "AWS", "✓"];
function TokenStream() {
  const chips = useRef<THREE.Mesh[]>([]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([V(-2.6, -1.5, -0.6), V(-1.2, -0.4, 0.5), V(0, 0.2, -0.3), V(1.3, 0.9, 0.4), V(2.6, 1.6, -0.5)]), []);
  const chipMats = useMemo(
    () =>
      TOKENS.map((w, i) => {
        const hi = w === "Researcher" || w === "Engineer" || w === "✓";
        const { tex, aspect } = labelTexture(w, {
          color: hi ? "#ffffff" : INK,
          bg: hi ? ACCENT : "#ffffff",
          border: hi ? undefined : "rgba(22,22,26,0.14)",
          radius: 22,
          font: `${hi ? 700 : 500} 40px "JetBrains Mono Variable", ui-monospace, monospace`,
        });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect, i };
      }),
    []
  );
  useFrame((st) => {
    const t = st.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    chips.current.forEach((c, i) => {
      if (!c) return;
      const u = (i / TOKENS.length + t * 0.035) % 1;
      c.position.copy(curve.getPointAt(u));
      const edge = Math.min(u / 0.08, (1 - u) / 0.08, 1);
      c.scale.setScalar(Math.max(edge, 0.001));
    });
  });
  return (
    <group rotation={[0.1, 0.25, 0.05]}>
      {chipMats.map((c, i) => (
        <mesh
          key={i}
          material={c.mat}
          ref={(el) => {
            if (el) chips.current[i] = el;
          }}
        >
          <planeGeometry args={[0.3 * c.aspect, 0.3]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- 2: chat thread ----------
const THREAD: { who: "user" | "ai"; text: string }[] = [
  { who: "user", text: "What does Ravi work on?" },
  { who: "ai", text: "Evaluating frontier LLMs and coding agents, and building a VLM benchmark." },
  { who: "user", text: "And before that?" },
  { who: "ai", text: "Deep learning on satellite imagery and an explainable clinical AI platform." },
  { who: "user", text: "Can he ship it?" },
  { who: "ai", text: "Yes: Docker, FastAPI, AWS, CI/CD and monitoring." },
];
function bubbleTexture(text: string, user: boolean) {
  const W = 760;
  const font = `500 30px "JetBrains Mono Variable", ui-monospace, monospace`;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (probe.measureText(test).width > W - 70 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  const width = Math.min(W, Math.max(...lines.map((l) => probe.measureText(l).width)) + 70);
  const H = 40 + lines.length * 42;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(width);
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  roundRect(ctx, 2, 2, cv.width - 4, H - 4, 30);
  ctx.fillStyle = user ? ACCENT : "#ffffff";
  ctx.fill();
  if (!user) {
    ctx.strokeStyle = "rgba(22,22,26,0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.font = font;
  ctx.fillStyle = user ? "#ffffff" : INK;
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, 35, 40 + i * 42));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, w: cv.width / 200, h: H / 200 };
}
function Chat() {
  const list = useRef<THREE.Group>(null);
  const dots = useRef<THREE.Mesh[]>([]);
  const bubbles = useMemo(() => {
    let y = 0;
    return THREAD.map((m) => {
      const b = bubbleTexture(m.text, m.who === "user");
      const item = { ...b, user: m.who === "user", y: y - b.h / 2 };
      y -= b.h + 0.14;
      return { ...item, mat: new THREE.MeshBasicMaterial({ map: b.tex, transparent: true, depthWrite: false }) };
    });
  }, []);
  const total = useMemo(() => -Math.min(...bubbles.map((b) => b.y - b.h / 2)) + 0.14, [bubbles]);
  const typing = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8a8a96" }), []);

  useFrame((st) => {
    const t = st.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    if (list.current) {
      const off = (t * 0.22) % total;
      list.current.children.forEach((c, i) => {
        let y = bubbles[i].y + off + 1.4;
        if (y > 1.9) y -= total;
        c.position.y = y;
        const fade = Math.min((1.9 - y) / 0.35, (y + 1.4) / 0.35, 1);
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(fade, 0);
      });
    }
    dots.current.forEach((d, i) => d && (d.position.y = -1.75 + Math.max(0, Math.sin(t * 6 - i * 0.8)) * 0.07));
  });

  return (
    <group rotation={[0.05, -0.35, 0]} scale={0.85}>
      <group ref={list}>
        {bubbles.map((b, i) => (
          <mesh key={i} material={b.mat} position={[b.user ? 1.6 - b.w / 2 : -1.6 + b.w / 2, b.y, 0]}>
            <planeGeometry args={[b.w, b.h]} />
          </mesh>
        ))}
      </group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          material={typing}
          position={[-1.45 + i * 0.13, -1.75, 0]}
          ref={(el) => {
            if (el) dots.current[i] = el;
          }}
        >
          <circleGeometry args={[0.04, 16]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- 3: context window filling up ----------
function Context() {
  const blocks = useRef<THREE.InstancedMesh>(null);
  const N = 64;
  const colA = useMemo(() => new THREE.Color(ACCENT), []);
  const colB = useMemo(() => new THREE.Color("#e4e3ef"), []);
  const colC = useMemo(() => new THREE.Color("#0ea5e9"), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const r = useMemo(() => rng(4), []);
  const kinds = useMemo(() => Array.from({ length: N }, () => (r() > 0.75 ? 1 : 0)), [r]);
  useFrame((st) => {
    const m = blocks.current;
    if (!m) return;
    const t = st.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const fill = ((t * 6) % (N + 12)) | 0;
    for (let i = 0; i < N; i++) {
      const x = (i % 16) * 0.42 - 3.15;
      const y = Math.floor(i / 16) * -0.42 + 0.63;
      const on = i < fill;
      tmp.position.set(x, y, on ? 0.04 : 0);
      tmp.scale.setScalar(on ? 1 : 0.86);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, on ? (kinds[i] ? colC : colA) : colB);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group rotation={[-0.35, 0, 0]}>
      <instancedMesh ref={blocks} args={[undefined, undefined, N]}>
        <boxGeometry args={[0.36, 0.36, 0.08]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

// ---------- 4: temperature ----------
const LOGITS = [2.4, 1.7, 1.2, 0.8, 0.35, 0, -0.4, -0.9];
const TS = Array.from({ length: 18 }, (_, i) => +(0.3 + i * 0.1).toFixed(1));
function Temperature() {
  const bars = useRef<THREE.Mesh[]>([]);
  const label = useRef<THREE.Mesh>(null);
  const cur = useRef(-1);
  const mats = useMemo(() => LOGITS.map((_, i) => new THREE.MeshStandardMaterial({ color: new THREE.Color(ACCENT).lerp(new THREE.Color("#c7c3f7"), i / 7), roughness: 0.5 })), []);
  const tLabels = useMemo(
    () =>
      TS.map((T) => {
        const { tex, aspect } = labelTexture(`temperature = ${T.toFixed(1)}`, { color: INK, bg: "#ffffff", border: "rgba(22,22,26,0.14)", radius: 24, font: `600 38px "JetBrains Mono Variable", ui-monospace, monospace` });
        return { mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), aspect };
      }),
    []
  );
  useFrame((st) => {
    const t = st.clock.elapsedTime * (store.reducedMotion ? 0.2 : 1);
    const T = 0.3 + 1.7 * (0.5 + 0.5 * Math.sin(t * 0.55));
    const ex = LOGITS.map((l) => Math.exp(l / T));
    const sum = ex.reduce((a, b) => a + b, 0);
    bars.current.forEach((b, i) => {
      if (!b) return;
      const h = Math.max(0.02, (ex[i] / sum) * 3.2);
      b.scale.y = h;
      b.position.y = -1 + h / 2;
    });
    const k = Math.min(TS.length - 1, Math.max(0, Math.round((T - 0.3) / 0.1)));
    if (k !== cur.current && label.current) {
      cur.current = k;
      label.current.material = tLabels[k].mat;
      label.current.scale.set(tLabels[k].aspect, 1, 1);
    }
  });
  return (
    <group rotation={[0.12, -0.4, 0]}>
      {LOGITS.map((_, i) => (
        <mesh
          key={i}
          material={mats[i]}
          position={[-1.75 + i * 0.5, 0, 0]}
          ref={(el) => {
            if (el) bars.current[i] = el;
          }}
        >
          <boxGeometry args={[0.36, 1, 0.36]} />
        </mesh>
      ))}
      <mesh ref={label} position={[0, -1.4, 0.2]}>
        <planeGeometry args={[0.28, 0.28]} />
      </mesh>
      <Shadow w={4.6} h={1} position={[0, -1.05, -0.3]} />
    </group>
  );
}

// ---------- 5: prompt chips (skills) ----------
function Chips() {
  const items = useRef<THREE.Group[]>([]);
  const chips = useMemo(
    () =>
      skillGroups.map((g) => {
        const off = labelTexture(g.name, { color: INK, bg: "#ffffff", border: "rgba(22,22,26,0.16)", font: `600 40px "JetBrains Mono Variable", ui-monospace, monospace` });
        const on = labelTexture(g.name, { color: "#ffffff", bg: ACCENT, font: `700 40px "JetBrains Mono Variable", ui-monospace, monospace` });
        return {
          aspect: off.aspect,
          off: new THREE.MeshBasicMaterial({ map: off.tex, transparent: true, depthWrite: false }),
          on: new THREE.MeshBasicMaterial({ map: on.tex, transparent: true, opacity: 0, depthWrite: false }),
        };
      }),
    []
  );
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    items.current.forEach((g, i) => {
      if (!g) return;
      const on = store.hoverCluster === i ? 1 : 0;
      chips[i].on.opacity = THREE.MathUtils.lerp(chips[i].on.opacity, on, 0.18);
      g.position.z = THREE.MathUtils.lerp(g.position.z, on * 0.5, 0.15);
      g.position.y = g.userData.y + Math.sin(t * 0.8 + i) * 0.04;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 1 + on * 0.12, 0.15));
    });
  });
  return (
    <group rotation={[0.1, 0.3, 0]} scale={0.85}>
      {chips.map((c, i) => {
        const x = (i % 2 ? 0.95 : -0.95) + (i % 4 === 1 ? 0.25 : 0);
        const y = 1.1 - Math.floor(i / 2) * 0.85 - (i % 2) * 0.3;
        return (
          <group
            key={i}
            position={[x, y, 0]}
            userData={{ y }}
            ref={(el) => {
              if (el) items.current[i] = el;
            }}
          >
            <mesh material={c.off}>
              <planeGeometry args={[0.42 * c.aspect, 0.42]} />
            </mesh>
            <mesh material={c.on} position={[0, 0, 0.005]}>
              <planeGeometry args={[0.42 * c.aspect, 0.42]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function PromptScene() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useChapterRig(groups, OFFSETS, { camZ: 8.2, camZNarrow: 10.5, spin: 0.15 });

  return (
    <>
      <color attach="background" args={[BG]} />
      <Backdrop fragment={backdrop} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <ChapterGroups groups={groups}>
        {[
          <NextToken key="p0" />,
          <TokenStream key="p1" />,
          <Chat key="p2" />,
          <Context key="p3" />,
          <Temperature key="p4" />,
          <Chips key="p5" />,
          <NextToken key="p6" />,
        ]}
      </ChapterGroups>
    </>
  );
}


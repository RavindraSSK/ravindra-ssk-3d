"use client";

import { useMemo, useRef, useState, useEffect, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import NeuralField from "./NeuralField";
import StudioScene from "./StudioScene";
import OrbitalScene from "./OrbitalScene";
import PaperScene from "./PaperScene";
import BlueprintScene from "./BlueprintScene";
import ArenaScene from "./ArenaScene";
import DarkroomScene from "./DarkroomScene";
import MugguScene from "./MugguScene";
import PromptScene from "./PromptScene";
import AgentScene from "./AgentScene";
import AttentionScene from "./AttentionScene";
import DiffusionScene from "./DiffusionScene";
import SiliconScene from "./SiliconScene";
import AscentScene from "./AscentScene";
import GraphScene from "./GraphScene";
import { emit, store, subscribe } from "@/lib/store";
import { currentTheme } from "@/lib/theme";

const getTheme = () => store.theme;
const getServerTheme = () => "neural";

/** Tells the loader the scene has drawn its first frame. */
function ReadySignal() {
  useFrame((state) => {
    if (!store.ready && state.clock.elapsedTime > 0.15) {
      store.ready = true;
      emit();
    }
  });
  return null;
}

/** Distant star dust for depth. */
function Dust({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    let seed = 99;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const r = 12 + rand() * 22;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.01;
    ref.current.rotation.x = store.chapter * 0.06;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        color="#7dd3fc"
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function Scene() {
  const [mobile, setMobile] = useState(false);

  // Lighter scene for phones and small tablets. Layout (centred vs beside the
  // text) is decided by canvas width in each scene, so touch laptops and large
  // tablets keep the desktop look.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse) and (max-width: 1024px)");
    const update = () => {
      store.isMobile = mq.matches;
      setMobile(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Theme is set in <head> before paint; sync it into the store once mounted.
  useEffect(() => {
    store.theme = currentTheme();
    emit();
  }, []);
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const count = mobile ? 3200 : 7000;
  // Camera/antialias per theme (Neural relies on bloom, so no MSAA there).
  const cam = theme === "neural" ? { z: 7.2, fov: 45 } : theme === "orbital" ? { z: 7.6, fov: 42 } : { z: 8.2, fov: 40 };

  return (
    <Canvas
      key={theme}
      className="!fixed inset-0 !h-[100lvh] !w-full"
      camera={{ position: [0, 0, cam.z], fov: cam.fov, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: theme !== "neural", powerPreference: "high-performance", alpha: false }}
      aria-hidden
    >
      <ReadySignal />
      {theme === "studio" && <StudioScene />}
      {theme === "orbital" && <OrbitalScene />}
      {theme === "paper" && <PaperScene />}
      {theme === "blueprint" && <BlueprintScene />}
      {theme === "arena" && <ArenaScene />}
      {theme === "darkroom" && <DarkroomScene />}
      {theme === "muggu" && <MugguScene />}
      {theme === "prompt" && <PromptScene />}
      {theme === "agent" && <AgentScene />}
      {theme === "attention" && <AttentionScene />}
      {theme === "diffusion" && <DiffusionScene />}
      {theme === "silicon" && <SiliconScene />}
      {theme === "ascent" && <AscentScene />}
      {theme === "graph" && <GraphScene />}
      {theme === "neural" && (
        <>
          <color attach="background" args={["#04070d"]} />
          <NeuralField key={count} count={count} />
          <Dust count={mobile ? 500 : 1400} />
          {!mobile && (
            <EffectComposer multisampling={0}>
              <Bloom mipmapBlur resolutionScale={0.5} levels={5} intensity={0.85} luminanceThreshold={0.08} luminanceSmoothing={0.3} radius={0.7} />
              <Vignette eskil={false} offset={0.25} darkness={0.75} />
            </EffectComposer>
          )}
        </>
      )}
    </Canvas>
  );
}

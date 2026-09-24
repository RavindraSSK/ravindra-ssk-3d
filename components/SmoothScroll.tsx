"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { store, subscribe } from "@/lib/store";

gsap.registerPlugin(ScrollTrigger);

let lenisInstance: Lenis | null = null;

/** The running Lenis instance (null before mount / after unmount). */
export function getLenis() {
  return lenisInstance;
}

/** Smooth-scroll to a chapter id (used by nav + chapter rail). */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) lenisInstance.scrollTo(el, { duration: 1.6 });
  else el.scrollIntoView({ behavior: "smooth" });
}

/**
 * Lenis smooth scrolling wired into GSAP's ticker + ScrollTrigger,
 * plus global pointer tracking for the 3D scene.
 * Mental model (roadmap §07): scroll position → progress → scene changes.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    store.reducedMotion = reduced;

    const lenis = new Lenis({
      lerp: reduced ? 1 : 0.13,
      smoothWheel: !reduced,
      wheelMultiplier: 1,
      anchors: { offset: 0, duration: 1.6 },
    });
    lenisInstance = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Hold scroll until the intro finishes.
    if (!store.introDone) lenis.stop();
    const unsub = subscribe(() => {
      if (store.introDone) lenis.start();
    });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      store.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      store.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    // Refresh trigger positions once web fonts settle.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      unsub();
      window.removeEventListener("pointermove", onMove);
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  return <>{children}</>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { emit, store, subscribe } from "@/lib/store";

/** Intro loader: counts to 100 while the WebGL scene warms up, then wipes away. */
export default function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counter = { v: 0 };
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      const tl = gsap.timeline({
        onComplete: () => {
          setGone(true);
        },
      });
      tl.to(counter, {
        v: 100,
        duration: reduced ? 0 : 0.5,
        ease: "power2.out",
        onUpdate: () => render(),
      })
        .add(() => {
          store.introDone = true;
          emit();
        })
        .to(root.current, {
          clipPath: "inset(0 0 100% 0)",
          duration: reduced ? 0.01 : 1.1,
          ease: "expo.inOut",
        });
    };

    const render = () => {
      if (num.current) num.current.textContent = String(Math.round(counter.v)).padStart(3, "0");
      if (bar.current) bar.current.style.transform = `scaleX(${counter.v / 100})`;
    };

    // Count to ~85 on a timer, then wait for the scene.
    const tween = gsap.to(counter, {
      v: 85,
      duration: reduced ? 0 : 1.6,
      ease: "power1.inOut",
      onUpdate: render,
      onComplete: () => {
        if (store.ready) finish();
      },
    });

    const unsub = subscribe(() => {
      if (store.ready && !tween.isActive()) finish();
    });
    // Safety net: never block the page (e.g. WebGL unavailable).
    const safety = window.setTimeout(finish, 4500);

    return () => {
      unsub();
      tween.kill();
      window.clearTimeout(safety);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-[var(--bg)] p-6 md:p-10"
      style={{ clipPath: "inset(0 0 0% 0)" }}
      role="status"
      aria-label="Loading"
    >
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
        <span>Ravindra SSK</span>
        <span>Neural Space</span>
      </div>
      <div>
        <div className="flex items-end justify-between gap-6">
          <p className="max-w-xs font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-[var(--muted)]">
            Initializing particles
            <br />
            Wiring synapses
          </p>
          <span
            ref={num}
            className="font-display text-[22vw] leading-[0.8] tracking-tighter text-[var(--fg)] md:text-[14vw]"
          >
            000
          </span>
        </div>
        <div className="mt-6 h-px w-full bg-[var(--line)]">
          <div ref={bar} className="h-px w-full origin-left scale-x-0 bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}

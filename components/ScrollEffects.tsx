"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { emit, store, subscribe } from "@/lib/store";

gsap.registerPlugin(ScrollTrigger);

/**
 * Rendered after all sections so pinned sections are set up first.
 * - Maps scroll position to a continuous chapter value for the 3D scene.
 * - Runs scroll-triggered reveals ([data-reveal], [data-split], [data-count]).
 * - Plays the hero intro once the loader is done.
 */
export default function ScrollEffects() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    let tops: number[] = [];

    const measure = () => {
      const y = window.scrollY;
      tops = sections.map((el) => el.getBoundingClientRect().top + y);
      update();
    };

    // Chapter i is "current" once its top passes 25% of the viewport.
    // The transition to i+1 runs while the next section's top travels
    // from the bottom of the viewport up to that 25% line.
    const update = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      let i = 0;
      for (let k = 0; k < sections.length; k++) if (tops[k] <= y + vh * 0.25) i = k;
      let f = 0;
      if (i + 1 < sections.length) {
        f = Math.min(Math.max((y + vh - tops[i + 1]) / (vh * 0.75), 0), 1);
      }
      const s = i + f;
      store.chapter = s;
      const active = Math.min(Math.round(s), sections.length - 1);
      if (active !== store.active) {
        store.active = active;
        emit();
      }
    };

    ScrollTrigger.addEventListener("refresh", measure);
    gsap.ticker.add(update);
    measure();

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Word-by-word heading reveals.
      document.querySelectorAll<HTMLElement>("[data-split]:not([data-hero])").forEach((el) => {
        gsap.from(el.querySelectorAll(".w > span"), {
          yPercent: 115,
          rotate: 3,
          duration: 0.8,
          ease: "power4.out",
          stagger: 0.035,
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      // Fade-up blocks.
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 36,
          autoAlpha: 0,
          duration: 0.8,
          ease: "power3.out",
          delay: Number(el.dataset.delay || 0),
          scrollTrigger: { trigger: el, start: "top 90%" },
        });
      });

      // Parallax.
      document.querySelectorAll<HTMLElement>("[data-speed]").forEach((el) => {
        gsap.to(el, {
          yPercent: -Number(el.dataset.speed) * 30,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
    });

    // Count-up numbers (run regardless of motion preference, instantly if reduced).
    document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const decimals = (el.dataset.count || "").split(".")[1]?.length ?? 0;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: store.reducedMotion ? 0 : 1.8,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
        onUpdate: () => {
          el.textContent = obj.v.toFixed(decimals);
        },
      });
    });

    // Hero intro timeline.
    let played = false;
    const playIntro = () => {
      if (played || !store.introDone) return;
      played = true;
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.to("[data-hero] .w > span", { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.06 })
        .to("[data-hero-fade]", { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1 }, "-=0.9");
    };
    gsap.set("[data-hero] .w > span", { yPercent: 115, rotate: 4 });
    gsap.set("[data-hero-fade]", { autoAlpha: 0, y: 24 });
    const unsub = subscribe(playIntro);
    playIntro();

    ScrollTrigger.refresh();

    return () => {
      unsub();
      mm.revert();
      gsap.ticker.remove(update);
      ScrollTrigger.removeEventListener("refresh", measure);
    };
  }, []);

  return null;
}

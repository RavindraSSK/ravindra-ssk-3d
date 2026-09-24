"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitText from "@/components/ui/SplitText";
import TiltCard from "@/components/ui/TiltCard";
import ProjectCover from "@/components/ui/ProjectCover";
import { projects } from "@/lib/content";
import { getLenis } from "@/components/SmoothScroll";

gsap.registerPlugin(ScrollTrigger);

/** Pinned section: vertical scroll drives a horizontal track of project cards (desktop). */
export default function Projects() {
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        const el = track.current!;
        const n = projects.length;
        const PAD = 40; // md:px-10
        const GAP = 28; // lg:gap-7
        const MIN_W = 380;
        // Size cards so a whole number of them fills the width: no card is ever cut in half at rest.
        let perView = 1;
        let cardW = 400;
        const layout = () => {
          const avail = window.innerWidth - PAD * 2;
          perView = Math.max(
            1,
            Math.min(n, Math.floor((avail + GAP) / (MIN_W + GAP))),
          );
          cardW = (avail - (perView - 1) * GAP) / perView;
          el.style.setProperty("--card-w", `${cardW}px`);
        };
        layout();
        const steps = () => Math.max(0, n - perView);
        const distance = () => steps() * (cardW + GAP);

        const tween = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: pin.current,
            start: "top top",
            end: () => `+=${Math.max(distance(), 1) * 1.1}`,
            pin: true,
            scrub: true, // Lenis already smooths the scroll; a second scrub delay feels laggy
            invalidateOnRefresh: true,
            onRefreshInit: layout,
            onUpdate: (self) => {
              if (progress.current)
                progress.current.style.transform = `scaleX(${self.progress})`;
            },
          },
        });

        // When scrolling pauses mid-track, glide to the nearest whole-card position.
        const st = tween.scrollTrigger!;
        let timer = 0;
        const onScroll = () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            const k = steps();
            if (!k || !st.isActive) return;
            const p = st.progress;
            if (p <= 0.001 || p >= 0.999) return;
            const snapped = Math.round(p * k) / k;
            const target = st.start + snapped * (st.end - st.start);
            if (Math.abs(target - window.scrollY) < 2) return;
            const lenis = getLenis();
            if (lenis) lenis.scrollTo(target, { duration: 0.6 });
            else window.scrollTo({ top: target, behavior: "smooth" });
          }, 140);
        };
        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
          window.removeEventListener("scroll", onScroll);
          window.clearTimeout(timer);
          tween.scrollTrigger?.kill();
          el.style.removeProperty("--card-w");
        };
      },
    );
    return () => mm.revert();
  }, []);

  return (
    <section id="projects" data-chapter className="relative">
      <div
        ref={pin}
        className="proj-pin relative flex min-h-[100svh] flex-col justify-center overflow-hidden py-28 lg:pb-14 lg:pt-28"
      >
        <div className="flex items-end justify-between gap-6 px-5 md:px-10">
          <div>
            <p className="eyebrow" data-reveal>
              03 — Selected work
            </p>
            <SplitText
              text="Things I've built."
              accentWords={["built"]}
              className="mt-4 font-display text-4xl leading-none tracking-tight md:text-5xl xl:text-6xl"
            />
          </div>
          <p className="hidden max-w-xs text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-[var(--muted)] lg:block">
            Keep scrolling: the track moves sideways,
            <br />
            one project at a time.
          </p>
        </div>

        {/* the clip window keeps neighbouring cards from peeking in at the edges */}
        <div className="mt-10 px-5 md:px-10 lg:mt-5">
          <div className="lg:-my-3 lg:overflow-hidden lg:py-3">
            <div
              ref={track}
              className="flex flex-col gap-6 lg:w-max lg:flex-row lg:gap-7"
            >
              {projects.map((p, i) => (
                <TiltCard
                  key={p.id}
                  className="glass group h-full w-full overflow-hidden rounded-3xl lg:w-[var(--card-w,400px)]"
                >
                  <article className="flex h-full flex-col">
                    <div className="proj-cover relative aspect-[5/3] overflow-hidden border-b border-[var(--line)] lg:aspect-[2/1]">
                      <div className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.06]">
                        <ProjectCover id={p.id} />
                      </div>
                      <span className="absolute left-4 top-4 rounded-full bg-[var(--bg)]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--fg)]/80">
                        {String(i + 1).padStart(2, "0")} /{" "}
                        {String(projects.length).padStart(2, "0")}
                      </span>
                      {p.status && (
                        <span className="absolute right-4 top-4 rounded-full border border-[var(--accent)]/50 bg-[var(--bg)]/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--accent)]">
                          {p.status}
                        </span>
                      )}
                    </div>
                    <div className="proj-body flex flex-1 flex-col p-6">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                        {p.year}
                      </p>
                      <h3 className="mt-1.5 font-display text-2xl tracking-tight">
                        {p.title}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--accent)]">
                        {p.subtitle}
                      </p>
                      <p className="proj-desc mt-3 text-[14px] leading-relaxed text-[var(--fg)]/65 lg:line-clamp-4 lg:text-[13.5px]">
                        {p.description}
                      </p>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {p.metrics.map((m) => (
                          <li key={m} className="chip chip-accent">
                            {m}
                          </li>
                        ))}
                      </ul>
                      <p className="proj-stack mt-3 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                        {p.stack.join(" · ")}
                      </p>
                      <a
                        href={p.href}
                        target="_blank"
                        rel="noreferrer"
                        className="link-arrow mt-auto self-start pt-5"
                        data-cursor="Open"
                      >
                        View on GitHub <span aria-hidden>↗</span>
                      </a>
                    </div>
                  </article>
                </TiltCard>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute inset-x-10 bottom-6 hidden h-px bg-[var(--line)] lg:block">
          <div
            ref={progress}
            className="h-px w-full origin-left scale-x-0 bg-[var(--accent)]"
          />
        </div>
      </div>
    </section>
  );
}

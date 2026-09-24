"use client";

import SplitText from "@/components/ui/SplitText";
import { certifications, skillGroups } from "@/lib/content";
import { store } from "@/lib/store";

export default function Skills() {
  const set = (i: number) => () => {
    store.hoverCluster = i;
  };

  return (
    <section id="skills" data-chapter className="relative min-h-[100svh] px-5 py-28 md:px-10 md:py-40">
      <div className="ml-auto max-w-2xl lg:mr-24">
        <p className="eyebrow" data-reveal>
          05 — Skills
        </p>
        <SplitText
          text="Six clusters. One toolkit."
          accentWords={["clusters."]}
          className="mt-5 font-display text-4xl leading-[1.02] tracking-tight md:text-6xl"
        />
        <p className="mt-6 max-w-md text-[15px] text-[var(--muted)]" data-reveal>
          <span className="hidden md:inline">Hover a group and its cluster lights up in the scene.</span>
          <span className="md:hidden">Each group maps to one object in the scene.</span>
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2" onPointerLeave={set(-1)}>
          {skillGroups.map((g, i) => (
            <div
              key={g.name}
              className="glass group rounded-2xl p-5 transition-colors duration-300 hover:border-[var(--accent)]/50"
              onPointerEnter={set(i)}
              onFocus={set(i)}
              onBlur={set(-1)}
              tabIndex={0}
              data-reveal
              data-delay={(i % 2) * 0.08}
              data-cursor=""
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg tracking-tight">{g.name}</h3>
                <span className="font-mono text-[10px] text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
                  C{i + 1}
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {g.items.map((s) => (
                  <li key={s} className="chip text-[11px]">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12" data-reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">Certifications</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {certifications.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[14px] leading-snug text-[var(--fg)]/80">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 bg-[var(--accent)]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

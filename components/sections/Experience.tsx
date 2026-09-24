import SplitText from "@/components/ui/SplitText";
import { experience } from "@/lib/content";

export default function Experience() {
  return (
    <section id="experience" data-chapter className="relative px-5 py-28 md:px-10 md:py-40">
      <div className="max-w-2xl">
        <p className="eyebrow" data-reveal>
          02 — Experience
        </p>
        <SplitText
          text="Training models. Testing models. Shipping them."
          accentWords={["Testing"]}
          className="mt-5 font-display text-4xl leading-[1.02] tracking-tight md:text-6xl"
        />
        <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-[var(--muted)] md:text-base" data-reveal>
          Each role added a layer: evaluating frontier models, researching new ones, and shipping systems that hold up in production.
        </p>

        <ol className="relative mt-14 space-y-5 border-l border-[var(--line)] pl-6 md:pl-8">
          {experience.map((job) => (
            <li key={job.role} className="relative" data-reveal>
              <span className="absolute -left-[29px] top-7 h-2.5 w-2.5 rounded-full border border-[var(--accent)] bg-[var(--bg)] md:-left-[37px]" />
              <article className="glass rounded-2xl p-6 transition-colors duration-500 hover:border-[var(--accent)]/40 md:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-display text-xl tracking-tight md:text-2xl">{job.org}</h3>
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--accent)]">
                    {job.period}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--fg)]/80">
                  {job.role} <span className="text-[var(--muted)]">· {job.meta}</span>
                </p>
                <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-[var(--fg)]/65">
                  {job.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <span className="mt-[9px] h-px w-3 shrink-0 bg-[var(--accent)]/70" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

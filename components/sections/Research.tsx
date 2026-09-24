import SplitText from "@/components/ui/SplitText";
import Honors from "@/components/ui/Honors";
import { research } from "@/lib/content";

export default function Research() {
  return (
    <section id="research" data-chapter className="relative min-h-[100svh] px-5 py-28 md:px-10 md:py-40">
      <div className="max-w-2xl">
        <p className="eyebrow" data-reveal>
          04 — Research
        </p>
        <SplitText
          text="From point clouds to language models."
          accentWords={["point", "clouds"]}
          className="mt-5 font-display text-4xl leading-[1.02] tracking-tight md:text-6xl"
        />

        <div className="mt-12 space-y-4">
          {research.map((r, i) => (
            <article key={r.title} className="glass rounded-2xl p-6 md:p-7" data-reveal data-delay={i * 0.08}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">{r.tag}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{r.where}</span>
              </div>
              <h3 className="mt-3 font-display text-2xl tracking-tight">{r.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--fg)]/65">{r.body}</p>
            </article>
          ))}
        </div>

        <Honors />
      </div>
    </section>
  );
}

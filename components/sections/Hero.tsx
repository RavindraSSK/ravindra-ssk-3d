import SplitText from "@/components/ui/SplitText";
import { profile } from "@/lib/content";

export default function Hero() {
  return (
    <section
      id="hero"
      data-chapter
      className="relative flex min-h-[100svh] items-end px-5 pb-28 pt-32 md:items-center md:px-10 md:pb-0"
    >
      <div className="relative z-10 max-w-[min(62rem,100%)]">
        <p data-hero-fade className="eyebrow mb-6 flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
          {profile.status} · {profile.location}
        </p>

        <SplitText
          as="h1"
          hero
          text="Ravindra SSK"
          className="font-display text-[19vw] font-medium leading-[0.84] tracking-[-0.04em] text-[var(--fg)] sm:text-[15vw] lg:text-[10.5vw]"
        />

        <SplitText
          as="p"
          hero
          text="I build and evaluate production ML & AI systems."
          accentWords={["evaluate", "production"]}
          className="mt-6 max-w-xl font-display text-2xl leading-[1.15] tracking-tight text-[var(--fg)]/90 md:text-[2.1rem]"
        />

        <ul data-hero-fade className="mt-8 flex flex-wrap gap-2">
          {["LLM Evaluation", "Model Routing", "Vision-Language Models", "MLOps"].map((t) => (
            <li key={t} className="chip">
              {t}
            </li>
          ))}
        </ul>

        <div data-hero-fade className="mt-10 flex flex-wrap items-center gap-3">
          <a href="#projects" className="btn btn-primary" data-cursor="Work">
            See the work
            <span aria-hidden>↓</span>
          </a>
          <a href={`mailto:${profile.email}`} className="btn" data-cursor="Mail">
            Get in touch
          </a>
        </div>
      </div>

      <div
        data-hero-fade
        className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 md:flex"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">Scroll to explore</span>
        <span className="scroll-line" />
      </div>

      <p
        data-hero-fade
        className="absolute bottom-8 right-5 hidden text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.25em] text-[var(--muted)] md:right-10 md:block"
      >
        M.S. Artificial Intelligence
        <br />
        Saint Louis University · Dec 2026
      </p>
    </section>
  );
}

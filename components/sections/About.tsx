import PortraitCard from "@/components/ui/PortraitCard";
import SplitText from "@/components/ui/SplitText";
import { about, profile } from "@/lib/content";

export default function About() {
  return (
    <section id="about" data-chapter className="relative min-h-[100svh] px-5 py-28 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        {/* Portrait on a rigid 3D card (tilts in depth; the photo itself never warps) */}
        <div className="relative mx-auto w-full max-w-[26rem]" data-speed="0.4">
          <PortraitCard alt={`Portrait of ${profile.fullName}`} />
        </div>

        <div className="glass rounded-3xl p-7 md:p-10">
          <p className="eyebrow" data-reveal>
            {about.kicker}
          </p>
          <SplitText
            text={about.title}
            accentWords={["Researcher"]}
            className="mt-5 font-display text-4xl leading-[1.02] tracking-tight md:text-6xl"
          />
          <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-[var(--fg)]/75 md:text-base">
            {about.body.map((p, i) => (
              <p key={i} data-reveal data-delay={i * 0.1}>
                {p}
              </p>
            ))}
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
            {about.stats.map((s) => {
              const numeric = s.value.replace(/[^0-9.]/g, "");
              const suffix = s.value.replace(/[0-9.]/g, "");
              return (
                <div key={s.label} className="bg-[var(--stat-bg)] p-5">
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-display text-3xl tracking-tight text-[var(--fg)] md:text-4xl">
                    <span data-count={numeric}>{numeric}</span>
                    <span className="text-[var(--accent)]">{suffix}</span>
                  </dd>
                  <p className="mt-1 font-mono text-[10px] uppercase leading-snug tracking-[0.15em] text-[var(--muted)]">
                    {s.label}
                  </p>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}

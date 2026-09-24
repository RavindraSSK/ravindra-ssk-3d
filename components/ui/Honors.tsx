import TiltCard from "@/components/ui/TiltCard";
import { awards, leadership, type Honor } from "@/lib/content";

/** Line icons (24×24, stroke = currentColor) so every theme can tint them. */
function Icon({ name }: { name: Honor["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "fellowship": // research fellowship: an atom
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <ellipse cx="12" cy="12" rx="9.5" ry="3.8" />
          <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-60 12 12)" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
    case "quality": // quality: shield with a check
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
          <path d="M8.5 12l2.5 2.5 4.5-5" />
        </svg>
      );
    case "scholarship": // scholarship: mortarboard
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M2 9l10-5 10 5-10 5-10-5z" />
          <path d="M6 11v4.5c0 1.6 2.7 3 6 3s6-1.4 6-3V11" />
          <path d="M22 9v5" />
        </svg>
      );
    case "captain": // handball
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9.2c4.6 1.4 12.2 1.4 16.8 0" />
          <path d="M3.6 14.8c4.6-1.4 12.2-1.4 16.8 0" />
          <path d="M12 3c-3.2 4.4-3.2 13.6 0 18" />
        </svg>
      );
    case "concrete": // structure: portal frame
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M2 10l10-6 10 6" />
          <path d="M3 21h18" />
          <path d="M5 21V10M12 21V10M19 21V10" />
          <path d="M5 15h14" />
        </svg>
      );
    case "service": // service: heart
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
          <path d="M8.5 11.5h2l1-2 1.5 4 1-2h1.5" />
        </svg>
      );
  }
}

/** Awards as medals (they coin-flip on hover), leadership as armband cards. */
export default function Honors() {
  return (
    <div className="mt-16">
      <p className="eyebrow" data-reveal>
        Honors &amp; leadership
      </p>
      <h3 className="mt-4 font-display text-3xl leading-tight tracking-tight md:text-4xl" data-reveal>
        Off the keyboard, <span className="text-accent-grad">on the field.</span>
      </h3>

      {/* Awards: medal cabinet */}
      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]" data-reveal>
        Awards
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {awards.map((a, i) => (
          <li key={a.title} className="h-full" data-reveal data-delay={i * 0.08}>
            <TiltCard className="glass group h-full rounded-2xl p-5" wrapClassName="h-full" max={8}>
              <div className="flex items-start justify-between">
                <span className="honor-medal">
                  <span className="honor-ribbon" aria-hidden />
                  <span className="honor-disc">
                    <Icon name={a.icon} />
                  </span>
                </span>
                {a.year && <span className="chip font-mono text-[10px]">{a.year}</span>}
              </div>
              <h4 className="mt-5 font-display text-lg leading-snug tracking-tight">{a.title}</h4>
              <p className="mt-1 text-[13px] text-[var(--muted)]">{a.org}</p>
              {a.detail && <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--accent)]">{a.detail}</p>}
            </TiltCard>
          </li>
        ))}
      </ul>

      {/* Leadership: armband cards */}
      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]" data-reveal>
        Leadership
      </p>
      <ul className="mt-4 space-y-3">
        {leadership.map((l, i) => (
          <li key={l.title} data-reveal data-delay={i * 0.08}>
            <div className="glass honor-band group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 pl-5 md:p-5 md:pl-6">
              <span className="honor-icon">
                <Icon name={l.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-display text-[17px] leading-snug tracking-tight">
                  {l.title}
                  {l.icon === "captain" && (
                    <span className="ml-2 inline-grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] align-[2px] font-mono text-[10px] font-bold text-[var(--on-accent)]" title="Captain">
                      C
                    </span>
                  )}
                </h4>
                <p className="mt-0.5 text-[13px] text-[var(--muted)]">{l.org}</p>
              </div>
              {l.year && <span className="chip hidden font-mono text-[10px] sm:inline-flex">{l.year}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

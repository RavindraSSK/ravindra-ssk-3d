import SplitText from "@/components/ui/SplitText";
import { profile } from "@/lib/content";

export default function Contact() {
  const links = [
    { label: "LinkedIn", href: profile.links.linkedin },
    { label: "GitHub", href: profile.links.github },
    { label: "ResearchGate", href: profile.links.researchgate },
    { label: "Full portfolio", href: profile.links.portfolio },
  ];

  return (
    <section
      id="contact"
      data-chapter
      className="relative flex min-h-[100svh] flex-col justify-between px-5 pb-8 pt-32 md:px-10"
    >
      <div className="my-auto text-center">
        <p className="eyebrow justify-center" data-reveal>
          06 — Contact
        </p>
        <SplitText
          text="Let's build something intelligent."
          accentWords={["intelligent."]}
          className="mx-auto mt-6 max-w-5xl font-display text-[12vw] leading-[0.92] tracking-[-0.03em] md:text-[7vw]"
        />
        <div className="mt-12 flex flex-col items-center gap-6" data-reveal>
          <a href={`mailto:${profile.email}`} className="btn btn-primary btn-lg" data-cursor="Mail">
            {profile.email}
          </a>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {links.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noreferrer" className="link-arrow">
                  {l.label} <span aria-hidden>↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-[var(--line)] pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] md:flex-row">
        <span>© {new Date().getFullYear()} {profile.fullName}</span>
        <span>Next.js · React Three Fiber · GLSL · GSAP · Lenis</span>
        <a href={profile.mainSite} className="hover:text-[var(--fg)]">
          A 3D chapter of ravindrassk.com ↗
        </a>
      </footer>
    </section>
  );
}

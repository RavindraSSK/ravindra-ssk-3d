"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chapters, profile } from "@/lib/content";
import { store, subscribe } from "@/lib/store";
import { THEMES, setTheme, type ThemeId } from "@/lib/theme";
import { scrollToId } from "@/components/SmoothScroll";

const getActive = () => store.active;
const getServer = () => 0;
const getTheme = () => store.theme;
const getServerTheme = () => "neural";

/** Theme picker: one button that opens a list of looks (fits any number of themes). */
function ThemeMenu({ theme }: { theme: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="pill gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. Change theme`}
      >
        <span
          aria-hidden
          className="grid h-3.5 w-3.5 place-items-center rounded-full border border-[var(--line-strong)]"
          style={{ background: current.bg }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: current.accent }} />
        </span>
        <span className="hidden sm:inline text-[var(--muted)]">Theme</span>
        <span>{current.label}</span>
        <span aria-hidden className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Themes"
          data-lenis-prevent
          className="fixed right-4 top-[68px] z-[60] max-h-[calc(100svh-84px)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--line-strong)] bg-[var(--chrome-bg)] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] md:right-10 md:top-[84px]"
        >
          <p className="px-3 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Pick a look · {THEMES.length}
          </p>
          {THEMES.map((t, i) => (
            <div key={t.id}>
              {(i === 0 || THEMES[i - 1].group !== t.group) && (
                <p className="px-3 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">{t.group}</p>
              )}
              <button
                role="menuitemradio"
                aria-checked={theme === t.id}
                onClick={() => {
                  setTheme(t.id as ThemeId);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors duration-200 ${
                  theme === t.id ? "bg-[var(--chip-bg)] ring-1 ring-[var(--accent)]" : "hover:bg-[var(--chip-bg)]"
                }`}
              >
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line-strong)]"
                  style={{ background: t.bg }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.accent }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-tight text-[var(--fg)]">{t.label}</span>
                  <span className="block truncate text-[12px] leading-tight text-[var(--muted)]">{t.note}</span>
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">{String(i + 1).padStart(2, "0")}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fixed top bar + chapter rail. */
export default function Chrome() {
  const active = useSyncExternalStore(subscribe, getActive, getServer);
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between [background:var(--header-bg)] px-5 pb-8 pt-5 md:px-10 md:pb-10 md:pt-7">
        <button
          onClick={() => scrollToId("hero")}
          className="group flex items-center gap-3 text-left"
          aria-label="Back to top"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] font-display text-[13px] tracking-tight text-[var(--fg)] transition-colors group-hover:border-[var(--accent)]">
            RS
          </span>
          <span className="hidden font-mono text-[11px] uppercase leading-tight tracking-[0.2em] text-[var(--muted)] sm:block">
            Ravindra SSK
            <br />
            <span className="text-[var(--fg)]/70">AI/ML Engineer</span>
          </span>
        </button>

        <nav className="flex items-center gap-2 md:gap-3">
          <ThemeMenu theme={theme} />
          <button onClick={() => scrollToId("projects")} className="pill hidden lg:inline-flex">
            Work
          </button>
          <button onClick={() => scrollToId("contact")} className="pill hidden lg:inline-flex">
            Contact
          </button>
          <a href={profile.mainSite} className="pill pill-accent" target="_blank" rel="noreferrer">
            <span className="hidden md:inline">ravindrassk.com</span>
            <span className="md:hidden">Site</span> <span aria-hidden>↗</span>
          </a>
        </nav>
      </header>

      {/* Chapter rail */}
      <nav
        aria-label="Chapters"
        className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex"
      >
        {chapters.map((c, i) => (
          <button
            key={c.id}
            onClick={() => scrollToId(c.id)}
            className="group flex items-center gap-3"
            aria-label={`Go to ${c.label}`}
            aria-current={active === i ? "step" : undefined}
          >
            {/* labels only appear on hover, so the rail never sits on top of content */}
            <span
              className={`rounded-full bg-[var(--chrome-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] opacity-0 transition-all duration-300 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 ${
                active === i ? "text-[var(--accent)]" : "text-[var(--fg)]"
              }`}
            >
              {String(i).padStart(2, "0")} {c.label}
            </span>
            <span
              className={`block h-px transition-all duration-500 ${
                active === i ? "w-8 bg-[var(--accent)]" : "w-4 bg-[var(--rail)] group-hover:bg-[var(--rail-hover)]"
              }`}
            />
          </button>
        ))}
      </nav>

      {/* Mobile chapter indicator */}
      <div className="fixed bottom-4 left-4 z-40 rounded-full border border-[var(--line)] bg-[var(--chrome-bg)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] lg:hidden">
        {String(active).padStart(2, "0")} / {String(chapters.length - 1).padStart(2, "0")} ·{" "}
        <span className="text-[var(--fg)]">{chapters[active]?.label}</span>
      </div>
    </>
  );
}

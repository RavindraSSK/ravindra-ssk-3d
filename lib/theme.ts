import { emit, store } from "./store";

// Available looks. Add a theme here + a CSS block in globals.css + a scene in components/scene.
export const THEMES = [
  { id: "neural", label: "Neural", note: "Particle neural field", bg: "#04070d", accent: "#2dd4bf", group: "Classic" },
  { id: "studio", label: "Studio", note: "Glass & chrome, light", bg: "#eeebe4", accent: "#0d9488", group: "Classic" },
  { id: "orbital", label: "Orbital", note: "Earth from orbit", bg: "#050914", accent: "#f5a524", group: "Classic" },
  { id: "paper", label: "Paper", note: "Ink sketches, editorial", bg: "#f3ede1", accent: "#c2410c", group: "Classic" },
  { id: "blueprint", label: "Blueprint", note: "Civil drafting, my first field", bg: "#0e3158", accent: "#ffd166", group: "Personal" },
  { id: "arena", label: "Arena", note: "Handball court, captain's view", bg: "#080b10", accent: "#ff7a1f", group: "Personal" },
  { id: "darkroom", label: "Darkroom", note: "Photography & film edit", bg: "#0d0909", accent: "#ff4d3d", group: "Personal" },
  { id: "muggu", label: "Muggu", note: "Andhra muggulu patterns", bg: "#17110d", accent: "#f2b53a", group: "Personal" },
  { id: "prompt", label: "Prompt", note: "Chat with an LLM · simple", bg: "#f4f4f1", accent: "#5b4cf0", group: "AI" },
  { id: "agent", label: "Agent Loop", note: "Plan, act, observe · medium", bg: "#08090d", accent: "#a3e635", group: "AI" },
  { id: "attention", label: "Attention", note: "Inside a transformer · advanced", bg: "#07060c", accent: "#f472b6", group: "AI" },
  { id: "diffusion", label: "Diffusion", note: "Noise to image · advanced", bg: "#09080f", accent: "#c084fc", group: "AI" },
  { id: "silicon", label: "Chip to Cluster", note: "The AI stack, zooming out", bg: "#050a09", accent: "#e8955b", group: "AI eras" },
  { id: "ascent", label: "Ascent", note: "Six stages, one climb", bg: "#0d0b22", accent: "#ff8a65", group: "AI eras" },
  { id: "graph", label: "Graph Era", note: "One agent becomes a network", bg: "#05080c", accent: "#7dd3fc", group: "AI eras" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "neural";

export function isTheme(v: string | null | undefined): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

/** Reads the theme set by the inline script in <head> (from ?theme= or last choice). */
export function currentTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : DEFAULT_THEME;
}

export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  store.theme = id;
  try {
    localStorage.setItem("rssk-theme", id);
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set("theme", id);
  window.history.replaceState(null, "", url);
  emit();
}

/** Runs before first paint so there's no flash of the wrong theme. */
export const themeInitScript = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var s=localStorage.getItem('rssk-theme');var ok=${JSON.stringify(
  THEMES.map((t) => t.id)
)};var t=ok.indexOf(q)>-1?q:(ok.indexOf(s)>-1?s:'${DEFAULT_THEME}');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`;

// Tiny mutable store shared between DOM (scroll, cursor) and the WebGL scene.
// The scene reads it every frame, so it never triggers React re-renders.
// UI that needs to react (chapter rail, loader) subscribes via `subscribe`.

type Listener = () => void;

export const store = {
  /** Continuous chapter position: 2.4 = 40% through chapter 2. */
  chapter: 0,
  /** Active chapter index (rounded, for UI). */
  active: 0,
  /** Pointer in normalized device coords (-1..1). */
  mouse: { x: 0, y: 0 },
  /** Skill cluster hovered in the Skills chapter (-1 = none). */
  hoverCluster: -1,
  /** Scene has rendered its first frame. */
  ready: false,
  /** Intro (loader) finished. */
  introDone: false,
  reducedMotion: false,
  isMobile: false,
  /** Active visual theme (see lib/theme.ts). */
  theme: "neural" as string,
};

const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emit() {
  listeners.forEach((fn) => fn());
}

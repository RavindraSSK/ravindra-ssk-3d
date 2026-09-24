# Ravindra SSK: Neural Space (3D portfolio)

An immersive 3D portfolio built from the *3D Web Development Roadmap*. It's a separate site that links back to [ravindrassk.com](https://ravindrassk.com).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
```

## Deploy (Vercel)

1. Push this folder to a new GitHub repo (e.g. `ravindra-ssk-3d`).
2. In Vercel, click **Add New → Project** and import the repo. The defaults work.
3. Add the domain `3d.ravindrassk.com` under **Settings → Domains**, then add the CNAME record Vercel shows you.

## Themes

Fifteen looks ship side by side, grouped as Classic, Personal, AI and AI eras. Pick one from the **Theme** menu in the top bar, or with a link:

- `/?theme=neural`: dark particle field (default)
- `/?theme=studio`: light, glass and chrome objects
- `/?theme=orbital`: deep space, a procedural Earth with satellites
- `/?theme=paper`: warm paper, serif type, ink line drawings
- `/?theme=blueprint`: civil-engineering drafting sheet: house elevation, truss bridge, frame building, site plan, laser-scan survey, structural columns
- `/?theme=arena`: floodlit handball court: match ball, court, tactics board, striped goal, shot tracking, a 3-2-1 defence for the six skill groups
- `/?theme=darkroom`: photography and film editing under a safelight: lens iris, film strip, contact sheet, edit timeline, RGB histogram, prints developing in trays
- `/?theme=muggu`: Andhra muggulu drawn around dot grids (real mirror-curve patterns that draw themselves as you scroll), lotus, and six diyas
- `/?theme=prompt` (AI, simple): light chat UI: next-token probabilities write the tagline, token stream, chat thread, context window, temperature vs softmax, six prompt chips
- `/?theme=agent` (AI, medium): one AI agent: planner core running plan → act → observe → reflect, six tools (the skill groups) called over glowing links, memory stack, live step log
- `/?theme=attention` (AI, advanced): inside a transformer: causal attention arcs on a token ring (real softmaxed head patterns), attention matrix bars, layer stack with residual stream, head grid, output vocabulary wheel
- `/?theme=silicon` (AI eras): Chip to Cluster: the stages of building with AI as hardware, zooming out one level per chapter: silicon die (model) → input traces into its pins (prompt) → memory stacks (context) → the whole board with ports for tools, tests, sandbox, evals and a shield (harness, "we are here") → a feedback bus around the board (loop) → a cluster of six more boards wired with fibre (graph, "next"); labels are PCB silkscreen
- `/?theme=ascent` (AI eras): the same six stages as a climb: floating platforms spiral up through a dawn-to-night sky (monolith, prompt screen, stacked context cards, gantry + beacon at harness, loop ring, a constellation of agents); reached stages are stone, stages ahead are holograms
- `/?theme=graph` (AI eras): Graph Era, the forward-looking version: one agent assembled shell by shell (core, prompt ring, context tiles, harness cage, loop track), then the camera pulls back and it becomes one node in a graph of six agents (the skill groups) passing messages
- `/?theme=diffusion` (AI, advanced): every chapter is a prompt that samples from Gaussian noise into a point-cloud image (brain, knot, helix, sunset, globe, six objects), with a step/σ readout; hovered skills "render" out of the noise

The choice is remembered per browser. Theme colors live in `app/globals.css` (`html[data-theme="..."]` blocks), the 3D scenes in `components/scene/` (one `*Scene.tsx` per theme, with shared helpers in `kit.tsx`), and the theme list in `lib/theme.ts`. Once you pick a winner, remove the other entries from `THEMES`.

## Edit content

All copy (about, experience, projects, research, skills, links) is in **`lib/content.ts`**.
The headshot is in `public/images/`.

## How it works

| Roadmap topic | Where |
|---|---|
| Three.js / R3F scene, camera, renderer | `components/scene/Scene.tsx` |
| GLSL shaders (vertex morph, noise, pointer repulsion, pulses) | `components/scene/shaders.ts` |
| Particles morphing between 5 formations | `components/scene/shapes.ts`, `NeuralField.tsx` |
| Scroll → progress → camera/scene | `components/ScrollEffects.tsx` → `lib/store.ts` → `NeuralField.tsx` |
| Smooth scrolling (Lenis + GSAP ticker) | `components/SmoothScroll.tsx` |
| GSAP ScrollTrigger: text reveals, parallax, count-ups | `components/ScrollEffects.tsx` |
| Pinned horizontal scroll | `components/sections/Projects.tsx` |
| Post-processing (bloom, vignette) | `components/scene/Scene.tsx` |
| Custom cursor, loader, 3D tilt cards | `components/ui/` |
| Performance: adaptive DPR, fewer particles on mobile, no bloom on mobile, reduced-motion support | `Scene.tsx`, `NeuralField.tsx`, `globals.css` |

Formations by chapter: **sphere** (intro/about) → **neural network** (experience) → **galaxy** (projects) → **terrain point cloud** (research) → **6 skill clusters** (skills) → **sphere** (contact).

"use client";

import { useEffect, useRef, useState } from "react";
import { profile } from "@/lib/content";

/*
 * Portrait as a rigid 3D card: the photo/video itself is never warped.
 * The whole card tilts toward the pointer (with an idle float), and
 * layers sit at different depths (translateZ) so it reads as a physical
 * object: back plate → media → glass bezel → HUD corners → name tag.
 *
 * Media: plays /images/portrait-loop.mp4 (a short "living photo" loop:
 * natural blinks/breathing) when present; otherwise the still photo shows
 * (the poster), so it works before the video exists.
 */

const MAX_TILT = 11; // degrees

export default function PortraitCard({ alt }: { alt: string }) {
  const card = useRef<HTMLDivElement>(null);
  const target = useRef({ rx: 0, ry: 0, gx: 50, gy: 30, hover: false });
  const [hasVideo, setHasVideo] = useState(false);
  // Set once the living-photo loop is added (see lib/content.ts → profile.portraitVideo).
  const videoSrc = profile.portraitVideo;

  // Smoothly follow the pointer; float gently when idle.
  // The loop only runs while the card is on screen.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = false;
    const cur = { rx: 0, ry: 0, gx: 50, gy: 30 };
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const tg = target.current;
      const idle = reduced ? 0 : 1;
      const rx = tg.hover ? tg.rx : Math.sin(t * 0.6) * 3 * idle;
      const ry = tg.hover ? tg.ry : Math.sin(t * 0.45) * 5 * idle;
      cur.rx += (rx - cur.rx) * 0.08;
      cur.ry += (ry - cur.ry) * 0.08;
      cur.gx += (tg.gx - cur.gx) * 0.08;
      cur.gy += (tg.gy - cur.gy) * 0.08;
      const el = card.current;
      if (el) {
        el.style.setProperty("--rx", `${cur.rx.toFixed(2)}deg`);
        el.style.setProperty("--ry", `${cur.ry.toFixed(2)}deg`);
        el.style.setProperty("--gx", `${cur.gx.toFixed(1)}%`);
        el.style.setProperty("--gy", `${cur.gy.toFixed(1)}%`);
      }
      if (running) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!e.isIntersecting) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    if (card.current) io.observe(card.current);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !card.current) return;
    const r = card.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    target.current = {
      rx: (0.5 - y) * MAX_TILT * 2,
      ry: (x - 0.5) * MAX_TILT * 2,
      gx: x * 100,
      gy: y * 100,
      hover: true,
    };
  };
  const onLeave = () => {
    target.current = { ...target.current, hover: false, gx: 50, gy: 30 };
  };

  return (
    <div className="card3d-stage" onPointerMove={onMove} onPointerLeave={onLeave} data-cursor="">
      <div ref={card} className="card3d">
        {/* back plate: gives the card visible thickness when tilted */}
        <div className="card3d-back" aria-hidden />

        {/* media: never distorted */}
        <div className="card3d-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/headshot-dark.webp"
            alt={alt}
            width={1122}
            height={1402}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {videoSrc && (
            <video
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                hasVideo ? "opacity-100" : "opacity-0"
              }`}
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/images/headshot-dark.webp"
              onCanPlay={() => setHasVideo(true)}
              aria-hidden
            />
          )}
        </div>

        {/* glass bezel + moving light sweep */}
        <div className="card3d-bezel" aria-hidden />
        <div className="card3d-glare" aria-hidden />

        {/* HUD corners float above the photo */}
        <div className="card3d-hud" aria-hidden>
          <span className="tl" />
          <span className="tr" />
          <span className="bl" />
          <span className="br" />
        </div>

        {/* name tag floats furthest forward */}
        <div className="card3d-tag">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
          Ravindra SSK Medicharla
        </div>
      </div>
    </div>
  );
}

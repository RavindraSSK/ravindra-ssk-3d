"use client";

import { useRef, type ReactNode } from "react";

/** Card that tilts toward the pointer in 3D with a moving glare. */
export default function TiltCard({
  children,
  className = "",
  wrapClassName = "",
  max = 10,
}: {
  children: ReactNode;
  className?: string;
  /** classes for the outer perspective wrapper (e.g. h-full inside a grid cell) */
  wrapClassName?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
    ref.current.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
    ref.current.style.setProperty("--gx", `${x * 100}%`);
    ref.current.style.setProperty("--gy", `${y * 100}%`);
  };
  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--rx", "0deg");
    ref.current.style.setProperty("--ry", "0deg");
  };

  return (
    <div className={`[perspective:1100px] ${wrapClassName}`}>
      <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`tilt ${className}`}>
        {children}
        <div className="tilt-glare" aria-hidden />
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

// WebGL only runs in the browser — skip server rendering for the canvas.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

export default function SceneLoader() {
  return <Scene />;
}

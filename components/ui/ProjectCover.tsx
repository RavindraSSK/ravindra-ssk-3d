import type { Project } from "@/lib/content";

// Generative SVG covers, one visual metaphor per project. Animated with CSS.
const T = "#2dd4bf";
const C = "#22d3ee";
const B = "#3b82f6";

function UQRoute() {
  // Requests hit small models; a confidence gate either answers or escalates to the 14B fallback.
  const small = [
    { y: 62, l: "1.5B" },
    { y: 112, l: "3B" },
    { y: 162, l: "7B" },
  ];
  const okPath = "M20 112 H70 M110 112 H170 L205 112 L240 88 H342";
  const escPath = "M20 112 H70 M110 112 H170 L205 112 L240 160 H300";
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={i} x1={0} y1={i * 26} x2={400} y2={i * 26} stroke="#fff" strokeOpacity={0.035} />
      ))}
      {small.map((m) => (
        <g key={m.l}>
          <path d={`M110 112 L${m.y === 112 ? 110 : 110} ${m.y}`} stroke={T} strokeOpacity={0.25} />
          <rect x={70} y={m.y - 14} width={40} height={28} rx={6} fill="#04070d" stroke={T} strokeOpacity={m.y === 112 ? 1 : 0.5} />
          <text x={90} y={m.y + 4} textAnchor="middle" fontSize={10} fontFamily="monospace" fill={T}>
            {m.l}
          </text>
        </g>
      ))}
      <path d="M110 112 H170" stroke={T} strokeOpacity={0.6} />
      {/* confidence gate */}
      <g transform="translate(205 112)">
        <rect x={-20} y={-20} width={40} height={40} transform="rotate(45)" fill="#04070d" stroke={C} strokeWidth={2} />
        <text y={4} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={C}>
          u&lt;τ
        </text>
      </g>
      <path d="M225 100 L240 88 H342" fill="none" stroke={T} strokeWidth={2} />
      <path d="M225 124 L240 160 H300" fill="none" stroke={B} strokeWidth={2} strokeDasharray="5 5" className="cover-dash" />
      <circle cx={358} cy={88} r={15} fill={T} fillOpacity={0.2} stroke={T} />
      <path d="M351 88 L356 94 L366 82" fill="none" stroke={T} strokeWidth={2.5} strokeLinecap="round" />
      <rect x={300} y={144} width={56} height={32} rx={7} fill="#04070d" stroke={B} strokeWidth={2} />
      <text x={328} y={164} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#93c5fd">
        14B
      </text>
      <text x={246} y={78} fontSize={9} fontFamily="monospace" fill={T} fillOpacity={0.8}>
        confident → answer
      </text>
      <text x={248} y={196} fontSize={9} fontFamily="monospace" fill="#93c5fd" fillOpacity={0.8}>
        uncertain → escalate
      </text>
      <circle r={4} fill={C}>
        <animateMotion dur="3s" repeatCount="indefinite" path={okPath} />
      </circle>
      <circle r={4} fill="#93c5fd">
        <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path={escPath} />
      </circle>
    </>
  );
}

function MediTrust() {
  // ECG line feeding into a SHAP-style bar chart.
  const bars = [0.9, -0.55, 0.7, -0.3, 0.45, -0.2, 0.3];
  return (
    <>
      <path
        d="M0 110 H80 L96 110 L106 70 L118 160 L130 40 L142 128 L152 110 H400"
        fill="none"
        stroke={T}
        strokeWidth={2.5}
        className="cover-ecg"
      />
      {bars.map((v, i) => (
        <rect
          key={i}
          x={v > 0 ? 250 : 250 + v * 120}
          y={150 + i * 10}
          width={Math.abs(v) * 120}
          height={6}
          rx={3}
          fill={v > 0 ? T : B}
          fillOpacity={0.8}
          className="cover-grow"
          style={{ animationDelay: `${i * 0.1}s`, transformOrigin: "250px 0" }}
        />
      ))}
      <line x1={250} y1={144} x2={250} y2={224} stroke="#fff" strokeOpacity={0.3} />
    </>
  );
}

function Campus() {
  // Detection boxes with class labels.
  const boxes = [
    { x: 40, y: 50, w: 110, h: 120, l: "backpack 0.92" },
    { x: 180, y: 90, w: 80, h: 70, l: "laptop 0.88" },
    { x: 280, y: 40, w: 90, h: 150, l: "person 0.95" },
  ];
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i} x1={i * 36} y1={0} x2={i * 36} y2={240} stroke="#fff" strokeOpacity={0.04} />
      ))}
      {boxes.map((b, i) => (
        <g key={i} className="cover-pop" style={{ animationDelay: `${i * 0.5}s` }}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={T} fillOpacity={0.06} stroke={i === 1 ? C : T} strokeWidth={2} />
          <rect x={b.x} y={b.y - 16} width={b.l.length * 6.2} height={16} fill={i === 1 ? C : T} />
          <text x={b.x + 4} y={b.y - 4} fontSize={10} fontFamily="monospace" fill="#04070d">
            {b.l}
          </text>
        </g>
      ))}
    </>
  );
}

function Gundata() {
  // Q-table heatmap with dice pips.
  const cells = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 18; c++) {
      // Rounded so server and browser agree (their sin/cos differ in the last digits).
      const v = Math.round(((Math.sin(r * 1.7 + c * 0.6) + Math.cos(c * 0.9 - r)) * 0.25 + 0.5) * 1000) / 1000;
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={20 + c * 20.5}
          y={30 + r * 20.5}
          width={18}
          height={18}
          rx={3}
          fill={v > 0.62 ? T : v > 0.4 ? B : "#0f1a2a"}
          fillOpacity={0.25 + v * 0.6}
          className="cover-flicker"
          style={{ animationDelay: `${((r + c) % 7) * 0.3}s` }}
        />
      );
    }
  }
  return (
    <>
      {cells}
      <g transform="translate(300 170)">
        <g className="cover-spin">
        <rect x={-26} y={-26} width={52} height={52} rx={10} fill="#04070d" stroke={C} strokeWidth={2} />
        {[
          [-12, -12],
          [12, 12],
          [0, 0],
          [12, -12],
          [-12, 12],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill={C} />
        ))}
        </g>
      </g>
    </>
  );
}

function SnapTune() {
  // Photo frame → waveform bars.
  return (
    <>
      <rect x={30} y={60} width={110} height={120} rx={6} fill="none" stroke={T} strokeWidth={2} />
      <circle cx={70} cy={100} r={12} fill={C} fillOpacity={0.6} />
      <path d="M30 170 L75 125 L100 150 L120 132 L140 150 V180 H30 Z" fill={T} fillOpacity={0.35} />
      <path d="M150 120 H180" stroke="#fff" strokeOpacity={0.4} strokeDasharray="4 4" className="cover-dash" />
      {Array.from({ length: 22 }).map((_, i) => {
        // Rounded so server and browser agree (their sin differs in the last digits).
        const h = Math.round((20 + Math.abs(Math.sin(i * 0.8)) * 70) * 100) / 100;
        return (
          <rect
            key={i}
            x={195 + i * 9}
            y={120 - h / 2}
            width={5}
            height={h}
            rx={2.5}
            fill={i % 3 ? T : C}
            className="cover-eq"
            style={{ animationDelay: `${i * 0.07}s`, transformOrigin: `${197 + i * 9}px 120px` }}
          />
        );
      })}
    </>
  );
}

const MAP: Record<Project["id"], () => React.ReactElement> = {
  uqroute: UQRoute,
  meditrust: MediTrust,
  campus: Campus,
  gundata: Gundata,
  snaptune: SnapTune,
};

export default function ProjectCover({ id }: { id: Project["id"] }) {
  const Art = MAP[id];
  return (
    <svg viewBox="0 0 400 240" className="h-full w-full" role="img" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`g-${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#0d2a33" />
          <stop offset="100%" stopColor="#060b14" />
        </radialGradient>
      </defs>
      <rect width={400} height={240} fill={`url(#g-${id})`} />
      <Art />
    </svg>
  );
}

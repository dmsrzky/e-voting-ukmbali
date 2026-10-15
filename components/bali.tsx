import { useId } from "react";

/* =====================================================================
 *  Ilustrasi khas Bali (SVG buatan sendiri, bebas dipakai):
 *  Candi Bentar, Meru, Penjor, pohon kelapa, bunga jepun (kamboja)
 * ===================================================================== */

const GROUND = 300;

function candiTiers(): [number, number][] {
  // [lebar, tinggi] tiap tingkat dari bawah ke atas
  return [[120, 46], [106, 30], [94, 26], [80, 24], [66, 22], [52, 20], [38, 18], [24, 16], [12, 16]];
}

function CandiHalf({ inner, dir }: { inner: number; dir: -1 | 1 }) {
  let y = GROUND;
  const parts: React.ReactNode[] = [];
  candiTiers().forEach(([w, h], i) => {
    const x = dir === -1 ? inner - w : inner;
    const top = y - h;
    parts.push(<rect key={`t${i}`} x={x} y={top} width={w} height={h} />);
    // pelipit (garis ornamen) di atas tiap tingkat
    const lx = dir === -1 ? inner - w - 5 : inner;
    parts.push(<rect key={`c${i}`} x={lx} y={top - 3} width={w + 5} height={4} />);
    // karang / tanduk di sudut luar
    const ox = dir === -1 ? inner - w - 5 : inner + w + 5;
    if (i < 8)
      parts.push(<path key={`h${i}`} d={`M${ox} ${top + 1} q ${dir * 9} -4 ${dir * 11} -16 q ${-dir * 4} 8 ${-dir * 11} 12 z`} />);
    y = top - 3;
  });
  // puncak
  const px = inner + dir * 6;
  parts.push(<path key="p" d={`M${px - 5} ${y} L${px} ${y - 16} L${px + 5} ${y} z`} />);
  return <g>{parts}</g>;
}

function Meru({ cx, scale = 1, tiers = 7 }: { cx: number; scale?: number; tiers?: number }) {
  const parts: React.ReactNode[] = [];
  let y = GROUND;
  parts.push(<rect key="base" x={cx - 48} y={y - 34} width={96} height={34} />);
  parts.push(<rect key="base2" x={cx - 54} y={y - 38} width={108} height={5} />);
  y -= 38;
  parts.push(<rect key="body" x={cx - 26} y={y - 22} width={52} height={22} />);
  y -= 22;
  for (let i = 0; i < tiers; i++) {
    const w = 132 - i * 15;
    const h = 13;
    parts.push(
      <path key={`r${i}`} d={`M${cx - w / 2} ${y} L${cx + w / 2} ${y} L${cx + w * 0.3} ${y - h} L${cx - w * 0.3} ${y - h} z`} />
    );
    y -= h;
    parts.push(<rect key={`p${i}`} x={cx - w * 0.18} y={y - 6} width={w * 0.36} height={6} />);
    y -= 6;
  }
  parts.push(<path key="f" d={`M${cx - 4} ${y} L${cx} ${y - 18} L${cx + 4} ${y} z`} />);
  return <g transform={`translate(${cx} ${GROUND}) scale(${scale}) translate(${-cx} ${-GROUND})`}>{parts}</g>;
}

function Penjor({ x, flip = false }: { x: number; flip?: boolean }) {
  return (
    <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
      <path d={`M${x} ${GROUND} C ${x - 8} 200, ${x - 6} 120, ${x + 22} 70 S ${x + 78} 26, ${x + 96} 54`} fill="none" strokeWidth={5} stroke="currentColor" strokeLinecap="round" />
      {/* hiasan sampian & lamak */}
      <path d={`M${x + 96} 54 l0 18`} stroke="currentColor" strokeWidth={2} />
      <path d={`M${x + 86} 72 h20 l-4 22 l-6 -8 l-6 8 z`} />
      <path d={`M${x - 3} 150 h16 v34 l-8 -8 l-8 8 z`} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${x + 4 + i * 16} ${86 - i * 9} l-3 14 l6 0 z`} />
      ))}
    </g>
  );
}

function Palm({ x, lean = 1, h = 190 }: { x: number; lean?: number; h?: number }) {
  const tx = x + lean * 40;
  const ty = GROUND - h;
  const fronds = [-150, -115, -75, -40, -10, 25];
  return (
    <g>
      <path d={`M${x - 5} ${GROUND} Q ${x + lean * 6} ${GROUND - h / 2} ${tx} ${ty} l3 2 Q ${x + lean * 14} ${GROUND - h / 2} ${x + 6} ${GROUND} z`} />
      {fronds.map((a, i) => {
        const r = (a * Math.PI) / 180;
        const ex = tx + Math.cos(r) * 70;
        const ey = ty + Math.sin(r) * 34 + 26;
        const mx = tx + Math.cos(r) * 38;
        const my = ty + Math.sin(r) * 34 - 12;
        return <path key={i} d={`M${tx} ${ty} Q ${mx} ${my} ${ex} ${ey} Q ${mx} ${my + 10} ${tx} ${ty + 4} z`} />;
      })}
    </g>
  );
}

/** Siluet panorama Bali untuk bagian bawah header. */
export function BaliSkyline({
  className = "",
  far = "#5A1520",
  near = "#2B060C",
  fit = "slice",
}: {
  className?: string;
  far?: string;
  near?: string;
  /** "slice" = penuhi area (layar sempit), "meet" = tampil utuh di tengah (layar lebar) */
  fit?: "slice" | "meet";
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 1200 300" preserveAspectRatio={`xMidYMax ${fit}`} className={className} aria-hidden>
      <defs>
        <radialGradient id={`sun${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F4D27A" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#E0A84A" stopOpacity="0.45" />
          <stop offset="1" stopColor="#E0A84A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="600" cy="168" r="150" fill={`url(#sun${id})`} />
      <g fill={far} opacity="0.9">
        <Meru cx={250} scale={0.82} />
        <Meru cx={950} scale={0.82} />
        <Meru cx={70} scale={0.55} tiers={5} />
        <Meru cx={1130} scale={0.55} tiers={5} />
        {/* pelengkap di luar bingkai — terlihat di layar lebar */}
        <Meru cx={-170} scale={0.7} />
        <Meru cx={1370} scale={0.7} />
        <Meru cx={-420} scale={0.5} tiers={5} />
        <Meru cx={1620} scale={0.5} tiers={5} />
        <rect x="-3000" y="286" width="7200" height="14" />
      </g>
      <g fill={near} color={near}>
        <Palm x={380} lean={-1} h={200} />
        <Palm x={840} lean={1} h={210} />
        <Palm x={20} lean={1} h={160} />
        <Palm x={1180} lean={-1} h={165} />
        <Palm x={-300} lean={1} h={190} />
        <Palm x={1500} lean={-1} h={185} />
        <Penjor x={430} flip />
        <Penjor x={770} />
        <CandiHalf inner={578} dir={-1} />
        <CandiHalf inner={622} dir={1} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={600 - (24 + i * 9)} y={268 + i * 8} width={48 + i * 18} height={8} />
        ))}
        <rect x="-3000" y="294" width="7200" height="6" />
      </g>
    </svg>
  );
}

/** Bunga jepun (kamboja) — ikon bunga khas Bali. */
export function Jepun({ size = 48, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id={`j${id}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="46">
          <stop offset="0" stopColor="#F2B731" />
          <stop offset="0.32" stopColor="#F8DC7A" />
          <stop offset="0.6" stopColor="#FFFDF6" />
          <stop offset="1" stopColor="#FFFFFF" />
        </radialGradient>
      </defs>
      <g fill={`url(#j${id})`} stroke="#E9DFC7" strokeWidth="0.8">
        {[0, 72, 144, 216, 288].map((r) => (
          <path key={r} transform={`rotate(${r})`} d="M0 0 C -10 -10 -16 -30 -6 -43 C 2 -52 17 -46 15 -31 C 13 -18 7 -8 0 0 Z" />
        ))}
      </g>
      <circle r="4" fill="#E9A51F" />
    </svg>
  );
}

/** Siluet orang untuk foto paslon yang belum diisi. */
export function PersonPlaceholder({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden>
      <circle cx="60" cy="62" r="27" fill="currentColor" />
      <path d="M8 160 C 10 116 34 98 60 98 C 86 98 110 116 112 160 Z" fill="currentColor" />
    </svg>
  );
}

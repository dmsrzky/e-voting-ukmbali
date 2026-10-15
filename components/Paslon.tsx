"use client";

import { pad2, type Paslon } from "@/lib/config";
import { shade } from "@/lib/color";
import { PersonPlaceholder } from "./bali";

/* ---------- Bingkai foto berbentuk gapura (atas melengkung) ---------- */
function Portrait({ src, alt, role, warna, big }: { src?: string; alt: string; role: string; warna: string; big: boolean }) {
  return (
    <figure className={`relative flex flex-col items-center ${big ? "w-[46%] max-w-[210px]" : "w-[62%] max-w-[230px]"}`}>
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-t-full rounded-b-2xl p-[3px]"
        style={{ background: "linear-gradient(180deg,#F3D98B,#C49A3C 60%,#8E6A1E)" }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-t-full rounded-b-[14px]"
          style={{ background: `radial-gradient(120% 80% at 50% 30%, ${shade(warna, 0.35)}, ${shade(warna, -0.25)})` }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
          ) : (
            <PersonPlaceholder className="absolute inset-x-0 bottom-0 h-[82%] w-full text-white/30" />
          )}
        </div>
      </div>
      <figcaption
        className="-mt-3 relative z-10 rounded-full border border-gold/60 bg-[#FFF8E6] px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: shade(warna, -0.2) }}
      >
        {role}
      </figcaption>
    </figure>
  );
}

/* ---------- Kartu paslon besar untuk halaman voting ---------- */
export function PaslonCard({ p, active, onSelect }: { p: Paslon; active: boolean; onSelect: () => void }) {
  const dark = shade(p.warna, -0.45);
  const duo = Boolean(p.wakil);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-[28px] bg-white text-left transition duration-200 ${
        active ? "-translate-y-0.5 shadow-[0_18px_40px_-16px_rgba(40,10,5,.55)]" : "shadow-[0_8px_24px_-18px_rgba(40,10,5,.5)] hover:-translate-y-0.5"
      }`}
      style={{ outline: `${active ? 4 : 1.5}px solid ${active ? p.warna : "#E7DCC7"}`, outlineOffset: active ? 0 : -1 }}
    >
      {/* panggung berwarna */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(165deg, ${p.warna} 0%, ${dark} 100%)` }}>
        <div className="patra absolute inset-0 opacity-70" />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(0deg, ${shade(dark, -0.3)}cc, transparent)` }} />

        {/* nomor urut */}
        <div className="relative z-10 flex items-start justify-between p-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full p-[2.5px]"
              style={{ background: "conic-gradient(from 210deg,#F6DE93,#B8862C,#F6DE93,#B8862C,#F6DE93)" }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full font-display text-[22px] font-bold text-[#FBE7AE]" style={{ background: dark }}>
                {pad2(p.nomor)}
              </div>
            </div>
            <div className="leading-tight text-white">
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">Nomor urut</div>
              <div className="font-display text-lg font-bold">Paslon {pad2(p.nomor)}</div>
            </div>
          </div>
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${active ? "border-white bg-white" : "border-white/60 bg-white/10"}`}
          >
            {active && (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={p.warna} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </span>
        </div>

        {/* foto */}
        <div className={`relative z-10 flex items-end justify-center gap-[4%] px-4 pb-6 ${duo ? "" : "pt-1"}`}>
          <Portrait src={p.fotoKetua} alt={`Calon ketua ${p.ketua}`} role={duo ? "Ketua" : "Calon Ketua"} warna={p.warna} big={duo} />
          {duo && <Portrait src={p.fotoWakil} alt={`Calon wakil ${p.wakil}`} role="Wakil" warna={p.warna} big />}
        </div>
      </div>

      <div className="tumpal h-2 opacity-80" />

      {/* nama */}
      <div className="px-5 pb-5 pt-3">
        <div className={`grid gap-3 ${duo ? "grid-cols-2" : "grid-cols-1 text-center"}`}>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">Calon Ketua</div>
            <div className="text-[15px] font-bold leading-snug">{p.ketua}</div>
          </div>
          {duo && (
            <div className="min-w-0 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">Calon Wakil</div>
              <div className="text-[15px] font-bold leading-snug">{p.wakil}</div>
            </div>
          )}
        </div>
        {p.tagline && (
          <p className="mt-3 border-t border-dashed border-sand pt-3 text-center text-sm italic text-ink/60">“{p.tagline}”</p>
        )}
        <div
          className={`mt-4 rounded-xl py-2.5 text-center text-sm font-semibold transition ${active ? "text-white" : "bg-cream text-ink/60 group-hover:bg-sand/60"}`}
          style={active ? { background: p.warna } : undefined}
        >
          {active ? "✓ Pilihanmu" : `Pilih Paslon ${pad2(p.nomor)}`}
        </div>
      </div>
    </button>
  );
}

/* ---------- Avatar kecil (dashboard & konfirmasi) ---------- */
function Avatar({ src, name, warna, size }: { src?: string; name: string; warna: string; size: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(160deg, ${warna}, ${shade(warna, -0.4)})`, fontSize: size * 0.34 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover object-top" />
      ) : (
        ini || "?"
      )}
    </div>
  );
}

export function PaslonMini({ p, size = 44 }: { p: Paslon; size?: number }) {
  return (
    <div className="relative flex shrink-0 items-center" style={{ paddingRight: 14 }}>
      <Avatar src={p.fotoKetua} name={p.ketua} warna={p.warna} size={size} />
      {p.wakil && (
        <div style={{ marginLeft: -size * 0.32 }}>
          <Avatar src={p.fotoWakil} name={p.wakil} warna={p.warna} size={size} />
        </div>
      )}
      <span
        className="absolute -bottom-1 right-0 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white px-1 font-display text-[11px] font-bold text-[#FBE7AE]"
        style={{ background: shade(p.warna, -0.45) }}
      >
        {pad2(p.nomor)}
      </span>
    </div>
  );
}

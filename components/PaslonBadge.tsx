import { pad2, type Paslon } from "@/lib/config";

/** Logo paslon kalau ada, kalau belum ada tampil nomor urut besar. */
export default function PaslonBadge({ p, size = 64 }: { p: Paslon; size?: number }) {
  if (p.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={p.logo}
        alt={`Logo paslon ${pad2(p.nomor)}`}
        width={size}
        height={size}
        className="shrink-0 rounded-2xl bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl font-extrabold text-white"
      style={{ width: size, height: size, background: p.warna, fontSize: size * 0.42 }}
    >
      {pad2(p.nomor)}
    </div>
  );
}

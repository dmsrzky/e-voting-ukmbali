import { PASLON, type Paslon } from "./config";

/** Baris tabel `paslon` di Supabase */
export type PaslonRow = {
  nomor: number;
  ketua: string;
  wakil: string | null;
  tagline: string | null;
  warna: string;
  foto_ketua: string | null;
  foto_wakil: string | null;
};

export const fromRow = (r: PaslonRow): Paslon => ({
  nomor: r.nomor,
  ketua: r.ketua,
  wakil: r.wakil || undefined,
  tagline: r.tagline || undefined,
  warna: r.warna,
  fotoKetua: r.foto_ketua || undefined,
  fotoWakil: r.foto_wakil || undefined,
});

/** Data dari database; kalau tabel belum dibuat/kosong → pakai lib/config.ts */
export const withFallback = (rows: PaslonRow[] | null | undefined): Paslon[] =>
  rows && rows.length ? [...rows].sort((a, b) => a.nomor - b.nomor).map(fromRow) : PASLON;

export const PASLON_COLS = "nomor, ketua, wakil, tagline, warna, foto_ketua, foto_wakil";

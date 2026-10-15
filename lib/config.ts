// =====================================================================
//  KONFIGURASI ACARA
//  Data paslon sekarang dikelola dari Dashboard → tab "Kelola Paslon".
//  Daftar PASLON di bawah hanya CADANGAN kalau tabel paslon belum dibuat.
// =====================================================================

export const EVENT = {
  judul: "Pemilihan Ketua UKM Bali",
  periode: "2026/2027",
  kampus: "Telkom University Surabaya",
  // (opsional) foto latar header, mis. foto pura/pantai Bali milik UKM sendiri.
  // Taruh di /public lalu isi "/hero.jpg". Kosongkan untuk pakai ilustrasi bawaan.
  heroImage: "",
};

export type Paslon = {
  nomor: number; // nomor urut (isi sesuai hasil spin)
  ketua: string;
  wakil?: string; // kosongkan kalau calonnya tunggal (tanpa wakil)
  // Foto: taruh di /public/paslon/ lalu tulis path-nya.
  // Paling bagus: potret 3:4 (mis. 900×1200 px), PNG background transparan / sudah di-remove bg.
  fotoKetua?: string; // mis. "/paslon/1-ketua.png"
  fotoWakil?: string; // mis. "/paslon/1-wakil.png"
  tagline?: string; // (opsional) slogan singkat, maks ±60 karakter
  warna: string; // warna utama kartu & grafik
};

export const PASLON: Paslon[] = [
  {
    nomor: 1,
    ketua: "Nama Calon Ketua 1",
    wakil: "Nama Calon Wakil 1",
    fotoKetua: "",
    fotoWakil: "",
    tagline: "",
    warna: "#A8232F", // merah
  },
  {
    nomor: 2,
    ketua: "Nama Calon Ketua 2",
    wakil: "Nama Calon Wakil 2",
    fotoKetua: "",
    fotoWakil: "",
    tagline: "",
    warna: "#17624F", // hijau
  },
  {
    nomor: 3,
    ketua: "Nama Calon Ketua 3",
    wakil: "Nama Calon Wakil 3",
    fotoKetua: "",
    fotoWakil: "",
    tagline: "",
    warna: "#24457F", // biru
  },
];

export const getPaslon = (nomor: number) => PASLON.find((p) => p.nomor === nomor);
export const pad2 = (n: number) => String(n).padStart(2, "0");

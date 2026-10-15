"use client";
import { prepForOcr } from "./image";

/*
 * Aturan validasi (KETAT):
 *   ✓ COCOK  = NIM yang diinput terbaca di KTM  DAN  nama yang diinput = nama LENGKAP di KTM
 *   ⚠ CEK    = salah satu tidak terpenuhi (nama tidak lengkap / beda, NIM beda / tidak terbaca)
 *   ? BURAM  = hampir tidak ada teks yang terbaca
 *
 * Skor nama dihitung dua arah:
 *   kata cocok / (kata di input + kata di baris nama KTM yang TIDAK ada di input)
 *   → "Dimas Rizky" vs KTM "DIMAS RIZKY PRATAMA" = 2/3 = 67% → CEK (nama tidak lengkap)
 */

export type OcrResult = {
  text: string;
  namaScore: number; // 0..1
  nimMatch: boolean;
  status: "cocok" | "cek" | "tidak_terbaca";
};

// kata label di KTM yang bukan bagian dari nama
const STOP = new Set([
  "NAMA", "NAME", "NIM", "NO", "NOMOR", "PRODI", "PROGRAM", "STUDI", "FAKULTAS", "JURUSAN", "KARTU", "TANDA",
  "MAHASISWA", "STUDENT", "CARD", "ID", "IDENTITAS", "UNIVERSITAS", "UNIVERSITY", "TELKOM", "SURABAYA", "BANDUNG",
  "JAKARTA", "PURWOKERTO", "TTL", "TEMPAT", "TANGGAL", "LAHIR", "ALAMAT", "BERLAKU", "HINGGA", "SAMPAI", "ANGKATAN",
  "TEKNIK", "ELEKTRO", "INFORMATIKA", "SISTEM", "INFORMASI", "INDUSTRI", "SAINS", "DATA", "BISNIS", "DIGITAL",
  "LOGISTIK", "TELEKOMUNIKASI", "KOMPUTER", "PERANGKAT", "LUNAK", "DESAIN", "KOMUNIKASI", "MANAJEMEN", "AKUNTANSI",
  "SARJANA", "DIPLOMA", "S1", "D3", "D4", "S2",
]);

function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

const words = (s: string) =>
  s.toUpperCase().replace(/[^A-Z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2);

// toleransi salah baca OCR: kata pendek harus persis, kata panjang boleh beda 1–2 huruf
const same = (a: string, b: string) => {
  if (a === b) return true;
  const L = Math.min(a.length, b.length);
  const tol = L >= 8 ? 2 : L >= 5 ? 1 : 0;
  return tol > 0 && lev(a, b) <= tol;
};

export function matchNama(nama: string, ocrText: string) {
  const input = words(nama);
  if (!input.length) return 0;

  // cari baris KTM yang paling banyak memuat kata dari nama input = baris nama
  const lines = ocrText.split(/\r?\n/).map((l) => words(l).filter((w) => !STOP.has(w)));
  let best: string[] = [];
  let bestHit = 0;
  for (const l of lines) {
    const hit = input.filter((t) => l.some((w) => same(w, t))).length;
    if (hit > bestHit) {
      bestHit = hit;
      best = l;
    }
  }
  if (bestHit === 0) return 0;

  // nama di KTM kadang terpotong ke 2 baris → ikutkan baris berikutnya kalau isinya kata nama juga
  const idx = lines.indexOf(best);
  const next = lines[idx + 1] ?? [];
  const nameLine = next.length && next.length <= 3 && next.some((w) => input.some((t) => same(w, t))) ? [...best, ...next] : best;

  const matched = input.filter((t) => nameLine.some((w) => same(w, t))).length;
  // kata di baris nama KTM yang tidak ada di input → nama yang diinput tidak lengkap
  const extra = nameLine.filter((w) => w.length >= 3 && !input.some((t) => same(w, t))).length;
  return matched / (input.length + extra);
}

/** NIM harus muncul sebagai satu deret angka utuh, persis sama. Huruf yang mirip angka (O→0, I→1, S→5) dikoreksi dulu. */
export function matchNim(nim: string, ocrText: string) {
  if (nim.length < 6) return false;
  const fixed = ocrText
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((tok) => tok.length >= 6 && (tok.match(/\d/g)?.length ?? 0) >= tok.length * 0.6) // token yang mayoritas angka
    .map((tok) => tok.replace(/[OQD]/g, "0").replace(/[IL|]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2"));
  // harus PERSIS sama (NIM berurutan cuma beda 1 digit, jadi tidak boleh ada toleransi)
  return fixed.some((tok) => tok === nim);
}

export function judge(nama: string, nim: string, text: string): OcrResult {
  const namaScore = matchNama(nama, text);
  const nimMatch = matchNim(nim, text);
  const clean = text.replace(/\s/g, "");
  let status: OcrResult["status"];
  if (namaScore >= 0.999 && nimMatch) status = "cocok";
  else if (clean.length < 12) status = "tidak_terbaca";
  else status = "cek";
  return { text, namaScore, nimMatch, status };
}

/** Alasan singkat untuk ditampilkan di dashboard. */
export function ocrReasons(r: { ocr_status: string | null; ocr_nama_score: number | null; ocr_nim_match: boolean | null }) {
  if (!r.ocr_status) return [];
  if (r.ocr_status === "tidak_terbaca") return ["Teks KTM tidak terbaca, cek manual"];
  const out: string[] = [];
  const s = r.ocr_nama_score ?? 0;
  if (s === 0) out.push("Nama tidak ditemukan di KTM");
  else if (s < 0.999) out.push("Nama tidak lengkap / berbeda dengan KTM");
  if (!r.ocr_nim_match) out.push("NIM tidak cocok / tidak terbaca");
  return out;
}

// Satu worker Tesseract dipakai ulang untuk semua foto (lebih cepat)
let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  }
  return workerPromise;
}

export async function runOcr(image: Blob, nama: string, nim: string): Promise<OcrResult> {
  const worker = await getWorker();
  const canvas = await prepForOcr(image);
  const { data } = await worker.recognize(canvas);
  return judge(nama, nim, data.text || "");
}

export async function terminateOcr() {
  if (workerPromise) {
    (await workerPromise).terminate();
    workerPromise = null;
  }
}

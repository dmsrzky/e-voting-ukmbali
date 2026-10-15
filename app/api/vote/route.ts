import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { cleanNama, cleanNim, normNama } from "@/lib/normalize";
import { PASLON } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // batas Vercel ±4.5 MB; foto sudah dikompres di browser

const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Data tidak terbaca. Coba kirim ulang.");
  }

  const nama = cleanNama(String(form.get("nama") ?? ""));
  const nim = cleanNim(String(form.get("nim") ?? ""));
  const paslon = Number(form.get("paslon"));
  const ktm = form.get("ktm");

  if (nama.length < 3 || nama.length > 100) return fail("Nama lengkap wajib diisi (min. 3 huruf).");
  if (!/^[0-9]{6,15}$/.test(nim)) return fail("NIM harus berupa angka (6–15 digit).");
  if (!Number.isInteger(paslon) || paslon < 1) return fail("Pilihan paslon tidak valid.");
  if (!(ktm instanceof File) || ktm.size === 0) return fail("Foto KTM wajib diunggah.");
  if (!ktm.type.startsWith("image/")) return fail("File KTM harus berupa gambar.");
  if (ktm.size > MAX_BYTES) return fail("Ukuran foto terlalu besar. Coba foto ulang.");

  const sb = supabaseServer();

  // 1. Voting masih dibuka?
  const { data: setting } = await sb.from("settings").select("voting_open").eq("id", 1).single();
  if (!setting?.voting_open) return fail("Voting sudah ditutup.", 403);

  // Paslon harus ada di database (atau di config kalau tabel paslon belum dibuat)
  const { data: pRows, error: pErr } = await sb.from("paslon").select("nomor");
  const nomorValid = pErr || !pRows?.length ? PASLON.map((p) => p.nomor) : pRows.map((r) => r.nomor as number);
  if (!nomorValid.includes(paslon)) return fail("Pilihan paslon tidak valid. Muat ulang halaman lalu pilih lagi.");

  // 2. Cek duplikat sebelum upload (hemat storage)
  const [byNim, byNama] = await Promise.all([
    sb.from("votes").select("id", { count: "exact", head: true }).eq("nim", nim),
    sb.from("votes").select("id", { count: "exact", head: true }).eq("nama_norm", normNama(nama)),
  ]);
  if ((byNim.count ?? 0) > 0)
    return fail("NIM ini sudah pernah digunakan untuk memilih. Satu NIM hanya bisa memilih satu kali.", 409);
  if ((byNama.count ?? 0) > 0)
    return fail("Nama ini sudah pernah memberikan suara. Satu orang hanya bisa memilih satu kali.", 409);

  // 3. Upload foto KTM ke bucket privat
  const path = `${nim}-${Date.now()}.jpg`;
  const bytes = new Uint8Array(await ktm.arrayBuffer());
  const up = await sb.storage.from("ktm").upload(path, bytes, { contentType: ktm.type, upsert: false });
  if (up.error) return fail("Gagal mengunggah foto KTM. Coba lagi.", 500);

  // 4. Simpan suara (unique index di DB jadi pengaman terakhir kalau ada 2 kiriman bersamaan)
  const ins = await sb.from("votes").insert({ nama, nim, paslon, ktm_path: path });
  if (ins.error) {
    await sb.storage.from("ktm").remove([path]);
    if (ins.error.code === "23505") {
      return fail(
        ins.error.message.includes("nim")
          ? "NIM ini sudah pernah digunakan untuk memilih."
          : "Nama ini sudah pernah memberikan suara.",
        409
      );
    }
    return fail("Gagal menyimpan suara. Coba lagi.", 500);
  }

  return NextResponse.json({ ok: true });
}

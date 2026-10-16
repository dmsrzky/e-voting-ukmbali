"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT, PASLON, pad2, type Paslon } from "@/lib/config";
import { cleanNim } from "@/lib/normalize";
import { compressImage } from "@/lib/image";
import { PaslonCard, PaslonMini } from "@/components/Paslon";
import { BaliSkyline, Jepun } from "@/components/bali";

type Phase = "loading" | "open" | "closed" | "error" | "done";

export default function VotePage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [list, setList] = useState<Paslon[]>(PASLON);
  const [nama, setNama] = useState("");
  const [nim, setNim] = useState("");
  const [paslon, setPaslon] = useState<number | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.paslon) && d.paslon.length) setList(d.paslon);
        setPhase(d.error ? "error" : d.open ? "open" : "closed");
      })
      .catch(() => setPhase("error"));
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPreparing(true);
    try {
      const blob = await compressImage(f);
      setFile(blob);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError("Foto tidak bisa dibaca. Coba pakai foto lain (format JPG/PNG).");
    } finally {
      setPreparing(false);
      e.target.value = "";
    }
  }

  const steps = [nama.trim().length >= 3 && /^[0-9]{6,15}$/.test(nim), Boolean(paslon), Boolean(file), agree];
  const valid = steps.every(Boolean);

  async function submit() {
    if (!valid || !file || !paslon) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("nama", nama);
    fd.append("nim", nim);
    fd.append("paslon", String(paslon));
    fd.append("ktm", file, "ktm.jpg");
    try {
      const r = await fetch("/api/vote", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      setConfirm(false);
      if (!r.ok) {
        setError(d.error || "Terjadi kesalahan. Coba lagi.");
        if (r.status === 403) setPhase("closed");
        return;
      }
      setPhase("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setConfirm(false);
      setError("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const chosen = paslon ? list.find((p) => p.nomor === paslon) : null;

  return (
    <main className="min-h-dvh">
      <Hero />

      <div className="mx-auto max-w-xl px-4 pb-10 pt-6">
        {phase === "loading" && <div className="card p-10 text-center text-ink/50">Memuat…</div>}

        {phase === "closed" && (
          <Notice title="Voting sudah ditutup" body="Terima kasih atas partisipasi semeton sareng sami. Hasil pemilihan akan diumumkan oleh panitia." />
        )}

        {phase === "error" && <Notice title="Sistem belum siap" body="Silakan muat ulang halaman beberapa saat lagi atau hubungi panitia." />}

        {phase === "done" && (
          <Notice
            title="Suksma! Suaramu sudah tercatat"
            body="Terima kasih telah menggunakan hak pilihmu dalam Pemilihan Ketua UKM Bali. Suaramu akan diverifikasi oleh panitia. Kamu bisa menutup halaman ini."
            big
          />
        )}

        {phase === "open" && (
          <div className="space-y-5">
            {/* progres */}
            <div className="flex items-center gap-2 px-1">
              {["Data diri", "Paslon", "KTM", "Kirim"].map((s, i) => (
                <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className={`h-1.5 w-full rounded-full transition ${steps[i] ? "bg-maroon" : "bg-sand"}`} />
                  <span className={`text-[11px] font-medium ${steps[i] ? "text-maroon" : "text-ink/40"}`}>{s}</span>
                </div>
              ))}
            </div>

            {/* 1. Data diri */}
            <section className="card p-5 sm:p-6">
              <StepTitle n={1} title="Data Pemilih" sub="Isi sesuai yang tertulis di KTM" />
              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Nama lengkap</span>
                  <input className="field" placeholder="Tulis nama LENGKAP sesuai KTM" value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" maxLength={100} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">NIM</span>
                  <input className="field tabular-nums" placeholder="Contoh: 1102240001" inputMode="numeric" value={nim} onChange={(e) => setNim(cleanNim(e.target.value).slice(0, 15))} />
                </label>
              </div>
            </section>

            {/* 2. Pilih paslon */}
            <section>
              <div className="card mb-4 p-5 sm:p-6">
                <StepTitle n={2} title="Pilih Pasangan Calon" sub="Ketuk salah satu kartu di bawah" />
              </div>
              <div
                className={list.length === 2 ? "grid gap-5 lg:-mx-48 lg:grid-cols-2" : "space-y-5"}
                role="radiogroup"
                aria-label="Pasangan calon"
              >
                {list.map((p) => (
                  <PaslonCard key={p.nomor} p={p} active={paslon === p.nomor} onSelect={() => setPaslon(p.nomor)} />
                ))}
              </div>
            </section>

            {/* 3. KTM */}
            <section className="card p-5 sm:p-6">
              <StepTitle n={3} title="Foto KTM" sub="Nama & NIM harus terbaca jelas, tidak buram dan tidak silau" />
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
              {preview ? (
                <div className="mt-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Pratinjau KTM" className="max-h-72 w-full rounded-2xl border border-sand bg-sand/30 object-contain" />
                  <button type="button" className="btn-ghost mt-3 w-full" onClick={() => inputRef.current?.click()}>
                    Ganti foto
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={preparing}
                  className="mt-5 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gold/60 bg-gold-soft/40 px-4 py-9 text-center transition hover:bg-gold-soft/70"
                >
                  <svg viewBox="0 0 48 48" className="h-11 w-11 text-maroon" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="38" height="28" rx="5" />
                    <circle cx="17" cy="23" r="4.5" />
                    <path d="M10 34c1.5-4 4-5.5 7-5.5s5.5 1.5 7 5.5M28 21h9M28 27h7" />
                  </svg>
                  <span className="font-semibold">{preparing ? "Menyiapkan foto…" : "Ambil / unggah foto KTM"}</span>
                  <span className="text-xs text-ink/50">Bisa langsung dari kamera HP</span>
                </button>
              )}
            </section>

            {/* Pernyataan + kirim */}
            <section className="card p-5 sm:p-6">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-maroon" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  Saya menyatakan data yang saya isi adalah benar milik saya, dan memahami bahwa suara dengan data tidak valid dapat dinyatakan{" "}
                  <b>tidak sah</b> oleh panitia.
                </span>
              </label>

              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

              <button className="btn-primary mt-5 w-full py-4 text-base" disabled={!valid || busy} onClick={() => setConfirm(true)}>
                Kirim Suara
              </button>
              {!valid && <p className="mt-2 text-center text-xs text-ink/45">Lengkapi semua langkah di atas untuk mengirim suara.</p>}
            </section>
          </div>
        )}
      </div>

      <Footer />

      {/* Modal konfirmasi */}
      {confirm && chosen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center">
          <div className="pop w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="poleng h-2" />
            <div className="p-6">
              <h3 className="font-display text-xl font-bold">Konfirmasi Pilihan</h3>
              <p className="mt-1 text-sm text-ink/55">Suara yang sudah dikirim tidak bisa diubah.</p>
              <div className="mt-5 flex items-center gap-4 rounded-2xl p-4 text-white" style={{ background: chosen.warna }}>
                <PaslonMini p={chosen} size={50} />
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white/80">Paslon {pad2(chosen.nomor)}</div>
                  <div className="truncate font-bold">{chosen.ketua}</div>
                  {chosen.wakil && <div className="truncate text-sm text-white/80">{chosen.wakil}</div>}
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink/50">Nama</dt><dd className="truncate font-semibold">{nama.trim()}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink/50">NIM</dt><dd className="font-semibold tabular-nums">{nim}</dd></div>
              </dl>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button className="btn-ghost" onClick={() => setConfirm(false)} disabled={busy}>Kembali</button>
                <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Mengirim…" : "Ya, kirim"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Hero() {
  const photo = EVENT.heroImage;
  return (
    <header className="relative overflow-hidden text-white">
      <div
        className="absolute inset-0"
        style={
          photo
            ? { background: `linear-gradient(180deg,rgba(60,10,18,.75),rgba(60,10,18,.55)), url(${photo}) center/cover` }
            : { background: "linear-gradient(180deg,#4E111B 0%,#7A1F2B 42%,#A9472E 78%,#D9894A 100%)" }
        }
      />
      <div className="patra absolute inset-0 opacity-60" />
      <Jepun size={58} className="floaty absolute -right-4 top-1 opacity-95 sm:right-[8%] sm:top-16" style={{ ["--r" as string]: "18deg" }} />
      <Jepun size={38} className="floaty absolute right-[12%] top-32 hidden opacity-90 sm:block" style={{ ["--r" as string]: "-25deg", animationDelay: "1.2s" }} />
      <Jepun size={44} className="floaty absolute left-[6%] top-28 hidden opacity-80 sm:block" style={{ ["--r" as string]: "40deg", animationDelay: ".6s" }} />

      <div className="relative mx-auto max-w-xl px-5 pt-9">
        <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-gold/40 bg-black/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-soft backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> E-Voting Resmi · UKM Bali
        </div>
        <p className="mt-5 font-display text-sm font-semibold tracking-[0.2em] text-gold-soft">OM SWASTYASTU</p>
        <h1 className="mt-1 font-display text-[30px] font-bold leading-[1.1] drop-shadow-sm sm:text-[40px]">{EVENT.judul}</h1>
        <div className="mt-3 flex items-center gap-3">
          <span className="h-px w-8 bg-gold/70" />
          <span className="text-sm font-medium text-white/85">Periode {EVENT.periode}</span>
        </div>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/85">Satu anggota, satu suara. Gunakan hak pilihmu dengan bijak untuk UKM Bali yang lebih baik.</p>
      </div>

      {photo ? (
        <div className="h-16" />
      ) : (
        <>
          <BaliSkyline className="relative mt-2 block h-[150px] w-full sm:hidden" />
          <BaliSkyline fit="meet" className="relative mt-4 hidden h-[230px] w-full sm:block" />
        </>
      )}
      <div className="poleng relative h-2.5" />
    </header>
  );
}

function StepTitle({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <span className="absolute inset-1 rotate-45 rounded-md border-2 border-gold bg-maroon" />
        <span className="relative font-display text-sm font-bold text-gold-soft">{n}</span>
      </span>
      <div>
        <h2 className="text-[17px] font-bold leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink/50">{sub}</p>}
      </div>
    </div>
  );
}

function Notice({ title, body, big }: { title: string; body: string; big?: boolean }) {
  return (
    <div className="card pop overflow-hidden text-center">
      <div className="relative flex justify-center bg-gradient-to-b from-gold-soft/70 to-white pb-2 pt-8">
        <Jepun size={big ? 92 : 70} className="floaty" />
      </div>
      <div className="px-7 pb-8">
        <h2 className="font-display text-2xl font-bold text-maroon">{title}</h2>
        <p className="mt-3 leading-relaxed text-ink/60">{body}</p>
      </div>
      <div className="poleng h-2" />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-4 bg-[#2B060C] text-center text-white/70">
      <div className="tumpal h-2 rotate-180 opacity-90" />
      <div className="px-4 py-7">
        <p className="font-display text-sm tracking-[0.16em] text-gold-soft">OM SANTIH, SANTIH, SANTIH OM</p>
        <p className="mt-2 text-xs">Panitia {EVENT.judul} · {EVENT.kampus}</p>
      </div>
    </footer>
  );
}

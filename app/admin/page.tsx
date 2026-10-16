"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EVENT, pad2, type Paslon } from "@/lib/config";
import { PASLON_COLS, withFallback, type PaslonRow } from "@/lib/paslon-data";
import PaslonManager from "@/components/PaslonManager";
import { ocrReasons, runOcr, terminateOcr } from "@/lib/ocr";
import { PaslonMini } from "@/components/Paslon";
import { BaliSkyline, Jepun } from "@/components/bali";
import { consumeIdleFlag, markActiveNow, useIdleLogout, IDLE_TIMEOUT_MS } from "@/lib/idle";

type Vote = {
  id: string;
  created_at: string;
  nama: string;
  nim: string;
  paslon: number;
  ktm_path: string;
  ocr_text?: string | null; // hanya diambil saat detail dibuka
  ocr_nama_score: number | null;
  ocr_nim_match: boolean | null;
  ocr_status: "cocok" | "cek" | "tidak_terbaca" | null;
  status: "pending" | "sah" | "tidak_sah";
  catatan: string | null;
  verified_by: string | null;
  verified_at: string | null;
};

const REFRESH_MS = 5000;
const LIST_COLS =
  "id, created_at, nama, nim, paslon, ktm_path, ocr_nama_score, ocr_nim_match, ocr_status, status, catatan, verified_by, verified_at";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function AdminPage() {
  const sb = supabaseBrowser();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  if (session === undefined) return <Center>Memuat…</Center>;
  if (!session) return <Login />;
  return <Dashboard email={session.user.email ?? ""} />;
}

/* ============================== LOGIN ============================== */

function Login() {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idleNote, setIdleNote] = useState(false);
  useEffect(() => setIdleNote(consumeIdleFlag()), []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    markActiveNow();
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) setErr("Email atau password salah.");
    setBusy(false);
  }

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4"
      style={{ background: "linear-gradient(180deg,#4E111B 0%,#7A1F2B 45%,#A9472E 80%,#D9894A 100%)" }}
    >
      <div className="patra absolute inset-0 opacity-60" />
      <BaliSkyline className="absolute inset-x-0 bottom-0 h-[38vh] w-full sm:hidden" />
      <BaliSkyline fit="meet" className="absolute inset-x-0 bottom-0 hidden h-[40vh] w-full sm:block" />
      <form onSubmit={go} className="pop relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="poleng h-2" />
        <div className="p-7">
        <div className="flex items-center gap-3">
          <Jepun size={40} />
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-maroon">Dashboard Panitia</div>
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold leading-tight">{EVENT.judul}</h1>
        <p className="text-sm text-ink/50">Periode {EVENT.periode}</p>
        <div className="mt-6 space-y-3">
          <input className="field" type="email" placeholder="Email admin" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="field" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        {idleNote && !err && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Kamu otomatis keluar karena tidak ada aktivitas selama {IDLE_TIMEOUT_MS / 60000} menit. Silakan masuk lagi.
          </p>
        )}
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        <button className="btn-primary mt-5 w-full" disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
        </div>
      </form>
    </main>
  );
}

/* ============================ DASHBOARD ============================ */

function Dashboard({ email }: { email: string }) {
  const sb = supabaseBrowser();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [mode, setMode] = useState<"valid" | "sah">("valid");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fOcr, setFOcr] = useState<string>("all");
  const [selected, setSelected] = useState<Vote | null>(null);
  const [tab, setTab] = useState<"rekap" | "paslon">("rekap");
  const [pRows, setPRows] = useState<PaslonRow[]>([]);
  const list = useMemo(() => withFallback(pRows), [pRows]);
  const getP = useCallback((n: number) => list.find((p) => p.nomor === n), [list]);

  const loadPaslon = useCallback(async () => {
    const { data, error } = await sb.from("paslon").select(PASLON_COLS).order("nomor");
    if (!error) setPRows((data ?? []) as PaslonRow[]);
  }, [sb]);
  useEffect(() => {
    loadPaslon();
  }, [loadPaslon]);
  const [ocrProg, setOcrProg] = useState<{ done: number; total: number } | null>(null);
  const ocrRunning = useRef(false);
  ocrRunning.current = ocrProg !== null;
  const doSignOut = useCallback(async () => {
    await sb.auth.signOut();
  }, [sb]);
  // auto-logout 10 menit tanpa aktivitas (tidak berlaku saat OCR massal sedang berjalan)
  const idle = useIdleLogout(doSignOut, () => ocrRunning.current);

  const urlsRef = useRef<Record<string, string>>({});
  const loadedOnce = useRef(false);
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const [s, v] = await Promise.all([
        sb.from("settings").select("voting_open").eq("id", 1).maybeSingle(),
        // tanpa ocr_text supaya refresh tiap 5 detik tetap ringan (hemat kuota Supabase)
        sb.from("votes").select(LIST_COLS).order("created_at", { ascending: false }),
      ]);
      if (s.error || v.error) {
        // gangguan jaringan sesaat: jangan tendang admin, coba lagi di siklus berikutnya
        if (!loadedOnce.current && !s.error && !s.data) setAllowed(false);
        return;
      }
      if (!s.data) {
        setAllowed(false);
        return;
      }
      loadedOnce.current = true;
      setAllowed(true);
      setOpen(s.data.voting_open);
      const rows = (v.data ?? []) as unknown as Vote[];
      setVotes(rows);
      setLastSync(new Date());

      // signed URL hanya untuk foto baru
      const missing = rows.map((r) => r.ktm_path).filter((p) => !urlsRef.current[p]);
      if (missing.length) {
        missing.forEach((p) => (urlsRef.current[p] = "")); // tandai sedang diambil
        const { data } = await sb.storage.from("ktm").createSignedUrls(missing, 60 * 60 * 8);
        data?.forEach((d) => d.path && d.signedUrl && (urlsRef.current[d.path] = d.signedUrl));
        missing.forEach((p) => urlsRef.current[p] === "" && delete urlsRef.current[p]);
        setUrls({ ...urlsRef.current });
      }
    } finally {
      loading.current = false;
    }
  }, [sb]);

  // auto-refresh tiap 5 detik (berhenti sementara saat tab tidak dibuka)
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  async function toggleOpen() {
    const next = !open;
    if (!confirm(next ? "Buka kembali voting?" : "Tutup voting sekarang? Pemilih tidak bisa mengirim suara lagi.")) return;
    const { error } = await sb.from("settings").update({ voting_open: next, updated_at: new Date().toISOString() }).eq("id", 1);
    if (!error) setOpen(next);
  }

  async function setStatus(v: Vote, status: Vote["status"], catatan?: string) {
    const patch = {
      status,
      catatan: catatan ?? v.catatan,
      verified_by: status === "pending" ? null : email,
      verified_at: status === "pending" ? null : new Date().toISOString(),
    };
    const { error } = await sb.from("votes").update(patch).eq("id", v.id);
    if (error) return alert("Gagal menyimpan: " + error.message);
    setVotes((cur) => cur.map((x) => (x.id === v.id ? { ...x, ...patch } : x)));
    setSelected((cur) => (cur && cur.id === v.id ? { ...cur, ...patch } : cur));
  }

  async function removeVote(v: Vote) {
    if (!confirm(`Hapus permanen suara ${v.nama} (${v.nim})? Gunakan hanya untuk data uji coba.`)) return;
    await sb.storage.from("ktm").remove([v.ktm_path]);
    const { error } = await sb.from("votes").delete().eq("id", v.id);
    if (error) return alert("Gagal menghapus: " + error.message);
    setVotes((cur) => cur.filter((x) => x.id !== v.id));
    setSelected(null);
  }

  async function ocrOne(v: Vote) {
    const { data, error } = await sb.storage.from("ktm").download(v.ktm_path);
    if (error || !data) throw error ?? new Error("download gagal");
    const r = await runOcr(data, v.nama, v.nim);
    const patch = {
      ocr_text: r.text.slice(0, 4000),
      ocr_nama_score: Math.round(r.namaScore * 100) / 100,
      ocr_nim_match: r.nimMatch,
      ocr_status: r.status,
    };
    await sb.from("votes").update(patch).eq("id", v.id);
    setVotes((cur) => cur.map((x) => (x.id === v.id ? { ...x, ...patch } : x)));
    setSelected((cur) => (cur && cur.id === v.id ? { ...cur, ...patch } : cur));
  }

  async function ocrBatch(all: boolean) {
    const list = votes.filter((v) => all || !v.ocr_status);
    if (!list.length) return;
    setOcrProg({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        await ocrOne(list[i]);
      } catch {
        /* lanjut ke berikutnya */
      }
      setOcrProg({ done: i + 1, total: list.length });
    }
    await terminateOcr();
    setOcrProg(null);
  }

  async function approveMatched() {
    const list = votes.filter((v) => v.status === "pending" && v.ocr_status === "cocok");
    if (!list.length) return alert("Tidak ada suara pending dengan OCR cocok.");
    if (!confirm(`Sahkan ${list.length} suara yang hasil OCR-nya cocok? Sebaiknya cek sekilas dulu fotonya.`)) return;
    for (const v of list) await setStatus(v, "sah");
  }

  function exportCsv() {
    const head = ["No", "Waktu (WIB)", "Nama", "NIM", "Paslon", "Ketua", "Status", "OCR", "Skor Nama", "NIM Terbaca", "Catatan", "Diverifikasi oleh"];
    const rows = [...votes].reverse().map((v, i) => [
      i + 1,
      fmtTime(v.created_at),
      v.nama,
      `'${v.nim}`,
      pad2(v.paslon),
      getP(v.paslon)?.ketua ?? "",
      v.status,
      v.ocr_status ?? "",
      v.ocr_nama_score ?? "",
      v.ocr_nim_match == null ? "" : v.ocr_nim_match ? "ya" : "tidak",
      v.catatan ?? "",
      v.verified_by ?? "",
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rekap-suara-ukm-bali-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  /* ---------- turunan data ---------- */
  const voteCount = useMemo(() => {
    const c: Record<number, number> = {};
    votes.forEach((v) => (c[v.paslon] = (c[v.paslon] ?? 0) + 1));
    return c;
  }, [votes]);

  const stats = useMemo(() => {
    const s = { total: votes.length, sah: 0, pending: 0, tidak_sah: 0, ocrDone: 0, cocok: 0 };
    votes.forEach((v) => {
      s[v.status]++;
      if (v.ocr_status) s.ocrDone++;
      if (v.ocr_status === "cocok") s.cocok++;
    });
    return s;
  }, [votes]);

  const results = useMemo(() => {
    const counted = votes.filter((v) => (mode === "sah" ? v.status === "sah" : v.status !== "tidak_sah"));
    const total = counted.length;
    const rows = list.map((p) => {
      const n = counted.filter((v) => v.paslon === p.nomor).length;
      return { p, n, pct: total ? (n / total) * 100 : 0 };
    });
    const max = Math.max(...rows.map((r) => r.n));
    return { total, rows, max };
  }, [votes, mode, list]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return votes.filter(
      (v) =>
        (fStatus === "all" || v.status === fStatus) &&
        (fOcr === "all" || (fOcr === "none" ? !v.ocr_status : v.ocr_status === fOcr)) &&
        (!k || v.nama.toLowerCase().includes(k) || v.nim.includes(k))
    );
  }, [votes, q, fStatus, fOcr]);

  if (allowed === null) return <Center>Memeriksa akses…</Center>;
  if (!allowed)
    return (
      <Center>
        <div className="card max-w-sm p-7 text-center">
          <div className="text-4xl">⛔</div>
          <h2 className="mt-3 text-lg font-bold">Akun ini bukan admin</h2>
          <p className="mt-1 text-sm text-ink/60">{email} belum terdaftar di tabel admins.</p>
          <button className="btn-ghost mt-5 w-full" onClick={() => sb.auth.signOut()}>Keluar</button>
        </div>
      </Center>
    );

  const leader = results.max > 0 ? results.rows.filter((r) => r.n === results.max) : [];

  return (
    <main className="min-h-dvh pb-16">
      {/* Top bar */}
      <header className="relative overflow-hidden text-white" style={{ background: "linear-gradient(120deg,#4E111B,#7A1F2B 55%,#A9472E)" }}>
        <div className="patra absolute inset-0 opacity-60" />
        <BaliSkyline fit="meet" className="pointer-events-none absolute bottom-0 right-0 h-full w-[720px] max-w-full opacity-40" far="#3a0b12" near="#2B060C" />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6">
          <Jepun size={44} className="hidden sm:block" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-soft">Dashboard Panitia</div>
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{EVENT.judul} {EVENT.periode}</h1>
          </div>
          <button
            onClick={toggleOpen}
            className={`btn px-4 py-2 text-sm ${open ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            <span className={`h-2 w-2 rounded-full ${open ? "animate-pulse bg-white" : "bg-white/50"}`} />
            {open ? "Voting DIBUKA" : "Voting DITUTUP"}
          </button>
          <button className="btn bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25" onClick={() => sb.auth.signOut()}>Keluar</button>
        </div>
        <div className="poleng relative h-2" />
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-5">
        {/* Tab */}
        <div className="flex gap-1 rounded-2xl border border-sand bg-white p-1 shadow-sm sm:inline-flex">
          {([
            ["rekap", "Rekap Suara"],
            ["paslon", "Kelola Paslon"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${tab === k ? "bg-maroon text-white shadow" : "text-ink/60 hover:bg-cream"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "paslon" && <PaslonManager sb={sb} rows={pRows} voteCount={voteCount} onChanged={loadPaslon} />}

        {tab === "rekap" && (
        <>
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Suara masuk" value={stats.total} />
          <Stat label="Sah" value={stats.sah} tone="text-emerald-700" />
          <Stat label="Belum dicek" value={stats.pending} tone="text-amber-700" />
          <Stat label="Tidak sah" value={stats.tidak_sah} tone="text-red-700" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Perolehan */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Perolehan Suara</h2>
              <div className="flex rounded-xl bg-sand/60 p-1 text-sm">
                {(["valid", "sah"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${mode === m ? "bg-white shadow-sm" : "text-ink/60"}`}
                  >
                    {m === "valid" ? "Semua (kecuali tidak sah)" : "Hanya terverifikasi sah"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-sm text-ink/50">Dihitung dari {results.total} suara</p>

            <div className="mt-5 space-y-5">
              {results.rows.map(({ p, n, pct }) => (
                <div key={p.nomor} className="flex items-center gap-4">
                  <PaslonMini p={p} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-display text-xs font-bold tracking-wider" style={{ color: p.warna }}>PASLON {pad2(p.nomor)}</span>
                        <div className="truncate font-semibold">{p.ketua}{p.wakil ? ` & ${p.wakil}` : ""}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-2xl font-extrabold tabular-nums">{pct.toFixed(1)}%</span>
                        <div className="text-xs text-ink/50 tabular-nums">{n} suara</div>
                      </div>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-sand/70">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: p.warna }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {leader.length === 1 && (
              <div className="mt-5 rounded-xl bg-gold-soft/60 px-4 py-2.5 text-sm">
                🏆 Unggul sementara: <b>Paslon {pad2(leader[0].p.nomor)}</b> — {leader[0].p.ketua}
              </div>
            )}
            {leader.length > 1 && (
              <div className="mt-5 rounded-xl bg-gold-soft/60 px-4 py-2.5 text-sm">⚖️ Suara sementara imbang antara {leader.map((l) => `Paslon ${pad2(l.p.nomor)}`).join(" & ")}</div>
            )}
          </section>

          {/* OCR + aksi */}
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Validasi KTM (OCR)</h2>
            <p className="mt-1 text-sm text-ink/60">
              Dinyatakan <b>cocok</b> hanya jika NIM terbaca persis <b>dan</b> nama yang diinput sama dengan nama lengkap di KTM. Hasilnya tetap <b>penanda</b>, keputusan sah di panitia.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <MiniStat label="Sudah di-OCR" value={`${stats.ocrDone}/${stats.total}`} />
              <MiniStat label="Cocok" value={stats.cocok} />
              <MiniStat label="Perlu cek" value={stats.ocrDone - stats.cocok} />
            </div>

            {ocrProg ? (
              <div className="mt-4">
                <div className="flex justify-between text-sm"><span>Memproses OCR… jangan tutup tab</span><span className="tabular-nums">{ocrProg.done}/{ocrProg.total}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full bg-maroon transition-all" style={{ width: `${(ocrProg.done / ocrProg.total) * 100}%` }} /></div>
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                <button className="btn-primary" onClick={() => ocrBatch(false)} disabled={stats.total === stats.ocrDone}>
                  Jalankan OCR ({stats.total - stats.ocrDone} belum)
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost text-sm" onClick={approveMatched}>Sahkan yang cocok</button>
                  <button className="btn-ghost text-sm" onClick={() => confirm("Ulang OCR untuk semua suara?") && ocrBatch(true)}>Ulang semua</button>
                </div>
                <button className="btn-ghost text-sm" onClick={exportCsv}>⬇ Export rekap (CSV / Excel)</button>
              </div>
            )}
            <p className="mt-3 text-xs text-ink/40"><span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" />Live · sinkron otomatis tiap 5 detik{lastSync ? ` · terakhir ${lastSync.toLocaleTimeString("id-ID")}` : ""}</p>
          </section>
        </div>

        {/* Tabel suara */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-sand p-4">
            <h2 className="mr-auto font-display text-lg font-bold">Daftar Suara <span className="text-ink/40">({filtered.length})</span></h2>
            <input className="field w-full py-2 sm:w-56" placeholder="Cari nama / NIM" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field w-auto py-2" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="all">Semua status</option>
              <option value="pending">Belum dicek</option>
              <option value="sah">Sah</option>
              <option value="tidak_sah">Tidak sah</option>
            </select>
            <select className="field w-auto py-2" value={fOcr} onChange={(e) => setFOcr(e.target.value)}>
              <option value="all">Semua OCR</option>
              <option value="cocok">OCR cocok</option>
              <option value="cek">OCR perlu cek</option>
              <option value="tidak_terbaca">Tidak terbaca</option>
              <option value="none">Belum di-OCR</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-ink/50">Belum ada suara.</div>
          ) : (
            <ul className="divide-y divide-sand">
              {filtered.map((v) => {
                const p = getP(v.paslon);
                return (
                  <li key={v.id}>
                    <button onClick={() => setSelected(v)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream">
                      <div className="h-12 w-[76px] shrink-0 overflow-hidden rounded-lg bg-sand">
                        {urls[v.ktm_path] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={urls[v.ktm_path]} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{v.nama}</div>
                        <div className="text-xs text-ink/50 tabular-nums">{v.nim} · {fmtTime(v.created_at)}</div>
                      </div>
                      {p && (
                        <span className="hidden shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white sm:inline" style={{ background: p.warna }}>
                          {pad2(p.nomor)}
                        </span>
                      )}
                      <OcrBadge s={v.ocr_status} />
                      <StatusBadge s={v.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </>
        )}
      </div>

      {selected && (
        <Detail
          v={selected}
          p={getP(selected.paslon)}
          url={urls[selected.ktm_path]}
          onClose={() => setSelected(null)}
          onStatus={setStatus}
          onOcr={ocrOne}
          onDelete={removeVote}
        />
      )}

      {idle.secondsLeft !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-[2px]">
          <div className="pop w-full max-w-sm overflow-hidden rounded-[28px] bg-white text-center shadow-2xl" role="alertdialog" aria-live="assertive">
            <div className="poleng h-2" />
            <div className="p-7">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold bg-gold-soft/50">
                <span className="font-display text-3xl font-bold tabular-nums text-maroon">{idle.secondsLeft}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">Masih di sana?</h3>
              <p className="mt-1 text-sm text-ink/60">
                Tidak ada aktivitas selama hampir {IDLE_TIMEOUT_MS / 60000} menit. Demi keamanan, kamu akan keluar otomatis dalam{" "}
                <b className="tabular-nums">{idle.secondsLeft} detik</b>.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button className="btn-ghost" onClick={() => idle.logoutNow()}>Keluar sekarang</button>
                <button className="btn-primary" onClick={idle.stay} autoFocus>Tetap masuk</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ============================ DETAIL MODAL ============================ */

function Detail({
  v, p, url, onClose, onStatus, onOcr, onDelete,
}: {
  v: Vote;
  p?: Paslon;
  url?: string;
  onClose: () => void;
  onStatus: (v: Vote, s: Vote["status"], catatan?: string) => Promise<void>;
  onOcr: (v: Vote) => Promise<void>;
  onDelete: (v: Vote) => Promise<void>;
}) {
  const [note, setNote] = useState(v.catatan ?? "");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(v.ocr_text ?? null);
  const reasons = ocrReasons(v);

  // teks OCR tidak ikut di-refresh tiap 5 detik, jadi diambil saat detail dibuka
  useEffect(() => {
    if (v.ocr_text !== undefined) return setOcrText(v.ocr_text);
    if (!v.ocr_status) return setOcrText(null);
    supabaseBrowser().from("votes").select("ocr_text").eq("id", v.id).maybeSingle()
      .then(({ data }) => setOcrText((data?.ocr_text as string | null) ?? null));
  }, [v.id, v.ocr_status, v.ocr_text]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sand bg-white px-5 py-3">
          <h3 className="font-display font-bold">Detail Suara</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-ink/50 hover:bg-sand">×</button>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1.3fr_1fr]">
          <div>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`KTM ${v.nama}`} className="w-full rounded-xl border border-sand bg-sand/30 object-contain" />
              </a>
            ) : (
              <div className="flex aspect-[1.6] items-center justify-center rounded-xl bg-sand text-sm text-ink/50">Memuat foto…</div>
            )}
            <p className="mt-1 text-xs text-ink/40">Klik foto untuk membuka ukuran penuh</p>
          </div>

          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <Row k="Nama" v={<b>{v.nama}</b>} />
              <Row k="NIM" v={<b className="tabular-nums">{v.nim}</b>} />
              <Row k="Waktu" v={fmtTime(v.created_at)} />
              <Row k="Pilihan" v={p ? <span className="font-bold" style={{ color: p.warna }}>Paslon {pad2(p.nomor)} · {p.ketua}</span> : v.paslon} />
              <Row k="Status" v={<StatusBadge s={v.status} />} />
              {v.verified_by && <Row k="Dicek oleh" v={<span className="text-xs">{v.verified_by}</span>} />}
            </dl>

            <div className="rounded-xl bg-cream p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Hasil OCR</span>
                <OcrBadge s={v.ocr_status} />
              </div>
              {v.ocr_status ? (
                <ul className="mt-2 space-y-1 text-ink/70">
                  <li>Kecocokan nama: <b>{Math.round((v.ocr_nama_score ?? 0) * 100)}%</b></li>
                  <li>NIM terbaca persis di KTM: <b>{v.ocr_nim_match ? "Ya" : "Tidak"}</b></li>
                  {reasons.map((r) => (
                    <li key={r} className="font-medium text-amber-800">⚠ {r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink/50">Belum diproses.</p>
              )}
              {ocrText && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-ink/50">Lihat teks yang terbaca</summary>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px]">{ocrText}</pre>
                </details>
              )}
              <button
                className="btn-ghost mt-3 w-full py-2 text-sm"
                disabled={ocrBusy}
                onClick={async () => {
                  setOcrBusy(true);
                  try { await onOcr(v); } catch { alert("OCR gagal untuk foto ini."); }
                  setOcrBusy(false);
                }}
              >
                {ocrBusy ? "Membaca KTM…" : v.ocr_status ? "Ulang OCR" : "Jalankan OCR"}
              </button>
            </div>

            <textarea className="field min-h-[64px] text-sm" placeholder="Catatan (opsional), mis. nama di KTM berbeda" value={note} onChange={(e) => setNote(e.target.value)} />

            <div className="grid grid-cols-2 gap-2">
              <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onStatus(v, "sah", note)}>✓ Sah</button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => onStatus(v, "tidak_sah", note)}>✕ Tidak sah</button>
            </div>
            <div className="flex justify-between text-sm">
              <button className="text-ink/50 underline-offset-2 hover:underline" onClick={() => onStatus(v, "pending", note)}>Kembalikan ke belum dicek</button>
              <button className="text-red-600/70 underline-offset-2 hover:underline" onClick={() => onDelete(v)}>Hapus</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ UI KECIL ============================ */

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-4 text-ink/60">{children}</main>;
}
function Stat({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-ink/50">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-cream px-2 py-2.5">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-ink/50">{label}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink/50">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v}</dd>
    </div>
  );
}
function StatusBadge({ s }: { s: Vote["status"] }) {
  const m = {
    pending: ["Belum dicek", "bg-amber-100 text-amber-800"],
    sah: ["Sah", "bg-emerald-100 text-emerald-800"],
    tidak_sah: ["Tidak sah", "bg-red-100 text-red-800"],
  }[s];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${m[1]}`}>{m[0]}</span>;
}
function OcrBadge({ s }: { s: Vote["ocr_status"] }) {
  if (!s) return <span className="hidden shrink-0 rounded-full bg-sand px-2.5 py-1 text-xs text-ink/50 md:inline">OCR –</span>;
  const m = {
    cocok: ["✓ Cocok", "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"],
    cek: ["⚠ Cek", "bg-amber-50 text-amber-700 ring-1 ring-amber-200"],
    tidak_terbaca: ["? Buram", "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"],
  }[s];
  return <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold md:inline ${m[1]}`}>{m[0]}</span>;
}

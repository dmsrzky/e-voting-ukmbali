"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pad2 } from "@/lib/config";
import { shade } from "@/lib/color";
import { fromRow, type PaslonRow } from "@/lib/paslon-data";
import { resizePortrait } from "@/lib/image";
import { PaslonCard } from "./Paslon";
import { PersonPlaceholder } from "./bali";

const PRESETS = ["#A8232F", "#17624F", "#24457F", "#B7791F", "#6B2C91", "#0E7490", "#9D174D", "#3F3F46"];

const pathFromUrl = (url?: string | null) => {
  if (!url) return null;
  const i = url.indexOf("/object/public/paslon/");
  return i === -1 ? null : decodeURIComponent(url.slice(i + "/object/public/paslon/".length).split("?")[0]);
};

export default function PaslonManager({
  sb,
  rows,
  voteCount,
  onChanged,
}: {
  sb: SupabaseClient;
  rows: PaslonRow[];
  voteCount: Record<number, number>;
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  async function addPaslon() {
    const nomor = (rows.reduce((m, r) => Math.max(m, r.nomor), 0) || 0) + 1;
    setAdding(true);
    const { error } = await sb.from("paslon").insert({
      nomor,
      ketua: `Nama Calon Ketua ${nomor}`,
      wakil: `Nama Calon Wakil ${nomor}`,
      warna: PRESETS[(nomor - 1) % PRESETS.length],
    });
    setAdding(false);
    if (error) return alert("Gagal menambah paslon: " + error.message);
    await onChanged();
  }

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">Kelola Paslon</h2>
          <p className="mt-1 text-sm text-ink/60">
            Perubahan nama, warna, dan foto langsung tampil di halaman voting. Nomor urut tetap: isi nama paslon sesuai hasil spin di tiap nomor.
          </p>
        </div>
        <button className="btn-primary" onClick={addPaslon} disabled={adding}>
          + Tambah paslon
        </button>
      </section>

      {rows.length === 0 && (
        <div className="card p-8 text-center text-ink/60">
          Tabel paslon masih kosong atau belum dibuat. Jalankan <code className="rounded bg-sand px-1.5">supabase/migration-01-paslon.sql</code> di SQL Editor Supabase, lalu muat ulang halaman ini.
        </div>
      )}

      {rows.map((r) => (
        <Editor key={r.nomor} sb={sb} row={r} votes={voteCount[r.nomor] ?? 0} onChanged={onChanged} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Editor({ sb, row, votes, onChanged }: { sb: SupabaseClient; row: PaslonRow; votes: number; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<PaslonRow>(row);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<"ketua" | "wakil" | null>(null);

  // sinkron kalau data dari server berubah & form belum diedit
  const base = useRef(row);
  useEffect(() => {
    const dirtyNow = JSON.stringify(draft) !== JSON.stringify(base.current);
    base.current = row;
    if (!dirtyNow) setDraft(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const dirty = (["ketua", "wakil", "tagline", "warna"] as const).some((k) => (draft[k] ?? "") !== (row[k] ?? ""));
  const set = (k: keyof PaslonRow, v: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  async function save() {
    if (!draft.ketua.trim()) return alert("Nama calon ketua wajib diisi.");
    if (!/^#[0-9A-Fa-f]{6}$/.test(draft.warna)) return alert("Format warna harus seperti #A8232F.");
    setSaving(true);
    const { error } = await sb
      .from("paslon")
      .update({
        ketua: draft.ketua.trim(),
        wakil: draft.wakil?.trim() || null,
        tagline: draft.tagline?.trim() || null,
        warna: draft.warna,
        updated_at: new Date().toISOString(),
      })
      .eq("nomor", row.nomor);
    setSaving(false);
    if (error) return alert("Gagal menyimpan: " + error.message);
    setSaved(true);
    await onChanged();
  }

  async function upload(role: "ketua" | "wakil", file: File) {
    if (!file.type.startsWith("image/")) return alert("File harus berupa gambar (PNG/JPG/WebP).");
    setUploading(role);
    try {
      const { blob, ext, type } = await resizePortrait(file);
      const path = `${row.nomor}-${role}-${Date.now()}.${ext}`;
      const up = await sb.storage.from("paslon").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
      if (up.error) throw up.error;
      const url = sb.storage.from("paslon").getPublicUrl(path).data.publicUrl;
      const col = role === "ketua" ? "foto_ketua" : "foto_wakil";
      const old = pathFromUrl(row[col]);
      const { error } = await sb.from("paslon").update({ [col]: url, updated_at: new Date().toISOString() }).eq("nomor", row.nomor);
      if (error) throw error;
      if (old) await sb.storage.from("paslon").remove([old]);
      setDraft((d) => ({ ...d, [col]: url }));
      await onChanged();
    } catch (e) {
      alert("Gagal mengunggah foto: " + (e instanceof Error ? e.message : "coba lagi"));
    } finally {
      setUploading(null);
    }
  }

  async function removePhoto(role: "ketua" | "wakil") {
    const col = role === "ketua" ? "foto_ketua" : "foto_wakil";
    if (!confirm(`Hapus foto calon ${role}?`)) return;
    const old = pathFromUrl(row[col]);
    const { error } = await sb.from("paslon").update({ [col]: null, updated_at: new Date().toISOString() }).eq("nomor", row.nomor);
    if (error) return alert("Gagal menghapus foto: " + error.message);
    if (old) await sb.storage.from("paslon").remove([old]);
    setDraft((d) => ({ ...d, [col]: null }));
    await onChanged();
  }

  async function removePaslon() {
    if (votes > 0) return alert(`Paslon ${pad2(row.nomor)} sudah punya ${votes} suara, jadi tidak bisa dihapus.`);
    if (!confirm(`Hapus Paslon ${pad2(row.nomor)} beserta fotonya?`)) return;
    const files = [pathFromUrl(row.foto_ketua), pathFromUrl(row.foto_wakil)].filter(Boolean) as string[];
    const { error } = await sb.from("paslon").delete().eq("nomor", row.nomor);
    if (error) return alert("Gagal menghapus: " + error.message);
    if (files.length) await sb.storage.from("paslon").remove(files);
    await onChanged();
  }

  const preview = fromRow(draft);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-sand px-5 py-3.5" style={{ background: `${draft.warna}0F` }}>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold text-[#FBE7AE]"
          style={{ background: shade(draft.warna, -0.45), boxShadow: "0 0 0 2px #C49A3C" }}
        >
          {pad2(row.nomor)}
        </span>
        <h3 className="flex-1 font-display text-base font-bold">Paslon {pad2(row.nomor)}</h3>
        <span className="text-xs text-ink/50">{votes} suara</span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_340px]">
        {/* ---------------- form ---------------- */}
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoSlot
              label="Foto Calon Ketua"
              src={draft.foto_ketua}
              warna={draft.warna}
              busy={uploading === "ketua"}
              onPick={(f) => upload("ketua", f)}
              onRemove={() => removePhoto("ketua")}
            />
            <PhotoSlot
              label="Foto Calon Wakil"
              src={draft.foto_wakil}
              warna={draft.warna}
              busy={uploading === "wakil"}
              disabled={!draft.wakil?.trim()}
              disabledText="Isi nama wakil dulu"
              onPick={(f) => upload("wakil", f)}
              onRemove={() => removePhoto("wakil")}
            />
          </div>
          <p className="-mt-2 text-xs text-ink/50">
            Foto otomatis diperkecil. Paling bagus potret 3:4 dengan background transparan (PNG). Foto langsung tersimpan setelah diunggah.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Nama calon ketua</span>
              <input className="field" value={draft.ketua} onChange={(e) => set("ketua", e.target.value)} maxLength={80} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Nama calon wakil <span className="font-normal text-ink/40">(kosongkan jika tanpa wakil)</span>
              </span>
              <input className="field" value={draft.wakil ?? ""} onChange={(e) => set("wakil", e.target.value)} maxLength={80} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Tagline / slogan <span className="font-normal text-ink/40">(opsional)</span>
            </span>
            <input className="field" value={draft.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} maxLength={70} placeholder="mis. Bersatu, Berbudaya, Berprestasi" />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-semibold">Warna kartu</span>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("warna", c)}
                  className="h-9 w-9 rounded-full transition hover:scale-105"
                  style={{ background: c, boxShadow: draft.warna.toUpperCase() === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }}
                  aria-label={`Warna ${c}`}
                />
              ))}
              <label className="ml-1 flex items-center gap-2 rounded-full border border-sand bg-white py-1 pl-1 pr-3 text-xs text-ink/60">
                <input type="color" value={draft.warna} onChange={(e) => set("warna", e.target.value.toUpperCase())} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                Warna lain
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-sand pt-4">
            <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
              {saving ? "Menyimpan…" : "Simpan perubahan"}
            </button>
            {dirty && (
              <button className="btn-ghost" onClick={() => setDraft(row)} disabled={saving}>
                Batal
              </button>
            )}
            {saved && !dirty && <span className="text-sm font-medium text-emerald-700">✓ Tersimpan, sudah tampil di halaman voting</span>}
            <button
              className="ml-auto text-sm text-red-600/70 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
              onClick={removePaslon}
              disabled={votes > 0}
              title={votes > 0 ? "Paslon yang sudah punya suara tidak bisa dihapus" : undefined}
            >
              Hapus paslon
            </button>
          </div>
        </div>

        {/* ---------------- preview ---------------- */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Preview di halaman voting</div>
          <div className="pointer-events-none">
            <PaslonCard p={preview} active={false} onSelect={() => {}} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoSlot({
  label,
  src,
  warna,
  busy,
  disabled,
  disabledText,
  onPick,
  onRemove,
}: {
  label: string;
  src: string | null;
  warna: string;
  busy: boolean;
  disabled?: boolean;
  disabledText?: string;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={disabled && !src ? "opacity-50" : ""}>
      <div className="mb-1.5 text-sm font-semibold">{label}</div>
      <div className="flex items-end gap-3">
        <div
          className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-t-full rounded-b-xl p-[2.5px]"
          style={{ background: "linear-gradient(180deg,#F3D98B,#C49A3C 60%,#8E6A1E)" }}
        >
          <div
            className="relative h-full w-full overflow-hidden rounded-t-full rounded-b-[10px]"
            style={{ background: `radial-gradient(120% 80% at 50% 30%, ${shade(warna, 0.35)}, ${shade(warna, -0.25)})` }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={label} className="absolute inset-0 h-full w-full object-cover object-top" />
            ) : (
              <PersonPlaceholder className="absolute inset-x-0 bottom-0 h-[82%] w-full text-white/30" />
            )}
            {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold text-white">Mengunggah…</div>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn-ghost px-3 py-2 text-sm" disabled={busy || (disabled && !src)} onClick={() => ref.current?.click()}>
            {src ? "Ganti foto" : "Unggah foto"}
          </button>
          {src && (
            <button type="button" className="text-left text-xs text-red-600/70 hover:underline" onClick={onRemove} disabled={busy}>
              Hapus foto
            </button>
          )}
          {disabled && !src && <span className="text-[11px] text-ink/45">{disabledText}</span>}
        </div>
      </div>
    </div>
  );
}

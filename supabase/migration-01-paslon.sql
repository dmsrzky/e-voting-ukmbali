-- =====================================================================
--  MIGRASI 01 — Kelola Paslon dari Dashboard
--  Sudah pernah menjalankan schema.sql? Cukup jalankan file INI sekali
--  di Supabase → SQL Editor → Run. Aman dijalankan ulang.
-- =====================================================================

-- ---------- Tabel paslon ----------
create table if not exists public.paslon (
  nomor int primary key check (nomor between 1 and 20),
  ketua text not null default '',
  wakil text,
  tagline text,
  warna text not null default '#A8232F' check (warna ~ '^#[0-9A-Fa-f]{6}$'),
  foto_ketua text,
  foto_wakil text,
  updated_at timestamptz not null default now()
);

-- Isi awal 3 paslon (nama bisa diganti dari dashboard)
insert into public.paslon (nomor, ketua, wakil, warna) values
  (1, 'Nama Calon Ketua 1', 'Nama Calon Wakil 1', '#A8232F'),
  (2, 'Nama Calon Ketua 2', 'Nama Calon Wakil 2', '#17624F'),
  (3, 'Nama Calon Ketua 3', 'Nama Calon Wakil 3', '#24457F')
on conflict (nomor) do nothing;

alter table public.paslon enable row level security;

-- Data paslon boleh dibaca semua orang (memang ditampilkan di halaman voting)
drop policy if exists "publik baca paslon" on public.paslon;
drop policy if exists "admin tambah paslon" on public.paslon;
drop policy if exists "admin ubah paslon" on public.paslon;
drop policy if exists "admin hapus paslon" on public.paslon;
create policy "publik baca paslon"  on public.paslon for select to anon, authenticated using (true);
create policy "admin tambah paslon" on public.paslon for insert to authenticated with check (public.is_admin());
create policy "admin ubah paslon"   on public.paslon for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin hapus paslon"  on public.paslon for delete to authenticated using (public.is_admin());

-- ---------- Storage: bucket PUBLIK untuk foto paslon ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paslon', 'paslon', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "admin upload foto paslon" on storage.objects;
drop policy if exists "admin ubah foto paslon"   on storage.objects;
drop policy if exists "admin hapus foto paslon"  on storage.objects;
create policy "admin upload foto paslon" on storage.objects for insert to authenticated with check (bucket_id = 'paslon' and public.is_admin());
create policy "admin ubah foto paslon"   on storage.objects for update to authenticated using (bucket_id = 'paslon' and public.is_admin());
create policy "admin hapus foto paslon"  on storage.objects for delete to authenticated using (bucket_id = 'paslon' and public.is_admin());

-- =====================================================================
--  SKEMA DATABASE — Sistem Voting Pemilihan Ketua UKM Bali
--  Jalankan SELURUH file ini sekali di Supabase → SQL Editor → Run.
-- =====================================================================

-- ---------- 1. Daftar admin (yang boleh buka dashboard) ----------
create table if not exists public.admins (
  email text primary key
);

-- ---------- 2. Pengaturan (buka/tutup voting) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  voting_open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- 3. Tabel suara ----------
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  nama text not null check (char_length(btrim(nama)) between 3 and 100),
  -- nama dinormalisasi (huruf kecil, spasi rapi) → dipakai untuk cek nama ganda
  nama_norm text generated always as (lower(regexp_replace(btrim(nama), '\s+', ' ', 'g'))) stored,
  nim text not null check (nim ~ '^[0-9]{6,15}$'),
  paslon int not null check (paslon >= 1),
  ktm_path text not null,

  -- hasil OCR (diisi dari dashboard admin)
  ocr_text text,
  ocr_nama_score real,
  ocr_nim_match boolean,
  ocr_status text check (ocr_status in ('cocok', 'cek', 'tidak_terbaca')),

  -- verifikasi panitia
  status text not null default 'pending' check (status in ('pending', 'sah', 'tidak_sah')),
  catatan text,
  verified_by text,
  verified_at timestamptz
);

-- Anti suara ganda: nama yang sama & NIM yang sama hanya bisa masuk sekali
create unique index if not exists votes_nama_norm_key on public.votes (nama_norm);
create unique index if not exists votes_nim_key on public.votes (nim);

-- ---------- 4. Helper: apakah user login termasuk admin? ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;

-- ---------- 5. Row Level Security ----------
alter table public.votes    enable row level security;
alter table public.settings enable row level security;
alter table public.admins   enable row level security;

-- Pemilih TIDAK menulis langsung ke database; semua suara masuk lewat server (/api/vote).
-- Jadi publik tidak punya akses sama sekali. Hanya admin yang bisa baca/ubah.
drop policy if exists "admin baca votes"   on public.votes;
drop policy if exists "admin ubah votes"   on public.votes;
drop policy if exists "admin hapus votes"  on public.votes;
drop policy if exists "admin baca settings" on public.settings;
drop policy if exists "admin ubah settings" on public.settings;
drop policy if exists "admin baca admins"  on public.admins;

create policy "admin baca votes"    on public.votes    for select to authenticated using (public.is_admin());
create policy "admin ubah votes"    on public.votes    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin hapus votes"   on public.votes    for delete to authenticated using (public.is_admin());
create policy "admin baca settings" on public.settings for select to authenticated using (public.is_admin());
create policy "admin ubah settings" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin baca admins"   on public.admins   for select to authenticated using (public.is_admin());

-- ---------- 6. Storage: bucket PRIVAT untuk foto KTM ----------
insert into storage.buckets (id, name, public)
values ('ktm', 'ktm', false)
on conflict (id) do update set public = false;

drop policy if exists "admin baca ktm"  on storage.objects;
drop policy if exists "admin hapus ktm" on storage.objects;
create policy "admin baca ktm"  on storage.objects for select to authenticated using (bucket_id = 'ktm' and public.is_admin());
create policy "admin hapus ktm" on storage.objects for delete to authenticated using (bucket_id = 'ktm' and public.is_admin());

-- ---------- 7. Paslon (dikelola dari dashboard) ----------
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

-- ---------- 8. DAFTARKAN EMAIL ADMIN ----------
-- Ganti dengan email akun admin (buat dulu akunnya di Authentication → Users).
-- insert into public.admins (email) values ('emailkamu@gmail.com');

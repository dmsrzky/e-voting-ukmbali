"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* =====================================================================
 *  Auto-logout dashboard admin kalau tidak ada aktivitas.
 *  - Aktivitas = gerak mouse, klik, ketik, scroll, sentuh layar.
 *  - Dibagi antar tab (localStorage): aktif di satu tab = semua tab aman.
 *  - Saat tab/laptop dibuka lagi setelah lama, langsung dicek & logout.
 * ===================================================================== */

export const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit
export const IDLE_WARN_MS = 60 * 1000; // peringatan 60 detik sebelum keluar

const KEY = "ukmbali-admin-last-activity";
const FLAG = "ukmbali-admin-idle-logout";

const readLast = (): number | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
const writeLast = (t: number) => {
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    /* abaikan */
  }
};

/** Panggil tepat setelah login berhasil supaya stempel waktu lama tidak memicu logout. */
export const markActiveNow = () => writeLast(Date.now());

/** Dibaca halaman login: apakah sesi barusan berakhir karena idle? */
export const consumeIdleFlag = (): boolean => {
  try {
    const v = sessionStorage.getItem(FLAG);
    sessionStorage.removeItem(FLAG);
    return v === "1";
  } catch {
    return false;
  }
};

export function useIdleLogout(onLogout: () => void | Promise<void>, keepAlive: () => boolean = () => false) {
  const last = useRef<number>(Date.now());
  const done = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const keep = useRef(keepAlive);
  keep.current = keepAlive;

  const bump = useCallback(() => {
    const now = Date.now();
    // tulis ke storage maksimal 1x per detik
    if (now - last.current > 1000) writeLast(now);
    last.current = now;
    setSecondsLeft(null);
  }, []);

  const logout = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    try {
      sessionStorage.setItem(FLAG, "1");
    } catch {
      /* abaikan */
    }
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* abaikan */
    }
    await onLogout();
  }, [onLogout]);

  useEffect(() => {
    // cek saat dashboard dibuka: kalau aktivitas terakhir sudah lewat batas → keluar
    const stored = readLast();
    if (stored && Date.now() - stored >= IDLE_TIMEOUT_MS) {
      logout();
      return;
    }
    last.current = stored ?? Date.now();
    writeLast(last.current);

    const check = () => {
      if (done.current) return;
      if (keep.current()) return bump(); // mis. OCR sedang berjalan
      const shared = Math.max(last.current, readLast() ?? 0);
      last.current = shared;
      const idle = Date.now() - shared;
      if (idle >= IDLE_TIMEOUT_MS) return void logout();
      setSecondsLeft(idle >= IDLE_TIMEOUT_MS - IDLE_WARN_MS ? Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000) : null);
    };

    const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        last.current = Math.max(last.current, Number(e.newValue));
        setSecondsLeft(null);
      }
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(check, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, [bump, logout]);

  return { secondsLeft, stay: bump, logoutNow: logout };
}

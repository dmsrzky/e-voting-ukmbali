import "server-only";
import { createClient } from "@supabase/supabase-js";

// Klien server dengan secret/service-role key — HANYA dipakai di API route, tidak pernah ke browser.
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi");
  return createClient(url, key, { auth: { persistSession: false } });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { PASLON_COLS, withFallback, type PaslonRow } from "@/lib/paslon-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = supabaseServer();
    const [s, p] = await Promise.all([
      sb.from("settings").select("voting_open").eq("id", 1).single(),
      sb.from("paslon").select(PASLON_COLS).order("nomor"),
    ]);
    if (s.error) throw s.error;
    return NextResponse.json(
      { open: s.data.voting_open, paslon: withFallback(p.error ? null : (p.data as PaslonRow[])) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ open: false, error: "Server belum terhubung ke database" }, { status: 500 });
  }
}

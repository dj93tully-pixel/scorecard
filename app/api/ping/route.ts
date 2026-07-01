import { NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabase";

// Keep-alive endpoint for an external uptime pinger (e.g. cron-job.org).
// Supabase's free tier pauses a project after ~7 days with no activity, so a
// scheduled hit here runs one trivial query to count as activity. Ping it every
// few days. Cheap: selects a single id, no data of consequence returned.

// Always run fresh — a cached response wouldn't touch the database.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  }
  const { error } = await supabase.from("games").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, pinged: true });
}

// lib/supabase.ts
// Browser Supabase client. The URL + anon/publishable key are public by design
// (this is a no-login app; access is gated by the link + permissive RLS).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// Fall back to harmless placeholders so the module never throws at import time;
// callers should check `supabaseConfigured` before using it.
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-key"
);

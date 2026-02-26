import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  // Never initialize during server prerender/build
  if (typeof window === "undefined") {
    throw new Error("Supabase client requested on the server. This app is client-only.");
  }

  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  _client = createClient(url, key);
  return _client;
}
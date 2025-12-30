import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  // IMPORTANT: Use matched pairs of URL + anon key from the same source.
  // Supabase-Vercel integration injects SUPABASE_* for preview branches.
  // VITE_* are typically set manually for production.
  // Mixing them causes auth failures (JWT ref mismatch).
  
  let url: string | undefined;
  let anonKey: string | undefined;
  
  // Prefer SUPABASE_* (injected by Supabase integration) if URL is set
  // This ensures preview deployments use preview credentials
  // Note: Integration uses SUPABASE_PUBLISHABLE_KEY, we also accept SUPABASE_ANON_KEY
  if (import.meta.env.SUPABASE_URL) {
    url = (import.meta.env.SUPABASE_URL as string).trim();
    anonKey = (
      (import.meta.env.SUPABASE_ANON_KEY as string | undefined) ||
      (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string | undefined)
    )?.trim();
  }
  
  // Fall back to VITE_* (manual config) if SUPABASE_* not available
  if (!url) {
    url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
    anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  }

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY) in your build env.'
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return _client;
}


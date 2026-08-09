import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  return { url, key };
}

/**
 * Stateless client for data protected by public anon/authenticated RLS
 * policies. It deliberately does not read request cookies, which keeps public
 * query results safe to cache across users and requests.
 */
export function createPublicClient() {
  const { url, key } = getSupabaseConfig();
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

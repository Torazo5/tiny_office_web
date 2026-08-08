import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing server-only Supabase secret configuration.");
  }
  return { url, key };
}

/** Server-only client for already-authorized admin operations. */
export function createAdminClient() {
  const { url, key } = getSupabaseConfig();
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

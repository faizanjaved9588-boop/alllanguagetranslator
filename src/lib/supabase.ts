import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://zneyxayrtsyjclhedpmg.supabase.co";
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_VKTJzQzqhCmJHtkvAyxmFA_RZrUSo14";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: typeof window !== "undefined", autoRefreshToken: true },
});

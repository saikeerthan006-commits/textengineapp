import { createClient } from "@supabase/supabase-js";
import { publicSupabaseKey, publicSupabaseUrl } from "./supabasePublicConfig";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || publicSupabaseUrl;
export const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || publicSupabaseKey) as string | undefined;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabase = supabaseConfigured ? createClient(supabaseUrl!, supabasePublishableKey!) : null;
export const supabaseConnectionUrl = supabaseUrl;

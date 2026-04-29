import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Check for both existence and placeholder values
    const isValidUrl = (u: string | undefined): boolean => {
      if (!u) return false;
      try {
        new URL(u);
        return u !== 'https://your-project.supabase.co';
      } catch (e) {
        return false;
      }
    };

    const isConfigured = 
      isValidUrl(url) && 
      key && 
      key !== 'your-anon-key' &&
      key.trim() !== '';

    if (!isConfigured) {
      throw new Error(
        `Supabase configuration is missing or invalid (URL provided: "${url}"). Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY correctly in the Secrets panel.`
      );
    }
    supabaseInstance = createClient(url!, key!);
  }
  return supabaseInstance;
}

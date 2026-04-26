import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Check for both existence and placeholder values
    const isConfigured = 
      url && 
      key && 
      url !== 'https://your-project.supabase.co' && 
      key !== 'your-anon-key' &&
      url.trim() !== '' &&
      key.trim() !== '';

    if (!isConfigured) {
      throw new Error(
        'Supabase configuration is missing or invalid. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Secrets panel.'
      );
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

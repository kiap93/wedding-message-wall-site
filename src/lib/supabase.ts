import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string | undefined;
declare const __SUPABASE_ANON_KEY__: string | undefined;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const envObj = (typeof window !== 'undefined' ? window.__ENV__ : undefined) || {};

    // 1. Direct constant replacement (__SUPABASE_URL__ defined via Vite config)
    // 2. Vite standard import.meta.env
    // 3. Runtime window.__ENV__ fallback
    const url = 
      (typeof __SUPABASE_URL__ !== 'undefined' && __SUPABASE_URL__) ||
      import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.SUPABASE_URL ||
      envObj.VITE_SUPABASE_URL ||
      envObj.SUPABASE_URL;

    const key = 
      (typeof __SUPABASE_ANON_KEY__ !== 'undefined' && __SUPABASE_ANON_KEY__) ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.SUPABASE_ANON_KEY ||
      envObj.VITE_SUPABASE_ANON_KEY ||
      envObj.SUPABASE_ANON_KEY;

    // Check for both existence, valid protocol, and non-placeholder values
    const isValidUrl = (u: string | undefined): boolean => {
      if (!u || u === 'undefined' || u === 'null') return false;
      try {
        const parsed = new URL(u);
        const hasValidProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
        return hasValidProtocol && u !== 'https://your-project.supabase.co';
      } catch (e) {
        return false;
      }
    };

    const isConfigured = 
      isValidUrl(url) && 
      key && 
      key !== 'undefined' &&
      key !== 'null' &&
      key !== 'your-anon-key' &&
      key.trim() !== '';

    if (!isConfigured) {
      throw new Error(
        `Supabase configuration is missing or invalid (URL provided: "${url || 'undefined'}"). ` +
        `Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in your build environment. ` +
        `For Cloudflare Workers Builds, configure these under: Cloudflare Dashboard > Workers & Pages > wedding-auth-worker > Settings > Builds > "Build variables and secrets". ` +
        `Note: Runtime secrets set via 'wrangler secret put' are only available to the Worker backend and are not injected into the Vite frontend build.`
      );
    }
    
    supabaseInstance = createClient(url!, key!);
  }
  return supabaseInstance;
}

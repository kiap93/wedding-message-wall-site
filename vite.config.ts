import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode, command}) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Resolve Supabase public variables from VITE_* or standard SUPABASE_* names
  const supabaseUrl = 
    env.VITE_SUPABASE_URL || 
    env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    process.env.SUPABASE_URL || 
    '';

  const supabaseAnonKey = 
    env.VITE_SUPABASE_ANON_KEY || 
    env.SUPABASE_ANON_KEY || 
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    '';

  if (command === 'build' && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn('\n' + '='.repeat(72));
    console.warn('⚠️  [BUILD INFO] Supabase client variables not found in build environment.');
    if (!supabaseUrl) console.warn('   - VITE_SUPABASE_URL is missing at build time');
    if (!supabaseAnonKey) console.warn('   - VITE_SUPABASE_ANON_KEY is missing at build time');
    console.warn('\n   For Cloudflare Workers Builds (Git integration):');
    console.warn('   Set these in: Workers & Pages > wedding-auth-worker > Settings > Builds > "Build variables and secrets"');
    console.warn('   (Cloudflare runtime secrets set via wrangler are not passed to Vite during build).');
    console.warn('='.repeat(72) + '\n');
  }

  return {
    plugins: [react()],
    define: {
      // Ensure Vite statically inlines these into client code when provided at build time
      ...(supabaseUrl ? { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl) } : {}),
      ...(supabaseAnonKey ? { 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey) } : {}),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

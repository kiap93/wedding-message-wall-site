import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode, command}) => {
  // Load environment variables across mode, working directory, and all prefixes
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

  // Safe build-time diagnostics: Reports presence and format WITHOUT printing any secret or key
  if (command === 'build') {
    let urlFormat = 'Missing';
    if (supabaseUrl) {
      try {
        const parsed = new URL(supabaseUrl);
        urlFormat = `Valid (${parsed.protocol}//${parsed.hostname})`;
      } catch (e) {
        urlFormat = 'Invalid URL format';
      }
    }

    const keyFormat = supabaseAnonKey 
      ? `Present (${supabaseAnonKey.length} chars, starts with "${supabaseAnonKey.slice(0, 3)}...")`
      : 'Missing';

    console.log('\n' + '='.repeat(72));
    console.log('🔍 [BUILD DIAGNOSTIC] Supabase Build Environment Status:');
    console.log(`   - VITE_SUPABASE_URL:      ${urlFormat}`);
    console.log(`   - VITE_SUPABASE_ANON_KEY:  ${keyFormat}`);
    console.log(`   - Resolved via:           ${env.VITE_SUPABASE_URL ? 'loadEnv(VITE_SUPABASE_URL)' : process.env.VITE_SUPABASE_URL ? 'process.env(VITE_SUPABASE_URL)' : env.SUPABASE_URL ? 'loadEnv(SUPABASE_URL)' : process.env.SUPABASE_URL ? 'process.env(SUPABASE_URL)' : 'Not found'}`);
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('\n⚠️  ACTION REQUIRED:');
      console.warn('   Vite requires these variables in the build environment to bake them into dist.');
      console.warn('   In Cloudflare Workers Builds (Git integration), verify settings under:');
      console.warn('   Cloudflare Dashboard > Workers & Pages > wedding-auth-worker > Settings > Builds > "Build variables and secrets"');
      console.warn('   (Ensure they are assigned to the Production branch environment).');
    }
    console.log('='.repeat(72) + '\n');
  }

  return {
    plugins: [react()],
    // Expose both VITE_ and SUPABASE_ prefixed variables to import.meta.env
    envPrefix: ['VITE_', 'SUPABASE_'],
    define: {
      // Direct constants (avoids any import.meta namespace collision while guaranteeing inlining)
      '__SUPABASE_URL__': JSON.stringify(supabaseUrl || ''),
      '__SUPABASE_ANON_KEY__': JSON.stringify(supabaseAnonKey || ''),
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
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            icons: ['lucide-react'],
            i18n: ['i18next', 'react-i18next'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

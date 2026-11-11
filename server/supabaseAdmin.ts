import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;
let _isConfigured: boolean | null = null;

export function isSupabaseAvailable(): boolean {
  if (_isConfigured !== null) return _isConfigured;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (
    !url ||
    !key ||
    url.includes('your-project.supabase.co') ||
    key.includes('your-service-role-key') ||
    url === 'http://localhost:54321' ||
    url.includes('localhost:54321') ||
    url.includes('127.0.0.1:54321') ||
    process.env.NODE_ENV === 'test'
  ) {
    _isConfigured = false;
    return false;
  }
  _isConfigured = true;
  return true;
}

export function markSupabaseUnavailable(): void {
  _isConfigured = false;
}

export function configureSupabase(url: string, key: string): void {
  if (url && key && !url.includes('your-project.supabase.co')) {
    _supabaseAdmin = createClient(url, key);
    _isConfigured = true;
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'anon_key';
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}


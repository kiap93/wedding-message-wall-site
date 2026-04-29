import { Agency } from '../types';
import { getSupabase } from './supabase';

export async function resolveWorkspaceBySlug(slug: string): Promise<Agency | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as Agency;
}

export async function getUserWorkspaces(userId: string): Promise<Agency[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data as Agency[];
}

export function getCurrentSubdomain(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Ignore local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  
  // Ignore internal cloud run development domain
  if (hostname.includes('a.run.app')) return null;
  
  // For eventframe.io
  // prod: eventframe.io -> parts.length = 2
  // prod subdomain: test.eventframe.io -> parts.length = 3
  
  if (parts.length > 2) {
    // If it starts with www, it's not a tenant subdomain
    if (parts[0] === 'www') return null;
    return parts[0];
  }
  
  return null;
}

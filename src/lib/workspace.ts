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
  
  // If we are on eventframe.io (or localhost)
  // local: localhost -> parts.length = 1
  // prod: eventframe.io -> parts.length = 2
  // prod subdomain: test.eventframe.io -> parts.length = 3
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  
  if (parts.length > 2) {
    // Return 'test' from 'test.eventframe.io'
    // This assumes we are on a .io domain or similar 2-part TLD
    return parts[0];
  }
  
  return null;
}

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
  
  // Ignore internal cloud run development domains
  if (hostname.includes('.run.app')) return null;
  
  // Explicitly ignore root and www on the production domain
  if (hostname === 'eventframe.io' || hostname === 'www.eventframe.io') return null;
  
  // For other domains (like test.eventframe.io)
  if (parts.length > 2) {
    // If it starts with www, it's typically the main site (www.eventframe.io)
    // but handled above. Adding here for completeness with other TLDs.
    if (parts[0] === 'www') return null;
    return parts[0];
  }
  
  return null;
}

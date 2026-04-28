import { getSupabase } from './supabase';
import { Agency } from '../types';

export async function resolveAgency(): Promise<Agency | null> {
  const supabase = getSupabase();
  const host = window.location.hostname;
  
  // 1. Check for custom domain or subdomain
  const parts = host.split('.');
  
  let agencySlug = null;
  
  if (host.includes('.eventframe.')) {
     // Handle organization.eventframe.io
     agencySlug = parts[0];
  } else if (parts.length >= 3 && !host.includes('run.app') && !host.includes('localhost')) {
     // Handle subdomain.domain.com (if not a cloud run or localhost)
     agencySlug = parts[0];
  } else if (parts.length > 2) {
     agencySlug = parts[0];
  }

  // Fallback to query param for testing
  const urlParams = new URLSearchParams(window.location.search);
  const forcedAgency = urlParams.get('agency');
  if (forcedAgency) agencySlug = forcedAgency;

  if (!agencySlug || 
      agencySlug === 'www' || 
      agencySlug === 'app' || 
      agencySlug === 'eventframe' || 
      agencySlug.includes('ais-') ||
      (host === 'eventframe.io' && !forcedAgency)
  ) {
    return null;
  }

  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .or(`slug.eq.${agencySlug},domain.eq.${host}`)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function getAgencyById(id: string): Promise<Agency | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', id)
    .single();
    
  return error ? null : data;
}

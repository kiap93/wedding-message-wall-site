import { Agency } from '../types';
import { API_BASE } from './config';
import { getCurrentSubdomain } from './workspace';

export async function resolveAgency(): Promise<Agency | null> {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.trim().toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const forcedAgency = urlParams.get('agency')?.trim().toLowerCase();
  const agencySlug = forcedAgency || getCurrentSubdomain();

  if (!agencySlug && (host === 'localhost' || host === '127.0.0.1' || host === 'eventframe.io' || host === 'www.eventframe.io')) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    if (agencySlug) params.set('slug', agencySlug);
    if (host) params.set('host', host);

    const response = await fetch(`${API_BASE}/api/agencies/resolve?${params.toString()}`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const agency = payload?.agency || payload?.data?.agency || (payload?.data?.id ? payload.data : null);
    return (payload?.found || payload?.success) && agency ? (agency as Agency) : null;
  } catch (err) {
    console.error('Error resolving agency:', err);
    return null;
  }
}

export async function getAgencyById(id: string): Promise<Agency | null> {
  if (!id || !String(id).trim()) return null;

  try {
    const response = await fetch(
      `${API_BASE}/api/agencies/resolve?id=${encodeURIComponent(id)}`,
      { credentials: 'include' }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const agency = payload?.agency || payload?.data?.agency || (payload?.data?.id ? payload.data : null);
    return (payload?.found || payload?.success) && agency ? (agency as Agency) : null;
  } catch (err) {
    console.error('Error fetching agency by ID:', err);
    return null;
  }
}

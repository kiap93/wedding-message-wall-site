// Detect if we are running in the AI Studio preview environment
const isAiStudio = 
  window.location.hostname.includes('run.app') || 
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('127.0.0.1') ||
  window.location.hostname.includes('googleusercontent.com');

// If in AI Studio, we point directly to the worker for auth to work (CORS).
// If on eventframe.io (root or subdomain), we use relative paths so cookies are shared safely.
export const API_BASE = isAiStudio 
  ? 'https://api.eventframe.io' 
  : 'https://api.eventframe.io';

console.log('[Config] API_BASE detected as:', API_BASE || '(relative)');
console.log('[Config] Hostname:', window.location.hostname);
console.log('[Config] isAiStudio:', isAiStudio);

/**
 * Extracts the tenant ID (subdomain) from the current URL.
 * Supports:
 * - subdomain.eventframe.io -> subdomain
 * - URL query param ?tenant=abc -> abc (for development)
 */
export const getTenant = (): string | null => {
  const hostname = window.location.hostname;
  
  // 1. Check Subdomain (Production)
  if (hostname.endsWith('.eventframe.io')) {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
  }

  // 2. Check Query Param (Development)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');
    if (tenantParam) return tenantParam;
  }

  return null;
};

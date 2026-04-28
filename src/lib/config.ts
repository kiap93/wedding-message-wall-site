// Detect if we are running on a custom domain (including eventframe.io or workers.dev subdomains)
const isCustomDomain = 
  window.location.hostname === 'eventframe.io' || 
  window.location.hostname.endsWith('.eventframe.io') ||
  window.location.hostname.endsWith('.workers.dev') ||
  window.location.hostname === 'wedding-event-api.buildsiteasia.com';

// If on a custom domain, use relative paths (worker is proxying everything)
// If on AI Studio preview, we must point directly to the worker service
export const API_BASE = isCustomDomain 
  ? '' 
  : 'https://wedding-auth-worker.kiap93-kmj.workers.dev';

// Detect if we are running in the AI Studio preview environment
const isAiStudio = 
  window.location.hostname.includes('run.app') || 
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('googleusercontent.com');

// If in AI Studio, we must point directly to the worker for auth to work (CORS)
// If on a custom domain (eventframe.io) or the worker domain itself, we use relative paths
export const API_BASE = isAiStudio 
  ? 'https://wedding-auth-worker.kiap93-kmj.workers.dev' 
  : '';

console.log('[Config] API_BASE detected as:', API_BASE || '(relative)');

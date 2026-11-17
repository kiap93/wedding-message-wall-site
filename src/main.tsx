import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  getStoredMarketingLanguage,
  resolveInitialMarketingLanguage,
} from './lib/i18n/MarketingTranslationContext';
import { normalizePathname } from './seo/canonical';

const rootEl = document.getElementById('root')!;

const isPrerendered = rootEl.hasAttribute('data-prerendered');
const prerenderPath = rootEl.getAttribute('data-prerender-path');
const currentPath = normalizePathname(window.location.pathname);
const resolvedLang = resolveInitialMarketingLanguage(
  window.location.search,
  getStoredMarketingLanguage(),
  window.location.pathname
);
const ssrLang = document.documentElement.lang || 'en';
const matchesPrerenderRoute = Boolean(prerenderPath) && prerenderPath === currentPath;

if (isPrerendered && rootEl.hasChildNodes() && ssrLang === resolvedLang && matchesPrerenderRoute) {
  hydrateRoot(rootEl, <App />);
} else {
  if (isPrerendered && rootEl.hasChildNodes()) {
    // Discard mismatched SSR marketing markup (e.g. if a host cached `/` for `/workspace`)
    rootEl.innerHTML = '';
    rootEl.removeAttribute('data-prerendered');
    rootEl.removeAttribute('data-prerender-path');
  }
  createRoot(rootEl).render(<App />);
}

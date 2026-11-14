import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  getStoredMarketingLanguage,
  resolveInitialMarketingLanguage,
} from './lib/i18n/MarketingTranslationContext';

const rootEl = document.getElementById('root')!;

const isPrerendered = rootEl.hasAttribute('data-prerendered');
const resolvedLang = resolveInitialMarketingLanguage(
  window.location.search,
  getStoredMarketingLanguage(),
  window.location.pathname
);
const ssrLang = document.documentElement.lang || 'en';

if (isPrerendered && rootEl.hasChildNodes() && ssrLang === resolvedLang) {
  hydrateRoot(rootEl, <App />);
} else {
  createRoot(rootEl).render(<App />);
}

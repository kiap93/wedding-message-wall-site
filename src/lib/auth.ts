import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  apiFetch,
  getCsrfToken,
  setCsrfTokenMemory,
  extractApiErrorMessage,
  unwrapApiData,
} from './apiClient';

export {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getCsrfToken,
  setCsrfTokenMemory,
  extractApiErrorMessage,
  unwrapApiData,
};

export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  return apiFetch(url, options);
}

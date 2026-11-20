import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  clearClientAuthStorage,
  getClientAuthEpoch,
  bumpClientAuthEpoch,
  apiFetch,
  ApiFetchOptions,
  getCsrfToken,
  setCsrfTokenMemory,
  extractApiErrorMessage,
  unwrapApiData,
} from './apiClient';

export {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  clearClientAuthStorage,
  getClientAuthEpoch,
  bumpClientAuthEpoch,
  getCsrfToken,
  setCsrfTokenMemory,
  extractApiErrorMessage,
  unwrapApiData,
};

export async function authenticatedFetch(url: string, options: ApiFetchOptions = {}) {
  return apiFetch(url, options);
}

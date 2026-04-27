export function getAuthToken() {
  return localStorage.getItem('wedding_session_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('wedding_session_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('wedding_session_token');
}

export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Still include for cookie support if available
  });
}

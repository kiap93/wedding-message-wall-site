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
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
    // console.log(`[auth] Sending request with Bearer token to: ${url}`);
  } else {
    // console.log(`[auth] Sending request without Bearer token to: ${url} (Cookie will be used)`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

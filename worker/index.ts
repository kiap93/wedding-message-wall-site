import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  APP_URL: string;      // The Worker URL (for Google callback)
  FRONTEND_URL: string; // The Website URL (for final redirect)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  // In production, you might want to restrict this to eventframe.io
  if (origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', worker: true }));

// 1. Redirect to Google
app.get('/api/auth/google', async (c) => {
  const GOOGLE_CLIENT_ID = c.env.GOOGLE_CLIENT_ID;
  const APP_URL = c.env.APP_URL;
  
  // Capture the origin to redirect back to the correct subdomain
  const origin = c.req.header('Origin') || c.env.FRONTEND_URL;
  const state = btoa(JSON.stringify({ origin }));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  // Support both: JSON for fetch() and direct redirect for browser
  const accept = c.req.header('Accept');
  if (accept && accept.includes('application/json')) {
    return c.json({ url });
  }

  return c.redirect(url);
});

// 2. Google Callback
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  
  let targetOrigin = c.env.FRONTEND_URL;
  if (stateParam) {
    try {
      const decoded = JSON.parse(atob(stateParam));
      if (decoded.origin) targetOrigin = decoded.origin;
    } catch (e) {
      console.error('Failed to decode state:', e);
    }
  }

  if (!code) return c.redirect(`${targetOrigin}/login?error=no_code`);

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, APP_URL } = c.env;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as any;
    
    // Get user info from ID Token (or skip and fetch userinfo)
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    const userPayload = await userResponse.json() as any;
    console.log('Google User Payload:', JSON.stringify(userPayload));

    const user = {
      id: userPayload.sub || userPayload.id || String(Math.random()),
      sub: userPayload.sub || userPayload.id || String(Math.random()),
      email: userPayload.email,
      name: userPayload.name,
      picture: userPayload.picture,
    };

    console.log('Signing User JWT:', JSON.stringify(user));

    // Sign our session JWT
    // Use an object that definitely has keys to avoid empty payload issues
    const token = await sign({ ...user, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, 'HS256');

    // Set cookie with SameSite=None for cross-domain support
    const cookieOptions: any = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    };

    // If we're on eventframe.io, use a wildcard domain to share cookies with subdomains
    const hostname = new URL(c.req.url).hostname;
    if (hostname.endsWith('eventframe.io')) {
      cookieOptions.domain = '.eventframe.io';
    }

    setCookie(c, 'wedding_session', token, cookieOptions);

    // Use the dynamic targetOrigin determined above
    return c.redirect(`${targetOrigin}/admin?token=${token}`);
  } catch (error) {
    console.error('Worker Auth Error:', error);
    // Use the dynamic targetOrigin for error redirect too
    const fallbackOrigin = c.env.FRONTEND_URL || 'https://eventframe.io';
    return c.redirect(`${fallbackOrigin}/login?error=auth_failed`);
  }
});

// 3. Get Current User
app.get('/api/auth/me', async (c) => {
  // Check both Cookie and Authorization Header
  let token = getCookie(c, 'wedding_session');
  
  const authHeader = c.req.header('Authorization');
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    console.log('Verified Session Payload:', JSON.stringify(payload));
    return c.json({ user: payload });
  } catch (e) {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

// 4. Logout
app.post('/api/auth/logout', (c) => {
  const cookieOptions: any = {
    path: '/',
    secure: true,
    sameSite: 'None'
  };

  const hostname = new URL(c.req.url).hostname;
  if (hostname.endsWith('eventframe.io')) {
    cookieOptions.domain = '.eventframe.io';
  }

  deleteCookie(c, 'wedding_session', cookieOptions);
  return c.json({ success: true });
});

app.get('/api/debug-env', (c) => {
  return c.json({
    has_jwt_secret: !!c.env.JWT_SECRET,
    has_google_secret: !!c.env.GOOGLE_CLIENT_SECRET,
    app_url: c.env.APP_URL
  });
});

// 5. Proxy all other requests to the Frontend App (White Label Logic)
app.all('*', async (c) => {
  const url = new URL(c.req.url);
  
  // If it's a request to the main application (not an API route already handled)
  // we proxy it to the FRONTEND_URL but preserve the hostname logic
  const targetUrl = new URL(url.pathname + url.search, c.env.FRONTEND_URL);
  
  console.log(`Proxying ${url.hostname}${url.pathname} -> ${targetUrl.toString()}`);

  const headers = new Headers(c.req.raw.headers);
  headers.delete('Host'); // Ensure the destination host is used instead of the client's host
  
  // Pass original host and proto so the app can handle logic if needed
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  const proxyRequest = new Request(targetUrl.toString(), {
    method: c.req.method,
    headers: headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    redirect: 'manual'
  });

  try {
    const response = await fetch(proxyRequest);
    
    // Create a new set of headers to modify
    const newHeaders = new Headers(response.headers);
    
    // Rewrite redirects that point to the internal origin
    const location = newHeaders.get('Location');
    if (location) {
      try {
        const locationUrl = new URL(location, targetUrl.toString());
        const frontendUrl = new URL(c.env.FRONTEND_URL);
        
        // If the redirect points to our internal origin, rewrite it to the public origin
        if (locationUrl.hostname === frontendUrl.hostname) {
          const rewrittenUrl = new URL(locationUrl.pathname + locationUrl.search, url.origin);
          newHeaders.set('Location', rewrittenUrl.toString());
        }
      } catch (err) {
        // If location is not a valid URL (and not relative), just cross our fingers or leave it
      }
    }

    // Also rewrite cookies to the public domain
    const setCookie = newHeaders.get('Set-Cookie');
    if (setCookie) {
      // Very simple domain rewrite for cookies if they specify the internal domain
      const frontendUrl = new URL(c.env.FRONTEND_URL);
      const publicUrl = new URL(url.origin);
      const rewrittenCookie = setCookie.replace(new RegExp(frontendUrl.hostname, 'g'), publicUrl.hostname);
      newHeaders.set('Set-Cookie', rewrittenCookie);
    }

    // Proxy must not return double CORS or other conflicting headers if already present
    // but usually fetch/response handling in Workers is transparent enough.
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (e) {
    console.error('Proxy Fetch Error:', e);
    return c.text(`Proxy Error: Failed to reach origin at ${c.env.FRONTEND_URL}.`, 502);
  }
});

export default app;

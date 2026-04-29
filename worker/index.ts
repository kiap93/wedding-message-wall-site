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

    // Set cookie with SameSite=None for cross-domain support (legacy support)
    setCookie(c, 'wedding_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

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
  deleteCookie(c, 'wedding_session', { 
    path: '/',
    secure: true,
    sameSite: 'None'
  });
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
  // we proxy it to the FRONTEND_URL but preserve the hostname for the app to detect subdomains
  
  // We need to be careful not to proxy to ourselves if FRONTEND_URL is same as eventframe.io
  // In a real setup, FRONTEND_URL should be the origin (e.g. Cloud Run or Vercel URL)
  const targetUrl = new URL(url.pathname + url.search, c.env.FRONTEND_URL);
  
  console.log(`Proxying ${url.hostname}${url.pathname} -> ${targetUrl.toString()}`);

  const request = new Request(targetUrl.toString(), c.req.raw);
  // Important: The Host header should ideally stay as the original one so the app knows the subdomain
  // but some origins reject foreign hosts. Our app logic uses window.location.hostname anyway.

  try {
    return await fetch(request);
  } catch (e) {
    return c.text(`Proxy Error: Failed to reach origin at ${c.env.FRONTEND_URL}. Ensure FRONTEND_URL in wrangler.toml points to your actual app origin (e.g. Cloud Run URL).`, 502);
  }
});

export default app;

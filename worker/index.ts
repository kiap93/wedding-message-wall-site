import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  APP_URL: string;      // The Worker URL (for Google callback)
  FRONTEND_URL: string; // The Website URL (for final redirect)
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  
  if (origin) {
    const url = new URL(origin);
    const domain = url.hostname;
    
    // Check if it's our main domain or a subdomain
    const isAllowed = 
      domain === 'eventframe.io' || 
      domain.endsWith('.eventframe.io') || 
      domain.includes('ais-dev-') || 
      domain.includes('localhost');

    if (isAllowed) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
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
  const source = c.req.query('source') || c.env.FRONTEND_URL || 'https://eventframe.io';

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: 'https://eventframe.io/api/auth/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: btoa(JSON.stringify({ source })), // Pass redirect source in state
  });

  return c.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

// 2. Google Callback
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  
  let redirectUrl = c.env.FRONTEND_URL || 'https://eventframe.io';
  if (state) {
    try {
      const decodedState = JSON.parse(atob(state));
      if (decodedState.source) redirectUrl = decodedState.source;
    } catch (e) {}
  }

  if (!code) return c.redirect(`${redirectUrl}/login?error=no_code`);

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
        redirect_uri: 'https://eventframe.io/api/auth/callback',
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as any;
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    const userPayload = await userResponse.json() as any;
    
    const user = {
      id: userPayload.sub || userPayload.id,
      sub: userPayload.sub || userPayload.id,
      email: userPayload.email,
      name: userPayload.name,
      picture: userPayload.picture,
    };

    const token = await sign({ ...user, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, 'HS256');

    // Set cookie on base domain for wildcard support
    const cookieOptions: any = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    };

    // If on eventframe.io, allow subdomains to see the cookie
    if (redirectUrl.includes('eventframe.io')) {
      cookieOptions.domain = '.eventframe.io';
    }

    setCookie(c, 'wedding_session', token, cookieOptions);

    return c.redirect(`${redirectUrl}/admin?token=${token}`);
  } catch (error) {
    console.error('Worker Auth Error:', error);
    return c.redirect(`${redirectUrl}/login?error=auth_failed`);
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

// 5. Debug
app.get('/api/debug-env', (c) => {
  return c.json({
    has_jwt_secret: !!c.env.JWT_SECRET,
    has_google_secret: !!c.env.GOOGLE_CLIENT_SECRET,
    app_url: c.env.APP_URL,
    frontend_url: c.env.FRONTEND_URL,
    host: c.req.header('Host')
  });
});

// 6. Proxy all other requests to the AI Studio frontend
app.all('*', async (c) => {
  const url = new URL(c.req.url);
  
  // Skip proxying if it's an API call that wasn't handled (e.g. 404 API)
  if (url.pathname.startsWith('/api/')) {
    return c.json({ error: 'API route not found' }, 404);
  }

  // The ORIGIN_URL is where the React code is hosted (AI Studio)
  const originUrl = c.env.APP_URL || 'https://ais-dev-gdngji75booh6pohbtz4yj-61188279736.asia-southeast1.run.app';
  const originHost = new URL(originUrl).hostname;

  // CRITICAL: Prevent circular proxying if the user points APP_URL to the custom domain itself
  if (url.hostname === originHost || url.hostname === 'eventframe.io' || url.hostname.endsWith('.eventframe.io')) {
    if (url.hostname === originHost && !originHost.includes('run.app')) {
       return c.text('Configuration Error: APP_URL in Cloudflare must point to the AI Studio URL (e.g., xxx.run.app), not your custom domain.', 400);
    }
  }
  
  const targetUrl = new URL(url.pathname + url.search, originUrl);
  
  const headers = new Headers(c.req.header());
  headers.set('Host', originHost);
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Proxy-By', 'Eventframe-Worker');

  try {
    const response = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers: headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS' ? await c.req.blob() : undefined,
      redirect: 'manual'
    });
    
    // Create new response to allow header modifications
    const newResponse = new Response(response.body, response);
    
    // Force correct CORS for the current requesting origin
    const origin = c.req.header('Origin');
    if (origin) {
      newResponse.headers.set('Access-Control-Allow-Origin', origin);
      newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return newResponse;
  } catch (error) {
    console.error('Proxy Error:', error);
    return c.text(`Backend unreachable. Please ensure APP_URL is set to ${originUrl} in Cloudflare variables.`, 504);
  }
});

export default app;

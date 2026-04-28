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

// Global Error Handler
app.onError((err, c) => {
  console.error(`[Worker Error] ${c.req.method} ${c.req.path} | Origin: ${c.req.header('Origin')}:`, err);
  return c.json({ 
    error: 'Internal Server Error', 
    message: err.message,
    stack: err.stack,
    path: c.req.path
  }, 500);
});

// 404 Handler for API routes specifically
app.notFound((c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;
  if (path === '/api' || path.startsWith('/api/')) {
    console.warn(`[Worker] API 404 Not Found: ${c.req.method} ${path}`);
    return c.json({ error: 'API Route Not Found', path }, 404);
  }
  return undefined as any; 
});

// CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const url = new URL(c.req.url);
  console.log(`[Worker] Incoming: ${c.req.method} ${url.pathname}${url.search} | Host: ${url.hostname} | Origin: ${origin || 'none'}`);
  
  if (origin) {
    const url = new URL(origin);
    const domain = url.hostname;
    
    // Check if it's our main domain or a known/local environment
    const isAllowed = 
      domain === 'eventframe.io' || 
      domain.endsWith('.eventframe.io') || 
      domain.endsWith('.run.app') || 
      domain.endsWith('.googleusercontent.com') ||
      domain.endsWith('.workers.dev') ||
      domain.includes('localhost') ||
      domain.includes('127.0.0.1') ||
      domain.includes('googleusercontent.com') ||
      domain.includes('run.app');

    if (isAllowed) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-fb-response-control');
      c.res.headers.set('Access-Control-Expose-Headers', 'Set-Cookie');
    } else {
      console.warn(`[Worker] Unallowed Origin Blocked: ${origin} (Domain: ${domain})`);
    }
  }
  
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

// Helper for Google Auth
async function handleGoogleAuth(c: any) {
  const GOOGLE_CLIENT_ID = c.env.GOOGLE_CLIENT_ID;
  if (!GOOGLE_CLIENT_ID) {
    return c.json({ error: 'Config Error', details: 'GOOGLE_CLIENT_ID is not set in Worker environment variables.' }, 500);
  }
  const source = c.req.query('source') || c.env.FRONTEND_URL || 'https://eventframe.io';
  
  let redirect_uri;
  const currentUrl = new URL(c.req.url);
  if (currentUrl.hostname.endsWith('eventframe.io')) {
    redirect_uri = 'https://eventframe.io/api/auth/callback';
  } else if (currentUrl.hostname.endsWith('workers.dev')) {
    redirect_uri = `https://${currentUrl.hostname}/api/auth/callback`;
  } else {
    redirect_uri = `${currentUrl.origin}/api/auth/callback`.replace('http://', 'https://');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirect_uri,
    uint: '1',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: btoa(JSON.stringify({ source })),
  });

  return c.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}

// --- API ROUTES ---
const api = new Hono<{ Bindings: Bindings }>();

api.get('/health', (c) => c.json({ status: 'ok', worker: true }));

api.all('/auth/google', handleGoogleAuth);
api.all('/auth/google/', handleGoogleAuth);

api.get('/auth/callback', async (c) => {
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

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET } = c.env;
  
  let redirect_uri;
  const currentUrl = new URL(c.req.url);
  if (currentUrl.hostname.endsWith('eventframe.io')) {
    redirect_uri = 'https://eventframe.io/api/auth/callback';
  } else if (currentUrl.hostname.endsWith('workers.dev')) {
    redirect_uri = `https://${currentUrl.hostname}/api/auth/callback`;
  } else {
    redirect_uri = `${currentUrl.origin}/api/auth/callback`.replace('http://', 'https://');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as any;
    
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

    const cookieOptions: any = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    };

    const knownDomains = ['eventframe.io'];
    const matchedDomain = knownDomains.find(d => redirectUrl.includes(d));
    
    if (matchedDomain) {
      cookieOptions.domain = `.${matchedDomain}`;
    } else {
      try {
        const url = new URL(redirectUrl);
        const parts = url.hostname.split('.');
        if (parts.length >= 2) {
          const baseDomain = parts.slice(-2).join('.');
          const publicSuffixes = ['localhost', '127.0.0.1', 'workers.dev', 'run.app', 'googleusercontent.com'];
          if (!publicSuffixes.includes(baseDomain) && !baseDomain.endsWith('.run.app')) {
            cookieOptions.domain = `.${baseDomain}`;
          }
        }
      } catch (e) {}
    }

    setCookie(c, 'wedding_session', token, cookieOptions);

    return c.redirect(`${redirectUrl}/admin?token=${token}`);
  } catch (error) {
    console.error('Worker Auth Error:', error);
    return c.redirect(`${redirectUrl}/login?error=auth_failed`);
  }
});

api.get('/auth/me', async (c) => {
  let token = getCookie(c, 'wedding_session');
  const authHeader = c.req.header('Authorization');
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    return c.json({ user: payload });
  } catch (e) {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

api.post('/auth/logout', (c) => {
  deleteCookie(c, 'wedding_session', { path: '/', secure: true, sameSite: 'None' });
  return c.json({ success: true });
});

api.get('/debug-env', (c) => {
  const url = new URL(c.req.url);
  const redirect_uri = `${url.origin}/api/auth/callback`.replace('http://', 'https://');
  return c.json({
    has_jwt_secret: !!c.env.JWT_SECRET,
    has_google_id: !!c.env.GOOGLE_CLIENT_ID,
    has_google_secret: !!c.env.GOOGLE_CLIENT_SECRET,
    app_url: c.env.APP_URL || 'not set',
    frontend_url: c.env.FRONTEND_URL || 'not set',
    host_header: c.req.header('Host'),
    request_url: c.req.url,
    detected_redirect_uri: redirect_uri,
    timestamp: new Date().toISOString()
  });
});

app.route('/api', api);

// Final fallback for any other /api routes that weren't caught above
app.all('/api', (c) => c.json({ error: 'API root not implemented', path: '/api' }, 404));
app.all('/api/*', (c) => {
  console.warn(`[Worker] Unhandled API route blocked from proxy: ${c.req.method} ${c.req.path}`);
  return c.json({ 
    error: 'API route not handled by worker', 
    path: c.req.path,
    method: c.req.method 
  }, 404);
});

// 6. Proxy all other requests to the AI Studio frontend
app.all('*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;
  const method = c.req.method;
  
  // PRIMARY GUARD: Prevent API calls from reaching the proxy logic
  if (path === '/api' || path.startsWith('/api/')) {
    console.warn(`[Worker] API Guard triggered: ${method} ${path}`);
    
    // Check if it's one of our defined routes that somehow fell through
    // This could happen if Hono's router missed it but the catch-all didn't
    return c.json({ 
      error: 'API route not handled by worker (Proxy Guard)', 
      path: path,
      method: method,
      suggestion: 'Check if the route is correctly defined in worker/index.ts'
    }, 404);
  }

  console.log(`[Worker] Proxying request for: ${method} ${path} | Host: ${url.hostname}`);

  // The ORIGIN_URL is where the React code is hosted (AI Studio)
  const originUrl = c.env.APP_URL || 'https://ais-dev-gdngji75booh6pohbtz4yj-61188279736.asia-southeast1.run.app';
  const originHost = new URL(originUrl).hostname;

  // CRITICAL: Prevent circular proxying
  if (url.hostname === originHost) {
     return c.text('Configuration Error: APP_URL in Cloudflare must point to the AI Studio URL (e.g., xxx.run.app), not the worker domain.', 400);
  }
  
  const targetUrl = new URL(url.pathname + url.search, originUrl);
  
  // Extract tenant from subdomain (e.g., john.eventframe.io -> john)
  let tenantId = null;
  const hostname = url.hostname;
  if (hostname.endsWith('.eventframe.io')) {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      tenantId = parts[0];
    }
  }

  const headers = new Headers(c.req.header());
  headers.set('Host', originHost);
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Proxy-By', 'Eventframe-Worker');
  
  if (tenantId) {
    headers.set('X-Tenant-ID', tenantId);
    console.log(`[Worker] Detected Tenant: ${tenantId}`);
  }

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
    return c.text(`Backend unreachable. Please ensure Cloudflare Variable APP_URL is correctly set: ${originUrl}`, 504);
  }
});

export default app;

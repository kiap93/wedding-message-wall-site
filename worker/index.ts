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

// --- AUTH HANDLERS ---

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

async function handleGoogleCallback(c: any) {
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
        code: code || '',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as any;
    
    if (tokens.error) {
      console.error('Google Token Error:', tokens);
      return c.redirect(`${redirectUrl}/login?error=token_exchange_failed`);
    }

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
    return c.redirect(`${redirectUrl}/login?error=auth_catch_error`);
  }
}

async function handleAuthMe(c: any) {
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
}

// --- API SUB-APP ---

const api = new Hono<{ Bindings: Bindings }>();

// Force all API routes to return JSON and stop fallthrough
api.use('*', async (c, next) => {
  console.log(`[Worker API] Hit: ${c.req.method} ${c.req.path}`);
  await next();
  // If we reach here and no response was set, it's a 404 for API
  if (c.res.status === 404) {
    return c.json({ error: 'API route not found', path: c.req.path }, 404);
  }
});

api.get('/health', (c) => {
  const url = new URL(c.req.url);
  return c.json({ 
    status: 'ok', 
    worker: true,
    path: c.req.path,
    url: c.req.url,
    hostname: url.hostname,
    timestamp: new Date().toISOString()
  });
});

api.all('/auth/google', handleGoogleAuth);
api.all('/auth/google/', handleGoogleAuth);
api.get('/auth/callback', handleGoogleCallback);
api.get('/auth/me', handleAuthMe);

api.post('/auth/logout', (c) => {
  deleteCookie(c, 'wedding_session', { 
    path: '/', 
    secure: true, 
    sameSite: 'None',
    domain: '.eventframe.io'
  });
  return c.json({ success: true });
});

api.get('/debug-env', (c) => {
  const url = new URL(c.req.url);
  return c.json({
    has_jwt_secret: !!c.env.JWT_SECRET,
    has_google_id: !!c.env.GOOGLE_CLIENT_ID,
    has_google_secret: !!c.env.GOOGLE_CLIENT_SECRET,
    app_url: c.env.APP_URL || 'not set',
    frontend_url: c.env.FRONTEND_URL || 'not set',
    host_header: c.req.header('Host'),
    hostname: url.hostname,
    request_path: c.req.path,
    request_url: c.req.url,
    timestamp: new Date().toISOString()
  });
});

// --- MAIN APP MIDDLEWARES & ROUTES ---

// Global Error Handler
app.onError((err, c) => {
  console.error(`[Worker Error] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ 
    error: 'Internal Server Error', 
    message: err.message,
    path: c.req.path
  }, 500);
});

// CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin) {
    const url = new URL(origin);
    const domain = url.hostname;
    
    const isAllowed = 
      domain === 'eventframe.io' || 
      domain.endsWith('.eventframe.io') || 
      domain.includes('localhost') ||
      domain.includes('127.0.0.1') ||
      domain.endsWith('.workers.dev') ||
      domain.endsWith('.run.app');

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

// Mount the API at the root app level
app.route('/api', api);
app.route('//api', api);

// Catch-all API guard (if it hits /api but not handled by sub-app)
app.all('/api/*', (c) => {
  return c.json({ error: 'API route not found on worker', path: c.req.path }, 404);
});

// Proxy logic for anything else
app.all('*', async (c) => {
  const path = c.req.path;
  
  // Guard for API leaking into proxy
  if (/\/api\//.test(path) || path === '/api' || path === '//api') {
    return c.json({ error: 'API path leaked to proxy', path }, 404);
  }

  const originUrl = c.env.APP_URL || 'https://ais-dev-gdngji75booh6pohbtz4yj-61188279736.asia-southeast1.run.app';
  const url = new URL(c.req.url);
  const targetUrl = new URL(url.pathname + url.search, originUrl);
  const originHost = new URL(originUrl).hostname;

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
    
    const newResponse = new Response(response.body, response);
    const origin = c.req.header('Origin');
    if (origin) {
      newResponse.headers.set('Access-Control-Allow-Origin', origin);
      newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return newResponse;
  } catch (error) {
    console.error('Proxy Error:', error);
    return c.text('Backend unreachable', 504);
  }
});

export default app;

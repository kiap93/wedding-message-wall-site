import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  APP_URL: string;      // https://api.eventframe.io
  FRONTEND_URL: string; // https://eventframe.io
};

const app = new Hono<{ Bindings: Bindings }>();

// =========================
// CORS (STRICT + COOKIES)
// =========================
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');

  if (origin) {
    try {
      const hostname = new URL(origin).hostname;

      const allowed =
        hostname === 'eventframe.io' ||
        hostname.endsWith('.eventframe.io');

      if (allowed) {
        c.res.headers.set('Access-Control-Allow-Origin', origin);
        c.res.headers.set('Access-Control-Allow-Credentials', 'true');
        c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
    } catch {}
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
});

// =========================
// HEALTH
// =========================
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'auth-worker',
    domain: 'api.eventframe.io',
  });
});

// =========================
// 1. GOOGLE LOGIN
// =========================
app.get('/api/auth/google', (c) => {
  const { GOOGLE_CLIENT_ID, APP_URL } = c.env;

  const redirect_uri = `${APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return c.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
});

// =========================
// 2. GOOGLE CALLBACK
// =========================
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, APP_URL, FRONTEND_URL } = c.env;

  if (!code) {
    return c.redirect(`${FRONTEND_URL}/login?error=no_code`);
  }

  const redirect_uri = `${APP_URL}/api/auth/callback`;

  try {
    // Exchange code
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json() as any;

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return c.redirect(`${FRONTEND_URL}/login?error=token_failed`);
    }

    // Get user
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userPayload = await userRes.json() as any;

    const user = {
      id: userPayload.sub,
      email: userPayload.email,
      name: userPayload.name,
      picture: userPayload.picture,
    };

    // Sign JWT
    const token = await sign(
      { ...user, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      'HS256'
    );

    // ✅ CRITICAL: shared across subdomains
    setCookie(c, 'wedding_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      domain: '.eventframe.io',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    // ✅ Clean redirect (NO token in URL)
    return c.redirect(`${FRONTEND_URL}/admin`);
  } catch (err) {
    console.error('Auth error:', err);
    return c.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

// =========================
// 3. CURRENT USER
// =========================
app.get('/api/auth/me', async (c) => {
  let token = getCookie(c, 'wedding_session');

  const authHeader = c.req.header('Authorization');
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    return c.json({ user: payload });
  } catch {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

// =========================
// 4. LOGOUT
// =========================
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'wedding_session', {
    path: '/',
    domain: '.eventframe.io',
    secure: true,
    sameSite: 'None',
  });

  return c.json({ success: true });
});

// =========================
// DEBUG
// =========================
app.get('/api/debug-env', (c) => {
  return c.json({
    app_url: c.env.APP_URL,
    frontend_url: c.env.FRONTEND_URL,
    has_google_id: !!c.env.GOOGLE_CLIENT_ID,
    has_google_secret: !!c.env.GOOGLE_CLIENT_SECRET,
    has_jwt: !!c.env.JWT_SECRET,
  });
});

export default app;
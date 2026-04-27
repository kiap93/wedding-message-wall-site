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
  // In production, you might want to restrict this to wedding-tools.buildsiteasia.com
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

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return c.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

// 2. Google Callback
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.redirect('/login?error=no_code');

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

    const user = {
      id: userPayload.sub,
      email: userPayload.email,
      name: userPayload.name,
      picture: userPayload.picture,
    };

    // Sign our session JWT
    const token = await sign(user, JWT_SECRET, 'HS256');

    // Set cookie with SameSite=None for cross-domain support (legacy support)
    setCookie(c, 'wedding_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Get Frontend URL from environment or fallback
    const FRONTEND_URL = c.env.FRONTEND_URL || 'https://wedding-tools.buildsiteasia.com';
    
    // Also pass the token in the URL so the frontend can save it to LocalStorage
    // (This avoids third-party cookie blocking issues)
    return c.redirect(`${FRONTEND_URL}/admin?token=${token}`);
  } catch (error) {
    console.error('Worker Auth Error:', error);
    return c.redirect('/login?error=auth_failed');
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

export default app;

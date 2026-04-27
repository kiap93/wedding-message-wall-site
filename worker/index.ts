import { Hono } from 'hono';
import { googleAuth } from '@hono/google-auth'; // Note: You can use standard fetch or a library
import { sign, verify } from 'hono/jwt';
import { cookie } from 'hono/cookie';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  APP_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

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
    const token = await sign(user, JWT_SECRET);

    // Set cookie
    setCookie(c, 'wedding_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return c.redirect('/admin');
  } catch (error) {
    console.error('Worker Auth Error:', error);
    return c.redirect('/login?error=auth_failed');
  }
});

// 3. Get Current User
app.get('/api/auth/me', async (c) => {
  const token = getCookie(c, 'wedding_session');
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    return c.json({ user: payload });
  } catch (e) {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

// 4. Logout
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'wedding_session', { path: '/' });
  return c.json({ success: true });
});

export default app;

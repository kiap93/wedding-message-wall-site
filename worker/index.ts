import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import Stripe from 'stripe';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  APP_URL: string;      // The Worker URL (for Google callback)
  FRONTEND_URL: string; // The Website URL (for final redirect)
  SUPABASE_URL: string;
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  VITE_SUPABASE_ANON_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  GMAIL_USER: string;
  GMAIL_PASS: string;
  RESEND_API_KEY: string;
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  // In production, you might want to restrict this to eventframe.io
  if (origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
  
  // Dynamically detect redirect_uri for AI Studio compatibility
  const host = c.req.header('host') || '';
  const isExternal = host.includes('.run.app');
  const protocol = c.req.header('x-forwarded-proto') || (isExternal ? 'https' : 'http');
  
  let currentRedirectUri = `${APP_URL}/api/auth/callback`;
  if (APP_URL.includes('localhost') && isExternal) {
    currentRedirectUri = `${protocol}://${host}/api/auth/callback`;
  }

  // Capture the origin to redirect back to the correct subdomain
  const origin = c.req.header('Origin') || c.env.FRONTEND_URL || `${protocol}://${host}`;
  const state = btoa(JSON.stringify({ origin }));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: currentRedirectUri,
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
    return c.json({ url, redirect_uri: currentRedirectUri });
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
  const jwtSecret = JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    // Dynamically detect redirect_uri
    const host = c.req.header('host') || '';
    const isExternal = host.includes('.run.app');
    const protocol = c.req.header('x-forwarded-proto') || (isExternal ? 'https' : 'http');
    
    let currentRedirectUri = `${APP_URL}/api/auth/callback`;
    if (APP_URL.includes('localhost') && isExternal) {
      currentRedirectUri = `${protocol}://${host}/api/auth/callback`;
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: currentRedirectUri,
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
    const token = await sign({ 
      ...user, 
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    }, jwtSecret, 'HS256');

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

    // Use JS replace to ensure history cleanup and popup support
    const redirectUrl = `${targetOrigin}/workspace?token=${token}`;
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Verified</title>
          <script>
            try {
              if (window.opener && window.opener !== window) {
                window.opener.postMessage({ type: 'AUTH_SUCCESS', token: "${token}" }, "*");
                // Give enough time for message to send before closing
                setTimeout(() => { 
                  try { window.close(); } catch(e) {}
                }, 1500);
              } else {
                window.location.replace("${redirectUrl}");
              }
            } catch (err) {
              window.location.replace("${redirectUrl}");
            }
          </script>
        </head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #FFFCF7; margin: 0;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.05); max-width: 90%; width: 340px;">
            <h2 style="margin: 0 0 1rem 0; font-family: sans-serif; color: #C5A059;">Verified</h2>
            <p style="color: #666; font-size: 0.9rem; line-height: 1.5;">Login successful! Returning to original tab...</p>
            <p style="color: #999; font-size: 0.7rem; margin-top: 1rem;">This window will close automatically.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Worker Auth Error:', error);
    // Use the dynamic targetOrigin for error redirect too
    const fallbackOrigin = c.env.FRONTEND_URL || 'https://eventframe.io';
    return c.redirect(`${fallbackOrigin}/login?error=auth_failed`);
  }
});

// 3. Get Current User
app.get('/api/auth/me', async (c) => {
  const hostname = new URL(c.req.url).hostname;
  const isSharedDomain = hostname.endsWith('eventframe.io');
  
  // Check both Authorization Header and Cookie
  const authHeader = c.req.header('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  const cookieToken = getCookie(c, 'wedding_session');
  if (!token) {
    token = cookieToken;
    
    // Safety check for legacy or invalid tokens
    if (token === 'null' || token === 'undefined') token = null;
  }
  
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  // CRITICAL for cross-domain logout:
  // If we are on a shared domain pool (eventframe.io), we require the cookie to be present 
  // ONLY if the user is supposed to be using cookies. 
  // If they are explicitly sending a token (from localStorage), we trust the token.
  // BUT if the cookie DOES exist and contradicts the token, we should be careful.
  // Actually, prioritizing the explicit Header is generally safer for "switched account" scenarios.

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256');
    return c.json({ user: payload });
  } catch (e: any) {
    const isJwtError = e.name === 'JwtTokenInvalid' || e.name === 'JwtTokenExpired' || e.name === 'JwtTokenIssuedAt' || e.message?.toLowerCase().includes('jwt');
    if (isJwtError) {
      console.error('Worker auth/me verification failed:', e.message);
      return c.json({ error: 'Invalid session', details: e.message }, 401);
    }
    console.error('Worker auth/me internal error:', e.message);
    return c.json({ error: 'Internal server error', details: e.message }, 500);
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

// Auth Helpers
async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedKey);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, originalHash] = storedHash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedKey);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === originalHash;
}

// 5. Email Auth (Magic Link Request - kept for backwards compatibility if needed, or repurposed)
app.post('/api/auth/email', async (c) => {
  const { email, password, mode } = await c.req.json();
  if (!email) return c.json({ error: 'Email is required' }, 400);

  if (email.toLowerCase().endsWith('@gmail.com')) {
    return c.json({ error: 'For Gmail accounts, please use Continue with Google.' }, 400);
  }

  const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined);
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY || c.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    // 1. Check if user exists
    const res = await fetch(`${supabaseUrl}/rest/v1/users_auth?email=eq.${email}`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const users = await res.json() as any[];
    const existingUser = users.length > 0 ? users[0] : null;

    if (mode === 'signup') {
      if (existingUser) {
        if (existingUser.is_verified) {
          return c.json({ error: 'User already exists and is verified. Please log in.' }, 400);
        }
        // If unverified, we'll fall through and send a new link
      } else {
        if (!password) return c.json({ error: 'Password is required' }, 400);
        const passwordHash = await hashPassword(password);
        
        // Save to Supabase
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/users_auth`, {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            email,
            password_hash: passwordHash,
            is_verified: false,
            created_at: new Date().toISOString()
          })
        });

        if (!insertRes.ok) throw new Error('DB Save failed');
      }
    } else {
      // Login mode
      if (!existingUser) return c.json({ error: 'Account not found' }, 404);
      if (!password) return c.json({ error: 'Password is required' }, 400);
      
      const isValid = await verifyPassword(password, existingUser.password_hash);
      if (!isValid) return c.json({ error: 'Invalid password' }, 401);
      
      if (!existingUser.is_verified) {
        // Allow login but warn? Or strictly block? Let's strictly block until verified.
        // But for easier testing, we'll allow but trigger a re-send.
      }
    }

    // Generate Magic Link for Verification or Direct Login (Unified Security)
    const magicToken = await sign({ 
      email,
      type: 'verify_account',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60)
    }, jwtSecret, 'HS256');

    const appUrl = (new URL(c.req.url)).origin === 'http://localhost:3000' ? 'http://localhost:3000' : 'https://eventframe.io';
    const verifyUrl = `${appUrl}/verify?token=${magicToken}`;

    console.log('--- AUTH ACTION ---');
    console.log(`Action: ${mode}`);
    console.log(`Email: ${email}`);
    console.log(`Verify link: ${verifyUrl}`);
    console.log('-------------------');

    // Attempt to send real email if configured
    if (c.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'Wedding Manager <onboarding@resend.dev>', // Default for unverified domains
            to: email,
            subject: mode === 'signup' ? 'Verify your Wedding Manager account' : 'Sign in to Wedding Manager',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF0; border-radius: 20px;">
                <h1 style="color: #2D2424; text-align: center;">Wedding Manager</h1>
                <div style="background-color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                  <p>
                    ${mode === 'signup' 
                      ? 'Welcome! Please verify your account to get started.' 
                      : 'You requested a login link.'}
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyUrl}" style="background-color: #C5A059; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                      ${mode === 'signup' ? 'Verify Account' : 'Sign In'}
                    </a>
                  </div>
                  <p style="font-size: 12px; color: #666;">
                    The link will expire in 15 minutes.
                  </p>
                </div>
              </div>
            `
          })
        });
        
        if (res.ok) {
          console.log(`[WORKER] Email sent successfully via Resend to ${email}`);
        } else {
          const err = await res.text();
          console.error(`[WORKER] Resend API error: ${err}`);
        }
      } catch (e) {
        console.error('Worker Resend attempt failed:', e);
      }
    } else if (c.env.GMAIL_USER && c.env.GMAIL_PASS) {
      console.log(`[WORKER] SMTP configured (${c.env.GMAIL_USER}), but direct SMTP is not supported in Workers. Please use Resend.`);
    }

    return c.json({ 
      success: true, 
      message: mode === 'signup' ? 'Account created. Please verify your email.' : 'Login link sent (Dual factor).'
    });
  } catch (error) {
    console.error('Worker Auth Error:', error);
    return c.json({ error: 'Authentication request failed' }, 500);
  }
});

// 5.1 Magic Link Verification (Now updates DB)
app.post('/api/auth/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ error: 'Token is required' }, 400);

  const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    
    if (payload.type !== 'verify_account' && payload.type !== 'magic_link') {
      return c.json({ error: 'Invalid token type' }, 400);
    }

    const email = payload.email;

    // Update is_verified in Supabase
    await fetch(`${supabaseUrl}/rest/v1/users_auth?email=eq.${email}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_verified: true })
    });

    const user = {
      id: `email-${btoa(email).slice(0, 12)}`,
      email: email,
      name: email.split('@')[0],
      picture: null,
    };

    const sessionToken = await sign({ 
      ...user, 
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    }, jwtSecret, 'HS256');

    const cookieOptions: any = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    };

    const hostname = new URL(c.req.url).hostname;
    if (hostname.endsWith('eventframe.io')) {
      cookieOptions.domain = '.eventframe.io';
    }

    setCookie(c, 'wedding_session', sessionToken, cookieOptions);
    return c.json({ success: true, user, token: sessionToken });
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    return c.json({ error: 'Invalid or expired link' }, 401);
  }
});

// 5.2 Forgot Password
app.post('/api/auth/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email is required' }, 400);

  const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/users_auth?email=eq.${email}`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const users = await res.json() as any[];
    const user = users.length > 0 ? users[0] : null;

    if (user) {
      const resetToken = await sign({
        email,
        type: 'password_reset',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
      }, jwtSecret, 'HS256');

      const appUrl = (new URL(c.req.url)).origin === 'http://localhost:3000' ? 'http://localhost:3000' : 'https://eventframe.io';
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
      
      const emailContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF0; border-radius: 20px;">
          <h1 style="color: #2D2424; text-align: center;">Reset Your Password</h1>
          <div style="background-color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p>You requested a password reset for your Wedding Manager account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #C5A059; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 12px; color: #666;">This link will expire in 1 hour.</p>
          </div>
        </div>
      `;

      if (c.env.RESEND_API_KEY) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: 'Wedding Manager <onboarding@resend.dev>',
              to: email,
              subject: 'Reset your Wedding Manager password',
              html: emailContent
            })
          });
        } catch (e) {
          console.error('Worker forgot password Resend failed:', e);
        }
      }
    }

    return c.json({ success: true, message: 'If this email is registered, a reset link will be sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// 5.3 Reset Password
app.post('/api/auth/reset-password', async (c) => {
  const { token, password } = await c.req.json();
  if (!token || !password) return c.json({ error: 'Token and password are required' }, 400);

  const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    if (payload.type !== 'password_reset') {
      return c.json({ error: 'Invalid token type' }, 400);
    }

    const email = payload.email;
    const passwordHash = await hashPassword(password);

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/users_auth?email=eq.${email}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password_hash: passwordHash })
    });

    if (!updateRes.ok) throw new Error('DB Update failed');

    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Reset password verification failed:', error.message);
    return c.json({ error: 'Invalid or expired reset link' }, 401);
  }
});

// 5.5 Projects API
app.put('/api/projects/:id', async (c) => updateProject(c));
app.patch('/api/projects/:id', async (c) => updateProject(c));

async function updateProject(c: any) {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const project_id = c.req.param('id');
    const projectData = await c.req.json();
    
    // Stringify JSON fields if column type is text (robustness)
    if (projectData.rsvp_fields && typeof projectData.rsvp_fields === 'object') {
      projectData.rsvp_fields = JSON.stringify(projectData.rsvp_fields);
    }

    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined);
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY || c.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: 'Supabase configuration missing', details: 'URL or Key not set in environment (Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings)' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('user_id', payload.id || payload.sub)
      .single();

    if (!agency) return c.json({ error: 'Agency not found' }, 403);

    // Exclude immutable
    const { id, agency_id, created_at, ...updateData } = projectData;

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', project_id)
      .eq('agency_id', agency.id)
      .select()
      .single();

    if (error) {
      console.error('Worker project update error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data });
  } catch (e: any) {
    if (e.name === 'JwtTokenInvalid' || e.name === 'JwtTokenExpired' || e.name === 'JwtTokenIssuedAt' || e.message?.includes('JWT')) {
      console.error('Worker project update auth failed:', e.message);
      return c.json({ error: 'Invalid session', details: e.message }, 401);
    }
    console.error('Worker project update internal error:', e.message);
    return c.json({ error: 'Internal server error', details: e.message }, 500);
  }
}

app.delete('/api/projects/:id', async (c) => {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const project_id = c.req.param('id');

    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined);
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY || c.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: 'Supabase configuration missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('user_id', payload.id || payload.sub)
      .single();

    if (!agency) return c.json({ error: 'Agency not found' }, 403);

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', project_id)
      .eq('agency_id', agency.id);

    if (error) {
      console.error('Worker project deletion error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/projects', async (c) => {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const projectData = await c.req.json();

    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined);
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY || c.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: 'Supabase configuration missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('user_id', payload.id || payload.sub)
      .single();

    if (!agency) return c.json({ error: 'Agency not found' }, 403);

    const newProject = {
      ...projectData,
      agency_id: agency.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (newProject.rsvp_fields && typeof newProject.rsvp_fields === 'object') {
      newProject.rsvp_fields = JSON.stringify(newProject.rsvp_fields);
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([newProject])
      .select()
      .single();

    if (error) {
      console.error('Worker project creation error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data }, 201);
  } catch (e: any) {
    console.error('Worker project creation internal error:', e.message);
    return c.json({ error: 'Internal server error', details: e.message }, 500);
  }
});

// --- Template Routes (Staff Only for Mutations) ---
app.post('/api/ai/generate-template', async (c) => {
  const { prompt, existingContext } = await c.req.json();
  if (!prompt) return c.json({ error: 'Prompt is required' }, 400);
  
  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: 'AI API Key not configured in worker' }, 500);

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let systemPrompt = `Create a professional wedding display design base on this user intent: "${prompt}". 
      The design should be modern, responsive, and a complete full-page experience.`;

    if (existingContext) {
      systemPrompt = `Refine the existing wedding display design based on this instruction: "${prompt}". 
      
      EXISTING CODE TO MODIFY:
      - HTML: ${existingContext.html}
      - CSS: ${existingContext.css}
      - Card HTML: ${existingContext.card_html}
      
      Please maintain the general structure while applying the requested changes. 
      If the user asks for a total rebuild, you may rewrite it significantly, but otherwise aim for consistency.`;
    }

    systemPrompt += `
      
      Requirements:
      1. Global HTML: Should be a complete layout. 
         - Use {{bride}}, {{groom}}, and {{date}} placeholders to display wedding details prominently.
         - Must contain <div id="messages-container"></div> where interactive message cards will float or drift.
      2. Global CSS: 
         - Style the entire page environment (backgrounds, overlays, typography).
         - Style #messages-container as relative with 100% width/height.
         - Style .custom-card-wrapper as absolute with animations.
         - NO OVERLAP: Use lanes with "top: calc(var(--row) * 18% + 5%)" and stagger with "animation-delay: calc(var(--index) * -7.5s)".
         - RESPONSIVE: Use fluid units (clamp, vh, vw, %).
         - Avoid using modulo (%) inside calc() as it is not broadly supported in all CSS engines; instead, use the provided --row and --col variables.
      3. Card HTML: A template for single messages using {{name}} and {{message}}.
      
      Ensure the typography for the Groom & Bride names feels special. The entire page should feel like a single cohesive theme.`;
    
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            html: { type: "string" },
            css: { type: "string" },
            card_html: { type: "string" },
            name: { type: "string" }
          },
          required: ["html", "css", "card_html", "name"]
        }
      }
    });

    return c.json(JSON.parse(result.text));
  } catch (err: any) {
    console.error('AI Generation worker error:', err);
    return c.json({ error: 'AI Generation failed', details: err.message }, 500);
  }
});

app.get('/api/templates', async (c) => {
  const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Worker template fetch error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: 'Internal server error', details: err.message }, 500);
  }
});

app.post('/api/templates', async (c) => {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const isStaff = payload.email === 'buildsiteasia@gmail.com' || payload.email?.endsWith('@eventframe.io');
    if (!isStaff) return c.json({ error: 'Staff access required' }, 403);

    const templateData = await c.req.json();
    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('templates')
      .insert([templateData])
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (e: any) {
    return c.json({ error: 'Invalid session', details: e.message }, 401);
  }
});

app.put('/api/templates/:id', async (c) => updateTemplate(c));
app.patch('/api/templates/:id', async (c) => updateTemplate(c));

async function updateTemplate(c: any) {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const isStaff = payload.email === 'buildsiteasia@gmail.com' || payload.email?.endsWith('@eventframe.io');
    if (!isStaff) return c.json({ error: 'Staff access required' }, 403);

    const { id } = c.req.param();
    const templateData = await c.req.json();
    const { id: _, ...updateData } = templateData;

    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (e: any) {
    return c.json({ error: 'Invalid session', details: e.message }, 401);
  }
}

app.delete('/api/templates/:id', async (c) => {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);
  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const isStaff = payload.email === 'buildsiteasia@gmail.com' || payload.email?.endsWith('@eventframe.io');
    if (!isStaff) return c.json({ error: 'Staff access required' }, 403);

    const { id } = c.req.param();
    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: 'Invalid session', details: e.message }, 401);
  }
});

app.post('/api/onboard', async (c) => {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const { role, name, groomName, brideName, slug } = await c.req.json();
    const userId = payload.id || payload.sub;

    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if slug exists
    const { data: existing } = await supabase
      .from('agencies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
      
    if (existing) {
      return c.json({ error: 'This subdomain is already taken' }, 400);
    }

    // 2. Create agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .insert([{
        name: role === 'couple' ? `${groomName} & ${brideName}` : name,
        slug,
        user_id: userId,
        user_role: role,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (agencyError) throw agencyError;

    let createdProjectId = null;

    // 3. If couple, create initial project ONLY (no sample data)
    if (role === 'couple' && agency) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          agency_id: agency.id,
          name: `${groomName} & ${brideName}'s Wedding`,
          groom_name: groomName,
          bride_name: brideName,
          slug: slug,
          theme_id: 'garden',
          wedding_date: new Date(Date.now() + 15552000000).toISOString().split('T')[0],
          location: 'To Be Announced',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (projectError) throw projectError;
      if (project) {
        createdProjectId = project.id;
      }
    }

    return c.json({ success: true, agency, createdProjectId }, 201);
  } catch (error: any) {
    console.error('Worker onboarding error:', error);
    return c.json({ error: error.message || 'Internal server error during onboarding' }, 500);
  }
});

app.post('/api/rsvps', async (c) => {
  try {
    const rsvpData = await c.req.json();
    
    // Stringify responses if column type is text (robustness)
    if (rsvpData.responses && typeof rsvpData.responses === 'object') {
      rsvpData.responses = JSON.stringify(rsvpData.responses);
    }
    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined);
    const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_SERVICE_KEY || c.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: 'Supabase configuration missing', details: 'URL or Key not set' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('rsvps')
      .insert([{ 
        ...rsvpData,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Worker RSVP error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data }, 201);
  } catch (e) {
    return c.json({ error: 'Failed to submit RSVP' }, 500);
  }
});

app.get('/api/debug-env', (c) => {
  return c.json({
    has_jwt_secret: !!c.env.JWT_SECRET,
    has_google_secret: !!c.env.GOOGLE_CLIENT_SECRET,
    has_stripe_secret: !!c.env.STRIPE_SECRET_KEY,
    has_supabase_url: !!c.env.SUPABASE_URL,
    has_vite_supabase_url: !!c.env.VITE_SUPABASE_URL,
    has_supabase_service_role: !!c.env.SUPABASE_SERVICE_ROLE_KEY,
    app_url: c.env.APP_URL
  });
});

// 6. Stripe Checkout Session
app.post('/api/create-checkout-session', async (c) => {
  const { planId, agencyId } = await c.req.json();
  const stripeSecret = c.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecret) {
    return c.json({ error: 'Stripe is not configured in worker' }, 500);
  }

  const stripe = new Stripe(stripeSecret, {
    httpClient: Stripe.createFetchHttpClient(), // REQUIRED for Cloudflare Workers
  });

  try {
    const isOneTime = planId === 'price_one_time';
    const appUrl = c.env.APP_URL || 'https://eventframe.io';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isOneTime ? 'Individual Wedding License' : (planId === 'price_monthly' ? 'Agency Pro (Monthly)' : 'Agency Pro (Yearly)'),
            },
            unit_amount: isOneTime ? 1900 : (planId === 'price_monthly' ? 4900 : 47000),
            ...(!isOneTime && {
              recurring: {
                interval: planId === 'price_monthly' ? 'month' : 'year',
              },
            }),
          },
          quantity: 1,
        },
      ],
      mode: isOneTime ? 'payment' : 'subscription',
      ...( !isOneTime && {
        subscription_data: {
          trial_period_days: 30,
        },
      }),
      success_url: `${appUrl}/subscription?success=true`,
      cancel_url: `${appUrl}/subscription?canceled=true`,
      metadata: {
        agencyId,
        planId,
      },
    });

    return c.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe error in worker:', error);
    return c.json({ error: error.message }, 500);
  }
});

// 7. Stripe Webhook
app.post('/api/webhook', async (c) => {
  const stripeSecret = c.env.STRIPE_SECRET_KEY;
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    console.warn('Webhook received but Stripe secrets missing');
    return c.text('Secrets missing', 200);
  }

  const stripe = new Stripe(stripeSecret, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature || '', webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Verification Error: ${err.message}`);
    return c.text(`Webhook Error: ${err.message}`, 400);
  }

  const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
  if (!supabaseUrl || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Webhook received but Supabase config missing');
    return c.text('Supabase config missing', 200);
  }

  const supabase = createClient(supabaseUrl, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const agencyId = session.metadata?.agencyId;
      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;

      if (agencyId) {
        const updateData: any = {
          subscription_status: 'active',
          stripe_customer_id: customerId,
          plan_id: session.metadata?.planId
        };
        
        if (subscriptionId) {
          updateData.subscription_id = subscriptionId;
        }

        await supabase
          .from('agencies')
          .update(updateData)
          .eq('id', agencyId);
        
        console.log(`Agency/Couple ${agencyId} confirmed via worker webhook`);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from('agencies')
        .update({ subscription_status: 'canceled' })
        .eq('subscription_id', subscription.id);
      break;
    }
  }

  return c.json({ received: true });
});

// 8. Proxy all other requests to the Frontend App (White Label Logic)
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

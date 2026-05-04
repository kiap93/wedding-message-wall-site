import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { createClient } from '@supabase/supabase-js';
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
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
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
  const jwtSecret = JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

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
          <title>Redirecting...</title>
          <script>
            try {
              if (window.opener && window.opener !== window) {
                window.opener.postMessage({ type: 'AUTH_SUCCESS', token: "${token}" }, "*");
                // Give a tiny bit of time for message to send before closing
                setTimeout(() => window.close(), 100);
              } else {
                window.location.replace("${redirectUrl}");
              }
            } catch (err) {
              window.location.replace("${redirectUrl}");
            }
          </script>
        </head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #FDFCF0;">
          <div style="text-align: center;">
            <p>Authentication successful! Redirecting you back to your workspace...</p>
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
  
  // Check both Cookie and Authorization Header
  const cookieToken = getCookie(c, 'wedding_session');
  let token = cookieToken;
  
  const authHeader = c.req.header('Authorization');
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    
    // CRITICAL for cross-domain logout:
    // If we are on a shared domain pool (eventframe.io), we require the cookie to be present.
    // If the cookie is missing but the header is present, it means the user might have logged out 
    // on another subdomain (which cleared the shared cookie) but still has local storage here.
    if (isSharedDomain && !cookieToken) {
      console.log('Shared domain logout detected: cookie missing but token in header.');
      return c.json({ error: 'Session revoked via logout' }, 401);
    }
  }

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256');
    return c.json({ user: payload });
  } catch (e: any) {
    console.error('Worker auth/me verification failed:', e.message);
    return c.json({ error: 'Invalid session', details: e.message }, 401);
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

// 5. Email Auth (Native for Worker)
app.post('/api/auth/email', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email is required' }, 400);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const user = {
      id: `email-${btoa(email).slice(0, 12)}`,
      email: email,
      name: email.split('@')[0],
      picture: null,
    };

    const token = await sign({ 
      ...user, 
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    }, jwtSecret, 'HS256');

    const cookieOptions: any = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    };

    const hostname = new URL(c.req.url).hostname;
    if (hostname.endsWith('eventframe.io')) {
      cookieOptions.domain = '.eventframe.io';
    }

    setCookie(c, 'wedding_session', token, cookieOptions);

    return c.json({ success: true, user, token });
  } catch (error) {
    console.error('Worker Email Auth Error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// 5.5 Projects API
app.put('/api/projects/:id', async (c) => {
  const tokenHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'wedding_session');
  let token = (tokenHeader?.startsWith('Bearer ') ? tokenHeader.substring(7) : null) || cookieToken;

  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const jwtSecret = c.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';

  try {
    const payload = await verify(token, jwtSecret, 'HS256') as any;
    const project_id = c.req.param('id');
    const projectData = await c.req.json();

    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;

    if (!supabaseUrl || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
      return c.json({ error: 'Supabase configuration missing on worker', details: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' }, 500);
    }

    const supabase = createClient(supabaseUrl, c.env.SUPABASE_SERVICE_ROLE_KEY);

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
});

app.post('/api/rsvps', async (c) => {
  try {
    const rsvpData = await c.req.json();
    const supabaseUrl = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;

    if (!supabaseUrl || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
      return c.json({ error: 'Supabase configuration missing on worker' }, 500);
    }

    const supabase = createClient(supabaseUrl, c.env.SUPABASE_SERVICE_ROLE_KEY);

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
    has_supabase_url: !!(c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL),
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

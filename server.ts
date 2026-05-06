import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const transporter = (GMAIL_USER && GMAIL_PASS) ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
}) : null;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url && !key) {
      throw new Error('Supabase configuration completely missing. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Settings menu.');
    }
    if (!url) {
      throw new Error('Supabase URL (VITE_SUPABASE_URL or SUPABASE_URL) is missing in environment.');
    }
    if (!key) {
      throw new Error('Supabase Key (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY) is missing in environment.');
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  `${APP_URL}/api/auth/callback`
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Webhook needs raw body - MUST be before express.json()
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.warn('Stripe not configured, skipping webhook');
      return res.status(200).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

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

          await getSupabaseAdmin()
            .from('agencies')
            .update(updateData)
            .eq('id', agencyId);
          console.log(`Agency/Couple ${agencyId} paid/subscribed!`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await getSupabaseAdmin()
          .from('agencies')
          .update({ subscription_status: 'canceled' })
          .eq('subscription_id', subscription.id);
        break;
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Diagnostics middleware
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
  });

  const apiRouter = express.Router();

  apiRouter.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      config: {
        has_supabase: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        has_jwt: !!process.env.JWT_SECRET,
        has_google: !!process.env.GOOGLE_CLIENT_ID
      }
    });
  });

  // --- Auth Routes ---
  apiRouter.get('/auth/google', (req, res) => {
    res.setHeader('X-Wedding-API', 'hit');
    console.log('Hitting /api/auth/google');
    
    if (!GOOGLE_CLIENT_ID) {
      console.error('Missing GOOGLE_CLIENT_ID');
      return res.status(500).json({ 
        error: 'Google Client ID not configured',
        details: 'Please set GOOGLE_CLIENT_ID in your .env or Settings menu.' 
      });
    }

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      prompt: 'consent'
    });
    res.json({ url: authorizeUrl });
  });

  apiRouter.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login?error=no_code');

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) throw new Error('No payload');

      const user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };

      const token = jwt.sign(user, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

      res.cookie('wedding_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Use JS replace to ensure history cleanup and popup support
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
            <script>
              try {
                if (window.opener && window.opener !== window) {
                  window.opener.postMessage({ type: 'AUTH_SUCCESS', token: "${token}" }, "*");
                  setTimeout(() => window.close(), 100);
                } else {
                  window.location.replace("/workspace");
                }
              } catch (err) {
                window.location.replace("/workspace");
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
      console.error('OAuth callback error:', error);
      res.redirect('/login?error=auth_failed');
    }
  });

  apiRouter.get('/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies.wedding_session;
    
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      res.json({ user: decoded });
    } catch (error: any) {
      console.error('Server auth/me error:', error.message);
      res.status(401).json({ error: 'Invalid session', details: error.message });
    }
  });

// Auth Helpers (Node.js version)
function hashPasswordNode(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPasswordNode(password: string, storedHash: string) {
  const [saltHex, originalHashHex] = storedHash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return hash.toString('hex') === originalHashHex;
}

  apiRouter.post('/auth/email', async (req, res) => {
    const { email, password, mode } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
      const supabase = getSupabaseAdmin();
      console.log(`Email auth action: ${mode} for ${email}`);
      
      // 1. Check if user exists in Supabase
      const { data: users, error: fetchError } = await supabase
        .from('users_auth')
        .select('*')
        .eq('email', email);

      if (fetchError) throw fetchError;
      const existingUser = users && users.length > 0 ? users[0] : null;

      if (mode === 'signup') {
        if (existingUser) return res.status(400).json({ error: 'User already exists' });
        if (!password) return res.status(400).json({ error: 'Password is required' });

        const passwordHash = hashPasswordNode(password);
        
        // Save to Supabase
        const { error: insertError } = await supabase
          .from('users_auth')
          .insert([{ 
            email, 
            password_hash: passwordHash, 
            is_verified: false,
            created_at: new Date().toISOString()
          }]);

        if (insertError) throw insertError;
      } else {
        // Login mode
        if (!existingUser) return res.status(404).json({ error: 'Account not found' });
        if (!password) return res.status(400).json({ error: 'Password is required' });
        
        const isValid = verifyPasswordNode(password, existingUser.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Invalid password' });
      }

      // Generate verification/login token
      const magicToken = jwt.sign(
        { email, type: 'verify_account' }, 
        JWT_SECRET, 
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const verifyUrl = `${APP_URL}/verify?token=${magicToken}`;
      
      console.log('--- AUTH ACTION (DEV) ---');
      console.log(`Action: ${mode}`);
      console.log(`Email: ${email}`);
      console.log(`Link: ${verifyUrl}`);
      console.log('-------------------------');

      // Send real email
      let emailSent = false;

      if (RESEND_API_KEY) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: 'Wedding Manager <onboarding@resend.dev>',
              to: email,
              subject: mode === 'signup' ? 'Verify your Wedding Manager account' : 'Sign in to Wedding Manager',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF0;">
                  <h1 style="color: #2D2424; text-align: center;">Wedding Manager</h1>
                  <div style="background-color: white; padding: 20px; border-radius: 12px;">
                    <p>${mode === 'signup' ? 'Welcome! Please verify your account.' : 'You requested a login link.'}</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${verifyUrl}" style="background-color: #C5A059; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        ${mode === 'signup' ? 'Verify Account' : 'Sign In'}
                      </a>
                    </div>
                  </div>
                </div>
              `
            })
          });
          if (res.ok) {
            console.log(`Email successfully sent via Resend to ${email}`);
            emailSent = true;
          } else {
            const err = await res.text();
            console.error(`Resend error: ${err}`);
          }
        } catch (err) {
          console.error('Resend failed, trying fallback:', err);
        }
      }

      if (!emailSent && transporter) {
        const mailOptions = {
          from: `"Wedding Manager" <${GMAIL_USER}>`,
          to: email,
          subject: mode === 'signup' ? 'Verify your Wedding Manager account' : 'Sign in to Wedding Manager',
          html: `
            <div style="font-family: 'serif', 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #FDFCF0; border: 1px solid #C5A059;">
              <h1 style="color: #2D2424; text-align: center; font-size: 28px;">Wedding Manager</h1>
              <div style="background-color: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <p style="color: #2D2424; font-size: 16px; line-height: 1.6;">
                  ${mode === 'signup' 
                    ? 'Thank you for creating an account! Please click the button below to verify your email and complete your setup.' 
                    : 'Click the button below to sign in to your dashboard.'}
                </p>
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${verifyUrl}" style="background-color: #C5A059; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;">
                    ${mode === 'signup' ? 'Verify Email' : 'Sign In Now'}
                  </a>
                </div>
                <p style="color: #2D2424; font-size: 14px; opacity: 0.6;">
                  If the button doesn't work, you can copy and paste this link: <br/>
                  <a href="${verifyUrl}" style="color: #C5A059;">${verifyUrl}</a>
                </p>
                <p style="color: #2D2424; font-size: 12px; opacity: 0.4; margin-top: 40px; text-align: center;">
                  The link will expire in 15 minutes.
                </p>
              </div>
            </div>
          `,
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email successfully sent via SMTP to ${email}`);
          emailSent = true;
        } catch (mailError) {
          console.error('Nodemailer Error:', mailError);
        }
      }

      res.json({ 
        success: true, 
        message: mode === 'signup' ? 'Account created. Check your email for verification.' : 'Login link sent to your email.',
        debug_link: process.env.NODE_ENV !== 'production' ? verifyUrl : undefined
      });
    } catch (error) {
      console.error('Email auth error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  apiRouter.post('/auth/verify', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
      const supabase = getSupabaseAdmin();
      const decoded = jwt.verify(token as string, JWT_SECRET, { algorithms: ['HS256'] }) as any;
      
      if (decoded.type !== 'verify_account' && decoded.type !== 'magic_link') {
        return res.status(400).json({ error: 'Invalid token type' });
      }

      const email = decoded.email;

      // Update is_verified in Supabase
      await supabase
        .from('users_auth')
        .update({ is_verified: true })
        .eq('email', email);

      const user = {
        id: `email-${Buffer.from(email).toString('base64').slice(0, 12)}`,
        email: email,
        name: email.split('@')[0],
        picture: null,
      };

      const sessionToken = jwt.sign(user, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

      res.cookie('wedding_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, user, token: sessionToken });
    } catch (error: any) {
      console.error('Token verification failed:', error.message);
      res.status(401).json({ error: 'Invalid or expired link' });
    }
  });

  apiRouter.post('/auth/logout', (req, res) => {
    res.clearCookie('wedding_session');
    res.json({ success: true });
  });

  // --- Project Routes ---
  apiRouter.put('/projects/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies.wedding_session;
    
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
      const { id } = req.params;
      const projectData = req.body;

      // Exclude sensitive/immutable fields
      const { id: _, agency_id, created_at, ...updateData } = projectData;

      // Verify the project belongs to the user's agency
      // First, get the agency for the user
      const { data: agency } = await getSupabaseAdmin()
        .from('agencies')
        .select('id')
        .eq('user_id', decoded.id || decoded.sub)
        .single();
      
      if (!agency) return res.status(403).json({ error: 'Agency not found' });

      // Update the project
      const { data, error: updateError } = await getSupabaseAdmin()
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .eq('agency_id', agency.id)
        .select()
        .single();

      if (updateError) {
        console.error('Project update error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      res.json({ success: true, data });
    } catch (error: any) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.message?.includes('JWT')) {
        console.error('Session verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid session', details: error.message });
      }
      console.error('Internal server error during project update:', error.message);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // --- RSVP Routes ---
  apiRouter.post('/rsvps', async (req, res) => {
    try {
      const rsvpData = req.body;
      const { data, error } = await getSupabaseAdmin()
        .from('rsvps')
        .insert([{ 
          ...rsvpData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('RSVP submission error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json({ success: true, data });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Moderation Routes ---
  apiRouter.post('/messages/:id/status', async (req, res) => {
    const token = req.cookies.wedding_session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      jwt.verify(token, JWT_SECRET);
      // In a real app, we'd use the server-side Supabase client here
      res.json({ success: true });
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid session', details: error.message });
    }
  });

  // --- Stripe Checkout Route ---
  apiRouter.post('/create-checkout-session', async (req, res) => {
    const { planId, agencyId } = req.body;
    
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    try {
      // In a production app, we'd look up the price ID from planId
      const isOneTime = planId === 'price_one_time';
      
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
        success_url: `${APP_URL}/subscription?success=true`,
        cancel_url: `${APP_URL}/subscription?canceled=true`,
        metadata: {
          agencyId,
          planId,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Fallback for unmatched API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // --- End Auth Routes ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Development server running on http://localhost:${PORT}`);
  });
}

startServer();

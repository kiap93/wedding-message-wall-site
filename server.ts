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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Supabase Service Role for non-client restricted operations (like webhook updates)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

          await supabaseAdmin
            .from('agencies')
            .update(updateData)
            .eq('id', agencyId);
          console.log(`Agency/Couple ${agencyId} paid/subscribed!`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
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
    res.json({ status: 'ok', time: new Date().toISOString() });
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

      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

      res.cookie('wedding_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect('/workspace');
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect('/login?error=auth_failed');
    }
  });

  apiRouter.get('/auth/me', (req, res) => {
    const token = req.cookies.wedding_session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ user: decoded });
    } catch (error) {
      res.status(401).json({ error: 'Invalid session' });
    }
  });

  apiRouter.post('/auth/email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
      console.log(`Email login attempt for: ${email}`);
      
      // Identical to Google Login payload but from email
      const user = {
        id: `email-${Buffer.from(email).toString('base64').slice(0, 12)}`,
        email: email,
        name: email.split('@')[0],
        picture: null,
      };

      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

      res.cookie('wedding_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, user });
    } catch (error) {
      console.error('Email login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  apiRouter.post('/auth/logout', (req, res) => {
    res.clearCookie('wedding_session');
    res.json({ success: true });
  });

  // --- Moderation Routes ---
  apiRouter.post('/messages/:id/status', async (req, res) => {
    const token = req.cookies.wedding_session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      jwt.verify(token, JWT_SECRET);
      // In a real app, we'd use the server-side Supabase client here
      res.json({ success: true });
    } catch (error) {
      res.status(401).json({ error: 'Invalid session' });
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

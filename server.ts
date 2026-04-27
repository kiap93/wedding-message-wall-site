import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  `${APP_URL}/api/auth/callback`
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

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

      res.redirect('/admin');
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

  apiRouter.post('/auth/logout', (req, res) => {
    res.clearCookie('wedding_session');
    res.json({ success: true });
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

import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadImage, deleteImageFiles, isR2Configured } from './storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';
const uploadRouter = express.Router();

// Setup Multer memory storage (never save raw files to disk)
const storage = multer.memoryStorage();
const uploadParser = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Supported formats: JPG, PNG, WEBP.'));
    }
  },
});

// Lazy load Supabase Admin
let supabaseAdminInstance: any = null;
function getSupabaseDb() {
  if (!supabaseAdminInstance) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (url && key && url !== 'https://your-project.supabase.co') {
      supabaseAdminInstance = createClient(url, key);
    }
  }
  return supabaseAdminInstance;
}

// Local local database fallback directory and path
const localDbPath = path.join(process.cwd(), 'server', 'data', 'local_images.json');

// Ensure local folder exists
function ensureLocalDbExists() {
  const dir = path.dirname(localDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(localDbPath)) {
    fs.writeFileSync(localDbPath, JSON.stringify([]));
  }
}

// Helpers for reading/writing local backup JSON DB
function readLocalImages(): any[] {
  ensureLocalDbExists();
  try {
    const data = fs.readFileSync(localDbPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function writeLocalImages(images: any[]) {
  ensureLocalDbExists();
  fs.writeFileSync(localDbPath, JSON.stringify(images, null, 2));
}

// Auth Helper
const getAuthUserId = (req: express.Request): string => {
  const authHeader = req.headers.authorization;
  const cookies = req.cookies || {};
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || cookies.wedding_session;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
      return decoded.id || decoded.sub || 'guest_user';
    } catch (e) {
      // Return guest for development purposes
      return 'guest_user';
    }
  }
  return 'guest_user';
};

/**
 * POST /api/upload
 * Handles form data uploads, compiles them to WebP, optimizes, pushes to R2, and saves to database.
 */
uploadRouter.post('/upload', (req, res) => {
  uploadParser.single('image')(req, res, async (err) => {
    // Graceful error handling for multer limits
    if (err) {
      console.warn('[UPLOAD-API] Multer parsing failed:', err.message);
      return res.status(400).json({ error: err.message });
    }

    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const activeUserId = getAuthUserId(req);
      const event_id = (req.body.event_id || req.body.projectId || 'default-event') as string;

      console.log(`[UPLOAD-API] File received: "${file.originalname}" size: ${file.size} bytes. User: ${activeUserId}, event_id: ${event_id}`);

      // Perform Sharp compressions and uploads to either R2 or local storage fallback
      const metadata = await processAndUploadImage(
        file.buffer,
        file.originalname,
        activeUserId,
        event_id
      );

      const dbRecord = {
        id: metadata.id,
        user_id: activeUserId,
        event_id,
        original_url: metadata.original_url,
        medium_url: metadata.medium_url,
        thumbnail_url: metadata.thumbnail_url,
        width: metadata.width,
        height: metadata.height,
        file_size: metadata.file_size,
        created_at: new Date().toISOString()
      };

      // Try saving to Supabase
      const db = getSupabaseDb();
      if (db) {
        console.log('[UPLOAD-API] Supabase connected. Writing metadata to database table...');
        const { error } = await db.from('uploaded_images').insert([dbRecord]);
        if (error) {
          console.error('[UPLOAD-API] Supabase database transaction failed:', error.message);
          // If table doesn't exist, we fallback to local JSON to stay robust
          if (error.code === '42P01') {
            console.log('[UPLOAD-API] Table uploaded_images not found. Writing to local JSON storage fallback...');
            const localDb = readLocalImages();
            localDb.push(dbRecord);
            writeLocalImages(localDb);
          } else {
            return res.status(500).json({ error: 'Database transaction failed: ' + error.message });
          }
        }
      } else {
        console.log('[UPLOAD-API] Supabase inactive. Writing image metadata to local JSON backup DB...');
        const localDb = readLocalImages();
        localDb.push(dbRecord);
        writeLocalImages(localDb);
      }

      return res.status(201).json({
        success: true,
        message: 'Image fully processed and saved successfully.',
        data: dbRecord
      });

    } catch (processError: any) {
      console.error('[UPLOAD-API] Core process failed:', processError);
      return res.status(500).json({ error: 'Image optimization process failed: ' + processError.message });
    }
  });
});

/**
 * GET /api/images
 * Lists uploaded images for current session
 */
uploadRouter.get('/images', async (req, res) => {
  try {
    const activeUserId = getAuthUserId(req);
    const event_id = (req.query.event_id || req.query.projectId) as string;

    console.log(`[UPLOAD-API] Fetching images list for user: ${activeUserId} event_id: ${event_id}`);

    const db = getSupabaseDb();
    let imagesList: any[] = [];

    if (db) {
      let query = db.from('uploaded_images').select('*').eq('user_id', activeUserId);
      if (event_id) {
        query = query.eq('event_id', event_id);
      }
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && data) {
        imagesList = data;
      } else {
        console.warn('[UPLOAD-API] Supabase query failed or layout missing, fetching local JSON records:', error?.message);
        imagesList = readLocalImages();
      }
    } else {
      imagesList = readLocalImages();
    }

    // Filter local lists if query exists
    if (!db || imagesList.length > 0) {
      imagesList = imagesList.filter(img => img.user_id === activeUserId);
      if (event_id) {
        imagesList = imagesList.filter(img => img.event_id === event_id);
      }
      // Sort descending by created_at
      imagesList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return res.status(200).json({
      success: true,
      data: imagesList
    });
  } catch (fetchError: any) {
    console.error('[UPLOAD-API] Error fetching images:', fetchError);
    return res.status(500).json({ error: 'Failed to query image library: ' + fetchError.message });
  }
});

/**
 * DELETE /api/images/:id
 * Removes image files from Cloudflare R2 / Disk and sweeps DB records
 */
uploadRouter.delete('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const activeUserId = getAuthUserId(req);

    console.log(`[UPLOAD-API] Received request to delete image id "${id}" from user ${activeUserId}`);

    const db = getSupabaseDb();
    let imageRecord: any = null;

    if (db) {
      const { data, error } = await db
        .from('uploaded_images')
        .select('*')
        .eq('id', id)
        .eq('user_id', activeUserId)
        .single();
      
      if (!error && data) {
        imageRecord = data;
      }
    }

    if (!imageRecord) {
      // Find from local database backup list
      const localDb = readLocalImages();
      imageRecord = localDb.find(img => img.id === id && img.user_id === activeUserId);
    }

    if (!imageRecord) {
      return res.status(404).json({ error: 'Image record not found or unauthorized.' });
    }

    // 1. Delete physical files from Cloudflare R2 or local disk storage
    await deleteImageFiles(
      imageRecord.original_url,
      imageRecord.medium_url,
      imageRecord.thumbnail_url
    );

    // 2. Remove record from DB
    if (db) {
      const { error: dbError } = await db.from('uploaded_images').delete().eq('id', id);
      if (dbError) {
        console.warn('[UPLOAD-API] Failed cleaning Supabase image metadata, falling back to local JSON clean:', dbError.message);
      }
    }

    // Always clean from local JSON DB list as well
    const localDb = readLocalImages();
    const updatedLocalDb = localDb.filter(img => img.id !== id);
    writeLocalImages(updatedLocalDb);

    return res.status(200).json({
      success: true,
      message: 'Image and files completely deleted.'
    });

  } catch (deleteError: any) {
    console.error('[UPLOAD-API] Deletion exception raised:', deleteError);
    return res.status(500).json({ error: 'Failed deleting resources: ' + deleteError.message });
  }
});

export default uploadRouter;

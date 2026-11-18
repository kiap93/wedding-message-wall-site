import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadImage, deleteImageFiles } from './storage';
import { buildErrorResponse, buildSuccessResponse } from './apiResponse';
import { authorizeProjectAccess, resolveProjectWithAgency } from './agencyService';
import { resolveAuthenticatedSessionUser } from './developerAdminService';

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-v1-sync-key-2024-secret-auth-v2';
const uploadRouter = express.Router();

// Setup Multer memory storage (never save raw files to disk)
const storage = multer.memoryStorage();
const uploadParser = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Supported formats: JPG, PNG, WEBP.'));
    }
  },
});

let supabaseAdminInstance: any = null;
function getSupabaseDb() {
  if (!supabaseAdminInstance) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;
    if (url && key && url !== 'https://your-project.supabase.co') {
      supabaseAdminInstance = createClient(url, key);
    }
  }
  return supabaseAdminInstance;
}

const localDbPath = path.join(process.cwd(), 'server', 'data', 'local_images.json');

function ensureLocalDbExists() {
  const dir = path.dirname(localDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(localDbPath)) {
    fs.writeFileSync(localDbPath, JSON.stringify([]));
  }
}

function readLocalImages(): any[] {
  ensureLocalDbExists();
  try {
    const data = fs.readFileSync(localDbPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeLocalImages(images: any[]) {
  ensureLocalDbExists();
  fs.writeFileSync(localDbPath, JSON.stringify(images, null, 2));
}

async function authorizeUploadRequest(
  req: express.Request,
  eventId?: string | null
): Promise<
  | { ok: true; actorId: string }
  | { ok: false; statusCode: number; code: string; message: string }
> {
  const authHeader = req.headers.authorization;
  const cookies = req.cookies || {};
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || cookies.wedding_session;
  const pinHeader = typeof req.headers['x-event-pin'] === 'string' ? req.headers['x-event-pin'].trim() : '';
  const db = getSupabaseDb();

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
      if (db) {
        const activeCheck = await resolveAuthenticatedSessionUser(db, decoded, process.env.SUPER_ADMIN_EMAILS);
        if (activeCheck.ok === false) {
          return {
            ok: false,
            statusCode: activeCheck.statusCode,
            code: activeCheck.code,
            message: activeCheck.error,
          };
        }
        if (eventId && eventId !== 'default-event') {
          const projAuth = await authorizeProjectAccess(db, {
            projectId: eventId,
            authUser: activeCheck.user,
            forbiddenMessage: 'You do not have permission to upload assets to this event.',
          });
          if (projAuth.ok === false) {
            return {
              ok: false,
              statusCode: projAuth.statusCode,
              code: projAuth.code,
              message: projAuth.error,
            };
          }
        }
        return { ok: true, actorId: String(activeCheck.user.id || activeCheck.user.sub || 'user') };
      }
      return { ok: true, actorId: String(decoded.id || decoded.sub || 'user') };
    } catch {
      // Fall through to PIN verification if present
    }
  }

  if (pinHeader && eventId && eventId !== 'default-event' && db) {
    const resolved = await resolveProjectWithAgency(db, eventId);
    if (resolved.ok && resolved.data.project.access_password && resolved.data.project.access_password === pinHeader) {
      return { ok: true, actorId: `couple_${eventId}` };
    }
    return {
      ok: false,
      statusCode: 403,
      code: 'INVALID_EVENT_PIN',
      message: 'Invalid event PIN or unauthorized access.',
    };
  }

  return {
    ok: false,
    statusCode: 401,
    code: 'UNAUTHENTICATED',
    message: 'Authentication or valid event PIN is required.',
  };
}

/**
 * POST /api/upload
 * Handles form data uploads, optimizes to WebP, pushes to R2 or local uploads fallback, and saves metadata.
 */
uploadRouter.post('/upload', (req, res) => {
  uploadParser.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json(buildErrorResponse('INVALID_UPLOAD_FILE', err.message));
    }

    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json(buildErrorResponse('MISSING_FILE', 'No file uploaded.'));
      }

      const event_id = String(req.body.event_id || req.body.projectId || 'default-event').trim();
      const authCheck = await authorizeUploadRequest(req, event_id);
      if (authCheck.ok === false) {
        return res
          .status(authCheck.statusCode)
          .json(buildErrorResponse(authCheck.code, authCheck.message));
      }

      const activeUserId = authCheck.actorId;
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
        created_at: new Date().toISOString(),
      };

      const db = getSupabaseDb();
      if (db) {
        const { error } = await db.from('uploaded_images').insert([dbRecord]);
        if (error) {
          if (error.code === '42P01') {
            const localDb = readLocalImages();
            localDb.push(dbRecord);
            writeLocalImages(localDb);
          } else {
            return res
              .status(500)
              .json(buildErrorResponse('UPLOAD_METADATA_SAVE_FAILED', 'Unable to save uploaded image metadata.'));
          }
        }
      } else {
        const localDb = readLocalImages();
        localDb.push(dbRecord);
        writeLocalImages(localDb);
      }

      return res.status(201).json(
        buildSuccessResponse(dbRecord, {
          message: 'Image fully processed and saved successfully.',
          url: dbRecord.original_url,
          publicUrl: dbRecord.original_url,
        })
      );
    } catch {
      return res
        .status(500)
        .json(buildErrorResponse('IMAGE_PROCESSING_FAILED', 'Image optimization or upload failed.'));
    }
  });
});

/**
 * GET /api/images
 * Lists uploaded images for authorized session or couple PIN
 */
uploadRouter.get('/images', async (req, res) => {
  try {
    const event_id = (req.query.event_id || req.query.projectId) as string | undefined;
    const authCheck = await authorizeUploadRequest(req, event_id || null);
    if (authCheck.ok === false) {
      return res
        .status(authCheck.statusCode)
        .json(buildErrorResponse(authCheck.code, authCheck.message));
    }

    const activeUserId = authCheck.actorId;
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
        imagesList = readLocalImages();
      }
    } else {
      imagesList = readLocalImages();
    }

    if (!db || imagesList.length > 0) {
      imagesList = imagesList.filter((img) => img.user_id === activeUserId);
      if (event_id) {
        imagesList = imagesList.filter((img) => img.event_id === event_id);
      }
      imagesList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return res.status(200).json(buildSuccessResponse(imagesList));
  } catch {
    return res
      .status(500)
      .json(buildErrorResponse('IMAGE_FETCH_FAILED', 'Failed to query image library.'));
  }
});

/**
 * DELETE /api/images/:id
 * Removes image files from Cloudflare R2 / Disk and cleans DB records
 */
uploadRouter.delete('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event_id = (req.query.event_id || req.query.projectId) as string | undefined;
    const authCheck = await authorizeUploadRequest(req, event_id || null);
    if (authCheck.ok === false) {
      return res
        .status(authCheck.statusCode)
        .json(buildErrorResponse(authCheck.code, authCheck.message));
    }

    const activeUserId = authCheck.actorId;
    const db = getSupabaseDb();
    let imageRecord: any = null;

    if (db) {
      const { data, error } = await db
        .from('uploaded_images')
        .select('*')
        .eq('id', id)
        .eq('user_id', activeUserId)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        imageRecord = data;
      }
    }

    if (!imageRecord) {
      const localDb = readLocalImages();
      imageRecord = localDb.find((img) => img.id === id && img.user_id === activeUserId);
    }

    if (!imageRecord) {
      return res
        .status(404)
        .json(buildErrorResponse('IMAGE_NOT_FOUND', 'Image record not found or unauthorized.'));
    }

    await deleteImageFiles(
      imageRecord.original_url,
      imageRecord.medium_url,
      imageRecord.thumbnail_url
    );

    if (db) {
      await db.from('uploaded_images').delete().eq('id', id);
    }

    const localDb = readLocalImages();
    writeLocalImages(localDb.filter((img) => img.id !== id));

    return res.status(200).json(
      buildSuccessResponse({ id }, { message: 'Image and files completely deleted.' })
    );
  } catch {
    return res
      .status(500)
      .json(buildErrorResponse('IMAGE_DELETE_FAILED', 'Failed deleting uploaded image resources.'));
  }
});

export default uploadRouter;


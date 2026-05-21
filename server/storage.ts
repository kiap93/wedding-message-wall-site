import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization of S3 client to prevent crash on startup if credentials are not configured
let s3ClientInstance: S3Client | null = null;

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export function getS3Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 configuration is missing in the environment variables.');
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint: process.env.R2_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3ClientInstance;
}

export interface UploadedImageMetadata {
  id: string;
  original_url: string;
  medium_url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  file_size: number;
}

/**
 * Processes an uploaded image buffer with sharp: converts to WebP and exports:
 * - thumbnail (300px width)
 * - medium (1200px width)
 * - original (as compressed WebP)
 * Uploads processed files to Cloudflare R2 (or fallback to local folder) and returns URLs and metadata.
 */
export async function processAndUploadImage(
  fileBuffer: Buffer,
  originalFilename: string,
  userId: string,
  eventId: string
): Promise<UploadedImageMetadata> {
  const uniqueId = Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  
  // Parse dimensions and metadata using sharp
  const sharpImg = sharp(fileBuffer);
  const metadata = await sharpImg.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Process variants using Sharp
  // 1. Original compressed WEBP (optional scale down if excessively large, keeping it highly optimized)
  const originalProcessed = await sharpImg
    .webp({ quality: 85 })
    .toBuffer();

  // 2. Medium (1200px width, preserving aspect ratio)
  const mediumProcessed = await sharp(fileBuffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // 3. Thumbnail (300px width, preserving aspect ratio)
  const thumbnailProcessed = await sharp(fileBuffer)
    .resize({ width: 300, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  // Define Cloudflare R2 path structure
  const r2Folder = `${userId}/${eventId}`;
  const originalKey = `${r2Folder}/original/${uniqueId}.webp`;
  const mediumKey = `${r2Folder}/medium/${uniqueId}.webp`;
  const thumbnailKey = `${r2Folder}/thumbnail/${uniqueId}.webp`;

  if (isR2Configured()) {
    console.log('[STORAGE] R2 is configured. Uploading processed images to Cloudflare R2...');
    const s3 = getS3Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const cdnUrl = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT;

    // Helper to upload a buffer to R2
    const uploadToR2 = async (key: string, buffer: Buffer) => {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
    };

    // Parallel uploads for maximum speed
    await Promise.all([
      uploadToR2(originalKey, originalProcessed),
      uploadToR2(mediumKey, mediumProcessed),
      uploadToR2(thumbnailKey, thumbnailProcessed),
    ]);

    // Build the CDN URLs
    const cleanPublicUrl = cdnUrl?.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
    
    return {
      id: uniqueId,
      original_url: `${cleanPublicUrl}/${originalKey}`,
      medium_url: `${cleanPublicUrl}/${mediumKey}`,
      thumbnail_url: `${cleanPublicUrl}/${thumbnailKey}`,
      width,
      height,
      file_size: originalProcessed.length,
    };
  } else {
    console.log('[STORAGE] R2 is not configured. Falling back to local public directory...');
    
    // Create local directory under public folder so they are accessible by client
    const publicDir = path.join(process.cwd(), 'public', 'uploads', userId, eventId);
    
    fs.mkdirSync(path.join(publicDir, 'original'), { recursive: true });
    fs.mkdirSync(path.join(publicDir, 'medium'), { recursive: true });
    fs.mkdirSync(path.join(publicDir, 'thumbnail'), { recursive: true });

    // Write buffers to files
    fs.writeFileSync(path.join(publicDir, 'original', `${uniqueId}.webp`), originalProcessed);
    fs.writeFileSync(path.join(publicDir, 'medium', `${uniqueId}.webp`), mediumProcessed);
    fs.writeFileSync(path.join(publicDir, 'thumbnail', `${uniqueId}.webp`), thumbnailProcessed);

    // Build local serving host URL relative paths
    const urlFolder = `/uploads/${userId}/${eventId}`;
    
    return {
      id: uniqueId,
      original_url: `${urlFolder}/original/${uniqueId}.webp`,
      medium_url: `${urlFolder}/medium/${uniqueId}.webp`,
      thumbnail_url: `${urlFolder}/thumbnail/${uniqueId}.webp`,
      width,
      height,
      file_size: originalProcessed.length,
    };
  }
}

/**
 * Attempt to delete images from R2 storage or local disk
 */
export async function deleteImageFiles(
  originalUrl: string,
  mediumUrl: string,
  thumbnailUrl: string
): Promise<void> {
  if (isR2Configured()) {
    console.log('[STORAGE] Deleting files from Cloudflare R2...');
    const s3 = getS3Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    // Extract the R2 key from the Urls
    // Assume URL is of format: https://cdn.com/userId/eventId/image-type/uniqueId.webp
    const getR2Key = (url: string) => {
      try {
        const urlObj = new URL(url);
        // Replace leading slash
        return urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
      } catch (e) {
        // Fallback for non-absolute URLs
        return url.replace(/https?:\/\/[^\/]+\//, '');
      }
    };

    const keys = [getR2Key(originalUrl), getR2Key(mediumUrl), getR2Key(thumbnailUrl)];

    await Promise.all(
      keys.map(async (key) => {
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          );
        } catch (err) {
          console.error(`[STORAGE] Error deleting R2 key ${key}:`, err);
        }
      })
    );
  } else {
    console.log('[STORAGE] Deleting files from local fallback disk...');
    const getLocalPath = (url: string) => {
      // url format: /uploads/userId/eventId/image-type/file.webp
      if (url.startsWith('/uploads/')) {
        return path.join(process.cwd(), 'public', url);
      }
      return null;
    };

    const paths = [getLocalPath(originalUrl), getLocalPath(mediumUrl), getLocalPath(thumbnailUrl)];

    paths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`[STORAGE] Error deleting local file ${filePath}:`, err);
        }
      }
    });
  }
}

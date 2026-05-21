# Cloud-Native Designer Image Upload & Optimization System

This system implements a low-cost, high-performance image upload pipeline featuring real-time, non-destructive cropping for the invitation editor.

---

## 1. Suggested Workspace Folder Structure

We keep server and client code neatly isolated to support ease of portability:

```text
/
├── server.ts                       # Custom Express fullstack entrypoint
├── server/
│   ├── storage.ts                  # Cloudflare R2 client & Sharp processor module
│   ├── uploadRouter.ts             # Express API router: /upload, /images, /images/:id
│   └── data/
│       └── local_images.json       # Bulletproof Local file database backup (fallback)
│
├── src/
│   ├── editor/
│   │   ├── store.ts                # Zustand global canvas design elements layout
│   │   ├── components/
│   │   │   ├── ElementRenderer.tsx # Renders Konva text/rect/image/buttons on stage
│   │   │   ├── PropertiesPanel.tsx # Side editor sidebar with sliders & triggers
│   │   │   ├── UploadDropzone.tsx  # Drag & drop HTML5 client file uploader
│   │   │   └── ImageLibraryModal.tsx# Grid selection drawer for user's past assets
│   │   └── utils/
│           └── snapping.ts         # Editor line-snapping guides
│
└── IMAGE_UPLOAD_SYSTEM.md          # Database setup guides & R2 policy guidelines
```

---

## 2. Supabase SQL Database Schema

Run the following query in your Supabase SQL Editor to provision the table and authorize public queries if necessary. Row-Level Security (RLS) policies are configured to match ownership:

```sql
-- 1. Create the uploaded images persistence catalog table
CREATE TABLE IF NOT EXISTS public.uploaded_images (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    original_url TEXT NOT NULL,
    medium_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create search indexing on ownership keys for lightspeed loading
CREATE INDEX IF NOT EXISTS idx_uploaded_images_user_event 
ON public.uploaded_images (user_id, event_id);

-- 3. Enable Row-Level Security (RLS) to prevent unauthorized tampering
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;

-- 4. Create secure access policies
-- Read: Users can query their own uploads
CREATE POLICY "Users can view family uploads" ON public.uploaded_images
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'guest_user');

-- Insert: Users can save new optimized records
CREATE POLICY "Users can record uploads" ON public.uploaded_images
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'guest_user');

-- Delete: Owners can drop records
CREATE POLICY "Users can purge uploads" ON public.uploaded_images
    FOR DELETE USING (auth.uid()::text = user_id OR user_id = 'guest_user');
```

---

## 3. Cloudflare R2 CORS & Storage Policy Instructions

Cloudflare R2 is an incredibly cost-effective object storage service offering zero-egress fees. Configure your bucket permissions as follows to allow secure multi-origin file uploads and fetches.

### CORS Rules (Cloudflare R2 Bucket settings)
Specify these in your Cloudflare Dash → R2 Object Storage → Bucket → **Settings** → **CORS Policy**:

```json
[
  {
    "AllowedOrigins": [
      "https://*.run.app",
      "http://localhost:3000",
      "https://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 4. Architectural Upload Flowchart

Below is the execution flow from the browser dropzone to the storage bucket:

```text
+-------------------+      Drag-and-Drop Image File (e.g. JPG, PNG)
|  UploadDropzone   | -------------------------------------------+
+-------------------+                                            |
         |                                                       v
         v [AJAX Form Payload: 5MB check]             +--------------------+
+-------------------+                                 | Server parses memory|
|  Express Router   | <============================== | Multer memory parser|
+-------------------+                                 +--------------------+
         |
         v [Process Raw Stream via Sharp]
+-------------------------------------------------------------------------+
|                                SHARP ENGINE                             |
|  - Compresses, strips junk EXIF payload metadata                        |
|  - Generates optimized high-performance WEBP file formats              |
|  - Emits:                                                               |
|    a) original_url (High-fidelity compressed WebP)                      |
|    b) medium_url   (1202px width scaled frame)                          |
|    c) thumbnail_url(300px width preview aspect frame)                  |
+-------------------------------------------------------------------------+
         |
         v [Upload to Cloudflare R2 / S3 standard protocol (parallel)]
+-------------------+             - Avoids costly bandwidth egress
|   Cloudflare R2   | <=========> - Cache-Control: public, max-age=31536000
+-------------------+
         |
         v [Persist Metadata & Coordinates]
+-------------------+             - user_id, event_id indexed
| Supabase Database | <=========> - Avoids data fragmentation
+-------------------+             - Keeps records fully responsive
```

---

## 5. Best Practices for Low-Cost Image Operations

1. **ConvertTo WebP Format At Source**: Conversions to `.webp` reduce file payloads by **60% to 85%** compared to native PNGs or JPEGs, directly saving storage bytes and network bandwidth.
2. **Aggressive Cache Control**: Process images with long age limits (`CacheControl: public, max-age=31536000, immutable`). Cloudflare serves cached assets from the edge instantly, avoiding expensive database queries or CPU processing.
3. **Lazy-Load Everything**: Thumbnail listings use HTML standard `loading="lazy"` on client viewports to minimize wasted bandwidth.
4. **Do Not Duplicate Files for Cropping**: Maintain a single persistent `medium_url` asset. Store crop coordinates (`x`, `y`, `width`, `height`) inside the canvas layout JSON document. Client-side canvas tools crop the image dynamically on-the-fly, reducing R2 storage bills to absolute zero for design customizations!

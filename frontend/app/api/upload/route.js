import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';

/**
 * POST /api/upload
 *
 * Upload image to Bunny.net Storage
 * Phase 1.1: Image Upload
 *
 * Accepts multipart/form-data with:
 * - file: The image file
 * - context: Where the image will be used (pet, sighting, chat)
 *
 * Returns:
 * - url: Public CDN URL for the uploaded image
 * - filename: Generated filename
 */

// Configuration
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
// Ensure CDN URL has https:// prefix
let BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
if (BUNNY_CDN_URL && !BUNNY_CDN_URL.startsWith('http')) {
  BUNNY_CDN_URL = `https://${BUNNY_CDN_URL}`;
}
const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL || 'https://storage.bunnycdn.com';

// Allowed file types and max size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Magic bytes for file type validation
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': null, // WebP has RIFF header, handled separately
};

// Valid context values (whitelist)
const VALID_CONTEXTS = ['pet', 'sighting', 'chat', 'general'];

/**
 * Validate file magic bytes to prevent type spoofing
 */
function validateMagicBytes(buffer, mimeType) {
  const bytes = new Uint8Array(buffer.slice(0, 12));

  // WebP files start with RIFF....WEBP
  if (mimeType === 'image/webp') {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
           bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return false;

  return expected.every((byte, i) => bytes[i] === byte);
}

/**
 * Validate and sanitize filename to prevent path traversal
 */
function isValidFilename(filename) {
  // Must not be empty
  if (!filename || typeof filename !== 'string') return false;

  // Must not contain path traversal patterns
  if (filename.includes('..') || filename.includes('/..') || filename.includes('\\')) {
    return false;
  }

  // Must match our expected pattern: folder/timestamp-randomid.extension
  const validPattern = /^(pets|sightings|uploads)\/\d+-[a-f0-9]+\.(jpg|png|gif|webp)$/;
  return validPattern.test(filename);
}

export async function POST(request) {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  console.log('========================================');
  console.log('[UPLOAD] POST request received');
  console.log(`[UPLOAD] Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  // Apply rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.UPLOAD, 'upload:post');
  if (!rateLimitResult.success) {
    await logEvent({
      event_type: 'upload.rate_limited',
      correlation_id: correlationId,
      resource_type: 'upload',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED'
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Check configuration
    if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY || !BUNNY_CDN_URL) {
      console.error('[UPLOAD] Bunny.net configuration missing');
      return NextResponse.json(
        { error: 'Image upload not configured. Please contact administrator.' },
        { status: 503 }
      );
    }

    // Check authentication (require for uploads to prevent abuse)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // For MVP, allow unauthenticated uploads for public reports
    // but log them differently and apply stricter rate limiting
    if (!userId) {
      console.log('[UPLOAD] Anonymous upload');
      // Anonymous uploads get stricter rate limiting
      const anonRateLimit = withRateLimit(request, { ...RateLimitPresets.PUBLIC_WRITE, maxRequests: 5 }, 'upload:anon');
      if (!anonRateLimit.success) {
        return rateLimitResponse(anonRateLimit);
      }
    } else {
      console.log(`[UPLOAD] User: ${userId}`);
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const context = formData.get('context') || 'general';

    // Validate context (whitelist)
    const sanitizedContext = VALID_CONTEXTS.includes(context) ? context : 'general';
    console.log(`[UPLOAD] Context: ${sanitizedContext}`);

    if (!file) {
      console.log('[UPLOAD] No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type from header
    console.log(`[UPLOAD] File type: ${file.type}`);
    console.log(`[UPLOAD] File size: ${file.size} bytes`);

    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log(`[UPLOAD] Invalid file type: ${file.type}`);
      await logEvent({
        event_type: 'upload.invalid_type',
        correlation_id: correlationId,
        resource_type: 'upload',
        action: 'create',
        result: 'failure',
        error_code: 'INVALID_FILE_TYPE',
        metadata: { file_type: file.type, user_id: userId || 'anonymous' }
      });
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[UPLOAD] File too large: ${file.size} > ${MAX_FILE_SIZE}`);
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate actual file content matches claimed type (prevent type spoofing)
    if (!validateMagicBytes(buffer, file.type)) {
      console.log(`[UPLOAD] File content does not match claimed type: ${file.type}`);
      await logEvent({
        event_type: 'upload.type_mismatch',
        correlation_id: correlationId,
        resource_type: 'upload',
        action: 'create',
        result: 'failure',
        error_code: 'FILE_TYPE_MISMATCH',
        metadata: { claimed_type: file.type, user_id: userId || 'anonymous' }
      });
      return NextResponse.json(
        { error: 'File content does not match file type' },
        { status: 400 }
      );
    }

    // Generate unique filename (no user input in path)
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const folder = sanitizedContext === 'pet' ? 'pets' : sanitizedContext === 'sighting' ? 'sightings' : 'uploads';
    const filename = `${folder}/${timestamp}-${randomId}.${extension}`;

    console.log(`[UPLOAD] Generated filename: ${filename}`);

    // Upload to Bunny.net Storage
    const uploadUrl = `${BUNNY_STORAGE_URL}/${BUNNY_STORAGE_ZONE}/${filename}`;
    console.log(`[UPLOAD] Uploading to Bunny.net...`);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': file.type,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`[UPLOAD] Bunny.net upload failed: ${uploadResponse.status}`);
      console.error(`[UPLOAD] Error response: ${errorText}`);

      await logEvent({
        event_type: 'upload.storage_failed',
        correlation_id: correlationId,
        resource_type: 'upload',
        action: 'create',
        result: 'failure',
        error_code: 'STORAGE_ERROR',
        metadata: { status: uploadResponse.status, user_id: userId || 'anonymous' }
      });

      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    // Construct CDN URL
    const cdnUrl = `${BUNNY_CDN_URL}/${filename}`;

    const duration = Date.now() - startTime;
    console.log(`[UPLOAD] Upload successful in ${duration}ms`);
    console.log(`[UPLOAD] CDN URL: ${cdnUrl}`);

    await logEvent({
      event_type: 'upload.success',
      correlation_id: correlationId,
      resource_type: 'upload',
      action: 'create',
      result: 'success',
      metadata: {
        filename,
        size: file.size,
        type: file.type,
        context: sanitizedContext,
        user_id: userId || 'anonymous',
        duration_ms: duration
      }
    });

    return NextResponse.json({
      url: cdnUrl,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('========================================');
    console.error('[UPLOAD] ERROR occurred');
    console.error(`[UPLOAD] Error message: ${error.message}`);
    console.error('========================================');

    await logEvent({
      event_type: 'upload.error',
      correlation_id: correlationId,
      resource_type: 'upload',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message
    });

    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 *
 * Delete an image from Bunny.net Storage
 * Only authenticated users can delete, and only valid filenames
 */
export async function DELETE(request) {
  console.log('[UPLOAD] DELETE request received');
  const correlationId = crypto.randomUUID();

  // Apply rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.API, 'upload:delete');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Check configuration
    if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY) {
      return NextResponse.json(
        { error: 'Image upload not configured' },
        { status: 503 }
      );
    }

    // Require authentication for deletes
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename required' },
        { status: 400 }
      );
    }

    // SECURITY: Validate filename to prevent path traversal attacks
    if (!isValidFilename(filename)) {
      console.log(`[UPLOAD] Invalid filename rejected: ${filename}`);

      await logEvent({
        event_type: 'upload.delete_invalid_filename',
        correlation_id: correlationId,
        resource_type: 'upload',
        action: 'delete',
        result: 'failure',
        error_code: 'INVALID_FILENAME',
        actor_id: session.user.id,
        metadata: { attempted_filename: filename.substring(0, 100) }
      });

      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    console.log(`[UPLOAD] Deleting: ${filename}`);

    // Delete from Bunny.net
    const deleteUrl = `${BUNNY_STORAGE_URL}/${BUNNY_STORAGE_ZONE}/${filename}`;

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNY_API_KEY,
      },
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      console.error(`[UPLOAD] Delete failed: ${deleteResponse.status}`);

      await logEvent({
        event_type: 'upload.delete_failed',
        correlation_id: correlationId,
        resource_type: 'upload',
        action: 'delete',
        result: 'failure',
        error_code: 'STORAGE_ERROR',
        actor_id: session.user.id,
        metadata: { filename, status: deleteResponse.status }
      });

      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      );
    }

    console.log('[UPLOAD] Delete successful');

    await logEvent({
      event_type: 'upload.delete_success',
      correlation_id: correlationId,
      resource_type: 'upload',
      action: 'delete',
      result: 'success',
      actor_id: session.user.id,
      metadata: { filename }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UPLOAD] Delete error:', error);

    await logEvent({
      event_type: 'upload.delete_error',
      correlation_id: correlationId,
      resource_type: 'upload',
      action: 'delete',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message
    });

    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL || 'https://storage.bunnycdn.com';

// Allowed file types and max size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request) {
  const startTime = Date.now();

  console.log('========================================');
  console.log('[UPLOAD] POST request received');
  console.log(`[UPLOAD] Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // Check configuration
    if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY || !BUNNY_CDN_URL) {
      console.error('[UPLOAD] Bunny.net configuration missing');
      console.error(`[UPLOAD] BUNNY_STORAGE_ZONE: ${BUNNY_STORAGE_ZONE ? 'set' : 'MISSING'}`);
      console.error(`[UPLOAD] BUNNY_API_KEY: ${BUNNY_API_KEY ? 'set' : 'MISSING'}`);
      console.error(`[UPLOAD] BUNNY_CDN_URL: ${BUNNY_CDN_URL ? 'set' : 'MISSING'}`);
      return NextResponse.json(
        { error: 'Image upload not configured. Please contact administrator.' },
        { status: 503 }
      );
    }

    // Optional: Check authentication (allow both authenticated and public uploads)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    console.log(`[UPLOAD] User: ${userId}`);

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const context = formData.get('context') || 'general';

    console.log(`[UPLOAD] Context: ${context}`);

    if (!file) {
      console.log('[UPLOAD] No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    console.log(`[UPLOAD] File type: ${file.type}`);
    console.log(`[UPLOAD] File size: ${file.size} bytes`);

    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log(`[UPLOAD] Invalid file type: ${file.type}`);
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

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const folder = context === 'pet' ? 'pets' : context === 'sighting' ? 'sightings' : 'uploads';
    const filename = `${folder}/${timestamp}-${randomId}.${extension}`;

    console.log(`[UPLOAD] Generated filename: ${filename}`);

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Bunny.net Storage
    const uploadUrl = `${BUNNY_STORAGE_URL}/${BUNNY_STORAGE_ZONE}/${filename}`;
    console.log(`[UPLOAD] Uploading to: ${uploadUrl}`);

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
    console.error(`[UPLOAD] Error stack: ${error.stack}`);
    console.error('========================================');

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
 * Only authenticated users can delete, and only their own images
 */
export async function DELETE(request) {
  console.log('[UPLOAD] DELETE request received');

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
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      );
    }

    console.log('[UPLOAD] Delete successful');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UPLOAD] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

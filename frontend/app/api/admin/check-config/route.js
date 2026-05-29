import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { isAdmin } from '@/app/lib/authz';

/**
 * GET /api/admin/check-config
 *
 * Shows environment variable configuration status
 * Admin-only endpoint for debugging deployment issues
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // In-handler admin re-check (fresh role): this returns storage credential
    // prefixes, so it must not rely on middleware or a stale JWT alone.
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[CONFIG CHECK] User:', session.user.email);

    // Check Bunny.net configuration
    const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
    const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
    const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
    const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL || 'https://storage.bunnycdn.com';

    const config = {
      bunnynet: {
        storageZone: {
          configured: !!BUNNY_STORAGE_ZONE,
          value: BUNNY_STORAGE_ZONE ? `${BUNNY_STORAGE_ZONE.substring(0, 3)}...${BUNNY_STORAGE_ZONE.substring(BUNNY_STORAGE_ZONE.length - 3)}` : 'NOT SET',
          isPlaceholder: BUNNY_STORAGE_ZONE === 'your-storage-zone-name',
        },
        apiKey: {
          configured: !!BUNNY_API_KEY,
          value: BUNNY_API_KEY ? `${BUNNY_API_KEY.substring(0, 8)}...` : 'NOT SET',
          isPlaceholder: BUNNY_API_KEY === 'your-api-key-here',
        },
        cdnUrl: {
          configured: !!BUNNY_CDN_URL,
          value: BUNNY_CDN_URL || 'NOT SET',
        },
        storageUrl: {
          configured: true,
          value: BUNNY_STORAGE_URL,
        },
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };

    // Test upload to Bunny.net
    let uploadTest = { status: 'skipped', reason: 'Missing credentials' };

    if (BUNNY_STORAGE_ZONE && BUNNY_API_KEY && !config.bunnynet.storageZone.isPlaceholder && !config.bunnynet.apiKey.isPlaceholder) {
      try {
        const testContent = 'Test upload from PetRecovery.org - ' + new Date().toISOString();
        const timestamp = Date.now();
        const filename = `test/config-check-${timestamp}.txt`;
        const uploadUrl = `${BUNNY_STORAGE_URL}/${BUNNY_STORAGE_ZONE}/${filename}`;

        console.log('[CONFIG CHECK] Testing upload to:', uploadUrl);

        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_API_KEY,
            'Content-Type': 'text/plain',
          },
          body: testContent,
        });

        if (response.ok) {
          uploadTest = {
            status: 'success',
            message: 'Upload test successful! Bunny.net is working correctly.',
            statusCode: response.status,
          };

          // Clean up test file
          await fetch(uploadUrl, {
            method: 'DELETE',
            headers: {
              'AccessKey': BUNNY_API_KEY,
            },
          });
        } else {
          const errorText = await response.text();
          uploadTest = {
            status: 'failed',
            message: 'Upload test failed',
            statusCode: response.status,
            error: errorText,
          };
        }
      } catch (error) {
        uploadTest = {
          status: 'error',
          message: 'Network error during upload test',
          error: error.message,
        };
      }
    }

    return NextResponse.json({
      config,
      uploadTest,
      ready: !config.bunnynet.storageZone.isPlaceholder &&
             !config.bunnynet.apiKey.isPlaceholder &&
             uploadTest.status === 'success',
    });

  } catch (error) {
    console.error('[CONFIG CHECK] Error:', error);

    return NextResponse.json(
      { error: 'Configuration check failed' },
      { status: 500 }
    );
  }
}

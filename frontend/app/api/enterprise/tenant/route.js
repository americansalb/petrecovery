import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/db';
import {
  TENANT_TYPES,
  PLANS,
  createTenant,
  configureBranding,
  getTenantConfig,
  createAPIKey,
  listMarketplaceIntegrations,
  installIntegration,
  manageTenantUsers,
} from '@/app/lib/enterprise/multiTenant';

/**
 * GET /api/enterprise/tenant
 * Get tenant configuration or marketplace
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'config';

    switch (action) {
      case 'types':
        return NextResponse.json({ types: TENANT_TYPES, plans: PLANS });

      case 'config':
        const tenantId = searchParams.get('tenantId');
        if (!tenantId) {
          return NextResponse.json(
            { error: 'Tenant ID required' },
            { status: 400 }
          );
        }
        const config = await getTenantConfig(prisma, tenantId);
        return NextResponse.json(config);

      case 'marketplace':
        const integrations = await listMarketplaceIntegrations(
          searchParams.get('category')
        );
        return NextResponse.json({ integrations });

      case 'users':
        const users = await manageTenantUsers(
          prisma,
          searchParams.get('tenantId'),
          'list',
          {}
        );
        return NextResponse.json({ users });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enterprise API error:', error);
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/enterprise/tenant
 * Create tenant, configure branding, manage integrations
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        const tenant = await createTenant(prisma, body.tenantData);
        return NextResponse.json(tenant);

      case 'branding':
        const branding = await configureBranding(
          prisma,
          body.tenantId,
          body.branding
        );
        return NextResponse.json(branding);

      case 'api_key':
        const apiKey = await createAPIKey(prisma, body.tenantId, body.keyConfig);
        return NextResponse.json(apiKey);

      case 'install_integration':
        const installation = await installIntegration(
          prisma,
          body.tenantId,
          body.integrationId,
          body.config
        );
        return NextResponse.json(installation);

      case 'manage_users':
        const userResult = await manageTenantUsers(
          prisma,
          body.tenantId,
          body.userAction,
          body.userData
        );
        return NextResponse.json(userResult);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enterprise action error:', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}

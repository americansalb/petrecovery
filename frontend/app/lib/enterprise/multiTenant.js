/**
 * Phase 30: Enterprise & White-label
 * Multi-tenant architecture, custom branding, API marketplace
 */

// Tenant types
export const TENANT_TYPES = {
  SHELTER: {
    id: 'shelter',
    name: 'Animal Shelter',
    features: ['case_management', 'intake_sync', 'volunteer_management'],
    maxUsers: 50,
  },
  RESCUE_ORG: {
    id: 'rescue_org',
    name: 'Rescue Organization',
    features: ['case_management', 'foster_network', 'adoption_tracking'],
    maxUsers: 100,
  },
  MUNICIPALITY: {
    id: 'municipality',
    name: 'Municipal Agency',
    features: ['case_management', 'licensing_integration', 'reporting', 'public_portal'],
    maxUsers: 200,
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    features: ['all'],
    maxUsers: -1, // Unlimited
  },
};

// Subscription plans
export const PLANS = {
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 9900, // cents per month
    features: ['basic_case_management', 'email_support', '5_team_members'],
    apiCalls: 1000,
    storage: '5GB',
  },
  PROFESSIONAL: {
    id: 'professional',
    name: 'Professional',
    price: 29900,
    features: ['advanced_case_management', 'integrations', 'priority_support', '25_team_members'],
    apiCalls: 10000,
    storage: '50GB',
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom pricing
    features: ['all', 'dedicated_support', 'sla', 'custom_integrations', 'unlimited_team'],
    apiCalls: -1, // Unlimited
    storage: 'Unlimited',
  },
};

/**
 * Create new tenant
 */
export async function createTenant(prisma, tenantData) {
  const {
    name,
    type,
    plan,
    domain,
    branding,
    adminUser,
  } = tenantData;

  const tenantType = TENANT_TYPES[type.toUpperCase()];
  const tenantPlan = PLANS[plan.toUpperCase()];

  if (!tenantType || !tenantPlan) {
    throw new Error('Invalid tenant type or plan');
  }

  // Generate tenant ID
  const tenantId = `tenant-${Date.now()}`;

  // Create tenant record
  const tenant = {
    id: tenantId,
    name,
    type: tenantType.id,
    plan: tenantPlan.id,
    domain: domain || `${name.toLowerCase().replace(/\s+/g, '-')}.petrecovery.org`,
    status: 'ACTIVE',
    settings: {
      branding: branding || {},
      features: tenantPlan.features,
      limits: {
        maxUsers: tenantType.maxUsers,
        apiCalls: tenantPlan.apiCalls,
        storage: tenantPlan.storage,
      },
    },
    createdAt: new Date().toISOString(),
    subscription: {
      planId: tenantPlan.id,
      startDate: new Date().toISOString(),
      billingCycle: 'monthly',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  // Create admin user
  const admin = await createTenantAdmin(prisma, tenantId, adminUser);

  // Provision resources
  await provisionTenantResources(tenantId, tenant.settings);

  return {
    tenant,
    admin: {
      id: admin.id,
      email: admin.email,
    },
    urls: {
      dashboard: `https://${tenant.domain}/dashboard`,
      api: `https://api.petrecovery.org/v1/tenants/${tenantId}`,
    },
  };
}

/**
 * Configure tenant branding
 */
export async function configureBranding(prisma, tenantId, branding) {
  const {
    logo,
    favicon,
    primaryColor,
    secondaryColor,
    fontFamily,
    customCSS,
    emailTemplates,
    loginBackground,
    footerText,
  } = branding;

  const brandingConfig = {
    logo: {
      light: logo?.light || null,
      dark: logo?.dark || null,
      icon: logo?.icon || null,
    },
    favicon: favicon || null,
    colors: {
      primary: primaryColor || '#3b82f6',
      secondary: secondaryColor || '#10b981',
      accent: branding.accentColor || '#f59e0b',
    },
    typography: {
      fontFamily: fontFamily || 'Inter, system-ui, sans-serif',
      headingFont: branding.headingFont || fontFamily || 'Inter, system-ui, sans-serif',
    },
    customCSS: customCSS || '',
    emailTemplates: emailTemplates || {},
    loginBackground: loginBackground || null,
    footer: {
      text: footerText || 'Powered by PetRecovery.org',
      showPoweredBy: branding.showPoweredBy !== false,
    },
    updatedAt: new Date().toISOString(),
  };

  // Validate and process assets
  if (brandingConfig.logo.light) {
    brandingConfig.logo.light = await processAsset(brandingConfig.logo.light, 'logo');
  }

  // Update tenant
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      branding: JSON.stringify(brandingConfig),
    },
  });

  // Generate custom CSS bundle
  const cssBundle = generateCSSBundle(brandingConfig);

  return {
    branding: brandingConfig,
    cssUrl: `https://assets.petrecovery.org/tenants/${tenantId}/brand.css`,
    previewUrl: `https://${tenantId}.petrecovery.org/preview`,
  };
}

/**
 * Get tenant configuration
 */
export async function getTenantConfig(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
      users: { select: { id: true } },
    },
  });

  if (!tenant) {
    return null;
  }

  return {
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
    domain: tenant.domain,
    status: tenant.status,
    branding: tenant.branding ? JSON.parse(tenant.branding) : {},
    features: tenant.features ? JSON.parse(tenant.features) : [],
    limits: tenant.limits ? JSON.parse(tenant.limits) : {},
    usage: {
      users: tenant.users.length,
      apiCalls: await getApiUsage(tenantId),
      storage: await getStorageUsage(tenantId),
    },
    subscription: tenant.subscription,
  };
}

/**
 * Create API key for tenant
 */
export async function createAPIKey(prisma, tenantId, keyConfig) {
  const {
    name,
    permissions,
    expiresIn,
    rateLimit,
    ipWhitelist,
  } = keyConfig;

  // Generate API key
  const apiKey = generateAPIKey();
  const keyHash = hashAPIKey(apiKey);

  const key = {
    id: `key-${Date.now()}`,
    tenantId,
    name,
    keyHash,
    keyPrefix: apiKey.substring(0, 8), // Show prefix for identification
    permissions: permissions || ['read'],
    rateLimit: rateLimit || { requests: 1000, window: '1h' },
    ipWhitelist: ipWhitelist || [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt: expiresIn
      ? new Date(Date.now() + parseExpiry(expiresIn)).toISOString()
      : null,
    lastUsedAt: null,
  };

  // Store in database
  await prisma.apiKey.create({
    data: {
      id: key.id,
      tenantId,
      name,
      keyHash,
      keyPrefix: key.keyPrefix,
      permissions: JSON.stringify(permissions),
      rateLimit: JSON.stringify(key.rateLimit),
      ipWhitelist: JSON.stringify(ipWhitelist),
      status: 'ACTIVE',
      expiresAt: key.expiresAt ? new Date(key.expiresAt) : null,
    },
  });

  return {
    key,
    apiKey, // Only returned once, must be saved by user
    warning: 'Save this API key securely. It cannot be retrieved again.',
    usage: {
      baseUrl: 'https://api.petrecovery.org/v1',
      authHeader: 'Authorization: Bearer YOUR_API_KEY',
      docsUrl: 'https://docs.petrecovery.org/api',
    },
  };
}

/**
 * API marketplace - list available integrations
 */
export async function listMarketplaceIntegrations(category = null) {
  const integrations = [
    {
      id: 'shelter-manager',
      name: 'Shelter Manager Pro',
      category: 'shelter',
      description: 'Sync with Shelter Manager Pro for automated intake processing',
      pricing: { type: 'free' },
      rating: 4.8,
      installs: 1250,
    },
    {
      id: 'petfinder-sync',
      name: 'Petfinder Sync',
      category: 'adoption',
      description: 'Automatically sync found pets with Petfinder listings',
      pricing: { type: 'free' },
      rating: 4.5,
      installs: 890,
    },
    {
      id: 'twilio-sms',
      name: 'Twilio SMS Alerts',
      category: 'notifications',
      description: 'Send SMS alerts for sightings and case updates',
      pricing: { type: 'usage', rate: '0.01 per message' },
      rating: 4.9,
      installs: 2100,
    },
    {
      id: 'stripe-payments',
      name: 'Stripe Payments',
      category: 'payments',
      description: 'Accept donations and process rewards',
      pricing: { type: 'free', note: 'Standard Stripe fees apply' },
      rating: 4.7,
      installs: 1800,
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp Newsletter',
      category: 'marketing',
      description: 'Sync subscribers and send newsletters',
      pricing: { type: 'paid', price: 1999, period: 'month' },
      rating: 4.3,
      installs: 450,
    },
    {
      id: 'salesforce',
      name: 'Salesforce CRM',
      category: 'crm',
      description: 'Sync donors and volunteers with Salesforce',
      pricing: { type: 'paid', price: 4999, period: 'month' },
      rating: 4.6,
      installs: 320,
    },
  ];

  if (category) {
    return integrations.filter(i => i.category === category);
  }

  return integrations;
}

/**
 * Install marketplace integration
 */
export async function installIntegration(prisma, tenantId, integrationId, config) {
  const integrations = await listMarketplaceIntegrations();
  const integration = integrations.find(i => i.id === integrationId);

  if (!integration) {
    throw new Error('Integration not found');
  }

  // Validate configuration
  const validatedConfig = validateIntegrationConfig(integrationId, config);

  // Create installation record
  const installation = {
    id: `install-${Date.now()}`,
    tenantId,
    integrationId,
    config: validatedConfig,
    status: 'ACTIVE',
    installedAt: new Date().toISOString(),
  };

  // Set up integration
  await setupIntegration(integrationId, tenantId, validatedConfig);

  return {
    installation,
    integration,
    webhookUrl: `https://api.petrecovery.org/webhooks/tenants/${tenantId}/integrations/${integrationId}`,
    status: 'Connected',
  };
}

/**
 * Generate SLA report
 */
export async function generateSLAReport(prisma, tenantId, period) {
  const { startDate, endDate } = period;

  // Get uptime data
  const uptimeData = await getUptimeMetrics(tenantId, startDate, endDate);

  // Get response time data
  const responseTimeData = await getResponseTimeMetrics(tenantId, startDate, endDate);

  // Get incident data
  const incidents = await getIncidents(tenantId, startDate, endDate);

  // Calculate SLA metrics
  const slaMetrics = {
    uptime: {
      target: 99.9,
      actual: uptimeData.percentage,
      met: uptimeData.percentage >= 99.9,
    },
    responseTime: {
      target: 200, // ms
      actual: responseTimeData.p95,
      met: responseTimeData.p95 <= 200,
    },
    supportResponseTime: {
      target: 4, // hours
      actual: await getAvgSupportResponseTime(tenantId, startDate, endDate),
      met: true,
    },
  };

  // Calculate credits if SLA not met
  const credits = calculateSLACredits(slaMetrics);

  return {
    period: { startDate, endDate },
    metrics: slaMetrics,
    uptime: {
      percentage: uptimeData.percentage,
      downtimeMinutes: uptimeData.downtimeMinutes,
      incidents: incidents.length,
    },
    performance: {
      avgResponseTime: responseTimeData.avg,
      p50ResponseTime: responseTimeData.p50,
      p95ResponseTime: responseTimeData.p95,
      p99ResponseTime: responseTimeData.p99,
    },
    incidents: incidents.map(i => ({
      id: i.id,
      type: i.type,
      duration: i.duration,
      impact: i.impact,
      resolved: i.resolved,
    })),
    credits,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Manage tenant users
 */
export async function manageTenantUsers(prisma, tenantId, action, userData) {
  switch (action) {
    case 'invite':
      return inviteTenantUser(prisma, tenantId, userData);

    case 'update':
      return updateTenantUser(prisma, tenantId, userData);

    case 'remove':
      return removeTenantUser(prisma, tenantId, userData.userId);

    case 'list':
      return listTenantUsers(prisma, tenantId);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Helper functions

async function createTenantAdmin(prisma, tenantId, adminData) {
  return { id: `user-${Date.now()}`, email: adminData.email };
}

async function provisionTenantResources(tenantId, settings) {
  console.log(`Provisioning resources for tenant ${tenantId}`);
}

async function processAsset(url, type) {
  return url;
}

function generateCSSBundle(branding) {
  return `:root {
    --primary-color: ${branding.colors.primary};
    --secondary-color: ${branding.colors.secondary};
    --accent-color: ${branding.colors.accent};
    --font-family: ${branding.typography.fontFamily};
  }
  ${branding.customCSS || ''}`;
}

async function getApiUsage(tenantId) {
  return 0;
}

async function getStorageUsage(tenantId) {
  return '0MB';
}

function generateAPIKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'pr_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function hashAPIKey(key) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}

function parseExpiry(expiresIn) {
  const match = expiresIn.match(/^(\d+)(d|h|m)$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

function validateIntegrationConfig(integrationId, config) {
  return config;
}

async function setupIntegration(integrationId, tenantId, config) {
  console.log(`Setting up ${integrationId} for tenant ${tenantId}`);
}

async function getUptimeMetrics(tenantId, startDate, endDate) {
  return { percentage: 99.95, downtimeMinutes: 22 };
}

async function getResponseTimeMetrics(tenantId, startDate, endDate) {
  return { avg: 85, p50: 65, p95: 180, p99: 350 };
}

async function getIncidents(tenantId, startDate, endDate) {
  return [];
}

async function getAvgSupportResponseTime(tenantId, startDate, endDate) {
  return 2.5;
}

function calculateSLACredits(metrics) {
  let credits = 0;
  if (!metrics.uptime.met) credits += 10;
  if (!metrics.responseTime.met) credits += 5;
  return { percentage: credits, reason: credits > 0 ? 'SLA targets not met' : null };
}

async function inviteTenantUser(prisma, tenantId, userData) {
  return { invited: true, email: userData.email };
}

async function updateTenantUser(prisma, tenantId, userData) {
  return { updated: true, userId: userData.userId };
}

async function removeTenantUser(prisma, tenantId, userId) {
  return { removed: true, userId };
}

async function listTenantUsers(prisma, tenantId) {
  return [];
}

export default {
  TENANT_TYPES,
  PLANS,
  createTenant,
  configureBranding,
  getTenantConfig,
  createAPIKey,
  listMarketplaceIntegrations,
  installIntegration,
  generateSLAReport,
  manageTenantUsers,
};

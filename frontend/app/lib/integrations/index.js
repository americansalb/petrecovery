/**
 * Unified Integration Manager
 *
 * Handles all external integrations (Slack, Discord, etc.)
 */

import * as slack from './slack';
import * as discord from './discord';

/**
 * Send notification to all configured integrations for a case
 */
export async function broadcastToCaseIntegrations(prisma, missionId, eventType, data) {
  const results = {
    slack: [],
    discord: [],
  };

  // Determine message formatters based on event type
  const formatters = {
    lost_pet: {
      slack: slack.formatLostPetAlert,
      discord: discord.formatLostPetAlert,
    },
    reunion: {
      slack: slack.formatReunionAlert,
      discord: discord.formatReunionAlert,
    },
    sighting: {
      slack: slack.formatSightingAlert,
      discord: discord.formatSightingAlert,
    },
    squad_update: {
      slack: (d) => slack.formatSquadUpdate(d, d.updateType),
      discord: (d) => discord.formatSquadUpdate(d, d.updateType),
    },
  };

  const formatter = formatters[eventType];
  if (!formatter) {
    console.warn(`Unknown event type for broadcast: ${eventType}`);
    return results;
  }

  // Get all integrations for this case
  const integrations = await prisma.integration.findMany({
    where: {
      isActive: true,
      OR: [
        { missionId },
        {
          rescueSquad: {
            cases: {
              some: { id: missionId },
            },
          },
        },
      ],
    },
  });

  for (const integration of integrations) {
    const config = integration.config ? JSON.parse(integration.config) : {};
    if (!config.webhookUrl) continue;

    try {
      let result;

      if (integration.type === 'SLACK') {
        const message = formatter.slack(data);
        result = await slack.sendWebhookMessage(config.webhookUrl, message);
        results.slack.push({ integrationId: integration.id, ...result });
      } else if (integration.type === 'DISCORD') {
        const message = formatter.discord(data);
        result = await discord.sendWebhookMessage(config.webhookUrl, message);
        results.discord.push({ integrationId: integration.id, ...result });
      }

      // Update last used timestamp
      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      console.error(`Integration ${integration.id} failed:`, error);
    }
  }

  return results;
}

/**
 * Create a new integration
 */
export async function createIntegration(prisma, {
  userId,
  type,
  webhookUrl,
  missionId,
  squadId,
  name,
}) {
  // Verify webhook before saving
  let verified = false;
  let webhookInfo = null;

  if (type === 'SLACK') {
    verified = await slack.verifyWebhook(webhookUrl);
  } else if (type === 'DISCORD') {
    verified = await discord.verifyWebhook(webhookUrl);
    if (verified) {
      webhookInfo = await discord.getWebhookInfo(webhookUrl);
    }
  }

  if (!verified) {
    throw new Error('Webhook verification failed');
  }

  const integration = await prisma.integration.create({
    data: {
      type,
      name: name || webhookInfo?.name || `${type} Integration`,
      config: JSON.stringify({
        webhookUrl,
        channelInfo: webhookInfo,
      }),
      isActive: true,
      createdById: userId,
      missionId: missionId || null,
      rescueSquadId: squadId || null,
    },
  });

  return integration;
}

/**
 * Test an integration by sending a test message
 */
export async function testIntegration(prisma, integrationId) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  const config = integration.config ? JSON.parse(integration.config) : {};
  if (!config.webhookUrl) {
    throw new Error('No webhook URL configured');
  }

  if (integration.type === 'SLACK') {
    return slack.sendWebhookMessage(config.webhookUrl, {
      text: ':white_check_mark: Test message from PetRecovery - your integration is working!',
    });
  } else if (integration.type === 'DISCORD') {
    return discord.sendTestMessage(config.webhookUrl);
  }

  throw new Error(`Unknown integration type: ${integration.type}`);
}

/**
 * Deactivate an integration
 */
export async function deactivateIntegration(prisma, integrationId) {
  return prisma.integration.update({
    where: { id: integrationId },
    data: { isActive: false },
  });
}

/**
 * Delete an integration
 */
export async function deleteIntegration(prisma, integrationId) {
  return prisma.integration.delete({
    where: { id: integrationId },
  });
}

/**
 * Get all integrations for a user
 */
export async function getUserIntegrations(prisma, userId) {
  return prisma.integration.findMany({
    where: {
      createdById: userId,
    },
    include: {
      case: {
        select: { id: true, petName: true, missionNumber: true },
      },
      rescueSquad: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get integrations for a specific case
 */
export async function getCaseIntegrations(prisma, missionId) {
  return prisma.integration.findMany({
    where: {
      OR: [
        { missionId },
        {
          rescueSquad: {
            cases: {
              some: { id: missionId },
            },
          },
        },
      ],
    },
    include: {
      rescueSquad: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Get integrations for a squad
 */
export async function getSquadIntegrations(prisma, squadId) {
  return prisma.integration.findMany({
    where: {
      rescueSquadId: squadId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Re-export individual modules for direct access
export { slack, discord };

/**
 * Discord Integration for PetRecovery
 *
 * Sends notifications to Discord channels via webhooks.
 */

/**
 * Send a message to a Discord webhook
 */
export async function sendWebhookMessage(webhookUrl, message) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} - ${text}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Discord webhook error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format a lost pet alert for Discord (embed)
 */
export function formatLostPetAlert(missionData) {
  const embed = {
    title: `:rotating_light: Lost Pet Alert: ${missionData.petName}`,
    color: 0xff6b6b, // Red
    fields: [
      {
        name: 'Pet Name',
        value: missionData.petName || 'Unknown',
        inline: true,
      },
      {
        name: 'Species',
        value: missionData.species || 'Unknown',
        inline: true,
      },
      {
        name: 'Breed',
        value: missionData.breed || 'Unknown',
        inline: true,
      },
      {
        name: 'Color',
        value: missionData.color || 'Unknown',
        inline: true,
      },
      {
        name: 'Last Seen',
        value: missionData.lastSeenAddress || missionData.location || 'Unknown location',
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: `Case #${missionData.missionNumber}`,
    },
  };

  if (missionData.description) {
    embed.description = missionData.description;
  }

  if (missionData.photoUrl) {
    embed.thumbnail = { url: missionData.photoUrl };
  }

  const caseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cases/${missionData.missionNumber}`;

  return {
    content: `**New Lost Pet Report** - Please help find ${missionData.petName}!`,
    embeds: [embed],
    components: [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 5, // Link
            label: 'View Case Details',
            url: caseUrl,
          },
          {
            type: 2,
            style: 5,
            label: 'Report Sighting',
            url: `${caseUrl}/sighting`,
          },
        ],
      },
    ],
  };
}

/**
 * Format a reunion notification for Discord
 */
export function formatReunionAlert(missionData) {
  return {
    content: `:tada: **Great News!** ${missionData.petName} has been reunited with their family!`,
    embeds: [
      {
        title: `${missionData.petName} is Home!`,
        color: 0x51cf66, // Green
        description: `Case #${missionData.missionNumber} has been successfully resolved.`,
        fields: [
          {
            name: 'Days Missing',
            value: `${missionData.daysLost || '?'} days`,
            inline: true,
          },
          {
            name: 'Resolution',
            value: missionData.resolution || 'Reunited',
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
        thumbnail: missionData.photoUrl ? { url: missionData.photoUrl } : undefined,
      },
    ],
  };
}

/**
 * Format a sighting notification for Discord
 */
export function formatSightingAlert(sightingData) {
  const embed = {
    title: `:eyes: New Sighting Reported`,
    color: 0xfab005, // Yellow
    fields: [
      {
        name: 'Pet',
        value: sightingData.petName,
        inline: true,
      },
      {
        name: 'Case',
        value: `#${sightingData.missionNumber}`,
        inline: true,
      },
      {
        name: 'Location',
        value: sightingData.location,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  if (sightingData.notes) {
    embed.description = sightingData.notes;
  }

  if (sightingData.photoUrl) {
    embed.image = { url: sightingData.photoUrl };
  }

  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'View Case',
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/cases/${sightingData.missionNumber}`,
          },
        ],
      },
    ],
  };
}

/**
 * Format a squad update for Discord
 */
export function formatSquadUpdate(squadData, updateType) {
  const configs = {
    new_member: {
      title: ':wave: New Rescue Force Member',
      color: 0x339af0, // Blue
    },
    search_started: {
      title: ':mag: Search Started',
      color: 0x51cf66, // Green
    },
    search_ended: {
      title: ':checkered_flag: Search Ended',
      color: 0x868e96, // Gray
    },
    area_covered: {
      title: ':white_check_mark: Area Covered',
      color: 0x20c997, // Teal
    },
  };

  const config = configs[updateType] || { title: ':bell: Rescue Force Update', color: 0x339af0 };

  return {
    embeds: [
      {
        title: config.title,
        color: config.color,
        fields: [
          {
            name: 'Rescue Force',
            value: squadData.squadName,
            inline: true,
          },
          {
            name: 'Case',
            value: `${squadData.petName} (#${squadData.missionNumber})`,
            inline: true,
          },
        ],
        description: squadData.details || undefined,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Format area summary for Discord
 */
export function formatAreaSummary(squadData) {
  return {
    embeds: [
      {
        title: ':bar_chart: Search Progress Update',
        color: 0x845ef7, // Purple
        fields: [
          {
            name: 'Rescue Force',
            value: squadData.squadName,
            inline: true,
          },
          {
            name: 'Areas Searched',
            value: `${squadData.areasSearched || 0}`,
            inline: true,
          },
          {
            name: 'Acreage Covered',
            value: `${squadData.acreageCovered?.toFixed(1) || 0} acres`,
            inline: true,
          },
          {
            name: 'Active Searchers',
            value: `${squadData.activeSearchers || 0}`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Send notification to all configured Discord webhooks for a case
 */
export async function notifyDiscordChannels(prisma, missionId, messageFormatter, data) {
  // Get all Discord integrations for squads associated with this case
  const integrations = await prisma.integration.findMany({
    where: {
      type: 'DISCORD',
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

  const results = [];
  const message = messageFormatter(data);

  for (const integration of integrations) {
    const config = integration.config ? JSON.parse(integration.config) : {};
    if (config.webhookUrl) {
      const result = await sendWebhookMessage(config.webhookUrl, message);
      results.push({ integrationId: integration.id, ...result });
    }
  }

  return results;
}

/**
 * Verify Discord webhook URL
 */
export async function verifyWebhook(webhookUrl) {
  try {
    // Discord webhooks return info on GET
    const response = await fetch(webhookUrl);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return !!data.id; // Valid webhook returns webhook ID
  } catch {
    return false;
  }
}

/**
 * Send test message to verify webhook
 */
export async function sendTestMessage(webhookUrl) {
  return sendWebhookMessage(webhookUrl, {
    content: ':white_check_mark: PetRecovery webhook connected successfully! You will receive pet alerts in this channel.',
    embeds: [
      {
        title: 'Webhook Verified',
        description: 'This Discord channel is now linked to PetRecovery. You will receive notifications for lost pet alerts, sightings, and reunions.',
        color: 0x51cf66,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/**
 * Get webhook info (channel name, guild name)
 */
export async function getWebhookInfo(webhookUrl) {
  try {
    const response = await fetch(webhookUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      channelId: data.channel_id,
      guildId: data.guild_id,
    };
  } catch {
    return null;
  }
}

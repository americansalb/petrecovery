/**
 * Slack Integration for ReunitePets
 *
 * Sends notifications to Slack channels via webhooks and app integrations.
 */

const SLACK_API_BASE = 'https://slack.com/api';

/**
 * Send a message to a Slack webhook
 */
export async function sendWebhookMessage(webhookUrl, message) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Slack webhook error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format a lost pet alert for Slack
 */
export function formatLostPetAlert(missionData) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:rotating_light: Lost Pet Alert: ${missionData.petName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Pet Name:*\n${missionData.petName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Species:*\n${missionData.species || 'Unknown'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Breed:*\n${missionData.breed || 'Unknown'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Color:*\n${missionData.color || 'Unknown'}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Last Seen:*\n${missionData.lastSeenAddress || missionData.location || 'Unknown location'}`,
      },
    },
  ];

  if (missionData.description) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description:*\n${missionData.description}`,
      },
    });
  }

  if (missionData.photoUrl) {
    blocks.push({
      type: 'image',
      image_url: missionData.photoUrl,
      alt_text: `Photo of ${missionData.petName}`,
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Case Details',
          emoji: true,
        },
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/cases/${missionData.missionNumber}`,
        style: 'primary',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Report Sighting',
          emoji: true,
        },
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/cases/${missionData.missionNumber}/sighting`,
      },
    ],
  });

  return { blocks };
}

/**
 * Format a reunion notification for Slack
 */
export function formatReunionAlert(missionData) {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:tada: Pet Reunited: ${missionData.petName}!`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Great news! *${missionData.petName}* has been reunited with their family!`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Case #${missionData.missionNumber} • Resolved after ${missionData.daysLost || '?'} days`,
          },
        ],
      },
    ],
  };
}

/**
 * Format a sighting notification for Slack
 */
export function formatSightingAlert(sightingData) {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:eyes: New Sighting Reported`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Pet:*\n${sightingData.petName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Case:*\n#${sightingData.missionNumber}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Location:*\n${sightingData.location}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Sighting',
              emoji: true,
            },
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/cases/${sightingData.missionNumber}`,
            style: 'primary',
          },
        ],
      },
    ],
  };
}

/**
 * Format a force update for Slack
 */
export function formatSquadUpdate(forceData, updateType) {
  const titles = {
    new_member: ':wave: New Force Member',
    search_started: ':mag: Search Started',
    search_ended: ':checkered_flag: Search Ended',
    area_covered: ':white_check_mark: Area Covered',
  };

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: titles[updateType] || ':bell: Force Update',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Squad:* ${forceData.forceName}\n*Case:* ${forceData.petName} (#${forceData.missionNumber})`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: forceData.details || 'No additional details',
          },
        ],
      },
    ],
  };
}

/**
 * Send notification to all configured Slack webhooks for a case
 */
export async function notifySlackChannels(prisma, missionId, messageFormatter, data) {
  // Get all Slack integrations for forces associated with this case
  const integrations = await prisma.integration.findMany({
    where: {
      type: 'SLACK',
      isActive: true,
      OR: [
        { missionId },
        {
          rescueForce: {
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
 * Verify Slack webhook URL
 */
export async function verifyWebhook(webhookUrl) {
  try {
    const testMessage = {
      text: 'ReunitePets webhook verification - this channel is now connected!',
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Slack OAuth flow for app installation
 */
export async function exchangeCodeForToken(code, redirectUri) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Slack credentials not configured');
  }

  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'OAuth exchange failed');
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    webhookUrl: data.incoming_webhook?.url,
    channelId: data.incoming_webhook?.channel_id,
    channelName: data.incoming_webhook?.channel,
  };
}

/**
 * Post a message using Slack API (requires bot token)
 */
export async function postMessage(accessToken, channel, message) {
  const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      ...message,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Failed to post message');
  }

  return data;
}

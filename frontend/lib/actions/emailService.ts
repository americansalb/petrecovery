/**
 * Email Service (Resend)
 *
 * Handles sending verified platform emails via Resend API.
 * See docs/Actions_Guide.md for full specification.
 *
 * @version 1.0
 */

import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';
import { getVerificationService } from './verificationService';

// =============================================================================
// TYPES
// =============================================================================

export interface ShelterEmailParams {
  userId: string;
  missionId: string;
  shelterContactId: string;
  shelterName: string;
  shelterEmail: string;
  shelterType: 'SHELTER' | 'VET' | 'ANIMAL_CONTROL';
  petName: string;
  petType: 'DOG' | 'CAT' | 'OTHER';
  petBreed?: string;
  petColor?: string;
  petDescription?: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  petPhotoUrl?: string;
  caseUrl: string;
  caseCreatedAt?: Date;
  timezone?: string;
}

export interface EmailResult {
  success: boolean;
  emailId?: string;
  attemptId?: string;
  pointsEarned?: number;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ReunitePets <alerts@petrecovery.org>';

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function getShelterEmailSubject(petName: string, petType: string): string {
  return `Lost ${petType.toLowerCase()} alert: ${petName} - Please help us look`;
}

function getShelterEmailHtml(params: ShelterEmailParams): string {
  const {
    shelterName,
    shelterType,
    petName,
    petType,
    petBreed,
    petColor,
    petDescription,
    lastSeenLocation,
    lastSeenDate,
    ownerName,
    ownerPhone,
    ownerEmail,
    petPhotoUrl,
    caseUrl,
  } = params;

  const typeLabel =
    shelterType === 'VET'
      ? 'veterinary clinic'
      : shelterType === 'ANIMAL_CONTROL'
        ? 'animal control office'
        : 'shelter';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lost Pet Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🐾 Lost Pet Alert</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">Dear ${shelterName} team,</p>

    <p>We're reaching out from ReunitePets to ask for your help. A beloved pet has gone missing in your area, and we're hoping your ${typeLabel} might be able to assist.</p>

    ${petPhotoUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <img src="${petPhotoUrl}" alt="${petName}" style="max-width: 300px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>
    ` : ''}

    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #1f2937; font-size: 18px;">Missing Pet Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Name:</td>
          <td style="padding: 8px 0; font-weight: 600;">${petName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Type:</td>
          <td style="padding: 8px 0;">${petType}</td>
        </tr>
        ${petBreed ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Breed:</td>
          <td style="padding: 8px 0;">${petBreed}</td>
        </tr>
        ` : ''}
        ${petColor ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Color:</td>
          <td style="padding: 8px 0;">${petColor}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Last Seen:</td>
          <td style="padding: 8px 0;">${lastSeenLocation}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Date:</td>
          <td style="padding: 8px 0;">${lastSeenDate}</td>
        </tr>
      </table>
      ${petDescription ? `
      <p style="margin-bottom: 0; color: #4b5563;"><strong>Description:</strong> ${petDescription}</p>
      ` : ''}
    </div>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
      <p style="margin: 0; color: #92400e;">
        <strong>Request:</strong> If a ${petType.toLowerCase()} matching this description is brought to your facility, please contact the owner immediately.
      </p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">Owner Contact</h3>
      <p style="margin: 5px 0;"><strong>${ownerName}</strong></p>
      <p style="margin: 5px 0;">📱 ${ownerPhone}</p>
      <p style="margin: 5px 0;">✉️ <a href="mailto:${ownerEmail}" style="color: #667eea;">${ownerEmail}</a></p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${caseUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">View Full Case Details</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">Thank you for helping reunite lost pets with their families. Every sighting and tip makes a difference!</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent via <a href="https://www.reunitepets.org" style="color: #667eea;">ReunitePets</a>, a free service helping reunite lost pets with their families.
    </p>
  </div>
</body>
</html>
  `.trim();
}

function getShelterEmailText(params: ShelterEmailParams): string {
  const {
    shelterName,
    petName,
    petType,
    petBreed,
    petColor,
    petDescription,
    lastSeenLocation,
    lastSeenDate,
    ownerName,
    ownerPhone,
    ownerEmail,
    caseUrl,
  } = params;

  return `
Lost Pet Alert

Dear ${shelterName} team,

We're reaching out from ReunitePets to ask for your help. A beloved pet has gone missing in your area.

MISSING PET DETAILS
-------------------
Name: ${petName}
Type: ${petType}
${petBreed ? `Breed: ${petBreed}` : ''}
${petColor ? `Color: ${petColor}` : ''}
Last Seen: ${lastSeenLocation}
Date: ${lastSeenDate}
${petDescription ? `Description: ${petDescription}` : ''}

REQUEST: If a ${petType.toLowerCase()} matching this description is brought to your facility, please contact the owner immediately.

OWNER CONTACT
-------------
${ownerName}
Phone: ${ownerPhone}
Email: ${ownerEmail}

View full case details: ${caseUrl}

Thank you for helping reunite lost pets with their families!

---
This email was sent via ReunitePets
  `.trim();
}

// =============================================================================
// EMAIL SERVICE CLASS
// =============================================================================

export class EmailService {
  private resend: Resend | null = null;

  constructor(private prisma: PrismaClient) {
    if (RESEND_API_KEY) {
      this.resend = new Resend(RESEND_API_KEY);
    }
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Send a shelter/vet/animal control contact email
   */
  async sendShelterEmail(params: ShelterEmailParams): Promise<EmailResult> {
    if (!this.resend) {
      return {
        success: false,
        error: 'Email service not configured. Set RESEND_API_KEY in environment.',
      };
    }

    const { shelterEmail, petName, petType, userId, missionId, shelterContactId, caseCreatedAt, timezone } = params;

    try {
      // Send email via Resend
      const { data, error } = await this.resend.emails.send({
        from: FROM_EMAIL,
        to: shelterEmail,
        subject: getShelterEmailSubject(petName, petType),
        html: getShelterEmailHtml(params),
        text: getShelterEmailText(params),
        tags: [
          { name: 'type', value: 'shelter_contact' },
          { name: 'case_id', value: missionId },
          { name: 'shelter_type', value: params.shelterType },
        ],
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const emailId = data?.id;
      if (!emailId) {
        return {
          success: false,
          error: 'No email ID returned from Resend',
        };
      }

      // Determine action type based on shelter type
      const actionType = params.shelterType === 'VET'
        ? 'contact_vets'
        : params.shelterType === 'ANIMAL_CONTROL'
          ? 'contact_animal_control'
          : 'contact_shelters';

      // Record the verified email and award points
      const verificationService = getVerificationService(this.prisma);
      const result = await verificationService.recordPlatformEmail({
        userId,
        missionId,
        shelterContactId,
        actionType: actionType as any,
        emailId,
        recipientEmail: shelterEmail,
        recipientName: params.shelterName,
        caseCreatedAt,
        timezone,
      });

      return {
        success: true,
        emailId,
        attemptId: result.attemptId,
        pointsEarned: result.pointsEarned,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error sending email';
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Send a batch of shelter emails
   */
  async sendBatchShelterEmails(
    emails: ShelterEmailParams[]
  ): Promise<{
    results: EmailResult[];
    successCount: number;
    failureCount: number;
    totalPoints: number;
  }> {
    const results: EmailResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalPoints = 0;

    for (const params of emails) {
      const result = await this.sendShelterEmail(params);
      results.push(result);

      if (result.success) {
        successCount++;
        totalPoints += result.pointsEarned ?? 0;
      } else {
        failureCount++;
      }

      // Small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      results,
      successCount,
      failureCount,
      totalPoints,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let emailServiceInstance: EmailService | null = null;

export function getEmailService(prisma: PrismaClient): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService(prisma);
  }
  return emailServiceInstance;
}

/**
 * Flyer Generation API
 *
 * POST /api/mission/[missionId]/flyers/generate - Generate flyer data/HTML
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import QRCode from 'qrcode';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// TYPES
// =============================================================================

type FlyerSize = 'full' | 'half' | 'quarter';
type FlyerTemplate = 'classic' | 'modern' | 'minimal';

interface GenerateFlyerBody {
  size?: FlyerSize;
  template?: FlyerTemplate;
  includeQrCode?: boolean;
  customMessage?: string;
}

interface FlyerData {
  petName: string;
  petType: string;
  breed: string;
  color: string;
  description: string;
  photoUrl: string | null;
  lastSeenLocation: string;
  lastSeenDate: string;
  contactPhone: string | null;
  contactEmail: string | null;
  rewardOffered: boolean;
  rewardAmount: number | null;
  caseUrl: string;
  qrCodeUrl: string;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /api/mission/[missionId]/flyers/generate
 *
 * Generate flyer data and HTML template for a case
 *
 * Body: {
 *   size?: 'full' | 'half' | 'quarter' (default: 'half')
 *   template?: 'classic' | 'modern' | 'minimal' (default: 'classic')
 *   includeQrCode?: boolean (default: true)
 *   customMessage?: string
 * }
 *
 * Returns: {
 *   flyerData: FlyerData,
 *   html: string (printable HTML template)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = await params;
    const body: GenerateFlyerBody = await request.json();

    const {
      size = 'half',
      template = 'classic',
      includeQrCode = true,
      customMessage,
    } = body;

    // Get case with pet and owner info
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      include: {
        pet: {
          select: {
            name: true,
            species: true,
            breed: true,
            color: true,
            distinctiveMarks: true,
            primaryPhotoUrl: true,
          },
        },
        reporter: {
          select: {
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Build case URL from the public case number (the real, shareable route
    // is /cases/[caseNumber]; the old /case/[id] link 404'd). Prefer the
    // request's own origin so scanned QR codes point at the same host the
    // flyer was generated from.
    const requestOrigin = (() => {
      try { return new URL(request.url).origin; } catch { return ''; }
    })();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin || 'https://www.reunitepets.org';
    const caseUrl = `${baseUrl}/cases/${(missionRecord as any).caseNumber || missionId}`;

    // Embed a real, scannable QR as a data URL (no external service — works
    // offline and survives the print CSP; the old placeholder never scanned).
    let qrCodeUrl = '';
    if (includeQrCode) {
      try {
        qrCodeUrl = await QRCode.toDataURL(caseUrl, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827', light: '#ffffff' },
        });
      } catch {
        qrCodeUrl = '';
      }
    }

    // Format last seen date
    const lastSeenDate = missionRecord.lastSeenAt
      ? new Date(missionRecord.lastSeenAt).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Unknown';

    // Build flyer data. Cases carry denormalized pet/owner fields directly,
    // so use those first (always present) and fall back to the linked Pet /
    // reporter records — the old code only read the Pet relation, which is
    // null for report-created cases, so every such flyer printed "Unknown".
    const m = missionRecord as any;
    const flyerData: FlyerData = {
      petName: m.petName || m.pet?.name || 'Unknown',
      petType: m.petSpecies || m.pet?.species || 'Pet',
      breed: m.petBreed || m.pet?.breed || '',
      color: m.petColor || m.pet?.color || '',
      description: m.petDescription || m.pet?.distinctiveMarks || '',
      photoUrl: m.petPhotoUrl || m.pet?.primaryPhotoUrl || null,
      lastSeenLocation: m.lastSeenAddress || 'Unknown location',
      lastSeenDate,
      contactPhone: m.ownerPhone || m.reporter?.phone || null,
      contactEmail: m.ownerEmail || m.reporter?.email || null,
      rewardOffered: m.hasReward || false,
      rewardAmount: m.rewardAmount || null,
      caseUrl,
      qrCodeUrl,
    };

    // Generate HTML based on template
    const html = generateFlyerHtml(flyerData, size, template, customMessage);

    return NextResponse.json({
      flyerData,
      html,
      printInstructions: getPrintInstructions(size),
    });
  } catch (error) {
    console.error('Flyer generate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate HTML flyer based on template and size
 */
function generateFlyerHtml(
  data: FlyerData,
  size: FlyerSize,
  template: FlyerTemplate,
  customMessage?: string
): string {
  const { width, height, fontSize } = getSizeStyles(size);
  const colors = getTemplateColors(template);

  const petDescription = [data.breed, data.color]
    .filter(Boolean)
    .join(', ');

  const contactInfo = data.contactPhone
    ? `CALL: ${data.contactPhone}`
    : data.contactEmail
    ? `EMAIL: ${data.contactEmail}`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lost ${data.petType} - ${data.petName}</title>
  <style>
    @page {
      size: letter;
      margin: 0.25in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #e5e7eb;
    }

    .mc-toolbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; gap: 10px; justify-content: center;
      padding: 12px; background: #111827;
    }
    .mc-toolbar button {
      font: 600 14px Arial, sans-serif; padding: 9px 20px;
      border: 0; border-radius: 8px; cursor: pointer;
    }
    .mc-toolbar .print { background: #dc2626; color: #fff; }
    .mc-toolbar .close { background: #374151; color: #fff; }
    .mc-stage { display: flex; justify-content: center; padding: 20px; }
    .mc-stage .print-container { box-shadow: 0 10px 30px rgba(0,0,0,.25); }

    .flyer {
      width: ${width};
      height: ${height};
      padding: 16px;
      border: 3px solid ${colors.border};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      page-break-inside: avoid;
    }

    .header {
      font-size: ${fontSize.header};
      font-weight: bold;
      color: ${colors.header};
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .alert-emoji {
      font-size: ${fontSize.emoji};
    }

    .photo-container {
      width: 60%;
      max-height: 40%;
      margin: 8px 0;
      overflow: hidden;
      border: 2px solid ${colors.border};
      border-radius: 8px;
    }

    .photo-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-placeholder {
      width: 100%;
      height: 150px;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: ${fontSize.small};
    }

    .pet-name {
      font-size: ${fontSize.name};
      font-weight: bold;
      color: ${colors.text};
      margin: 8px 0 4px;
    }

    .pet-description {
      font-size: ${fontSize.body};
      color: ${colors.text};
      margin-bottom: 8px;
    }

    .location {
      font-size: ${fontSize.body};
      color: ${colors.text};
      margin-bottom: 4px;
    }

    .date {
      font-size: ${fontSize.small};
      color: #666;
      margin-bottom: 12px;
    }

    .reward {
      font-size: ${fontSize.body};
      font-weight: bold;
      color: ${colors.reward};
      background: ${colors.rewardBg};
      padding: 4px 16px;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .contact {
      font-size: ${fontSize.contact};
      font-weight: bold;
      color: ${colors.header};
      margin-bottom: 12px;
    }

    .qr-section {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .qr-code img {
      width: 80px;
      height: 80px;
    }

    .qr-label {
      font-size: ${fontSize.small};
      color: #666;
      margin-top: 4px;
    }

    .custom-message {
      font-size: ${fontSize.small};
      font-style: italic;
      color: #666;
      margin-top: 8px;
      max-width: 90%;
    }

    /* Print layout for multiple flyers per page */
    .print-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }

    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .mc-toolbar { display: none; }
      .mc-stage { padding: 0; }
      .mc-stage .print-container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="mc-toolbar">
    <button class="print" onclick="window.print()">Print this flyer</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
  <div class="mc-stage">
  <div class="print-container">
    <div class="flyer">
      <div class="header">
        <span class="alert-emoji">🚨</span>
        LOST ${data.petType.toUpperCase()}
        <span class="alert-emoji">🚨</span>
      </div>

      <div class="photo-container">
        ${data.photoUrl
          ? `<img src="${data.photoUrl}" alt="${data.petName}" />`
          : `<div class="photo-placeholder">[Pet Photo]</div>`
        }
      </div>

      <div class="pet-name">${data.petName.toUpperCase()}</div>

      ${petDescription ? `<div class="pet-description">${petDescription}</div>` : ''}

      <div class="location">Last seen: ${data.lastSeenLocation}</div>
      <div class="date">${data.lastSeenDate}</div>

      ${data.rewardOffered
        ? `<div class="reward">${data.rewardAmount ? `$${data.rewardAmount} ` : ''}REWARD OFFERED</div>`
        : ''
      }

      ${contactInfo ? `<div class="contact">${contactInfo}</div>` : ''}

      ${data.qrCodeUrl ? `
        <div class="qr-section">
          <div class="qr-code">
            <img src="${data.qrCodeUrl}" alt="QR Code" />
          </div>
          <div class="qr-label">Scan for more info</div>
        </div>
      ` : ''}

      ${customMessage ? `<div class="custom-message">"${customMessage}"</div>` : ''}
    </div>
  </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Get size-specific styles
 */
function getSizeStyles(size: FlyerSize): {
  width: string;
  height: string;
  fontSize: {
    header: string;
    emoji: string;
    name: string;
    body: string;
    contact: string;
    small: string;
  };
} {
  switch (size) {
    case 'full':
      return {
        width: '7.5in',
        height: '10in',
        fontSize: {
          header: '32px',
          emoji: '28px',
          name: '36px',
          body: '18px',
          contact: '24px',
          small: '14px',
        },
      };
    case 'quarter':
      return {
        width: '3.75in',
        height: '5in',
        fontSize: {
          header: '14px',
          emoji: '12px',
          name: '16px',
          body: '10px',
          contact: '12px',
          small: '8px',
        },
      };
    case 'half':
    default:
      return {
        width: '7.5in',
        height: '5in',
        fontSize: {
          header: '20px',
          emoji: '18px',
          name: '24px',
          body: '14px',
          contact: '18px',
          small: '10px',
        },
      };
  }
}

/**
 * Get template-specific colors
 */
function getTemplateColors(template: FlyerTemplate): {
  border: string;
  background: string;
  header: string;
  text: string;
  reward: string;
  rewardBg: string;
} {
  switch (template) {
    case 'modern':
      return {
        border: '#2563eb',
        background: '#f8fafc',
        header: '#2563eb',
        text: '#1e293b',
        reward: '#059669',
        rewardBg: '#ecfdf5',
      };
    case 'minimal':
      return {
        border: '#374151',
        background: '#ffffff',
        header: '#111827',
        text: '#374151',
        reward: '#111827',
        rewardBg: '#f3f4f6',
      };
    case 'classic':
    default:
      return {
        border: '#dc2626',
        background: '#ffffff',
        header: '#dc2626',
        text: '#1f2937',
        reward: '#ca8a04',
        rewardBg: '#fef9c3',
      };
  }
}

/**
 * Get print instructions based on size
 */
function getPrintInstructions(size: FlyerSize): string {
  switch (size) {
    case 'full':
      return 'Print on letter-size paper (8.5" x 11"). One flyer per page.';
    case 'quarter':
      return 'Print on letter-size paper. Cut into 4 flyers (2x2 grid). Great for bulletin boards!';
    case 'half':
    default:
      return 'Print on letter-size paper. Cut in half for 2 flyers. Perfect for posting in windows and on poles.';
  }
}

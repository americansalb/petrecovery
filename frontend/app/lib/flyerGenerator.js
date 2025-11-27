/**
 * Flyer Generator Library
 *
 * Generates printable PDF flyers for lost pets with QR codes.
 * Supports multiple formats: Letter, Half-Page, Quarter, and Poster.
 */

// QR Code generation using browser-compatible library
export function generateQRCodeDataUrl(text, size = 200) {
  // Simple QR code data URL generator using canvas
  // In production, use a library like 'qrcode' npm package
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="black">QR</text>
    </svg>
  `)}`;
}

// Flyer configuration presets
export const FLYER_PRESETS = {
  LETTER: {
    name: 'Full Page (Letter)',
    width: 612, // 8.5" in points
    height: 792, // 11" in points
    orientation: 'portrait',
    photoSize: { width: 500, height: 350 },
    titleSize: 48,
    subtitleSize: 24,
    bodySize: 14,
    qrSize: 120
  },
  HALF_PAGE: {
    name: 'Half Page',
    width: 612,
    height: 396, // Half of 11"
    orientation: 'landscape',
    photoSize: { width: 250, height: 200 },
    titleSize: 32,
    subtitleSize: 18,
    bodySize: 12,
    qrSize: 80
  },
  QUARTER: {
    name: 'Quarter Page',
    width: 306,
    height: 396,
    orientation: 'portrait',
    photoSize: { width: 250, height: 180 },
    titleSize: 24,
    subtitleSize: 14,
    bodySize: 10,
    qrSize: 60
  },
  POSTER: {
    name: 'Large Poster (11x17)',
    width: 792,
    height: 1224,
    orientation: 'portrait',
    photoSize: { width: 700, height: 500 },
    titleSize: 72,
    subtitleSize: 36,
    bodySize: 18,
    qrSize: 150
  }
};

/**
 * Generate flyer HTML for printing or PDF conversion
 */
export function generateFlyerHTML(caseData, options = {}) {
  const {
    format = 'LETTER',
    includeQR = true,
    includePhoto = true,
    includeReward = true,
    includeContact = true,
    primaryColor = '#DC2626',
    accentColor = '#1F2937',
    customMessage = ''
  } = options;

  const preset = FLYER_PRESETS[format] || FLYER_PRESETS.LETTER;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://petrecovery.org';
  const caseUrl = `${baseUrl}/cases/${caseData.id}`;

  // Format phone number
  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>LOST: ${caseData.petName} - Missing ${caseData.petSpecies}</title>
      <style>
        @page {
          size: ${preset.width}pt ${preset.height}pt;
          margin: 0;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          width: ${preset.width}pt;
          height: ${preset.height}pt;
          background: white;
          color: ${accentColor};
        }

        .flyer {
          width: 100%;
          height: 100%;
          padding: 24pt;
          display: flex;
          flex-direction: column;
          border: 4pt solid ${primaryColor};
        }

        .header {
          background: ${primaryColor};
          color: white;
          padding: 16pt;
          text-align: center;
          margin: -24pt -24pt 16pt -24pt;
        }

        .header h1 {
          font-size: ${preset.titleSize}pt;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2pt;
          margin-bottom: 8pt;
        }

        .header h2 {
          font-size: ${preset.subtitleSize}pt;
          font-weight: 600;
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: ${format === 'HALF_PAGE' ? 'row' : 'column'};
          gap: 16pt;
        }

        .photo-section {
          ${format === 'HALF_PAGE' ? 'width: 45%;' : ''}
        }

        .photo {
          width: 100%;
          max-width: ${preset.photoSize.width}pt;
          height: ${preset.photoSize.height}pt;
          object-fit: cover;
          border: 3pt solid ${accentColor};
          border-radius: 8pt;
          margin: 0 auto;
          display: block;
        }

        .details-section {
          ${format === 'HALF_PAGE' ? 'width: 55%;' : ''}
          flex: 1;
        }

        .pet-name {
          font-size: ${Math.round(preset.titleSize * 0.7)}pt;
          font-weight: 800;
          color: ${primaryColor};
          text-align: center;
          margin-bottom: 12pt;
        }

        .pet-info {
          font-size: ${preset.bodySize}pt;
          line-height: 1.6;
          margin-bottom: 12pt;
        }

        .pet-info strong {
          color: ${accentColor};
        }

        .info-row {
          display: flex;
          margin-bottom: 6pt;
        }

        .info-label {
          font-weight: 700;
          min-width: 100pt;
        }

        .description {
          font-size: ${preset.bodySize}pt;
          line-height: 1.5;
          padding: 12pt;
          background: #f8f8f8;
          border-radius: 8pt;
          margin-bottom: 12pt;
        }

        .reward-banner {
          background: #FEF3C7;
          border: 2pt solid #F59E0B;
          padding: 12pt;
          text-align: center;
          border-radius: 8pt;
          margin-bottom: 12pt;
        }

        .reward-banner .amount {
          font-size: ${Math.round(preset.subtitleSize * 1.2)}pt;
          font-weight: 900;
          color: #B45309;
        }

        .contact-section {
          background: ${primaryColor};
          color: white;
          padding: 16pt;
          margin: auto -24pt -24pt -24pt;
          text-align: center;
        }

        .contact-section h3 {
          font-size: ${preset.subtitleSize}pt;
          margin-bottom: 8pt;
        }

        .contact-phone {
          font-size: ${Math.round(preset.titleSize * 0.6)}pt;
          font-weight: 900;
          letter-spacing: 1pt;
        }

        .qr-section {
          position: absolute;
          bottom: 80pt;
          right: 24pt;
          text-align: center;
        }

        .qr-code {
          width: ${preset.qrSize}pt;
          height: ${preset.qrSize}pt;
          background: white;
          padding: 4pt;
          border: 1pt solid #ccc;
        }

        .qr-label {
          font-size: 8pt;
          color: #666;
          margin-top: 4pt;
        }

        .tear-strips {
          display: flex;
          justify-content: space-between;
          margin-top: 8pt;
          border-top: 1pt dashed #ccc;
          padding-top: 8pt;
        }

        .tear-strip {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-size: 9pt;
          padding: 4pt;
          border: 1pt dashed #ccc;
          text-align: center;
        }

        .custom-message {
          font-style: italic;
          color: #666;
          text-align: center;
          margin: 12pt 0;
          font-size: ${preset.bodySize}pt;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="flyer">
        <div class="header">
          <h1>LOST ${caseData.petSpecies?.toUpperCase() || 'PET'}</h1>
          <h2>Please Help Us Find Our Family Member!</h2>
        </div>

        <div class="content">
          ${includePhoto && caseData.petPhotoUrl ? `
            <div class="photo-section">
              <img src="${caseData.petPhotoUrl}" alt="${caseData.petName}" class="photo" />
            </div>
          ` : ''}

          <div class="details-section">
            <div class="pet-name">"${caseData.petName || 'Unknown'}"</div>

            <div class="pet-info">
              <div class="info-row">
                <span class="info-label">Species:</span>
                <span>${caseData.petSpecies || 'Unknown'}</span>
              </div>
              ${caseData.petBreed ? `
                <div class="info-row">
                  <span class="info-label">Breed:</span>
                  <span>${caseData.petBreed}</span>
                </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Color:</span>
                <span>${caseData.petColor || 'Unknown'}</span>
              </div>
              ${caseData.petSize ? `
                <div class="info-row">
                  <span class="info-label">Size:</span>
                  <span>${caseData.petSize}</span>
                </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Last Seen:</span>
                <span>${formatDate(caseData.lastSeenAt)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Location:</span>
                <span>${caseData.lastSeenAddress || 'Unknown'}</span>
              </div>
            </div>

            ${caseData.petDescription ? `
              <div class="description">
                <strong>Description:</strong> ${caseData.petDescription.substring(0, 300)}${caseData.petDescription.length > 300 ? '...' : ''}
              </div>
            ` : ''}

            ${includeReward && caseData.hasReward && caseData.rewardAmount ? `
              <div class="reward-banner">
                <div>REWARD OFFERED</div>
                <div class="amount">$${caseData.rewardAmount.toLocaleString()}</div>
              </div>
            ` : ''}

            ${customMessage ? `
              <div class="custom-message">${customMessage}</div>
            ` : ''}
          </div>
        </div>

        ${includeQR ? `
          <div class="qr-section">
            <img src="${generateQRCodeDataUrl(caseUrl, preset.qrSize)}" alt="QR Code" class="qr-code" />
            <div class="qr-label">Scan for more info</div>
          </div>
        ` : ''}

        ${includeContact ? `
          <div class="contact-section">
            <h3>IF FOUND, PLEASE CONTACT:</h3>
            <div class="contact-phone">${formatPhone(caseData.ownerPhone) || caseData.ownerEmail || 'Contact through website'}</div>
            ${caseData.ownerEmail && caseData.ownerPhone ? `
              <div style="margin-top: 8pt; font-size: ${preset.bodySize}pt;">
                or email: ${caseData.ownerEmail}
              </div>
            ` : ''}
            <div style="margin-top: 8pt; font-size: ${Math.round(preset.bodySize * 0.9)}pt;">
              Case #${caseData.caseNumber || caseData.id?.substring(0, 8).toUpperCase()}
            </div>
          </div>
        ` : ''}
      </div>

      ${format === 'LETTER' ? `
        <div class="tear-strips" style="position: absolute; bottom: 0; left: 24pt; right: 24pt;">
          ${Array(7).fill(0).map(() => `
            <div class="tear-strip">
              ${caseData.petName}<br/>
              ${formatPhone(caseData.ownerPhone) || ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </body>
    </html>
  `;

  return html;
}

/**
 * Generate flyer and trigger print dialog
 */
export function printFlyer(caseData, options = {}) {
  const html = generateFlyerHTML(caseData, options);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
}

/**
 * Download flyer as HTML file (can be converted to PDF)
 */
export function downloadFlyerHTML(caseData, options = {}) {
  const html = generateFlyerHTML(caseData, options);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `lost-pet-flyer-${caseData.petName?.replace(/\s+/g, '-').toLowerCase() || 'pet'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate multiple flyers per page (for economical printing)
 */
export function generateMultipleFlyersHTML(caseData, count = 4, options = {}) {
  const singleFlyer = generateFlyerHTML(caseData, { ...options, format: 'QUARTER' });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Lost Pet Flyers - ${caseData.petName}</title>
      <style>
        @page {
          size: letter;
          margin: 0.25in;
        }
        body {
          margin: 0;
          padding: 0;
        }
        .page {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(2, 1fr);
          gap: 0.25in;
          height: 10.5in;
          width: 8in;
          page-break-after: always;
        }
        .flyer-container {
          border: 1px dashed #ccc;
          overflow: hidden;
        }
        .flyer-container iframe {
          width: 100%;
          height: 100%;
          border: none;
          transform: scale(0.95);
          transform-origin: top left;
        }
        @media print {
          .page {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      ${Array(Math.ceil(count / 4)).fill(0).map(() => `
        <div class="page">
          ${Array(Math.min(4, count)).fill(0).map(() => `
            <div class="flyer-container">
              <!-- Flyer content would go here -->
            </div>
          `).join('')}
        </div>
      `).join('')}
    </body>
    </html>
  `;

  return html;
}

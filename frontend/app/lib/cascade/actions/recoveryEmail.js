/**
 * recovery_email action (tier 2) — the branded "everything you need to bring
 * them home" email, with the print-ready Letter flyer attached and links back
 * to the live recovery kit. This is the email that makes reporting here feel
 * unmistakably worth it.
 *
 * Phone-only reporters (placeholder email) are SKIPPED: they already got the
 * case link over SMS at intake, so this action never spams a second text.
 */

import prisma from '@/app/lib/prisma';
import { sendEmail, renderBrandedEmail } from '@/app/lib/email';
import { isPlaceholderEmail } from '@/app/lib/placeholderEmail';
import { getEmailBaseUrl } from '@/app/lib/config';

const SPECIES_WORD = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit', OTHER: 'pet' };

/** Best-effort fetch of the stored Letter flyer so we can attach it. */
async function loadLetterFlyer(caseId, petName) {
  try {
    const asset = await prisma.caseAsset.findUnique({
      where: { caseId_kind: { caseId, kind: 'FLYER_LETTER' } },
    });
    if (!asset || asset.status !== 'ready' || !asset.url) return null;
    const resp = await fetch(asset.url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length) return null;
    const safeName = String(petName || 'pet').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'pet';
    return { filename: `${safeName}-flyer.pdf`, content: buf, contentType: 'application/pdf' };
  } catch {
    return null;
  }
}

export async function runRecoveryEmail(ctx) {
  const c = ctx.case;
  const email = c.ownerEmail;

  if (!email || isPlaceholderEmail(email)) {
    const skip = new Error('phone-only reporter — case link already sent via SMS at intake');
    skip.skip = true;
    throw skip;
  }

  const baseUrl = getEmailBaseUrl();
  const caseUrl = `${baseUrl}/cases/${c.caseNumber}`;
  const petName = c.petName || 'your pet';
  const speciesWord = SPECIES_WORD[c.petSpecies] || 'pet';

  const reporter = await prisma.user
    .findUnique({ where: { id: c.reporterId }, select: { name: true } })
    .catch(() => null);
  const firstName = reporter?.name ? reporter.name.split(/\s+/)[0] : '';

  const ai = ctx.results.ai_copy || {};
  const opener =
    ai.plea ||
    `We know how frightening this is. The moment you posted, we went to work so you don't have to do this alone — here's everything we built to bring ${petName} home.`;

  const attachment = await loadLetterFlyer(c.id, petName);

  const kitList = [
    'Print-ready flyers (a classic poster, tear-off tabs, and a big yard sign) — the Letter poster is attached to this email',
    'Ready-to-post images and captions for Facebook, Nextdoor, and Instagram',
    'A scannable QR code that brings anyone straight to your case page',
    `A first-24-hours search plan tailored to a lost ${speciesWord}`,
    'A shortlist of nearby shelters to call, and any possible matches we already found',
  ];

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi${firstName ? ` ${firstName}` : ''},</p>
    <p style="margin:0 0 16px;">${opener}</p>
    <p style="margin:0 0 8px; font-weight:700; color:#0f172a;">Inside your recovery kit:</p>
    <ul style="margin:0 0 16px; padding-left:20px;">
      ${kitList.map((item) => `<li style="margin:0 0 8px;">${item}</li>`).join('')}
    </ul>
    <p style="margin:0 0 4px;">Everything stays on your case page — open it any time, add a photo, or download a fresh flyer.</p>
    ${attachment ? '' : '<p style="margin:12px 0 0; font-size:14px; color:#94a3b8;">Your printable flyer is ready on the case page (the download button under “Share kit”).</p>'}
  `;

  const html = renderBrandedEmail({
    preheader: `Your flyers, share images, and search plan for ${petName} are ready.`,
    heading: `Everything you need to bring ${petName} home`,
    bodyHtml,
    ctaLabel: 'Open your recovery kit',
    ctaUrl: caseUrl,
    footnote: `Case ${c.caseNumber}`,
  });

  await sendEmail({
    to: email,
    subject: `Your recovery kit for ${petName} is ready`,
    html,
    attachments: attachment ? [attachment] : undefined,
  });

  return { count: 1, result: { sent: true, attachedFlyer: Boolean(attachment) } };
}

/**
 * What the site has already made for a pet that its search can use.
 *
 * When a pet is reported the site makes a kit for it (app/lib/cascade):
 * three flyers as PDFs, share pictures, the words of a post, the nearest
 * shelters with their phone numbers, and the local groups to post in. The
 * pet's page shows it under "share". The search's tasks used none of it
 * (founder, 2026-11-13: "Why are we acting as though all these assets
 * cannot assist in the mission control").
 *
 * This reads the kit as the tasks need it. Which task uses which part,
 * and what each is called, is `gearFor` in app/lib/searchPlan.js.
 *
 * Nothing here is private: the same files and lines are on the pet's
 * public page. A link that is not a plain https address, or a phone that
 * is not a number, is left out rather than passed on.
 */
import prisma from '@/app/lib/prisma';

/** The files a task can hand over, by the kit's own names for them. */
export const KIT_FILES = ['FLYER_POSTER', 'FLYER_LETTER', 'FLYER_HALF', 'SOCIAL_SQUARE', 'SOCIAL_STORY'];

const web = (url) => (typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null);
const line = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
function phoneOf(text) {
  const kept = String(text || '').replace(/[^\d+]/g, '');
  return kept.replace(/\D/g, '').length >= 7 ? kept : null;
}

/**
 * The kit as the tasks use it: { files: { KIND: url }, caption, shelters:
 * [{ name, phone, miles }], groups: [{ name, url }] }. `assets` and
 * `steps` are the kit's rows (CaseAsset, CascadeStep).
 */
export function kitFrom({ assets = [], steps = [] } = {}) {
  const files = {};
  for (const asset of assets) {
    if (asset && KIT_FILES.includes(asset.kind) && asset.status === 'ready' && web(asset.url)) files[asset.kind] = asset.url;
  }
  const result = Object.fromEntries(steps.filter((s) => s && s.result && typeof s.result === 'object').map((s) => [s.key, s.result]));
  const captions = result.ai_copy?.captions || {};
  const caption = [captions.facebook, captions.nextdoor].find((c) => typeof c === 'string' && c.trim()) || '';
  const shelters = (Array.isArray(result.shelters?.shelters) ? result.shelters.shelters : [])
    .map((s) => ({ name: line(s?.name, 80), phone: phoneOf(s?.phone), miles: Number.isFinite(s?.distanceMi) ? s.distanceMi : null }))
    .filter((s) => s.name)
    .slice(0, 8);
  const groups = (Array.isArray(result.share_targets?.targets) ? result.share_targets.targets : [])
    .map((t) => ({ name: line(t?.name, 120), url: web(t?.url) }))
    .filter((t) => t.name && t.url)
    .slice(0, 6);
  return { files, caption: caption.trim().slice(0, 2000), shelters, groups };
}

/** The kit of one pet, or null when the site made none (a pet reported before the kit existed). */
export async function readKit(caseId) {
  const kit = await prisma.caseActivation
    .findUnique({
      where: { caseId },
      select: {
        assets: { where: { status: 'ready' }, select: { kind: true, status: true, url: true } },
        steps: { where: { key: { in: ['ai_copy', 'shelters', 'share_targets'] } }, select: { key: true, result: true } },
      },
    })
    .catch(() => null);
  return kit ? kitFrom(kit) : null;
}

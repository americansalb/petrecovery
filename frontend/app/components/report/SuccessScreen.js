'use client';

/**
 * SuccessScreen - shared post-submit screen for both wizards.
 *
 * Lost: case number, squad/patrol notification summary, share tools.
 * Found: potential matches (shared MatchCard, §4d no-PII payload) are the
 * hero content; otherwise shelter/vet guidance.
 */

import Link from 'next/link';
import { Check, Sparkles, Camera, Copy, Share2, Heart, Mail, Facebook, MessageSquare } from 'lucide-react';
import { MatchCard } from '@/components/case/MatchCard';
import { WIZARD_THEMES } from './wizardTheme';
import RecoveryKit from './recoveryKit/RecoveryKit';

export default function SuccessScreen({
  variant = 'lost',
  caseNumber,
  petName,
  photoMissing = false,
  isLoggedIn = false,
  accountCreated = false,
  contactEmail,
  contactPhone, // phone-only guests: where the case-link SMS went
  // lost
  squadsNotified = 0,
  assignedSquad,
  activation, // { caseNumber, status } snapshot from the create response; drives the live Recovery Kit
  // found
  matches = [],
  matchesNotified = 0,
}) {
  const theme = WIZARD_THEMES[variant];
  const caseUrl = caseNumber ? `/cases/${caseNumber}` : '/dashboard';
  const shareUrl = typeof window !== 'undefined' && caseNumber ? `${window.location.origin}/cases/${caseNumber}` : '';

  const share = () => {
    if (!shareUrl) return;
    if (navigator.share) {
      navigator
        .share({ title: variant === 'lost' ? `Help find ${petName}!` : 'Found pet - help find the owner', url: shareUrl })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareUrl);
    }
  };

  const nextSteps =
    variant === 'lost'
      ? [
          'Print your flyers and post them near the last-seen spot',
          'Share your case link to Facebook, Nextdoor, and group chats',
          'Call nearby shelters today and file a lost report with each',
        ]
      : [
          'Strong matches alert the owner automatically',
          'A vet or shelter can scan for a microchip - free',
          'Keep them somewhere calm and safe if you can',
        ];

  return (
    <div className="flex-1 overflow-y-auto animate-slide-up">
      <div className="w-full max-w-xl mx-auto px-5 sm:px-8 py-8 lg:py-12 text-center">
        {/* Hero */}
        <div className="relative inline-block mb-5">
          <span className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-[#0B1133]">
            <Check size={40} className="text-[#F2D21B]" strokeWidth={3} />
          </span>
          <Sparkles size={20} className="absolute -top-1 -right-2 text-flash-400" />
          <Sparkles size={15} className="absolute -bottom-1 -left-2 text-flash-400" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-midnight-900">
          {variant === 'lost' ? 'Your alert is live' : 'Report posted - thank you'}
        </h1>

        {caseNumber && (
          <p className="inline-block mt-3 px-4 py-2 rounded-xl bg-midnight-100 text-sm">
            <span className="text-midnight-500">Case </span>
            <span className="font-mono font-bold text-midnight-900">{caseNumber}</span>
          </p>
        )}

        <p className="text-midnight-500 mt-3">
          {variant === 'lost' ? (
            squadsNotified > 0 ? (
              <>
                <strong className="text-midnight-800">{squadsNotified}</strong> rescue{' '}
                {squadsNotified === 1 ? 'team is' : 'teams are'} on alert for{' '}
                <strong className="text-midnight-800">{petName}</strong>.
              </>
            ) : (
              <>
                Neighbors near the last-seen spot will see <strong className="text-midnight-800">{petName}</strong>
                &apos;s report.
              </>
            )
          ) : matchesNotified > 0 ? (
            <>
              <strong className="text-midnight-800">{matchesNotified}</strong>{' '}
              {matchesNotified === 1 ? 'owner has' : 'owners have'} been alerted about a possible match.
            </>
          ) : (
            'We checked every nearby lost-pet report and will keep matching as new ones come in.'
          )}
        </p>

        {/* Found: matches are the payoff */}
        {variant === 'found' && matches.length > 0 && (
          <div className="mt-8 text-left">
            <h2 className="text-lg font-extrabold text-midnight-900">
              Possible matches near you ({matches.length})
            </h2>
            <p className="text-sm text-midnight-500 mt-1 mb-4">
              We compared your report with lost pets nearby. Strong matches alert the owner automatically.
            </p>
            <div className="space-y-3">
              {matches.slice(0, 5).map((match) => (
                <MatchCard
                  key={match.reportId}
                  connectAvailable={false}
                  match={{
                    matchId: match.reportId,
                    petPhoto: match.petPhoto,
                    petName: match.petName,
                    species: match.petSpecies,
                    coarseArea: match.coarseArea,
                    pTrueMatch: match.pTrueMatch,
                    matchSource: match.matchSource,
                    band: match.band,
                    canConnect: match.canConnect,
                  }}
                />
              ))}
            </div>
            {matches.length > 5 && (
              <p className="text-center text-sm text-midnight-400 mt-3">
                +{matches.length - 5} more potential matches
              </p>
            )}
          </div>
        )}

        {/* Photo nudge if skipped */}
        {photoMissing && (
          <div className="mt-6 p-4 rounded-2xl bg-flash-50 border border-flash-200 flex items-start gap-3 text-left">
            <span className="w-9 h-9 rounded-full bg-flash-400 flex items-center justify-center shrink-0">
              <Camera size={17} className="text-midnight-900" />
            </span>
            <div className="text-sm">
              <p className="font-bold text-midnight-900">Got a photo later?</p>
              <p className="text-midnight-600 mt-0.5">
                Reports with photos get far more sightings - add one anytime from your case page.
              </p>
            </div>
          </div>
        )}

        {/* Phone-only guests: the SMS is their only way back to the case */}
        {!contactEmail && contactPhone && (
          <div className="mt-4 p-4 rounded-2xl bg-[#F3EFE7] border border-[#E5E0D4] flex items-start gap-3 text-left">
            <MessageSquare size={19} className="text-[#0B1133] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-[#0A0D26]">We texted you the link</p>
              <p className="text-[#6B6459] mt-0.5">
                Check <strong>{contactPhone}</strong> for your case link. Save it, it&apos;s how you
                manage this report.
              </p>
            </div>
          </div>
        )}

        {/* Account created note for guests */}
        {accountCreated && contactEmail && (
          <div className="mt-4 p-4 rounded-2xl bg-[#F3EFE7] border border-[#E5E0D4] flex items-start gap-3 text-left">
            <Mail size={19} className="text-[#0B1133] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-[#0A0D26]">Check your inbox</p>
              <p className="text-[#6B6459] mt-0.5">
                We sent a link to <strong>{contactEmail}</strong> so you can manage this report and get updates.
              </p>
            </div>
          </div>
        )}

        {/* Squad joined (lost) */}
        {variant === 'lost' && assignedSquad && (
          <div className="mt-4 p-4 rounded-2xl bg-[#F3EFE7] border border-[#E5E0D4] flex items-start gap-3 text-left">
            <Heart size={19} className="text-[#0B1133] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-[#0A0D26]">You&apos;ve joined {assignedSquad.name}</p>
              <p className="text-[#6B6459] mt-0.5">Your neighbors are ready to help search.</p>
            </div>
          </div>
        )}

        {/* What happens next - the static fallback shown when there's no live cascade */}
        {(() => {
          const whatHappensNext = (
            <div className="mt-6 p-5 rounded-2xl bg-white border border-midnight-100 shadow-card text-left">
              <h3 className="font-bold text-midnight-900 mb-3.5">What happens next</h3>
              <ol className="space-y-3">
                {nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-px text-white ${theme.accentBg}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm text-midnight-600">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          );

          // Lost reports fire the cascade - show the live Recovery Kit, which
          // falls back to the static list if the activation never seeded.
          if (variant === 'lost' && caseNumber && activation) {
            return (
              <div className="mt-6">
                <RecoveryKit
                  caseNumber={caseNumber}
                  initialStatus={activation.status}
                  fallback={whatHappensNext}
                  petName={petName}
                  shareUrl={shareUrl}
                  onShare={share}
                />
              </div>
            );
          }
          return whatHappensNext;
        })()}

        {/* CTAs */}
        <div className="mt-6 space-y-3">
          {caseNumber && (
            <Link
              href={caseUrl}
              className="block w-full py-4 rounded-2xl font-extrabold text-lg transition-all bg-[#0B1133] text-[#F2D21B] hover:opacity-95 shadow-lg"
            >
              View {variant === 'lost' ? 'your' : 'the'} case page
            </Link>
          )}
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="block w-full py-3.5 rounded-2xl font-semibold text-midnight-700 bg-midnight-100 hover:bg-midnight-200 transition-colors"
            >
              Back to dashboard
            </Link>
          )}
        </div>

        {/* Share */}
        {caseNumber && (
          <div className="mt-8 pt-6 border-t border-midnight-100">
            <p className="text-sm text-midnight-400 mb-3">Every share is another pair of eyes:</p>
            <div className="flex justify-center gap-2.5">
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-midnight-100 text-midnight-700 text-sm font-semibold hover:bg-midnight-200 transition-colors"
              >
                {typeof navigator !== 'undefined' && navigator.share ? <Share2 size={15} /> : <Copy size={15} />}
                {typeof navigator !== 'undefined' && navigator.share ? 'Share' : 'Copy link'}
              </button>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1133] text-[#FFF9EE] text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Facebook size={15} />
                Facebook
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

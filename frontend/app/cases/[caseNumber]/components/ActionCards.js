'use client';

/**
 * ActionCards - Primary ways to help find the pet
 *
 * Design: Typography-first with colored accents, no generic icons.
 * Each action has a distinctive visual identity through color + text.
 *
 * Priority order:
 * 1. Share Alert (amplification)
 * 2. Boost This Search (fund digital reach - when enabled)
 * 3. Check Shelters
 * 4. Print Flyers
 * 5. Join Search Party
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Phone } from 'lucide-react';
import { useSession } from 'next-auth/react';

// Text-first action card with colored accent
function ActionCard({
  href,
  onClick,
  title,
  description,
  accentColor,
  badge,
  emoji,
  external = false,
  variant = 'default' // 'default' | 'primary' | 'highlight'
}) {
  const baseStyles = "block w-full rounded-2xl overflow-hidden transition group text-left";

  const variantStyles = {
    primary: "bg-midnight-900 hover:bg-midnight-800 text-white shadow-lg",
    highlight: "bg-flash-50 hover:bg-flash-100 border-2 border-flash-300 text-midnight-900",
    default: "bg-white hover:bg-midnight-50 border border-midnight-200 shadow-sm text-midnight-900"
  };

  const content = (
    <div className="flex items-stretch">
      {/* Colored accent bar */}
      <div className={`w-1.5 ${accentColor} flex-shrink-0`} />

      {/* Content */}
      <div className="flex-1 flex items-center gap-4 px-5 py-4">
        {/* Emoji if provided */}
        {emoji && (
          <span className="text-2xl flex-shrink-0">{emoji}</span>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-bold text-lg ${variant === 'primary' ? 'text-white' : 'text-midnight-900'}`}>
              {title}
            </p>
            {badge && (
              <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                {badge}
              </span>
            )}
          </div>
          <p className={`text-sm mt-0.5 ${variant === 'primary' ? 'text-white/70' : 'text-midnight-500'}`}>
            {description}
          </p>
        </div>

        {/* Arrow */}
        <ChevronRight className={`w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition ${
          variant === 'primary' ? 'text-white/40' : 'text-midnight-300'
        }`} />
      </div>
    </div>
  );

  const className = `${baseStyles} ${variantStyles[variant]}`;

  if (onClick) {
    return <button onClick={onClick} className={className}>{content}</button>;
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return <Link href={href} className={className}>{content}</Link>;
}

export default function ActionCards({
  caseNumber,
  caseData,
  onShare,
  onReportSighting
}) {
  const { status: authStatus } = useSession();
  const locationQuery = encodeURIComponent(caseData?.lastSeenAddress || '');
  const searcherCount = caseData?.activeSearchers || 0;
  // Signed-in helpers get the full board; strangers get the no-account
  // join flow instead of Mission Control's sign-in gate.
  const joinHref =
    authStatus === 'authenticated'
      ? `/mission-control?mission=${caseNumber}`
      : `/join/${caseData?.id || caseNumber}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="space-y-4"
    >
      <h2 className="font-bold text-midnight-900 text-lg">How You Can Help</h2>

      <div className="space-y-3">
        {/* 1. Share Alert */}
        <ActionCard
          onClick={onShare}
          title="Share This Alert"
          description="Spread the word to your community"
          accentColor="bg-midnight-600"
          emoji="📣"
          variant="primary"
        />

        {/* 2. Boost This Search */}
        {caseData?.adFundEnabled && (
          <ActionCard
            href={`/mission-control?mission=${caseNumber}&tab=boost`}
            title="Boost This Search"
            description="Reach thousands more neighbors"
            accentColor="bg-flash-400"
            emoji="⚡"
            variant="highlight"
          />
        )}

        {/* 3. Check Shelters */}
        <ActionCard
          href={`/shelters?location=${locationQuery}&case=${caseNumber}`}
          title="Check Nearby Shelters"
          description="Many lost pets are found here"
          accentColor="bg-purple-500"
          badge="Important"
        />

        {/* 4. Print Flyers - jump to the ready-made flyers/social kit below */}
        <ActionCard
          href="#share-kit"
          title="Print Flyers"
          description="Ready-made flyers & share images below"
          accentColor="bg-amber-500"
        />

        {/* 5. Join Search Party */}
        <ActionCard
          href={joinHref}
          title="Join Search Party"
          description={searcherCount > 0 ? `${searcherCount} people searching now` : 'Be the first to join'}
          accentColor="bg-emerald-500"
        />
      </div>

      {/* Contact Owner */}
      {caseData?.contact?.phone && (
        <div className="pt-4 border-t border-midnight-100">
          <a
            href={`tel:${caseData.contact.phone}`}
            className="flex items-center justify-center gap-2 py-3 text-midnight-600 hover:text-midnight-900 font-medium transition"
          >
            <Phone className="w-4 h-4" />
            Contact Owner Directly
          </a>
        </div>
      )}
    </motion.div>
  );
}

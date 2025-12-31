'use client';

/**
 * ActionCards - Primary ways to help find the pet
 *
 * Priority order:
 * 1. Report Sighting (primary conversion) - in hero/sticky
 * 2. Share Alert (amplification)
 * 3. Boost This Search (fund digital reach - when enabled)
 * 4. Check Shelters (many pets end up there!)
 * 5. Print Flyers
 * 6. Join Search Party
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Share2, Building2, Printer, Users, Zap,
  ChevronRight, Phone, ExternalLink
} from 'lucide-react';

// Action card component
function ActionCard({
  href,
  onClick,
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  badge,
  external = false,
  priority = 'secondary' // 'primary' | 'secondary' | 'tertiary'
}) {
  const baseStyles = "block w-full rounded-2xl p-4 transition group text-left";

  const priorityStyles = {
    primary: "bg-midnight-900 hover:bg-midnight-800 text-white shadow-lg",
    secondary: "bg-white hover:bg-midnight-50 border border-midnight-200 shadow text-midnight-900",
    tertiary: "bg-midnight-50 hover:bg-midnight-100 border border-midnight-100 text-midnight-900"
  };

  const content = (
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition flex-shrink-0`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-lg">{title}</p>
          {badge && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-sm ${priority === 'primary' ? 'text-white/80' : 'text-midnight-500'}`}>
          {description}
        </p>
      </div>
      <ChevronRight className={`w-5 h-5 ${priority === 'primary' ? 'text-white/50' : 'text-midnight-300'} group-hover:translate-x-1 transition flex-shrink-0`} />
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={`${baseStyles} ${priorityStyles[priority]}`}>
        {content}
      </button>
    );
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseStyles} ${priorityStyles[priority]}`}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={`${baseStyles} ${priorityStyles[priority]}`}>
      {content}
    </Link>
  );
}

export default function ActionCards({
  caseNumber,
  caseData,
  onShare,
  onReportSighting
}) {
  const locationQuery = encodeURIComponent(caseData?.lastSeenAddress || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="space-y-4"
    >
      <h2 className="font-bold text-midnight-900 text-lg">How You Can Help</h2>

      <div className="space-y-3">
        {/* 1. Share Alert - Primary for amplification */}
        <ActionCard
          onClick={onShare}
          icon={Share2}
          iconBg="bg-white/20"
          iconColor="text-white"
          title="Share This Alert"
          description="Help spread the word to your community"
          priority="primary"
        />

        {/* 2. Boost This Search - Help fund digital reach */}
        {caseData?.adFundEnabled && (
          <ActionCard
            href={`/mission-control?mission=${caseNumber}&tab=boost`}
            icon={Zap}
            iconBg="bg-flash-400"
            iconColor="text-midnight-900"
            title="Boost This Search"
            description="Help reach thousands more neighbors nearby"
            priority="secondary"
          />
        )}

        {/* 3. Check Shelters */}
        <ActionCard
          href={`/shelters?location=${locationQuery}&case=${caseNumber}`}
          icon={Building2}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          title="Check Nearby Shelters"
          description="Many lost pets end up at shelters"
          badge="Important"
          priority="secondary"
        />

        {/* 4. Print Flyers */}
        <ActionCard
          href={`/mission-control?mission=${caseNumber}&tab=flyer`}
          icon={Printer}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          title="Print Flyers"
          description="Post in your neighborhood"
          priority="secondary"
        />

        {/* 5. Join Search Party */}
        <ActionCard
          href={`/mission-control?mission=${caseNumber}`}
          icon={Users}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
          title="Join Search Party"
          description={`${caseData?.activeSearchers || 0} people actively searching`}
          priority="secondary"
        />
      </div>

      {/* Contact Owner - Secondary action */}
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

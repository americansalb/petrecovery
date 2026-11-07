'use client';

/**
 * ReviewPosterCard - the review screen's heart: the flyer itself, drawn
 * from the answers (FlyerPreview), and under it each line of the report
 * as a row that taps back to its step via onEdit.
 */

import { Pencil } from 'lucide-react';
import FlyerPreview from './FlyerPreview';

export default function ReviewPosterCard({
  variant = 'lost',
  flyer = {}, // FlyerPreview props
  rows = [], // [{ id, icon: Icon, label, value }] - id is the step to edit
  onEdit, // (stepId) => void; omit for a read-only poster
}) {
  return (
    <div className="space-y-4">
      <div className="max-w-[350px]">
        <FlyerPreview {...flyer} variant={variant} className="shadow-card-hover" />
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl border border-midnight-200 bg-white px-4 divide-y divide-midnight-100">
          {rows.map((row) => {
            const RowIcon = row.icon;
            const Tag = onEdit ? 'button' : 'div';
            return (
              <Tag
                key={row.id}
                {...(onEdit
                  ? { type: 'button', onClick: () => onEdit(row.id), 'aria-label': `Change ${row.label.toLowerCase()}` }
                  : {})}
                className={`w-full flex items-center gap-3 min-h-[52px] py-2 text-left ${
                  onEdit ? 'hover:bg-midnight-50 -mx-2 px-2 rounded-lg transition-colors' : ''
                }`}
              >
                {RowIcon && <RowIcon size={17} className="text-midnight-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-midnight-500">{row.label}</p>
                  <p className="text-[15px] font-semibold text-midnight-900 truncate">{row.value || 'Not answered'}</p>
                </div>
                {onEdit && <Pencil size={15} className="text-midnight-400 shrink-0" aria-hidden="true" />}
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
}

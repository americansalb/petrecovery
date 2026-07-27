'use client';

/**
 * ReviewPosterCard - the "neighborhood board" poster preview.
 *
 * Shown on the review/fork screen (every row taps back to its step via
 * onEdit) and reused on the success screen as the share visual.
 */

import { Pencil } from 'lucide-react';
import { WIZARD_THEMES, SPECIES_ICONS } from './wizardTheme';

export default function ReviewPosterCard({
  variant = 'lost',
  photoUrl,
  species = 'other',
  petName,
  chips = [], // strings: colors, size, breed…
  rows = [], // [{ id, icon: Icon, label, value }] - id is the step to edit
  onEdit, // (stepId) => void; omit for a read-only poster
}) {
  const theme = WIZARD_THEMES[variant];
  const SpeciesIcon = SPECIES_ICONS[species] || SPECIES_ICONS.other;

  return (
    <div className="rounded-3xl overflow-hidden bg-white border border-midnight-100 shadow-card-hover max-w-md">
      {/* Photo / placeholder with stamp */}
      <div className="relative">
        {photoUrl ? (
          <img src={photoUrl} alt={petName ? `Photo of ${petName}` : 'Pet photo'} className="w-full aspect-[4/3] object-cover" />
        ) : (
          <div className={`w-full aspect-[4/3] flex flex-col items-center justify-center ${theme.posterGrad}`}>
            <SpeciesIcon size={72} className="text-white/90 drop-shadow" />
            <span className="mt-3 px-3 py-1 rounded-full bg-white/25 text-white text-xs font-semibold backdrop-blur">
              No photo yet
            </span>
          </div>
        )}
        <span
          className={`absolute top-4 right-4 px-3.5 py-1.5 rounded-md text-sm font-black tracking-[0.2em] uppercase rotate-3 shadow-lg border-2 border-white/60 ${theme.stampChip}`}
        >
          {theme.stamp}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        <p className="text-2xl font-extrabold tracking-tight text-midnight-900 leading-none">
          {petName || 'Unknown friend'}
        </p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.filter(Boolean).map((chip, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full bg-midnight-100 text-midnight-700 text-xs font-semibold"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4 divide-y divide-midnight-100 border-t border-midnight-100">
            {rows.map((row) => {
              const RowIcon = row.icon;
              const Tag = onEdit ? 'button' : 'div';
              return (
                <Tag
                  key={row.id}
                  {...(onEdit
                    ? { type: 'button', onClick: () => onEdit(row.id), 'aria-label': `Edit ${row.label}` }
                    : {})}
                  className={`w-full flex items-center gap-3 py-3 text-left group ${
                    onEdit ? 'hover:bg-midnight-50 -mx-2 px-2 rounded-lg transition-colors' : ''
                  }`}
                >
                  {RowIcon && <RowIcon size={17} className="text-midnight-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-midnight-400">
                      {row.label}
                    </p>
                    <p className="text-sm font-medium text-midnight-800 truncate">{row.value || '-'}</p>
                  </div>
                  {onEdit && (
                    <Pencil
                      size={14}
                      className="text-midnight-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  )}
                </Tag>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

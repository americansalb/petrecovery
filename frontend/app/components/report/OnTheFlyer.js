/**
 * OnTheFlyer - the sentence an answer puts on the flyer, shown under the
 * question the moment it is answered. Yellow like the flyer itself, so the
 * owner sees what a stranger will read.
 */

export default function OnTheFlyer({ label = 'On the flyer', line, children, className = '' }) {
  if (!line && !children) return null;
  return (
    <div className={`rounded-xl border border-flash-200 bg-flash-50 px-3.5 py-3 ${className}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-flash-900">{label}</p>
      {line && <p className="mt-1 text-[15px] font-bold leading-snug text-midnight-900">{line}</p>}
      {children}
    </div>
  );
}

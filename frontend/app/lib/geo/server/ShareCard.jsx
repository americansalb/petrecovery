/**
 * The link-preview card for a shared game (1200x630), rendered by satori.
 * satori rules: every box with more than one child is display: flex, and
 * only the font families we bundle exist.
 */

const NAVY = '#0f172a';
const NAVY_SOFT = '#1e293b';
const YELLOW = '#facc15';
const PAPER = '#f8fafc';
const MUTED = '#94a3b8';

function barColor(score) {
  if (score >= 4500) return '#22c55e';
  if (score >= 3000) return YELLOW;
  if (score >= 1000) return '#f97316';
  return '#ef4444';
}

export function ShareCard({ headline, subline, rounds, footer, mode }) {
  const isStreak = mode === 'streak';
  const bars = rounds.slice(0, 12);
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: NAVY,
        color: PAPER,
        padding: '56px 64px',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: YELLOW, marginRight: 14 }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Where on Earth</div>
        </div>
        <div style={{ fontSize: 24, color: MUTED }}>reunitepets.org/geo</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 116, fontWeight: 900, letterSpacing: -4, lineHeight: 1 }}>{headline}</div>
        <div style={{ fontSize: 34, color: MUTED, marginTop: 18 }}>{subline}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 120 }}>
          {bars.map((round, i) => {
            const height = isStreak ? (round.correct ? 120 : 24) : Math.max(10, Math.round((round.score / 5000) * 120));
            const color = isStreak ? (round.correct ? '#22c55e' : '#ef4444') : barColor(round.score);
            return (
              <div
                key={i}
                style={{
                  width: 44,
                  height,
                  marginRight: 14,
                  borderRadius: 8,
                  backgroundColor: color,
                }}
              />
            );
          })}
          {bars.length === 0 ? <div style={{ height: 120, width: 4, backgroundColor: NAVY_SOFT }} /> : null}
        </div>
        <div style={{ fontSize: 26, color: MUTED }}>{footer}</div>
      </div>
    </div>
  );
}

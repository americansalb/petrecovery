/** The current server-defined leagues; no decorative or invented player rank. */
import { Gem, Shield, Trophy } from 'lucide-react';
import { TIERS } from '@/app/lib/geo/rating';
export default function RankPath() {
  return (
    <div className="pe-rank-path" aria-label="Leagues from lowest to highest">
      {TIERS.map((tier, i) => (
        <div className="pe-rank-step" key={tier.name}>
          <div className="pe-rank-badge" style={{ '--rank-color': tier.color }}>
            {i > 3 ? (
              <Gem size={28} strokeWidth={1.3} />
            ) : i === 3 ? (
              <Trophy size={27} strokeWidth={1.3} />
            ) : (
              <Shield size={27} strokeWidth={1.3} />
            )}
          </div>
          <span>{tier.name}</span>
        </div>
      ))}
    </div>
  );
}

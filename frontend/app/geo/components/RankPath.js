/** The current server-defined leagues; no decorative or invented player rank. */
import RankEmblem from "./RankEmblem";
import { TIERS } from "@/app/lib/geo/rating";
export default function RankPath() {
  return (
    <div className="pe-rank-path" aria-label="Leagues from lowest to highest">
      {TIERS.map((tier) => (
        <div className="pe-rank-step" key={tier.name}>
          <RankEmblem tier={tier.name} decorative />
          <span>{tier.name}</span>
          <small className="pe-rank-cutoff">{tier.label}</small>
        </div>
      ))}
    </div>
  );
}

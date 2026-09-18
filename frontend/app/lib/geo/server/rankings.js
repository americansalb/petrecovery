import { PROVISIONAL_GAMES, tierFor } from '../rating';
import { seasonFor } from '../season';

// One population snapshot per ladder/request. Never calculate percentiles
// from the visible (paginated) first 50 rows. The launch pool is deliberately
// small; this can later become a database window query without changing rules.
export async function rankingViews(store, ladder, season = seasonFor().key) {
  const rows = await store.listLeaderboard(ladder, { limit: null, minGames: PROVISIONAL_GAMES, season });
  const population = rows.length;
  return rows.map((row, index) => {
    const accuracy = row.scoredRounds > 0 ? Math.max(0, Math.min(1, (row.scoredPoints || 0) / (row.scoredRounds * 5000))) : null;
    const position = { rank: index + 1, population, games: row.games, accuracy };
    return { ...row, ...position, percentile: population ? (index + 1) / population : null, tier: tierFor(position) };
  });
}

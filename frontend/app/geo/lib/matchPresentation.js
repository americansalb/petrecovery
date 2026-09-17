import { PROVISIONAL_GAMES, placementsFrom } from "@/app/lib/geo/rating";
import { sortStandings } from "@/app/lib/geo/rooms";

/** Rating placements cover profile holders; match standings include everyone. */
export function matchStandings(players, variant) {
  const sorted = sortStandings(players, variant);
  const places = placementsFrom(sorted, (player) =>
    variant === "duel"
      ? player.eliminated
        ? 0
        : player.hp || 0
      : player.score || 0,
  );
  return sorted.map((player, i) => ({ ...player, placement: places[i] }));
}

/** Presentation follows server results, including ties and missed rounds. */
export function roundOutcome(state) {
  const guesses = state.reveal?.guesses || [];
  const mine = guesses.find((g) => g.playerId === state.me?.id);
  const leaders = guesses.filter(
    (g) => g.rank === 1 && !g.timedOut && g.score > 0,
  );
  const player = state.players?.find((p) => p.id === state.me?.id);
  if (mine?.timedOut)
    return { title: "No pin this round.", tone: "quiet", mine };
  if (state.room.variant === "duel" && player?.eliminated && mine?.damage > 0)
    return { title: "Out of this duel.", tone: "loss", mine };
  if (!leaders.length)
    return { title: "No points this round.", tone: "quiet", mine };
  if (leaders.some((g) => g.playerId === state.me?.id))
    return {
      title: leaders.length > 1 ? "A shared round win." : "You took the round.",
      tone: "win",
      mine,
    };
  const leader = state.players?.find((p) => p.id === leaders[0].playerId);
  return {
    title:
      leaders.length > 1
        ? "A tie at the top."
        : `${leader?.name || "Your rival"} takes the round.`,
    tone: "rival",
    mine,
  };
}

export function placedLeague(player) {
  const rating = player?.rating;
  return rating && !rating.provisional && rating.games >= PROVISIONAL_GAMES
    ? rating.tier
    : null;
}

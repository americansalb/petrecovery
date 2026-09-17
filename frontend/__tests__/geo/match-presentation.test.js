const {
  roundOutcome,
  placedLeague,
  matchStandings,
} = require("@/app/geo/lib/matchPresentation");

test("match winners include unranked players, independent of rating placements", () => {
  const players = [
    { id: "rated", score: 2000, placement: 1 },
    { id: "guest", score: 4500, placement: null },
  ];
  expect(
    matchStandings(players, "classic").map((p) => [p.id, p.placement]),
  ).toEqual([
    ["guest", 1],
    ["rated", 2],
  ]);
  expect(players[0].placement).toBe(1);
});
test("unrated equal scores share first place", () => {
  const players = [
    { id: "a", name: "A", score: 4000, roundWins: 2 },
    { id: "b", name: "B", score: 4000, roundWins: 1 },
    { id: "c", score: 2000 },
  ];
  expect(matchStandings(players, "classic").map((p) => p.placement)).toEqual([
    1, 1, 3,
  ]);
});
test("duel standings rank remaining health and share eliminated places", () => {
  const players = [
    { id: "a", hp: 0, eliminated: true, score: 9000 },
    { id: "b", hp: 2100, score: 6000 },
    { id: "c", hp: 0, eliminated: true, score: 7000 },
  ];
  expect(
    matchStandings(players, "duel").map((p) => [p.id, p.placement]),
  ).toEqual([
    ["b", 1],
    ["a", 2],
    ["c", 2],
  ]);
});

const state = (guesses, patch = {}) => ({
  room: { variant: "classic" },
  me: { id: "me" },
  players: [
    { id: "me", name: "You" },
    { id: "rival", name: "Mira" },
  ],
  reveal: { guesses },
  ...patch,
});

test("a zero-point round or timeout is not celebrated as a win", () => {
  expect(
    roundOutcome(state([{ playerId: "me", rank: 1, score: 0 }])).tone,
  ).toBe("quiet");
  expect(
    roundOutcome(state([{ playerId: "me", rank: 1, score: 0, timedOut: true }]))
      .title,
  ).toBe("No pin this round.");
});
test("shared scores are described as a shared win, not an outright win", () => {
  expect(
    roundOutcome(
      state([
        { playerId: "me", rank: 1, score: 4900 },
        { playerId: "rival", rank: 1, score: 4900 },
      ]),
    ).title,
  ).toBe("A shared round win.");
});
test("a rival can win without exposing any unrevealed guess", () => {
  expect(
    roundOutcome(
      state([
        { playerId: "me", rank: 2, score: 3400 },
        { playerId: "rival", rank: 1, score: 4900 },
      ]),
    ).title,
  ).toBe("Mira takes the round.");
  expect(roundOutcome(state([])).tone).toBe("quiet");
});
test("duel elimination takes precedence over ordinary round feedback", () => {
  const s = state(
    [
      { playerId: "me", rank: 2, score: 400, damage: 6000 },
      { playerId: "rival", rank: 1, score: 4900 },
    ],
    {
      room: { variant: "duel" },
      players: [
        { id: "me", name: "You", eliminated: true },
        { id: "rival", name: "Mira" },
      ],
    },
  );
  expect(roundOutcome(s)).toMatchObject({
    title: "Out of this duel.",
    tone: "loss",
  });
});
test("a league emblem is earned after placements, never from the initial rating", () => {
  expect(
    placedLeague({ rating: { games: 0, tier: "Silver", provisional: true } }),
  ).toBe(null);
  expect(
    placedLeague({ rating: { games: 4, tier: "Gold", provisional: false } }),
  ).toBe(null);
  expect(
    placedLeague({ rating: { games: 5, tier: "Gold", provisional: false } }),
  ).toBe("Gold");
  expect(placedLeague(null)).toBe(null);
});

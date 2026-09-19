"use client";

/** The game hub: choose company, choose a game, play. Live status is never invented. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Flame,
  Languages,
  Play,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  CONTINENTS,
  CONTINENT_ORDER,
  configToParams,
  DEFAULT_CONFIG,
  MODES,
} from "@/app/lib/geo/modes";
import { PROVISIONAL_GAMES } from "@/app/lib/geo/rating";
import { ordinal } from "@/app/lib/geo/distance";
import { untilText } from "@/app/lib/geo/meter";
import { APPLE_COVERAGE_NAMES } from "@/app/lib/geo/coverage";
import { profileHeaders } from "../../lib/profile";
import { loadGeoConfig } from "../../lib/serverConfig";
import ScriptArtwork from "./ScriptArtwork";
import Button from "../ui/Button";
import { latestSavedGame } from '../../lib/savedGame';
import { safeReturnTo } from '@/app/lib/geo/authReturn';
import { randomSeedString } from '@/app/lib/geo/random';
import { scriptConfigToQuery } from '@/app/lib/geo/script';

const COUNTRIES = Object.entries(APPLE_COVERAGE_NAMES)
  .map(([code, name]) => ({
    code,
    name: name.replace(/^the /, ""),
    flag: String.fromCodePoint(...(code === "UK" ? "GB" : code).split("").map((letter) => 127397 + letter.charCodeAt(0))),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function GameMenu() {
  const router = useRouter();
  const [company, setCompany] = useState("solo");
  const [game, setGame] = useState("street");
  const [starting, setStarting] = useState(false);
  const [savedGame, setSavedGame] = useState(null);
  const [imagery, setImagery] = useState(null);
  const [daily, setDaily] = useState(null);
  const [cup, setCup] = useState(null);
  const [solo, setSolo] = useState(null);
  const [openRooms, setOpenRooms] = useState(null);
  const [answered, setAnswered] = useState({});
  const [continent, setContinent] = useState("europe");
  const [country, setCountry] = useState("JP");
  const multiplayer = company === "multi";
  const script = game === "script";

  useEffect(() => {
    let live = true;
    latestSavedGame().then((saved) => { if (live) setSavedGame(saved); });
    const get = (name, url, set, pick = (d) => d) =>
      fetch(url, { headers: profileHeaders(), cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!live || !d) return;
          set(pick(d));
          setAnswered((was) => ({ ...was, [name]: true }));
        })
        .catch(() => {});
    get("daily", "/api/geo/daily", setDaily);
    get("cup", "/api/geo/cup", setCup);
    get(
      "solo",
      "/api/geo/leaderboard?ladder=solo",
      setSolo,
      (d) => d.you || null,
    );
    get("rooms", "/api/geo/rooms", setOpenRooms, (d) =>
      Array.isArray(d.rooms) ? d.rooms.length : null,
    );
    loadGeoConfig({ shouldStop: () => !live })
      .then(
        (d) => live && d && setImagery(Boolean(d.providers?.apple?.configured)),
      )
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const start = () => {
    setStarting(true);
    if (multiplayer) router.push(`/geo/rooms?game=${game}`);
    else if (script) router.push(`/geo/script/play?${scriptConfigToQuery({ ladder: 'world', rounds: 5, seed: randomSeedString() })}`);
    else router.push(`/geo/play?${configToParams(DEFAULT_CONFIG).toString()}`);
  };

  return (
    <main className="pe-home pe-home--immersive">
      <section
        className={`pe-world pe-enter ${script ? "pe-world--script" : ""}`}
        aria-labelledby="world-title"
      >
        <div className="pe-world-art" aria-hidden="true" />
        <div className="pe-world-shade" aria-hidden="true" />
        <div className="pe-stage-content">
          <div className="pe-hero-copy">
            <h1 id="world-title">
              Where on<br /><em>Earth?</em>
            </h1>
            <p className="pe-hero-description">
              {script
                ? "Find the place from its language."
                : "Look around. Guess where you are."}
            </p>
          </div>
          <section
            className="pe-play-dock pe-enter"
            aria-label="Choose how to play"
          >
            <div className="pe-dock-heading">
              <div className="pe-company" role="group" aria-label="Play with">
                <button
                  type="button"
                  aria-pressed={!multiplayer}
                  onClick={() => setCompany("solo")}
                >
                  <UserRound size={18} /> Solo
                </button>
                <button
                  type="button"
                  aria-pressed={multiplayer}
                  onClick={() => setCompany("multi")}
                >
                  <Users size={19} /> Multiplayer
                </button>
              </div>
              <span className="pe-dock-note">
                Street or Script
              </span>
            </div>
            <div className="pe-dock-body">
              <div
                className="pe-game-choices"
                role="group"
                aria-label="Game"
              >
                  <>
                    <button
                      type="button"
                      className="pe-mode-choice"
                      aria-pressed={game === "street"}
                      onClick={() => setGame("street")}
                    >
                      <span className="pe-mode-thumb" />
                      <span>
                        <strong>Street</strong>
                        <small>Street views</small>
                      </span>
                      <span className="pe-choice-dot" />
                    </button>
                    <button
                      type="button"
                      className="pe-mode-choice"
                      aria-pressed={game === "script"}
                      onClick={() => setGame("script")}
                    >
                      <span className="pe-mode-glyph" lang="ja">
                        あ
                      </span>
                      <span>
                        <strong>Script</strong>
                        <small>Written languages</small>
                      </span>
                      <span className="pe-choice-dot" />
                    </button>
                  </>
              </div>
              <div className="pe-launch">
                <Button
                  onClick={start}
                  disabled={
                    starting || (!multiplayer && !script && imagery === false)
                  }
                  size="lg"
                  data-cold-open-play
                  className="pe-play-button"
                >
                  <Play size={19} fill="currentColor" />
                  {starting
                    ? "Let’s go…"
                    : `Play ${script ? "Script" : "Street"}`}
                  <ArrowRight size={20} />
                </Button>
                <p>
                  {multiplayer
                    ? openRooms === null
                      ? "Find an opponent or invite friends"
                      : openRooms
                        ? `${openRooms} open ${openRooms === 1 ? "room" : "rooms"} · or create your own`
                        : "Find an opponent or invite friends"
                    : imagery === false && !script
                      ? "Street is unavailable here. Try Script."
                      : `${DEFAULT_CONFIG.rounds} rounds · No timer · Free`}
                </p>
              </div>
            </div>
            <div className="pe-dock-foot">
              {savedGame?.url ? <Link href={safeReturnTo(savedGame.url, '/geo')}><Play size={15} /> Continue {savedGame.kind === 'script' ? 'Script' : 'Street'}</Link> : null}
              <Link href="/geo/script" data-menu-script>
                <Languages size={15} /> All Script languages{" "}
                <ArrowRight size={14} />
              </Link>
              <Link href="/geo/rooms" data-menu-friends>
                <Users size={15} /> Have a room code? <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>
        {script ? (
          <ScriptArtwork />
        ) : (
          <div className="pe-world-marker" aria-hidden="true">
            <div className="pe-marker-pin">
              <Compass size={32} strokeWidth={1.5} />
            </div>
            <i />
          </div>
        )}
        <a className="pe-scene-next" href="#compete-title">
          Daily challenges & rankings <ArrowRight size={15} />
        </a>
      </section>

      <section className="pe-competition" aria-labelledby="compete-title">
        <div className="pe-section-heading">
          <div>
            <h2 id="compete-title">Challenges</h2>
          </div>
          <Link href="/geo/leaderboard">
            Rankings <ArrowRight size={16} />
          </Link>
        </div>
        <div className="pe-event-list">
          <Link
            href="/geo/play?mode=daily"
            data-menu-daily
            className="pe-event"
          >
            <span className="pe-event-emblem">
              <CalendarDays size={25} />
            </span>
            <div>
              <h3>Daily</h3>
              <p>{MODES.daily.fixed.rounds} places · No timer</p>
              <small>
                {answered.daily && daily?.you?.rank
                  ? `You’re ${ordinal(daily.you.rank)} of ${daily.finished} today`
                  : answered.daily && daily?.finished
                    ? `${daily.finished} players finished today`
                    : "Same places for everyone"}
              </small>
            </div>
            <ArrowRight className="pe-event-arrow" size={20} />
          </Link>
          <Link
            href="/geo/play?mode=ranked"
            data-menu-ranked
            className="pe-event"
          >
            <span className="pe-event-emblem pe-event-emblem--rank">
              <Compass size={29} />
            </span>
            <div>
              <h3>Ranked</h3>
              <p>
                {MODES.ranked.fixed.rounds} rounds. {MODES.ranked.fixed.time}{" "}
                seconds. No moving.
              </p>
              <small>
                {answered.solo
                  ? solo?.games >= PROVISIONAL_GAMES
                    ? `${solo.tier} · ${solo.value} rating`
                    : `${solo?.games || 0} of ${PROVISIONAL_GAMES} placement games`
                  : "A new challenge every hour."}
              </small>
            </div>
            <ArrowRight className="pe-event-arrow" size={20} />
          </Link>
          <Link href="/geo/play?mode=cup" data-menu-cup className="pe-event">
            <span className="pe-event-emblem pe-event-emblem--cup">
              <Trophy size={28} />
            </span>
            <div>
              <h3>Weekly cup</h3>
              <p>{MODES.cup.fixed.rounds} places · One entry</p>
              <small>
                {cup?.endsAt
                  ? `Ends ${untilText(cup.endsAt)}`
                  : "Resets weekly"}
              </small>
            </div>
            <ArrowRight className="pe-event-arrow" size={20} />
          </Link>
        </div>
      </section>

      <details className="pe-expeditions pe-practice">
        <summary>More ways to play <span>Country streak · Choose a region</span></summary>
        <div className="pe-expedition-options">
          <Link
            href="/geo/play?mode=streak"
            data-menu-streak
            className="pe-streak"
          >
            <Flame size={24} />
            <span>
              <strong>Country streak</strong>
              <small>One wrong country ends the run.</small>
            </span>
            <ArrowRight size={18} />
          </Link>
          <div className="pe-region">
            <label>
              <span>Continent</span>
              <select
                value={continent}
                onChange={(e) => setContinent(e.target.value)}
                aria-label="Continent"
              >
                {CONTINENT_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {CONTINENTS[id].label}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href={`/geo/play?mode=continent&region=${continent}`}
              data-menu-continent
              aria-label="Play continent"
            >
              <ArrowRight size={20} />
            </Link>
          </div>
          <div className="pe-region">
            <label>
              <span>Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-label="Country"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href={`/geo/play?mode=country&region=${country}`}
              data-menu-country
              aria-label="Play country"
            >
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </details>
    </main>
  );
}

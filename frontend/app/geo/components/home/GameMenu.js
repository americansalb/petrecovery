"use client";

/**
 * The front door: choose Street or Script, play. Live status is never
 * invented.
 *
 * It used to carry a Solo/Multiplayer toggle beside that choice, which
 * put the word Multiplayer on the screen twice - once in the
 * navigation, once here - with both ending at /geo/rooms. Two controls
 * for one destination on the one screen a stranger meets first is the
 * product described rather than played (founder, 2026-09-22: "like the
 * person that made it does not know the purpose of the app but only
 * each individual feature"). The navigation keeps multiplayer, on every
 * screen; this page asks the one question a game needs.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Compass,
  Play,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  configToParams,
  DEFAULT_CONFIG,
  MODES,
} from "@/app/lib/geo/modes";
import { PROVISIONAL_GAMES } from "@/app/lib/geo/rating";
import { ordinal } from "@/app/lib/geo/distance";
import { untilText } from "@/app/lib/geo/meter";
import { profileHeaders } from "../../lib/profile";
import { loadGeoConfig } from "../../lib/serverConfig";
import { initializeMapKit } from "../../lib/appleMapKit";
import { prefersReducedMotion } from "../../lib/motion";
import ScriptArtwork from "./ScriptArtwork";
import Button from "../ui/Button";
import { latestSavedGame } from '../../lib/savedGame';
import { safeReturnTo } from '@/app/lib/geo/authReturn';
import { randomSeedString } from '@/app/lib/geo/random';
import { scriptConfigToQuery } from '@/app/lib/geo/script';

/**
 * One line of the lists under the scene: the name, what it is, and the
 * player's own standing when the server has said (never a placeholder
 * standing for atmosphere). The whole row is the link.
 */
function MenuRow({ href, marker, title, detail, status = "" }) {
  return (
    <Link
      href={href}
      {...{ [marker]: "" }}
      className="group flex min-h-[64px] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-pe-raised sm:px-5"
    >
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-6">
        <h3 className="font-semibold text-pe-fg sm:w-36 sm:shrink-0">{title}</h3>
        <p className="mt-0.5 text-sm text-pe-muted sm:mt-0 sm:flex-1">{detail}</p>
        {status ? (
          <p className="pe-fade-in mt-1 text-sm font-medium text-pe-accent-fg sm:mt-0 sm:text-right">{status}</p>
        ) : null}
      </div>
      <ArrowRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-pe-subtle transition group-hover:translate-x-0.5 group-hover:text-pe-fg"
      />
    </Link>
  );
}

export default function GameMenu() {
  const router = useRouter();
  // Script is the game the page opens on (founder, 2026-09-25).
  const [game, setGame] = useState("script");
  const [starting, setStarting] = useState(false);
  const [savedGame, setSavedGame] = useState(null);
  const [imagery, setImagery] = useState(null);
  const [daily, setDaily] = useState(null);
  const [cup, setCup] = useState(null);
  const [solo, setSolo] = useState(null);
  const [answered, setAnswered] = useState({});
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
    loadGeoConfig({ shouldStop: () => !live })
      .then((d) => {
        if (!live || !d) return;
        const apple = Boolean(d.providers?.apple?.configured);
        setImagery(apple);
        // Start Apple's SDK here rather than on the round screen.
        // Measured on the live site: a Street round spent about three and
        // a half seconds initialising MapKit before it could even try its
        // first spot, and the player watched a spinner for all of it.
        // initializeMapKit memoises on a module-level promise and the
        // lobby reaches the round by a client navigation, so the work
        // done while somebody is still choosing is work the round does
        // not repeat. It loads the script and mints a token; it looks up
        // no imagery, so it costs nothing against the Look Around quota.
        if (apple) initializeMapKit().catch(() => {});
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const start = () => {
    setStarting(true);
    if (script) router.push(`/geo/script/play?${scriptConfigToQuery({ rounds: 5, seed: randomSeedString() })}`);
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
            {/* Keyed on the game, so choosing Script fades the new line in
                rather than swapping the words under the reader. */}
            <p key={script ? "script" : "street"} className="pe-hero-description pe-swap">
              {script
                ? "Find the place from its language."
                : "Look around. Guess where you are."}
            </p>
          </div>
          <section
            className="pe-play-dock pe-enter"
            aria-label="Choose how to play"
          >
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
                  </>
              </div>
              <div className="pe-launch">
                <Button
                  onClick={start}
                  disabled={starting || (!script && imagery === false)}
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
                  {imagery === false && !script
                    ? "Street is unavailable here. Try Script."
                    : `${DEFAULT_CONFIG.rounds} rounds · No timer · Free`}
                </p>
              </div>
            </div>
            <div className="pe-dock-foot">
              {savedGame?.url ? <Link href={safeReturnTo(savedGame.url, '/geo')}><Play size={15} /> Continue {savedGame.kind === 'script' ? 'Script' : 'Street'}</Link> : null}
              {/* Only beside Script. It said "All Script languages" and
                  led to a list of them; there is no list to show now
                  (app/lib/geo/script.js), and the page it leads to sets
                  the rounds and the timer. */}
              {script ? (
                <Link href="/geo/script" data-menu-script>
                  <SlidersHorizontal size={15} /> Rounds and timer{" "}
                  <ArrowRight size={14} />
                </Link>
              ) : null}
              <Link href={`/geo/rooms?game=${game}`} data-menu-friends>
                <Users size={15} /> Play with a friend <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>
        {/* Each is a fresh element when the game changes, so each arrives
            (pe-swap) instead of being there. Both are positioned with a
            transform of their own - a tilt, and a smaller scale on a
            phone - which the arrival keeps, because it moves them with
            the separate `translate` property (motion.css). */}
        {script ? (
          <ScriptArtwork className="pe-swap" />
        ) : (
          <div className="pe-world-marker pe-swap" aria-hidden="true">
            <div className="pe-marker-pin">
              <Compass size={32} strokeWidth={1.5} />
            </div>
            <i />
          </div>
        )}
        {/* Glides down to the challenges rather than jumping there. The
            hash stays for a page that has not hydrated yet. */}
        <a
          className="pe-scene-next"
          href="#compete-title"
          onClick={(event) => {
            const target = document.querySelector(".pe-home-challenges");
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({
              behavior: prefersReducedMotion() ? "auto" : "smooth",
              block: "start",
            });
          }}
        >
          Daily challenges & rankings <ArrowRight size={15} />
        </a>
      </section>

      {/* What else there is, as two short lists: one line per thing,
          what it is, and where you stand in it when the server knows.
          They were three icon tiles in 10px type and a collapsed
          "More ways to play" that most people never opened. */}
      <div className="pe-home-more mx-auto max-w-[1200px] px-4 sm:px-6">
        <section className="pe-home-challenges scroll-mt-20 pt-12 sm:pt-16" aria-labelledby="compete-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="compete-title" className="ui-h2">Challenges</h2>
            <Link
              href="/geo/leaderboard"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-pe-accent-fg hover:underline"
            >
              Rankings <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-2 divide-y divide-pe-line overflow-hidden rounded-xl border border-pe-line bg-pe-surface">
            <MenuRow
              href="/geo/play?mode=daily"
              marker="data-menu-daily"
              title="Daily"
              detail={`${MODES.daily.fixed.rounds} places · No timer · Same places for everyone`}
              status={
                answered.daily && daily?.you?.rank
                  ? `You’re ${ordinal(daily.you.rank)} of ${daily.finished} today`
                  : answered.daily && daily?.finished
                    ? `${daily.finished} ${daily.finished === 1 ? "player" : "players"} finished today`
                    : ""
              }
            />
            <MenuRow
              href="/geo/play?mode=ranked"
              marker="data-menu-ranked"
              title="Ranked"
              detail={`${MODES.ranked.fixed.rounds} rounds · ${MODES.ranked.fixed.time} seconds · No moving`}
              status={
                answered.solo
                  ? solo?.games >= PROVISIONAL_GAMES
                    ? `${solo.tier} · ${solo.value} rating`
                    : `${solo?.games || 0} of ${PROVISIONAL_GAMES} placement games played`
                  : ""
              }
            />
            <MenuRow
              href="/geo/play?mode=cup"
              marker="data-menu-cup"
              title="Weekly cup"
              detail={`${MODES.cup.fixed.rounds} places · One entry a week`}
              status={cup?.endsAt ? `Ends ${untilText(cup.endsAt)}` : ""}
            />
          </div>
        </section>

        <section className="pe-home-practice pt-10" aria-labelledby="more-title">
          <h2 id="more-title" className="ui-h2">More ways to play</h2>
          <div className="mt-4 divide-y divide-pe-line overflow-hidden rounded-xl border border-pe-line bg-pe-surface">
            <MenuRow
              href="/geo/play?mode=streak"
              marker="data-menu-streak"
              title="Country streak"
              detail="Name the country. One wrong answer ends the run."
            />
            {/* One continent and One country were here, and the country
                list was every country the game covers. That is kept
                secret now (app/lib/geo/modes.js, RETIRED_MODES). */}
          </div>
        </section>
      </div>
    </main>
  );
}

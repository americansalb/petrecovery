"use client";

import { useId } from "react";

const METALS = {
  Wood: ["#e5c39b", "#9a6b43", "#513829"],
  Copper: ["#f1c09a", "#b66d45", "#543b30"],
  Silver: ["#f3f5eb", "#acbdbb", "#3e5c60"],
  Meteorite: ["#e7eaf0", "#8995a7", "#303c4c"],
  Gold: ["#fff0b4", "#d7ad53", "#725132"],
  Sapphire: ["#b8edee", "#55aacc", "#183f70"],
};

/** Original vector insignia: each league has its own silhouette and center. */
export default function RankEmblem({
  tier,
  className = "",
  decorative = false,
}) {
  const id = useId().replace(/:/g, "");
  const colors = METALS[tier];
  const gem = tier === "Sapphire";
  const premium = tier === "Gold" || gem || tier === "Meteorite";
  const shape =
    tier === "Copper"
      ? "M60 9 101 33 101 81 60 109 19 81 19 33Z"
      : tier === "Silver"
        ? "M39 11 81 11 105 35 105 78 81 102 39 102 15 78 15 35Z"
        : tier === "Meteorite"
          ? "M60 4 110 58 60 115 10 58Z"
          : "M60 7 94 22 104 58 91 90 60 111 29 90 16 58 26 22Z";
  return (
    <svg
      viewBox="0 0 120 124"
      className={`pe-league-emblem ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={
        decorative ? undefined : `${colors ? tier : "Unplaced"} league`
      }
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".9" y2="1">
          <stop stopColor={colors?.[0] || "#afc0b6"} />
          <stop offset=".45" stopColor={colors?.[1] || "#58766d"} />
          <stop offset="1" stopColor={colors?.[2] || "#183c43"} />
        </linearGradient>
        <linearGradient id={`${id}-core`} x2=".8" y2="1">
          <stop stopColor="#214d50" />
          <stop offset="1" stopColor="#082a35" />
        </linearGradient>
      </defs>
      {premium
        ? [1, -1].map((side) => (
            <g
              key={side}
              transform={`translate(60 62) scale(${side} 1)`}
              fill={colors[1]}
              opacity=".8"
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <ellipse
                  key={n}
                  cx={42 - n * 2}
                  cy={-23 + n * 12}
                  rx="5"
                  ry="11"
                  transform={`rotate(${-38 + n * 14} ${42 - n * 2} ${-23 + n * 12})`}
                />
              ))}
            </g>
          ))
        : null}
      <path d={shape} fill="#021c24" transform="translate(0 5)" />
      <path
        d={shape}
        fill={`url(#${id}-metal)`}
        stroke={colors?.[0] || "#869e8e"}
        strokeWidth="1.5"
      />
      <path
        d={shape}
        transform="translate(60 58) scale(.86) translate(-60 -58)"
        fill={`url(#${id}-core)`}
        stroke={colors?.[0] || "#869e8e"}
        strokeWidth=".6"
      />
      <circle
        cx="60"
        cy="57"
        r="29"
        fill="none"
        stroke={colors?.[1] || "#7d9d8c"}
        opacity=".4"
      />
      {!colors ? (
        <>
          <circle cx="60" cy="57" r="17" fill="none" stroke="#b8c7ba" />
          <path d="m64 45-13 8 5 16 13-8Z" fill="none" stroke="#b8c7ba" />
        </>
      ) : gem ? (
        <g stroke="#ceefee" strokeWidth="1">
          <path d="M40 39h40l12 17-32 29-32-29Z" fill="#3986ad" />
          <path
            d="m40 39 8 17 12-17 12 17 8-17M28 56h64M48 56l12 29 12-29"
            fill="none"
          />
          <path d="M60 39 48 56h24Z" fill="#a4d7dc" />
          <path d="m48 56 12 29-32-29Z" fill="#23557f" />
        </g>
      ) : (
        <g fill={`url(#${id}-metal)`} stroke={colors[0]} strokeWidth=".7">
          {tier === "Wood" ? (
            <g fill="none" strokeWidth="2">
              <path d="M42 33q36-10 36 23t-35 26q-17-25-1-49Z" />
              <path d="M50 40q22-6 20 18t-20 16q-10-18 0-34Z" />
              <path d="M57 46q10 0 6 15t-9 4" />
            </g>
          ) : tier === "Copper" ? (
            <>
              <path d="m60 29 12 31-12-5-12 5Z" />
              <path d="m60 84-9-25 9 4 9-4Z" opacity=".55" />
            </>
          ) : tier === "Silver" ? (
            <path d="m60 27 8 22 22 8-22 8-8 22-8-22-22-8 22-8Z" />
          ) : tier === "Meteorite" ? (
            <>
              <path d="m47 32 24 1 16 20-5 24-27 9-20-18 2-23Z" />
              <path d="m47 32 8 23 32-2M55 55v31M55 55 35 68M55 55l27 22" fill="none" stroke="#303c4c" strokeWidth="2" />
              <path d="m64 43 4 5m-24 13 5 3m18 7 5-3" fill="none" stroke="#f9e2c4" strokeWidth="3" />
            </>
          ) : (
            <>
              <path d="m38 41 11 9 11-21 11 21 11-9-5 25H43Z" />
              <path d="M44 73h32v5H44Z" />
              <circle cx="60" cy="58" r="5" fill="#fff0ba" />
            </>
          )}
        </g>
      )}
      <path
        d="M45 97h30"
        stroke={colors?.[0] || "#adc3b1"}
        strokeWidth="2"
        opacity=".65"
      />
    </svg>
  );
}

/** A match trophy, visually distinct from a league insignia. */
export function VictoryCrest() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 160 160" className="pe-victory-crest" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-trophy`} x2=".8" y2="1">
          <stop stopColor="#fff0b7" />
          <stop offset=".5" stopColor="#d2ae68" />
          <stop offset="1" stopColor="#856041" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="75" r="57" fill="#173e44" stroke="#c7d49b55" />
      <circle
        cx="80"
        cy="75"
        r="48"
        fill="none"
        stroke="#dbdfaa55"
        strokeDasharray="1 7"
      />
      {[1, -1].map((side) => (
        <g
          key={side}
          transform={`translate(80 82) scale(${side} 1)`}
          fill="#a8bd7b"
        >
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <ellipse
              key={n}
              cx={48 - n * 3}
              cy={-30 + n * 13}
              rx="3.3"
              ry="8"
              transform={`rotate(${-35 + n * 13} ${48 - n * 3} ${-30 + n * 13})`}
            />
          ))}
        </g>
      ))}
      <path
        d="M57 43h46v27q0 22-23 27-23-5-23-27Z"
        fill={`url(#${id}-trophy)`}
        stroke="#ffebad"
        strokeWidth="2"
      />
      <path
        d="M58 51H44v11q0 16 17 17M102 51h14v11q0 16-17 17"
        fill="none"
        stroke="#d9b879"
        strokeWidth="5"
      />
      <path d="M80 95v17m-18 5h36" stroke="#d9b879" strokeWidth="6" />
      <path
        d="m80 51 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1Z"
        fill="#6e6945"
      />
      <path
        d="M61 46h7v26q0 12 12 17"
        fill="none"
        stroke="#fff4c188"
        strokeWidth="3"
      />
    </svg>
  );
}

'use client';

/**
 * ConfettiBurst - sixty lines of joy, zero dependencies
 *
 * Pure CSS falling confetti in house colors. Renders once on mount,
 * cleans itself up visually by fading; cheap enough for any phone.
 */

import { useMemo } from 'react';

const COLORS = ['#facc15', '#fde047', '#34d399', '#ffffff', '#fbbf24'];

export default function ConfettiBurst({ count = 28 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        tilt: Math.random() * 360,
        drift: -40 + Math.random() * 80,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-8vh) translateX(0) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(105vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.tilt}deg)`,
            '--drift': `${p.drift}px`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

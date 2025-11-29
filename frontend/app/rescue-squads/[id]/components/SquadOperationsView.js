'use client';

/**
 * SquadOperationsView - Tactical OS Interface
 *
 * Full viewport tactical map operating system.
 * NO sidebars, NO headers, NO footers - just the map and HUD.
 *
 * Layer Architecture:
 * - Layer 0 (z-0):  Map Canvas
 * - Layer 1 (z-10): Data Overlay (pins, zones)
 * - Layer 2 (z-20): HUD (Heads Up Display)
 */

// ============================================
// MOCK DATA - No API calls, layout only
// ============================================
const MOCK_SQUAD = {
  name: 'Brooklyn Squad',
  activeCount: 12,
};

const MOCK_CASES = [
  { id: 1, name: 'Bella', species: 'DOG', time: '2h', color: '#ef4444' },
  { id: 2, name: 'Max', species: 'DOG', time: '5h', color: '#f97316' },
  { id: 3, name: 'Luna', species: 'CAT', time: '1d', color: '#eab308' },
  { id: 4, name: 'Charlie', species: 'DOG', time: '3h', color: '#ef4444' },
  { id: 5, name: 'Milo', species: 'CAT', time: '12h', color: '#f97316' },
];

export default function SquadOperationsView() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 relative">

      {/* ========================================
          LAYER 0: Map Canvas (z-0)
          ======================================== */}
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
          <span className="text-slate-600 text-2xl font-mono">MAP LAYER</span>
        </div>
      </div>

      {/* ========================================
          LAYER 1: Data Overlay (z-10)
          For pins, search zones, volunteer dots
          ======================================== */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Pins will go here */}
      </div>

      {/* ========================================
          LAYER 2: HUD - Heads Up Display (z-20)
          ======================================== */}
      <div className="absolute inset-0 z-20 pointer-events-none">

        {/* ---- TOP BAR: Floating Pill ---- */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="
            px-6 py-3
            bg-slate-900/80 backdrop-blur-xl
            border border-slate-700/50
            rounded-full
            shadow-2xl
            flex items-center gap-3
          ">
            <span className="text-white font-semibold">
              {MOCK_SQUAD.name}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-orange-400 font-bold">
              {MOCK_SQUAD.activeCount} Active
            </span>
          </div>
        </div>

        {/* ---- BOTTOM BAR: Fixed Bottom ---- */}
        <div className="
          absolute bottom-0 left-0 right-0
          pointer-events-auto
        ">
          {/* Glassmorphism container */}
          <div className="
            bg-slate-900/90 backdrop-blur-xl
            border-t border-slate-700/50
            px-4 pt-4 pb-6
          ">
            {/* Active Cases - Horizontal Scroll */}
            <div className="mb-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                Active Cases
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {MOCK_CASES.map((c) => (
                  <button
                    key={c.id}
                    className="
                      flex-shrink-0
                      flex items-center gap-3
                      px-4 py-3
                      bg-slate-800/80 hover:bg-slate-700/80
                      border border-slate-700/50
                      rounded-xl
                      transition-all
                    "
                  >
                    {/* Pet avatar placeholder */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{
                        backgroundColor: `${c.color}20`,
                        border: `2px solid ${c.color}`,
                      }}
                    >
                      {c.species === 'DOG' ? '🐕' : '🐈'}
                    </div>
                    {/* Info */}
                    <div className="text-left">
                      <div className="text-white font-semibold text-sm">
                        {c.name}
                      </div>
                      <div
                        className="text-xs font-medium"
                        style={{ color: c.color }}
                      >
                        {c.time} ago
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* MASSIVE REPORT SIGHTING BUTTON */}
            <button className="
              w-full
              py-5
              bg-gradient-to-r from-red-600 to-red-700
              hover:from-red-500 hover:to-red-600
              rounded-2xl
              shadow-lg shadow-red-900/50
              transition-all
              active:scale-[0.98]
            ">
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">👁</span>
                <span className="text-white text-xl font-bold tracking-wide">
                  REPORT SIGHTING
                </span>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

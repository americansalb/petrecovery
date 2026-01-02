# Lost Pet Simulator - Implementation Plan

## Overview

A Monte Carlo simulation tool that predicts where lost pets are likely to be found, with visual map-based playback and analytics. When a pet is reported lost, we can run thousands of simulations to generate probability heatmaps, then validate our predictions against actual outcomes to continuously improve accuracy.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SIMULATOR PAGE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────────────────┐│
│  │   CONFIG PANEL       │  │              INTERACTIVE MAP             ││
│  │                      │  │                                          ││
│  │  Pet: [Dog ▼]        │  │     ░░░░▒▒▒▓▓▓████⌂████▓▓▓▒▒▒░░░░       ││
│  │  Size: [Medium ▼]    │  │                                          ││
│  │  Behavior: [Wander▼] │  │         🐕 ← Pet (animated)              ││
│  │  Terrain: [Suburb▼]  │  │      👤 👤 👤 ← Searchers                ││
│  │  Searchers: [5]      │  │                                          ││
│  │  Strategy: [Grid ▼]  │  │  ┌─────────────────────────────────────┐ ││
│  │  Duration: [72 hrs]  │  │  │ ▶ ⏸ │ 1x 2x 10x │ ════●══════ 2:45 │ ││
│  │                      │  │  └─────────────────────────────────────┘ ││
│  │  [Run Single]        │  │         Playback Controls                ││
│  │  [Run Batch: 1000]   │  │                                          ││
│  ├──────────────────────┤  ├──────────────────────────────────────────┤│
│  │  SIMULATION LIST     │  │           ANALYTICS DASHBOARD            ││
│  │                      │  │                                          ││
│  │  ✓ Sim #1 - Found    │  │  Success Rate: ████████░░ 78%           ││
│  │  ✓ Sim #2 - Found    │  │  Avg Time: 4.2 hours                    ││
│  │  ✗ Sim #3 - Timeout  │  │  Best Strategy: Probability-based       ││
│  │  ► Sim #4 - Playing  │  │                                          ││
│  │  ...                 │  │  Zone Breakdown:                         ││
│  │                      │  │  HIGH: 67% | MED: 22% | LOW: 8% | EXT: 3%││
│  └──────────────────────┘  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
frontend/
├── app/
│   ├── simulator/
│   │   ├── page.js                      # Main simulator page
│   │   ├── components/
│   │   │   ├── SimulatorConfig.js       # Configuration form
│   │   │   ├── SimulatorMap.js          # Map with animated playback
│   │   │   ├── PlaybackControls.js      # Play/pause/speed/timeline
│   │   │   ├── SimulationList.js        # List of simulations
│   │   │   ├── BatchResults.js          # Aggregate analytics
│   │   │   ├── HeatmapOverlay.js        # Find location heatmap
│   │   │   └── EntityMarker.js          # Animated pet/searcher markers
│   │   └── hooks/
│   │       ├── useSimulationPlayback.js # Playback state machine
│   │       └── useSimulatorSSE.js       # Real-time progress
│   │
│   ├── api/simulator/
│   │   ├── route.js                     # Create/list simulations
│   │   ├── [simulationId]/
│   │   │   ├── route.js                 # Get simulation details
│   │   │   └── stream/route.js          # SSE for live progress
│   │   └── batch/
│   │       ├── route.js                 # Start/list batches
│   │       └── [batchId]/route.js       # Batch results
│   │
│   └── lib/simulator/
│       ├── engine.js                    # Core simulation engine
│       ├── petBehavior.js               # Pet movement algorithms
│       ├── searcherBehavior.js          # Search pattern algorithms
│       ├── terrainModifiers.js          # Environmental factors
│       └── analytics.js                 # Statistics calculator
│
└── prisma/schema.prisma                 # New models added
```

---

## Data Models

### SimulationConfig
Stores reusable simulation configurations:
- Pet attributes (species, size, behavior profile)
- Environment (center location, terrain type, search radius)
- Searcher setup (count, strategy, speed)
- Time parameters (max hours, time step)

### SimulationBatch
Groups multiple simulation runs:
- Links to config
- Tracks progress (completed/total)
- Stores aggregate results (success rate, avg time to find)
- Analytics JSON for detailed breakdown

### Simulation
Individual simulation run:
- Random seed (for reproducibility)
- Outcome (found/timeout, when, where, by whom)
- **Path data as JSON** (not rendered - reconstructed on playback)
- Statistics (distances traveled, zones visited)

---

## Simulation Engine

### Pet Behavior Profiles

| Profile | Description | Typical Species | Movement Pattern |
|---------|-------------|-----------------|------------------|
| **WANDERER** | Explores consistently | Most dogs | Semi-random walk, follows "scents" |
| **HIDER** | Finds spot and stays | Scared cats, small dogs | Initial movement → hide for hours |
| **RUNNER** | Panicked flight | Any frightened pet | Fast initial burst, then slows |
| **TERRITORIAL** | Stays in known area | Outdoor cats | Circular pattern, returns to center |

### Search Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **GRID** | Systematic cell coverage | Large volunteer groups |
| **SPIRAL** | Expanding from center | Single searcher, hiders |
| **RANDOM** | Uncoordinated movement | Simulating untrained volunteers |
| **PROBABILITY** | Weighted toward likely zones | Optimal results |

### Core Algorithm

```
1. Initialize pet at last-seen location
2. Initialize N searchers based on strategy
3. For each time step (every 5 simulated minutes):
   a. Move pet according to behavior model
   b. Move each searcher according to strategy
   c. Check if any searcher is within "vision radius" of pet
   d. If found → record success, end simulation
   e. Record all positions for playback
4. If max time reached → record timeout
5. Store path data as compressed JSON
```

---

## Playback System

### Data Storage (Backend)
Simulations store paths as coordinate arrays:
```javascript
petPath: [
  { minute: 0, lat: 41.878, lng: -87.629, state: 'ACTIVE' },
  { minute: 5, lat: 41.879, lng: -87.628, state: 'ACTIVE' },
  { minute: 10, lat: 41.879, lng: -87.627, state: 'HIDING' },
  // ... hundreds of points
]
```

### Rendering (Frontend)
When user clicks a simulation:
1. Fetch path data from API
2. `useSimulationPlayback` hook manages playback state
3. Interpolate between recorded points for smooth animation
4. Render on Leaflet map with animated markers
5. Update probability zones based on elapsed time

### Playback Controls
- **Play/Pause** - Start/stop animation
- **Speed** - 1x, 2x, 5x, 10x, 50x
- **Timeline scrubber** - Jump to any point
- **Jump to Find** - Skip to discovery moment
- **Step** - Advance one time unit at a time

---

## Analytics Dashboard

After running a batch of simulations, display:

### Success Metrics
- Overall success rate (% found within time limit)
- Average/median time to find
- Success rate by zone (HIGH/MEDIUM/LOW/EXTENDED)

### Search Pattern Analysis
- Which strategy performed best
- Optimal number of searchers
- Coverage efficiency

### Heatmap
- Aggregate "where pets were found" across all simulations
- Visual probability cloud on the map
- Compare to predicted zones

### Calibration Insights
- Predicted vs. actual zone distribution
- Recommendations for adjusting model parameters

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Add Prisma models (SimulationConfig, SimulationBatch, Simulation)
- [ ] Run database migration
- [ ] Create basic simulation engine (simple pet + searcher movement)
- [ ] Create `/api/simulator` routes (CRUD operations)
- [ ] Create `/app/simulator/page.js` with basic layout

### Phase 2: Simulation Engine
- [ ] Implement all 4 pet behavior profiles (WANDERER, HIDER, RUNNER, TERRITORIAL)
- [ ] Implement all 4 search strategies (GRID, SPIRAL, RANDOM, PROBABILITY)
- [ ] Add terrain modifiers (URBAN, SUBURBAN, RURAL)
- [ ] Integrate with existing `searchProbability.js` values
- [ ] Add batch processing capability

### Phase 3: Visual Playback
- [ ] Create `SimulatorMap.js` with Leaflet integration
- [ ] Implement `useSimulationPlayback.js` hook
- [ ] Create animated pet/searcher markers with trails
- [ ] Build `PlaybackControls.js` component
- [ ] Add smooth interpolation between recorded positions
- [ ] Implement "find moment" celebration animation

### Phase 4: Analytics Dashboard
- [ ] Create `BatchResults.js` component
- [ ] Implement aggregate statistics calculator
- [ ] Add heatmap overlay for find locations
- [ ] Create zone breakdown visualizations
- [ ] Add CSV/JSON export functionality

### Phase 5: Calibration System
- [ ] Compare simulation predictions to actual `CaseOutcome` data
- [ ] Create feedback loop to adjust base parameters
- [ ] Build accuracy tracking over time
- [ ] Document calibration methodology

---

## Key Integration Points

### Existing Code to Leverage

1. **`app/lib/searchProbability.js`**
   - Base radius values by species/size
   - Time multipliers
   - Zone probability distribution (67.5% HIGH, 18% MEDIUM, etc.)

2. **`app/lib/volunteer/searchGrid.js`**
   - Haversine distance calculations
   - Grid cell generation
   - Priority scoring by distance

3. **`app/components/mission/SARMapView.js`**
   - Leaflet map initialization
   - Probability circle rendering
   - Marker management patterns

4. **`app/api/mission/[missionId]/stream/route.js`**
   - SSE implementation for real-time updates

---

## Future Enhancements

1. **Machine Learning Integration**
   - Train model on validated outcomes
   - Neural network for complex pattern recognition
   - Automatic parameter optimization

2. **Real Terrain Data**
   - Integrate OpenStreetMap for actual barriers (roads, water, fences)
   - Building footprints for urban hiding spots
   - Elevation data for rural areas

3. **Weather Factors**
   - Temperature affects pet movement
   - Rain/snow changes behavior
   - Day/night visibility differences

4. **Community Validation**
   - Allow users to mark "pet found here" on resolved cases
   - Compare to simulation predictions
   - Crowdsource calibration data

---

## Success Metrics

The simulator will be considered successful when:

1. **Accuracy** - Predicted HIGH zone contains actual find location >60% of the time
2. **Utility** - Users report the probability zones helped focus their search
3. **Learning** - Model accuracy improves over time with more outcome data
4. **Engagement** - Searchers use the probability guidance during active searches

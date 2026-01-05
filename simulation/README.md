# Pet Recovery Monte Carlo Simulation Engine

A research-backed Monte Carlo simulation engine for predicting lost pet behavior and optimizing search strategies.

## Features

- **Species-Specific Behavioral Models**
  - Dogs: FDM/DIR gravity spiral movement, continuous exponential fear decay
  - Cats: Threshold phenomenon (10-12 day hiding before emergence), triangular patrol patterns

- **Temperament-Based Behavior**
  - Dogs: Gregarious (G), Confident (C), Aloof (A), Xenophobic (X), Bonded (B)
  - Cats: Curious (CUR), Careless (CL), Cautious (CAU), Xenophobic (X), Bonded (B)

- **Discrete Searcher Agents**
  - Types: Owner, Household, Volunteer, Professional, Shelter Staff, ACO
  - Strategies: NaiveExpandingCircle, ProfileAware, TrapFocused, CoordinatedGrid

- **Recovery Tools**
  - Trap mechanics with habituation and bait effectiveness
  - Scent article mechanics with wind effects
  - Species-appropriate strategies

- **Real-World Terrain**
  - OpenStreetMap integration for real terrain data
  - Traffic risks, hiding spots, barriers, water sources

## Research Foundation

Based on peer-reviewed research:
- Huang et al. (2018) - Cat displacement distributions
- Kremer et al. (2021) - Dog displacement patterns
- Weiss et al. (2012) - Recovery outcome rates
- Albrecht Lost Pet Recovery Protocols - Threshold phenomenon, temperament profiles

## Installation

```bash
# Basic installation (no external dependencies)
pip install -e .

# With development tools
pip install -e ".[dev]"

# With API server
pip install -e ".[api]"

# With performance optimizations
pip install -e ".[performance]"
```

## Quick Start

```python
from simulation.core.types import Species, AnimalProfile, SimulationConfig
from simulation.core.engine import run_single_simulation
from simulation.agents import DogAgent, create_search_team
from simulation.environment import create_simple_environment

# Create pet profile
profile = AnimalProfile(
    species=Species.DOG,
    temperament="C",  # Confident
    size_class="MED",
    age_class="ADT",
    is_indoor_only=False,
    is_indoor_outdoor=True,
    has_microchip=True,
    has_collar=True,
    flight_distance_m=100,
    initial_fear=0.8,
)

# Create simulation
config = SimulationConfig(
    seed=42,
    max_simulation_hours=72,
    start_location=(37.7749, -122.4194),  # San Francisco
    animal_profile=profile,
)

# Create environment
env = create_simple_environment(
    center=config.start_location,
    radius_m=2000,
)

# Create agents
pet = DogAgent(profile, config.start_location)
searchers = create_search_team(
    num_searchers=3,
    home_location=config.start_location,
    target_profile=profile,
)

# Run simulation
result = run_single_simulation(pet, searchers, env, config)

print(f"Outcome: {result.outcome}")
print(f"Time: {result.time_to_outcome:.1f} hours")
print(f"Distance traveled: {result.pet_distance_m:.0f}m")
```

## Monte Carlo Batch Runs

```python
from simulation.monte_carlo import MonteCarloOrchestrator, MonteCarloConfig

mc_config = MonteCarloConfig(
    num_simulations=1000,
    parallel=True,
    base_config=config,
)

orchestrator = MonteCarloOrchestrator(mc_config)
batch_result = orchestrator.run_batch(
    profile=profile,
    start_location=config.start_location,
    environment=env,
)

print(f"Recovery rate: {batch_result.recovery_rate:.1%}")
print(f"Median time to find: {batch_result.median_time_hours:.1f} hours")
```

## OpenStreetMap Integration

```python
from simulation.environment.osm import create_environment_from_osm, osm_to_environment_grid

# Fetch real terrain data
osm_env = create_environment_from_osm(
    center_lat=37.7749,
    center_lon=-122.4194,
    radius_m=1000,
)

# Convert to simulation grid
env = osm_to_environment_grid(osm_env)

# Access features
print(f"Hiding spots: {len(osm_env['hiding_spots'])}")
print(f"Water sources: {len(osm_env['water_sources'])}")
```

## Frontend Integration

```python
from simulation.api import SimulationAPIBridge, FrontendSimulationConfig

bridge = SimulationAPIBridge(use_osm=True)

# From frontend config
frontend_config = FrontendSimulationConfig(
    id="config_123",
    pet_species="DOG",
    pet_size="MEDIUM",
    pet_personality="NEUTRAL",
    # ... other fields
)

# Run and get frontend-compatible result
result = bridge.run_simulation(frontend_config)

# Or run batch
batch_result, sim_results = bridge.run_batch(frontend_config, num_runs=100)
```

## Testing

```bash
# Run all tests
pytest simulation/tests/

# Run with coverage
pytest simulation/tests/ --cov=simulation --cov-report=html

# Run validation tests only
pytest simulation/tests/test_validation.py -v
```

## Architecture

```
simulation/
├── core/           # Core types, constants, utilities, engine
├── agents/         # Pet and searcher agent implementations
├── environment/    # Grid, traps, scent articles, OSM integration
├── monte_carlo/    # Batch orchestration
├── api/            # Frontend bridge
└── tests/          # Comprehensive test suite
```

## License

MIT License - See LICENSE file for details.

"""
Pet Recovery Monte Carlo Simulation Engine

A research-backed simulation framework for modeling lost pet behavior,
searcher effectiveness, and recovery outcomes.

Based on BEHAVIORAL_PROFILES.md specification.

Example usage:
    from simulation import run_monte_carlo, AnimalProfile, SimulationConfig, Species

    # Create a dog profile
    profile = AnimalProfile(
        species=Species.DOG,
        temperament="C",  # Confident
        size_class="MED",
        age_class="ADT",
        escape_type="D1",  # Door dash
        escape_location=(40.7128, -74.0060),
        home_location=(40.7128, -74.0060),
    )

    # Create simulation config
    config = SimulationConfig(
        max_simulation_hours=168,  # 7 days
        num_searchers=3,
    )

    # Run Monte Carlo
    results = run_monte_carlo(profile, config, num_simulations=100)
    print(f"Recovery rate: {results.recovery_rate:.1%}")
"""

from .core.types import (
    Species,
    DogTemperament,
    CatTemperament,
    AnimalProfile,
    AnimalState,
    AnimalStatus,
    SimulationConfig,
    SimulationResult,
    BatchResult,
    OutcomeType,
    SearcherType,
    SearchStrategy,
    TerrainType,
)

from .core.engine import SimulationEngine, run_single_simulation

from .monte_carlo.orchestrator import (
    MonteCarloOrchestrator,
    MonteCarloConfig,
    run_monte_carlo,
    sensitivity_analysis,
)

from .agents.dog_agent import DogAgent
from .agents.cat_agent import CatAgent
from .agents.searcher_agent import SearcherAgent, create_search_team

from .environment.grid import EnvironmentGrid, create_simple_environment

__version__ = "1.0.0"
__all__ = [
    # Types
    "Species",
    "DogTemperament",
    "CatTemperament",
    "AnimalProfile",
    "AnimalState",
    "AnimalStatus",
    "SimulationConfig",
    "SimulationResult",
    "BatchResult",
    "OutcomeType",
    "SearcherType",
    "SearchStrategy",
    "TerrainType",
    # Engine
    "SimulationEngine",
    "run_single_simulation",
    # Monte Carlo
    "MonteCarloOrchestrator",
    "MonteCarloConfig",
    "run_monte_carlo",
    "sensitivity_analysis",
    # Agents
    "DogAgent",
    "CatAgent",
    "SearcherAgent",
    "create_search_team",
    # Environment
    "EnvironmentGrid",
    "create_simple_environment",
]

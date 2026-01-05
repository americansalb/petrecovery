"""
API Bridge for Frontend Integration

Converts between frontend Prisma models and Python simulation types.
Provides REST-compatible endpoints for the Next.js frontend.
"""

import json
import random
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

from ..core.types import (
    Species, AnimalProfile, AnimalState, SimulationConfig as PySimConfig,
    SimulationResult, SearcherProfile, SearcherType, SearchStrategy,
)
from ..core.constants import (
    DOG_TEMPERAMENT_PARAMS, CAT_TEMPERAMENT_PARAMS,
    DOG_SIZE_PARAMS, CAT_SIZE_PARAMS,
)
from ..core.engine import SimulationEngine, run_single_simulation
from ..monte_carlo.orchestrator import MonteCarloOrchestrator, MonteCarloConfig
from ..agents import DogAgent, CatAgent, SearcherAgent, create_search_team
from ..environment import EnvironmentGrid, create_simple_environment
from ..environment.osm import create_environment_from_osm, osm_to_environment_grid


class FrontendPetSpecies(str, Enum):
    """Pet species from Prisma schema."""
    DOG = "DOG"
    CAT = "CAT"


class FrontendPetSize(str, Enum):
    """Pet sizes from Prisma schema."""
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"


class FrontendSearchStrategy(str, Enum):
    """Search strategies from Prisma schema."""
    PASSIVE = "PASSIVE"
    MODERATE = "MODERATE"
    AGGRESSIVE = "AGGRESSIVE"


class FrontendOutcome(str, Enum):
    """Simulation outcomes matching Prisma SimulationOutcome."""
    FOUND_BY_SEARCHER = "FOUND_BY_SEARCHER"
    RETURNED_HOME = "RETURNED_HOME"
    FOUND_VIA_SHELTER = "FOUND_VIA_SHELTER"
    FOUND_VIA_SOCIAL = "FOUND_VIA_SOCIAL"
    FOUND_VIA_PLATFORM = "FOUND_VIA_PLATFORM"
    TIMEOUT_SEARCHING = "TIMEOUT_SEARCHING"
    TIMEOUT_SHELTERED = "TIMEOUT_SHELTERED"


@dataclass
class FrontendSimulationConfig:
    """Configuration from frontend database."""
    id: str
    pet_species: str  # DOG or CAT
    pet_size: str  # SMALL, MEDIUM, LARGE
    pet_personality: str  # FRIENDLY, NEUTRAL, SHY
    is_indoor_pet: bool
    has_microchip: bool
    has_collar: bool
    start_latitude: float
    start_longitude: float
    search_radius_miles: float
    num_searchers: int
    search_strategy: str  # PASSIVE, MODERATE, AGGRESSIVE
    using_traps: bool
    using_scent_articles: bool
    max_simulation_hours: int
    time_step_minutes: int
    start_hour_of_day: int


@dataclass
class FrontendSimulationResult:
    """Result format expected by frontend."""
    id: str
    config_id: str
    batch_id: Optional[str]
    status: str  # PENDING, RUNNING, COMPLETED
    outcome: Optional[str]  # FrontendOutcome value
    random_seed: int
    found_at_minute: Optional[int]
    found_by_searcher: Optional[int]
    found_latitude: Optional[float]
    found_longitude: Optional[float]
    pet_path_json: str  # JSON array
    searcher_paths_json: str  # JSON array
    pet_distance_miles: Optional[float]
    searcher_distance_miles: Optional[float]
    final_pet_state: Optional[str]
    was_transported: bool
    transported_at_minute: Optional[int]


@dataclass
class FrontendBatchResult:
    """Batch result format for frontend."""
    id: str
    config_id: str
    total_runs: int
    completed_runs: int
    status: str
    success_rate: Optional[float]
    avg_time_to_find_mins: Optional[float]
    median_time_to_find_mins: Optional[float]
    avg_pet_distance_miles: Optional[float]
    found_by_searcher_count: int
    returned_home_count: int
    found_via_shelter_count: int
    found_via_social_count: int
    found_via_platform_count: int
    timeout_searching_count: int
    timeout_sheltered_count: int


class ConfigConverter:
    """Converts between frontend and Python config formats."""

    # Map frontend personality to temperaments
    PERSONALITY_TO_DOG_TEMPERAMENT = {
        "FRIENDLY": "G",   # Gregarious
        "NEUTRAL": "C",    # Confident
        "SHY": "A",        # Aloof
    }

    PERSONALITY_TO_CAT_TEMPERAMENT = {
        "FRIENDLY": "CUR",  # Curious
        "NEUTRAL": "CAU",   # Cautious
        "SHY": "X",         # Xenophobic
    }

    # Map frontend sizes
    SIZE_TO_DOG_SIZE = {
        "SMALL": "SML",
        "MEDIUM": "MED",
        "LARGE": "LRG",
    }

    SIZE_TO_CAT_SIZE = {
        "SMALL": "SML",
        "MEDIUM": "MED",
        "LARGE": "LRG",
    }

    # Map search strategies
    STRATEGY_TO_SEARCH_STRATEGY = {
        "PASSIVE": SearchStrategy.NAIVE_EXPANDING,
        "MODERATE": SearchStrategy.PROFILE_AWARE,
        "AGGRESSIVE": SearchStrategy.COORDINATED_GRID,
    }

    @classmethod
    def frontend_to_python_profile(
        cls,
        config: FrontendSimulationConfig
    ) -> AnimalProfile:
        """Convert frontend config to Python AnimalProfile."""

        species = Species.DOG if config.pet_species == "DOG" else Species.CAT

        if species == Species.DOG:
            temperament = cls.PERSONALITY_TO_DOG_TEMPERAMENT.get(
                config.pet_personality, "C"
            )
            size_class = cls.SIZE_TO_DOG_SIZE.get(config.pet_size, "MED")
            temp_params = DOG_TEMPERAMENT_PARAMS.get(temperament, {})
        else:
            temperament = cls.PERSONALITY_TO_CAT_TEMPERAMENT.get(
                config.pet_personality, "CAU"
            )
            size_class = cls.SIZE_TO_CAT_SIZE.get(config.pet_size, "MED")
            temp_params = CAT_TEMPERAMENT_PARAMS.get(temperament, {})

        # Determine age class (default to adult)
        age_class = "ADT"

        # Determine indoor/outdoor status
        is_indoor_only = config.is_indoor_pet
        is_indoor_outdoor = not config.is_indoor_pet

        return AnimalProfile(
            species=species,
            temperament=temperament,
            size_class=size_class,
            age_class=age_class,
            is_indoor_only=is_indoor_only,
            is_indoor_outdoor=is_indoor_outdoor,
            has_microchip=config.has_microchip,
            has_collar=config.has_collar,
            flight_distance_m=temp_params.get("flight_distance_m", {}).get("max", 100),
            initial_fear=0.8,  # Default high fear for lost pet
        )

    @classmethod
    def frontend_to_python_config(
        cls,
        config: FrontendSimulationConfig,
        seed: Optional[int] = None
    ) -> PySimConfig:
        """Convert frontend config to Python SimulationConfig."""

        profile = cls.frontend_to_python_profile(config)

        # Convert miles to meters for radius
        search_radius_m = config.search_radius_miles * 1609.34

        # Convert hours to simulation ticks
        max_ticks = int(config.max_simulation_hours * 60 / config.time_step_minutes)

        return PySimConfig(
            seed=seed or random.randint(1, 1000000),
            max_simulation_hours=config.max_simulation_hours,
            time_step_minutes=config.time_step_minutes,
            start_hour_of_day=config.start_hour_of_day,
            start_location=(config.start_latitude, config.start_longitude),
            search_radius_m=search_radius_m,
            num_searchers=config.num_searchers,
            use_traps=config.using_traps,
            use_scent_articles=config.using_scent_articles,
            animal_profile=profile,
        )

    @classmethod
    def python_result_to_frontend(
        cls,
        result: SimulationResult,
        config_id: str,
        batch_id: Optional[str] = None
    ) -> FrontendSimulationResult:
        """Convert Python result to frontend format."""

        # Map outcome
        outcome_map = {
            "captured": FrontendOutcome.FOUND_BY_SEARCHER.value,
            "detected": FrontendOutcome.FOUND_BY_SEARCHER.value,
            "self_return": FrontendOutcome.RETURNED_HOME.value,
            "shelter": FrontendOutcome.FOUND_VIA_SHELTER.value,
            "timeout": FrontendOutcome.TIMEOUT_SEARCHING.value,
            "deceased": FrontendOutcome.TIMEOUT_SEARCHING.value,
        }

        outcome = outcome_map.get(result.outcome, FrontendOutcome.TIMEOUT_SEARCHING.value)

        # Convert path to JSON
        pet_path = [
            {
                "minute": step.get("hour", 0) * 60,
                "lat": step.get("position", (0, 0))[0],
                "lng": step.get("position", (0, 0))[1],
                "state": step.get("state", "unknown"),
                "energy": step.get("stamina", 1.0),
                "hunger": step.get("hunger", 0.0),
            }
            for step in result.pet_path
        ]

        searcher_paths = [
            {
                "searcherId": i,
                "path": [
                    {
                        "minute": step.get("hour", 0) * 60,
                        "lat": step.get("position", (0, 0))[0],
                        "lng": step.get("position", (0, 0))[1],
                    }
                    for step in path
                ]
            }
            for i, path in enumerate(result.searcher_paths)
        ]

        # Calculate distance in miles
        pet_distance_miles = result.pet_distance_m / 1609.34 if result.pet_distance_m else None

        return FrontendSimulationResult(
            id=result.simulation_id,
            config_id=config_id,
            batch_id=batch_id,
            status="COMPLETED",
            outcome=outcome,
            random_seed=result.seed,
            found_at_minute=int(result.time_to_outcome * 60) if result.time_to_outcome else None,
            found_by_searcher=result.found_by_searcher_id,
            found_latitude=result.final_position[0] if result.final_position else None,
            found_longitude=result.final_position[1] if result.final_position else None,
            pet_path_json=json.dumps(pet_path),
            searcher_paths_json=json.dumps(searcher_paths),
            pet_distance_miles=pet_distance_miles,
            searcher_distance_miles=None,  # TODO: Calculate
            final_pet_state=result.final_state,
            was_transported=False,  # TODO: Implement
            transported_at_minute=None,
        )


class SimulationAPIBridge:
    """
    Bridge between frontend API and Python simulation engine.

    Usage:
        bridge = SimulationAPIBridge()

        # Run single simulation
        result = bridge.run_simulation(frontend_config)

        # Run batch
        batch_result = bridge.run_batch(frontend_config, num_runs=100)
    """

    def __init__(self, use_osm: bool = True, osm_cache_dir: Optional[str] = None):
        self.use_osm = use_osm
        self.osm_cache_dir = osm_cache_dir

    def create_environment(
        self,
        center_lat: float,
        center_lon: float,
        radius_m: float
    ) -> EnvironmentGrid:
        """Create environment grid, optionally from OSM data."""

        if self.use_osm:
            try:
                osm_env = create_environment_from_osm(
                    center_lat, center_lon, radius_m
                )
                return osm_to_environment_grid(osm_env)
            except Exception as e:
                # Fall back to simple environment on OSM failure
                print(f"OSM load failed, using simple environment: {e}")

        return create_simple_environment(
            center=(center_lat, center_lon),
            radius_m=radius_m,
        )

    def run_simulation(
        self,
        config: FrontendSimulationConfig,
        seed: Optional[int] = None
    ) -> FrontendSimulationResult:
        """Run a single simulation with frontend config."""

        py_config = ConfigConverter.frontend_to_python_config(config, seed)

        # Create environment
        env = self.create_environment(
            config.start_latitude,
            config.start_longitude,
            py_config.search_radius_m
        )

        # Create pet agent
        profile = py_config.animal_profile
        if profile.species == Species.DOG:
            pet = DogAgent(profile, (config.start_latitude, config.start_longitude))
        else:
            pet = CatAgent(profile, (config.start_latitude, config.start_longitude))

        # Create search team
        strategy = ConfigConverter.STRATEGY_TO_SEARCH_STRATEGY.get(
            config.search_strategy, SearchStrategy.PROFILE_AWARE
        )
        searchers = create_search_team(
            num_searchers=config.num_searchers,
            home_location=(config.start_latitude, config.start_longitude),
            target_profile=profile,
            strategy=strategy,
        )

        # Run simulation
        result = run_single_simulation(
            pet=pet,
            searchers=searchers,
            environment=env,
            config=py_config,
        )

        return ConfigConverter.python_result_to_frontend(
            result, config.id
        )

    def run_batch(
        self,
        config: FrontendSimulationConfig,
        num_runs: int = 100,
        parallel: bool = True
    ) -> Tuple[FrontendBatchResult, List[FrontendSimulationResult]]:
        """Run a batch of simulations."""

        py_config = ConfigConverter.frontend_to_python_config(config)

        # Create MC config
        mc_config = MonteCarloConfig(
            num_simulations=num_runs,
            parallel=parallel,
            base_config=py_config,
        )

        # Create environment (cached for batch)
        env = self.create_environment(
            config.start_latitude,
            config.start_longitude,
            py_config.search_radius_m
        )

        # Run Monte Carlo
        orchestrator = MonteCarloOrchestrator(mc_config)
        batch_result = orchestrator.run_batch(
            profile=py_config.animal_profile,
            start_location=(config.start_latitude, config.start_longitude),
            environment=env,
        )

        # Convert individual results
        frontend_results = [
            ConfigConverter.python_result_to_frontend(r, config.id)
            for r in batch_result.simulations
        ]

        # Calculate aggregate stats
        successful = [r for r in batch_result.simulations if r.outcome in ["captured", "detected", "self_return"]]
        success_rate = len(successful) / num_runs if num_runs > 0 else 0

        times_to_find = [r.time_to_outcome for r in successful if r.time_to_outcome]
        avg_time = sum(times_to_find) / len(times_to_find) * 60 if times_to_find else None
        sorted_times = sorted(times_to_find)
        median_time = sorted_times[len(sorted_times) // 2] * 60 if sorted_times else None

        distances = [r.pet_distance_m for r in batch_result.simulations if r.pet_distance_m]
        avg_distance = sum(distances) / len(distances) / 1609.34 if distances else None

        # Count outcomes
        outcome_counts = {
            "found_by_searcher": 0,
            "returned_home": 0,
            "found_via_shelter": 0,
            "timeout_searching": 0,
        }
        for r in batch_result.simulations:
            if r.outcome in ["captured", "detected"]:
                outcome_counts["found_by_searcher"] += 1
            elif r.outcome == "self_return":
                outcome_counts["returned_home"] += 1
            elif r.outcome == "shelter":
                outcome_counts["found_via_shelter"] += 1
            else:
                outcome_counts["timeout_searching"] += 1

        frontend_batch = FrontendBatchResult(
            id=batch_result.batch_id,
            config_id=config.id,
            total_runs=num_runs,
            completed_runs=len(batch_result.simulations),
            status="COMPLETED",
            success_rate=success_rate,
            avg_time_to_find_mins=avg_time,
            median_time_to_find_mins=median_time,
            avg_pet_distance_miles=avg_distance,
            found_by_searcher_count=outcome_counts["found_by_searcher"],
            returned_home_count=outcome_counts["returned_home"],
            found_via_shelter_count=outcome_counts["found_via_shelter"],
            found_via_social_count=0,
            found_via_platform_count=0,
            timeout_searching_count=outcome_counts["timeout_searching"],
            timeout_sheltered_count=0,
        )

        return frontend_batch, frontend_results


def create_api_handler():
    """
    Create FastAPI/Flask-compatible handler functions.

    Returns dict of handler functions that can be mounted to a web framework.
    """
    bridge = SimulationAPIBridge()

    def run_simulation_handler(config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Handle single simulation request."""
        config = FrontendSimulationConfig(**config_dict)
        result = bridge.run_simulation(config)
        return asdict(result)

    def run_batch_handler(
        config_dict: Dict[str, Any],
        num_runs: int = 100
    ) -> Dict[str, Any]:
        """Handle batch simulation request."""
        config = FrontendSimulationConfig(**config_dict)
        batch_result, sim_results = bridge.run_batch(config, num_runs)
        return {
            "batch": asdict(batch_result),
            "simulations": [asdict(r) for r in sim_results],
        }

    return {
        "run_simulation": run_simulation_handler,
        "run_batch": run_batch_handler,
    }

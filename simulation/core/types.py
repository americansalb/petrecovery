"""
Core Type Definitions for Pet Recovery Monte Carlo Simulation

Based on BEHAVIORAL_PROFILES.md Part 0
All types used throughout the simulation engine.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from enum import Enum
import math


# =============================================================================
# ENUMERATIONS
# =============================================================================

class Species(Enum):
    DOG = "dog"
    CAT = "cat"


class TerrainType(Enum):
    URBAN = "urban"
    SUBURBAN = "suburban"
    RURAL = "rural"
    WOODED = "wooded"
    WATER = "water"
    ROAD = "road"
    HIGHWAY = "highway"
    PARK = "park"
    FOREST = "forest"
    DEEP_FOREST = "deep_forest"
    WETLAND = "wetland"
    AGRICULTURAL = "agricultural"
    INDUSTRIAL = "industrial"


class DogTemperament(Enum):
    """Dog temperament codes from Kat Albrecht behavioral research"""
    G = "gregarious"      # Approaches strangers readily
    C = "confident"       # Curious but cautious
    A = "aloof"          # Avoids but doesn't flee
    X = "xenophobic"     # Flees from all humans
    B = "bonded"         # Only trusts owner/family


class CatTemperament(Enum):
    """Cat temperament codes from Missing Pet Partnership"""
    CUR = "curious"       # Investigates, may approach
    CL = "careless"       # Indoor/outdoor, street-smart
    CAU = "cautious"      # Hides but may emerge
    X = "xenophobic"      # Flees, deep hiding
    B = "bonded"          # Only trusts owner


class DogSize(Enum):
    TOY = "toy"           # < 10 lbs
    SML = "small"         # 10-25 lbs
    MED = "medium"        # 25-50 lbs
    LRG = "large"         # 50-90 lbs
    GNT = "giant"         # > 90 lbs


class CatSize(Enum):
    SML = "small"         # < 8 lbs
    MED = "medium"        # 8-12 lbs
    LRG = "large"         # > 12 lbs


class DogAge(Enum):
    PUP = "puppy"         # < 1 year
    YNG = "young"         # 1-3 years
    ADT = "adult"         # 3-7 years
    SEN = "senior"        # > 7 years


class CatAge(Enum):
    KIT = "kitten"        # < 6 months
    JUV = "juvenile"      # 6 months - 1 year
    YNG = "young"         # 1-3 years
    ADT = "adult"         # 3-10 years
    SEN = "senior"        # > 10 years


class AnimalStatus(Enum):
    FLEEING = "fleeing"
    TRAVELING = "traveling"
    HIDING = "hiding"
    RESTING = "resting"
    FORAGING = "foraging"
    RECOVERED = "recovered"
    DECEASED = "deceased"


class CatHidingPhase(Enum):
    """Cat-specific hiding phases for threshold phenomenon"""
    DEEP = "deep_hiding"        # First 10-12 days
    EMERGENCE = "emergence"     # After threshold reached


class DogBackground(Enum):
    F = "family"          # Family pet
    R = "rescue"          # Recent rescue
    ST = "stray"          # Former stray
    W = "working"         # Working dog


class CatBackground(Enum):
    F = "family"          # Family pet
    R = "rescue"          # Recent rescue
    FO = "feral_origin"   # Formerly feral
    BR = "breeder"        # From breeder
    MH = "multi_home"     # Multi-cat household


class HealthStatus(Enum):
    HLT = "healthy"
    CHR = "chronic"       # Chronic condition
    INJ = "injured"
    ILL = "ill"


class IndoorOutdoor(Enum):
    """Cat indoor/outdoor status"""
    IO = "indoor_only"
    IOP = "indoor_primarily"
    OIP = "outdoor_primarily"
    OO = "outdoor_only"


class SearcherType(Enum):
    """Types of searchers with different effectiveness"""
    OWNER = "owner"
    HOUSEHOLD = "household_member"
    FRIEND = "friend"
    VOLUNTEER = "volunteer"
    PROFESSIONAL = "professional"
    SHELTER_STAFF = "shelter_staff"
    ACO = "animal_control_officer"


class SearchStrategy(Enum):
    """Search strategies from BEHAVIORAL_PROFILES Part 11"""
    NAIVE_EXPANDING = "naive_expanding_circle"
    PROFILE_AWARE = "profile_aware"
    TRAP_FOCUSED = "trap_focused"
    COORDINATED_GRID = "coordinated_grid"
    SIGHTING_CHASER = "sighting_chaser"


class OutcomeType(Enum):
    """All possible simulation outcomes"""
    SELF_RETURN = "self_return"
    FOUND_BY_OWNER = "found_by_owner"
    FOUND_BY_SEARCHER = "found_by_searcher"
    STRANGER_RETURN = "stranger_return"
    AT_SHELTER = "at_shelter"
    TRAPPED = "trapped"
    ADOPTED_BY_NEIGHBOR = "adopted_by_neighbor"
    STILL_MISSING = "still_missing"
    DECEASED_TRAFFIC = "deceased_traffic"
    DECEASED_PREDATOR = "deceased_predator"
    DECEASED_EXPOSURE = "deceased_exposure"
    DECEASED_DEHYDRATION = "deceased_dehydration"
    DECEASED_STARVATION = "deceased_starvation"
    DECEASED_INJURY = "deceased_injury"


# =============================================================================
# ESCAPE TYPE CODES
# =============================================================================

# Dog escape types
DOG_ESCAPE_TYPES = {
    "W1": {"name": "walk_off_leash", "initial_fear": 0.3, "initial_status": "traveling"},
    "W2": {"name": "walk_leash_slip", "initial_fear": 0.5, "initial_status": "fleeing"},
    "W3": {"name": "walk_leash_drop", "initial_fear": 0.4, "initial_status": "traveling"},
    "Y1": {"name": "yard_gate_left", "initial_fear": 0.2, "initial_status": "traveling"},
    "Y2": {"name": "yard_jumped_fence", "initial_fear": 0.4, "initial_status": "fleeing"},
    "Y3": {"name": "yard_dug_under", "initial_fear": 0.3, "initial_status": "traveling"},
    "D1": {"name": "door_dash", "initial_fear": 0.5, "initial_status": "fleeing"},
    "D2": {"name": "door_left_open", "initial_fear": 0.2, "initial_status": "traveling"},
    "V1": {"name": "vehicle_accident", "initial_fear": 0.95, "initial_status": "fleeing"},
    "V2": {"name": "vehicle_jumped_out", "initial_fear": 0.8, "initial_status": "fleeing"},
    "V3": {"name": "vehicle_ran_from_car", "initial_fear": 0.7, "initial_status": "fleeing"},
    "ST1": {"name": "startle_thunder", "initial_fear": 0.9, "initial_status": "fleeing"},
    "ST2": {"name": "startle_fireworks", "initial_fear": 0.9, "initial_status": "fleeing"},
    "ST3": {"name": "startle_gunshot", "initial_fear": 0.95, "initial_status": "fleeing"},
    "ST4": {"name": "startle_other_loud", "initial_fear": 1.0, "initial_status": "fleeing"},
    "TH1": {"name": "theft", "initial_fear": 0.8, "initial_status": "hiding"},
    "TH2": {"name": "intentional_abandonment", "initial_fear": 0.6, "initial_status": "hiding"},
    "OT": {"name": "other", "initial_fear": 0.5, "initial_status": "traveling"},
}

# Cat escape types (same codes, different fear responses)
CAT_ESCAPE_TYPES = {
    "W1": {"name": "walk_off_leash", "initial_fear": 0.4, "initial_status": "hiding"},
    "W2": {"name": "walk_harness_slip", "initial_fear": 0.6, "initial_status": "fleeing"},
    "D1": {"name": "door_dash", "initial_fear": 0.6, "initial_status": "fleeing"},
    "D2": {"name": "door_left_open", "initial_fear": 0.3, "initial_status": "traveling"},
    "D3": {"name": "window_screen_failure", "initial_fear": 0.5, "initial_status": "hiding"},
    "V1": {"name": "vehicle_accident", "initial_fear": 0.98, "initial_status": "fleeing"},
    "V2": {"name": "vehicle_jumped_out", "initial_fear": 0.85, "initial_status": "fleeing"},
    "ST1": {"name": "startle_thunder", "initial_fear": 0.85, "initial_status": "fleeing"},
    "ST2": {"name": "startle_fireworks", "initial_fear": 0.9, "initial_status": "fleeing"},
    "ST3": {"name": "startle_predator", "initial_fear": 0.95, "initial_status": "fleeing"},
    "ST4": {"name": "startle_other", "initial_fear": 0.8, "initial_status": "fleeing"},
    "M1": {"name": "move_new_home", "initial_fear": 0.7, "initial_status": "hiding"},
    "M2": {"name": "move_construction", "initial_fear": 0.6, "initial_status": "fleeing"},
    "TH1": {"name": "theft", "initial_fear": 0.9, "initial_status": "hiding"},
    "OT": {"name": "other", "initial_fear": 0.5, "initial_status": "hiding"},
}


# =============================================================================
# CORE DATACLASSES
# =============================================================================

@dataclass
class AnimalProfile:
    """
    Complete profile describing a lost pet's characteristics.
    Used to parameterize movement, behavior, and recovery probability.
    """
    species: Species
    temperament: str                      # Dog: G/C/A/X/B, Cat: CUR/CL/CAU/X/B
    size_class: str                       # Dog: TOY/SML/MED/LRG/GNT, Cat: SML/MED/LRG
    age_class: str                        # Dog: PUP/YNG/ADT/SEN, Cat: KIT/JUV/YNG/ADT/SEN
    breed_or_type: Optional[str] = None
    indoor_outdoor: Optional[str] = None  # Cat only: IO/IOP/OIP/OO
    background: str = "F"                 # F/R/ST/W (dog) or F/R/FO/BR/MH (cat)
    health_status: str = "HLT"            # HLT/CHR/INJ/ILL
    escape_type: str = "D1"               # See escape type codes
    escape_location: Tuple[float, float] = (0.0, 0.0)  # (lat, lon)
    home_location: Tuple[float, float] = (0.0, 0.0)
    territory: str = "HOME"               # HOME/NEAR/FAR/LOST
    is_neutered: bool = True
    microchipped: bool = False
    has_collar: bool = False
    has_collar_with_id: bool = False
    recall_training: float = 0.5          # 0.0-1.0

    def get_escape_params(self) -> Dict[str, Any]:
        """Get initial fear and status based on escape type"""
        if self.species == Species.DOG:
            return DOG_ESCAPE_TYPES.get(self.escape_type, DOG_ESCAPE_TYPES["OT"])
        else:
            return CAT_ESCAPE_TYPES.get(self.escape_type, CAT_ESCAPE_TYPES["OT"])


@dataclass
class AnimalState:
    """
    Runtime state of an animal during simulation.
    Updated each tick based on behavior and environment.
    """
    position: Tuple[float, float]         # Current (lat, lon)
    status: AnimalStatus = AnimalStatus.TRAVELING
    fear_level: float = 0.5               # 0.0-1.0
    hunger_level: float = 0.0             # 0.0-1.0
    thirst_level: float = 0.0             # 0.0-1.0
    stamina: float = 1.0                  # 0.0-1.0
    health: HealthStatus = HealthStatus.HLT
    injury_severity: float = 0.0          # 0.0-1.0
    injury_type: Optional[str] = None
    injury_infected: bool = False
    hours_since_escape: float = 0.0
    hours_since_last_water: float = 0.0
    hours_since_last_food: float = 0.0
    current_hiding_spot: Optional[Any] = None
    visited_locations: List[Tuple[float, float]] = field(default_factory=list)
    threshold_reached: bool = False       # Cat only: has threshold been reached?
    hiding_phase: Optional[CatHidingPhase] = None
    last_scent_point: Optional[Tuple[float, float]] = None
    current_cell: Tuple[int, int] = (0, 0)
    current_speed: float = 1.0            # m/s
    is_hiding: bool = False
    hiding_spot_quality: float = 0.0
    human_wariness: float = 0.0           # Increases after failed captures
    failed_capture_count: int = 0
    last_failed_capture_time: float = 0.0
    death_cause: Optional[str] = None
    recovery_method: Optional[str] = None
    recovered_by: Optional[str] = None
    trap_wariness: Dict[str, float] = field(default_factory=dict)
    time_of_day: int = 12                 # 0-23 hour


@dataclass
class SightingReport:
    """A reported sighting of the lost pet."""
    location: Tuple[float, float]
    timestamp: datetime
    confidence: float = 0.5               # 0-1
    direction_of_travel: Optional[float] = None  # Radians
    behavior_observed: Optional[str] = None
    reporter_type: str = "stranger"


@dataclass
class GridMetadata:
    """Metadata for the simulation grid."""
    cell_size_m: float = 10.0
    origin_lat: float = 0.0
    origin_lon: float = 0.0
    grid_width: int = 100
    grid_height: int = 100

    def grid_to_coords(self, i: int, j: int) -> Tuple[float, float]:
        """Convert grid indices to lat/lon coordinates."""
        meters_per_deg_lat = 111000
        meters_per_deg_lon = 111000 * math.cos(math.radians(self.origin_lat))
        lat = self.origin_lat + (i * self.cell_size_m) / meters_per_deg_lat
        lon = self.origin_lon + (j * self.cell_size_m) / meters_per_deg_lon
        return (lat, lon)

    def coords_to_grid(self, lat: float, lon: float) -> Tuple[int, int]:
        """Convert lat/lon coordinates to grid indices."""
        meters_per_deg_lat = 111000
        meters_per_deg_lon = 111000 * math.cos(math.radians(self.origin_lat))
        i = int((lat - self.origin_lat) * meters_per_deg_lat / self.cell_size_m)
        j = int((lon - self.origin_lon) * meters_per_deg_lon / self.cell_size_m)
        return (max(0, min(self.grid_height - 1, i)),
                max(0, min(self.grid_width - 1, j)))


@dataclass
class EnvironmentCell:
    """A single cell in the environment grid."""
    grid_x: int
    grid_y: int
    lat: float
    lon: float
    terrain_type: TerrainType = TerrainType.SUBURBAN
    hiding_spots: int = 0
    hiding_spot_quality: float = 0.0
    water_sources: int = 0
    food_sources: int = 0
    human_activity: float = 0.5           # 0-1
    traffic_risk: float = 0.1             # 0-1
    predator_risk: float = 0.1            # 0-1
    is_barrier: bool = False
    weather_protection: float = 0.0       # 0-1


@dataclass
class TrapInfo:
    """Information about a placed trap."""
    location: Tuple[float, float]
    trap_type: str = "box_trap_small"
    bait_type: str = "standard_dog_food"
    days_since_placement: int = 0
    placed_at_hours: float = 0.0
    is_active: bool = True
    habituation_visits: int = 0           # Times animal approached but didn't enter


@dataclass
class ScentArticle:
    """A scent article placed in the search area."""
    location: Tuple[float, float]
    placed_at_hours: float
    article_type: str = "worn_clothing"
    type_multiplier: float = 1.0
    wind_direction: Optional[float] = None  # Radians
    wind_speed: float = 0.0                 # m/s


@dataclass
class SearcherProfile:
    """Profile for a searcher agent."""
    searcher_type: SearcherType
    search_strategy: SearchStrategy
    hours_available_per_day: float = 4.0
    search_speed_mps: float = 1.2         # Walking speed
    detection_range_m: float = 30.0
    recall_effectiveness: float = 0.5     # For owner/household
    dedication_level: float = 0.7         # 0-1, affects persistence
    fatigue_rate: float = 0.1             # Per hour
    current_fatigue: float = 0.0


@dataclass
class SimulationConfig:
    """Configuration for a simulation run."""
    max_simulation_hours: int = 168       # 7 days
    tick_duration_minutes: float = 5.0
    grid_cell_size_m: float = 10.0
    search_radius_m: float = 2000.0
    num_searchers: int = 1
    include_traps: bool = False
    include_scent_articles: bool = False
    weather_enabled: bool = False
    predator_enabled: bool = True
    random_seed: Optional[int] = None


@dataclass
class SimulationResult:
    """Results from a single simulation run."""
    outcome: OutcomeType
    outcome_hours: Optional[float] = None
    outcome_location: Optional[Tuple[float, float]] = None
    total_distance_traveled_m: float = 0.0
    max_distance_from_home_m: float = 0.0
    final_distance_from_home_m: float = 0.0
    path: List[Tuple[float, float, float]] = field(default_factory=list)  # (lat, lon, hour)
    sightings: List[SightingReport] = field(default_factory=list)
    state_history: List[Dict[str, Any]] = field(default_factory=list)
    seed: Optional[int] = None


@dataclass
class BatchResult:
    """Aggregated results from a batch of simulations."""
    total_runs: int
    outcome_counts: Dict[OutcomeType, int] = field(default_factory=dict)
    outcome_rates: Dict[OutcomeType, float] = field(default_factory=dict)
    recovery_rate: float = 0.0
    mortality_rate: float = 0.0
    avg_recovery_hours: Optional[float] = None
    median_recovery_hours: Optional[float] = None
    avg_distance_traveled_m: float = 0.0
    median_max_distance_m: float = 0.0
    confidence_intervals: Dict[str, Tuple[float, float]] = field(default_factory=dict)

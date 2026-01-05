"""
Trap Mechanics for Pet Recovery Simulation

Implements trap placement, habituation, bait effectiveness,
and capture mechanics from BEHAVIORAL_PROFILES.md.
"""

import math
import random
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

from ..core.types import TrapInfo, Species
from ..core.constants import TRAP_PARAMS, BAIT_EFFECTIVENESS
from ..core.utils import distance, get_time_period, clamp


class TrapType(Enum):
    BOX_TRAP_SMALL = "box_trap_small"
    BOX_TRAP_MEDIUM = "box_trap_medium"
    BOX_TRAP_LARGE = "box_trap_large"
    MISSY_TRAP = "missy_trap"
    DROP_TRAP = "drop_trap"
    TRANSFER_TRAP = "transfer_trap"


class BaitType(Enum):
    STANDARD_DOG_FOOD = "standard_dog_food"
    HIGH_VALUE_DOG_TREAT = "high_value_dog_treat"
    CANNED_CAT_FOOD = "canned_cat_food"
    TUNA = "tuna"
    ROTISSERIE_CHICKEN = "rotisserie_chicken"
    SARDINES = "sardines"
    KFC_ORIGINAL = "kfc_original"
    MACKEREL = "mackerel"


@dataclass
class TrapState:
    """Runtime state of a trap."""
    trap_id: str
    location: Tuple[float, float]
    trap_type: TrapType
    bait_type: BaitType
    is_active: bool = True
    is_triggered: bool = False
    placed_at_hour: float = 0.0
    last_checked_hour: float = 0.0
    bait_freshness: float = 1.0  # Degrades over time
    visits_by_target: int = 0
    visits_by_other: int = 0
    capture_animal_id: Optional[str] = None


class TrapManager:
    """
    Manages trap placement, state, and capture mechanics.

    Key mechanics:
    - Habituation: Animals become less wary after multiple visits
    - Bait degradation: Bait becomes less effective over time
    - Time of day: Capture probability varies (crepuscular for cats)
    - Species-specific trap sizes
    """

    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed)
        self.traps: Dict[str, TrapState] = {}
        self.trap_counter = 0

    def place_trap(
        self,
        location: Tuple[float, float],
        trap_type: TrapType = TrapType.BOX_TRAP_SMALL,
        bait_type: BaitType = BaitType.ROTISSERIE_CHICKEN,
        current_hour: float = 0.0
    ) -> str:
        """Place a new trap and return its ID."""
        self.trap_counter += 1
        trap_id = f"trap_{self.trap_counter}"

        self.traps[trap_id] = TrapState(
            trap_id=trap_id,
            location=location,
            trap_type=trap_type,
            bait_type=bait_type,
            placed_at_hour=current_hour,
            last_checked_hour=current_hour,
        )

        return trap_id

    def check_trap(self, trap_id: str, current_hour: float) -> Optional[str]:
        """
        Check a trap for captures.
        Returns captured animal ID if any.
        """
        if trap_id not in self.traps:
            return None

        trap = self.traps[trap_id]
        trap.last_checked_hour = current_hour

        if trap.is_triggered and trap.capture_animal_id:
            return trap.capture_animal_id

        return None

    def reset_trap(self, trap_id: str, new_bait: Optional[BaitType] = None):
        """Reset a triggered trap with optional new bait."""
        if trap_id not in self.traps:
            return

        trap = self.traps[trap_id]
        trap.is_triggered = False
        trap.capture_animal_id = None

        if new_bait:
            trap.bait_type = new_bait
            trap.bait_freshness = 1.0

    def update_bait_freshness(self, hours_delta: float):
        """Update bait freshness for all traps."""
        # Bait loses ~20% effectiveness per day
        decay_rate = 0.2 / 24

        for trap in self.traps.values():
            if trap.is_active and not trap.is_triggered:
                trap.bait_freshness = max(0.1, trap.bait_freshness - decay_rate * hours_delta)

    def calculate_attraction_radius(
        self,
        trap: TrapState,
        wind_speed_mps: float = 0,
        wind_direction: Optional[float] = None
    ) -> Tuple[float, Optional[float]]:
        """
        Calculate the effective attraction radius of a trap.

        Returns: (radius_m, downwind_direction) or (radius_m, None) if no wind
        """
        # Base radius depends on bait type and freshness
        base_radius = 30  # meters

        # Bait effectiveness
        bait_key = trap.bait_type.value
        bait_mult = 1.0  # Default

        # Freshness affects radius
        radius = base_radius * trap.bait_freshness

        # Wind extends radius downwind
        if wind_speed_mps > 2:
            # Light wind: 1.5x, Moderate: 2x, Strong: 2.5x
            if wind_speed_mps < 5:
                wind_mult = 1.5
            elif wind_speed_mps < 10:
                wind_mult = 2.0
            else:
                wind_mult = 2.5

            radius *= wind_mult
            return (radius, wind_direction)

        return (radius, None)

    def attempt_capture(
        self,
        trap_id: str,
        animal_profile: Any,
        animal_state: Any,
        current_hour: float,
        rng: Optional[random.Random] = None
    ) -> Tuple[bool, str]:
        """
        Attempt to capture an animal in a trap.

        Returns: (captured: bool, reason: str)
        """
        if rng is None:
            rng = self.rng

        if trap_id not in self.traps:
            return (False, "trap_not_found")

        trap = self.traps[trap_id]

        if not trap.is_active or trap.is_triggered:
            return (False, "trap_inactive")

        # Check trap size compatibility
        trap_params = TRAP_PARAMS.get(trap.trap_type.value, {})
        suitable_for = trap_params.get("suitable_for", [])

        species = animal_profile.species.value
        size = animal_profile.size_class

        is_suitable = False
        if species == "cat" and "cat" in suitable_for:
            is_suitable = True
        elif species == "dog":
            if size in ["TOY", "SML"] and "dog_small" in suitable_for:
                is_suitable = True
            elif size in ["MED"] and "dog_medium" in suitable_for:
                is_suitable = True
            elif size in ["LRG", "GNT"] and "dog_large" in suitable_for:
                is_suitable = True

        if not is_suitable:
            return (False, "wrong_trap_size")

        # Base capture probability
        base_prob = trap_params.get("base_capture_prob", 0.25)

        # Bait effectiveness for species
        bait_key = trap.bait_type.value
        bait_effect = BAIT_EFFECTIVENESS.get(bait_key, {}).get(species, 1.0)

        # Bait freshness
        freshness_mult = trap.bait_freshness

        # Hunger increases capture probability
        hunger_mult = 1 + animal_state.hunger_level * 0.5

        # Fear decreases capture probability
        fear_mult = 1 - animal_state.fear_level * 0.4

        # Time of day (cats more active at dawn/dusk)
        time_period = get_time_period(int(current_hour) % 24)
        if species == "cat":
            if time_period in ["dawn", "dusk"]:
                time_mult = 1.5
            elif time_period == "night":
                time_mult = 1.0
            else:
                time_mult = 0.5
        else:
            # Dogs more consistent
            if time_period == "night":
                time_mult = 0.7
            else:
                time_mult = 1.0

        # Habituation: Previous visits without capture reduce wariness
        # But also increase trap-specific wariness
        trap_wariness = animal_state.trap_wariness.get(trap_id, 0)
        habituation_visits = trap.visits_by_target

        # Habituation bonus (more visits = more comfortable approaching)
        habituation_mult = 1 + min(habituation_visits * 0.1, 0.5)

        # But trap wariness from failed captures is penalty
        wariness_mult = 1 - trap_wariness * 0.5

        # Calculate final probability
        capture_prob = (
            base_prob *
            bait_effect *
            freshness_mult *
            hunger_mult *
            fear_mult *
            time_mult *
            habituation_mult *
            wariness_mult
        )

        capture_prob = clamp(capture_prob, 0.01, 0.85)

        # Roll for capture
        if rng.random() < capture_prob:
            trap.is_triggered = True
            trap.capture_animal_id = "captured"
            return (True, "captured")
        else:
            # Record visit
            trap.visits_by_target += 1

            # Increase trap wariness slightly
            current_wariness = animal_state.trap_wariness.get(trap_id, 0)
            animal_state.trap_wariness[trap_id] = min(0.8, current_wariness + 0.1)

            return (False, "escaped")

    def get_nearby_traps(
        self,
        position: Tuple[float, float],
        radius_m: float = 100
    ) -> List[Tuple[str, float]]:
        """Get all traps within radius of position."""
        nearby = []
        for trap_id, trap in self.traps.items():
            if trap.is_active and not trap.is_triggered:
                dist = distance(position, trap.location)
                if dist <= radius_m:
                    nearby.append((trap_id, dist))

        return sorted(nearby, key=lambda x: x[1])

    def get_trap_status(self, trap_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a trap."""
        if trap_id not in self.traps:
            return None

        trap = self.traps[trap_id]
        return {
            "trap_id": trap.trap_id,
            "location": trap.location,
            "trap_type": trap.trap_type.value,
            "bait_type": trap.bait_type.value,
            "is_active": trap.is_active,
            "is_triggered": trap.is_triggered,
            "bait_freshness": trap.bait_freshness,
            "visits_by_target": trap.visits_by_target,
            "has_capture": trap.capture_animal_id is not None,
        }

    def get_all_trap_statuses(self) -> List[Dict[str, Any]]:
        """Get status of all traps."""
        return [self.get_trap_status(tid) for tid in self.traps]


def calculate_optimal_trap_placement(
    last_known_position: Tuple[float, float],
    sightings: List[Any],
    species: str,
    hiding_spots: List[Tuple[float, float, float]],
    num_traps: int = 3
) -> List[Tuple[float, float]]:
    """
    Calculate optimal trap placement locations based on behavioral profile.

    For cats: Near hiding spots, on patrol routes
    For dogs: Along travel corridors, near food sources
    """
    placements = []

    if species == "cat":
        # Cats: Place near high-quality hiding spots
        # They'll encounter traps during emergence forays
        sorted_spots = sorted(hiding_spots, key=lambda x: -x[2])  # Sort by quality

        for spot in sorted_spots[:num_traps]:
            # Place trap 10-20m from hiding spot (on patrol route)
            angle = random.uniform(0, 2 * math.pi)
            offset_m = random.uniform(10, 20)

            lat_offset = offset_m / 111000 * math.cos(angle)
            lon_offset = offset_m / (111000 * math.cos(math.radians(spot[0]))) * math.sin(angle)

            placements.append((spot[0] + lat_offset, spot[1] + lon_offset))

    else:
        # Dogs: Use sightings to predict travel corridors
        if sightings and len(sightings) >= 2:
            # Place along apparent travel direction
            for i in range(min(num_traps, len(sightings))):
                sight = sightings[-(i+1)]  # Most recent first
                placements.append(sight.location)
        else:
            # Default: Expanding circle from last known
            for i in range(num_traps):
                angle = 2 * math.pi * i / num_traps
                radius_m = 100 + i * 50

                lat_offset = radius_m / 111000 * math.cos(angle)
                lon_offset = radius_m / (111000 * math.cos(math.radians(last_known_position[0]))) * math.sin(angle)

                placements.append((
                    last_known_position[0] + lat_offset,
                    last_known_position[1] + lon_offset
                ))

    return placements[:num_traps]

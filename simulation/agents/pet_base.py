"""
Base Pet Agent for Monte Carlo Simulation

Provides common functionality for dog and cat agents.
Based on BEHAVIORAL_PROFILES.md core framework.
"""

import math
import random
from abc import ABC, abstractmethod
from typing import Tuple, Optional, Dict, Any, List
from dataclasses import dataclass, field

from ..core.types import (
    AnimalProfile, AnimalState, AnimalStatus, Species,
    HealthStatus, OutcomeType
)
from ..core.constants import (
    PHYSIOLOGY_PARAMS, MOVEMENT_SPEEDS, TERRAIN_PARAMS,
    TIME_OF_DAY_ACTIVITY
)
from ..core.utils import (
    haversine, distance, offset_position, direction_to,
    normalize_angle, clamp, exponential_decay, get_time_period,
    calculate_direction_with_noise
)


class PetAgent(ABC):
    """
    Abstract base class for pet agents.

    Implements common physiological dynamics, movement mechanics,
    and state management. Subclasses implement species-specific
    behavioral patterns.
    """

    def __init__(
        self,
        profile: AnimalProfile,
        seed: Optional[int] = None
    ):
        self.profile = profile
        self.rng = random.Random(seed)

        # Initialize state from profile
        escape_params = profile.get_escape_params()
        initial_status = AnimalStatus(escape_params["initial_status"])

        self.state = AnimalState(
            position=profile.escape_location,
            status=initial_status,
            fear_level=escape_params["initial_fear"],
        )

        # Track movement
        self.path: List[Tuple[float, float, float]] = []  # (lat, lon, hour)
        self.total_distance_m = 0.0
        self.max_distance_from_home_m = 0.0

        # Initialize heading (direction of travel)
        self.heading = self.rng.uniform(0, 2 * math.pi)

        # Get species-specific parameters
        self._load_parameters()

    @abstractmethod
    def _load_parameters(self):
        """Load species-specific parameters. Implemented by subclasses."""
        pass

    @abstractmethod
    def update_fear(self, hours_delta: float):
        """Update fear level. Species have different fear dynamics."""
        pass

    @abstractmethod
    def calculate_movement_direction(self, environment: Any) -> float:
        """Calculate direction of movement. Species-specific patterns."""
        pass

    @abstractmethod
    def check_state_transition(self, environment: Any, hour: int) -> Optional[AnimalStatus]:
        """Check if state should transition. Species-specific logic."""
        pass

    def tick(self, hours_delta: float, environment: Any, current_hour: int):
        """
        Execute one simulation tick.

        Updates all state variables and moves the animal.
        """
        # Skip if terminal state
        if self.state.status in [AnimalStatus.RECOVERED, AnimalStatus.DECEASED]:
            return

        # Record position
        self.path.append((
            self.state.position[0],
            self.state.position[1],
            self.state.hours_since_escape
        ))

        # 1. Update time tracking
        self.state.hours_since_escape += hours_delta
        self.state.hours_since_last_water += hours_delta
        self.state.hours_since_last_food += hours_delta
        self.state.time_of_day = current_hour

        # 2. Update physiological state
        self.update_physiology(hours_delta, environment)

        # 3. Update fear (species-specific)
        self.update_fear(hours_delta)

        # 4. Check for state transitions
        new_status = self.check_state_transition(environment, current_hour)
        if new_status:
            self.state.status = new_status

        # 5. Move if in active state
        if self.state.status in [AnimalStatus.FLEEING, AnimalStatus.TRAVELING, AnimalStatus.FORAGING]:
            self.move(hours_delta, environment, current_hour)

        # 6. Check for environmental hazards
        self.check_hazards(hours_delta, environment, current_hour)

    def update_physiology(self, hours_delta: float, environment: Any):
        """Update hunger, thirst, and stamina."""
        params = PHYSIOLOGY_PARAMS

        # Hunger increases
        hunger_rate = params["hunger"]["rate_per_hour"]
        if self.state.status == AnimalStatus.FORAGING:
            # May find food while foraging
            if self.rng.random() < 0.1 * hours_delta:
                self.state.hunger_level = max(0, self.state.hunger_level - params["hunger"]["foraging_relief"])
        self.state.hunger_level = clamp(self.state.hunger_level + hunger_rate * hours_delta, 0, 1)

        # Thirst increases
        thirst_rate = params["thirst"]["rate_per_hour"]
        # Check for water sources in environment
        if environment and hasattr(environment, 'has_water_nearby'):
            if environment.has_water_nearby(self.state.position):
                self.state.thirst_level = max(0, self.state.thirst_level - params["thirst"]["water_relief"])
                self.state.hours_since_last_water = 0
        self.state.thirst_level = clamp(self.state.thirst_level + thirst_rate * hours_delta, 0, 1)

        # Stamina dynamics
        stamina_params = params["stamina"]
        if self.state.status == AnimalStatus.FLEEING:
            drain = stamina_params["drain_rate_fleeing_per_hour"]
            self.state.stamina = max(0, self.state.stamina - drain * hours_delta)
        elif self.state.status == AnimalStatus.TRAVELING:
            drain = stamina_params["drain_rate_traveling_per_hour"]
            self.state.stamina = max(0, self.state.stamina - drain * hours_delta)
        elif self.state.status in [AnimalStatus.RESTING, AnimalStatus.HIDING]:
            recovery = stamina_params["recovery_rate_resting_per_hour"]
            self.state.stamina = min(1, self.state.stamina + recovery * hours_delta)

    def move(self, hours_delta: float, environment: Any, current_hour: int):
        """Move the animal based on current state."""
        # Get base speed for species and state
        species_key = "dog" if self.profile.species == Species.DOG else "cat"
        status_key = self.state.status.value

        base_speed = MOVEMENT_SPEEDS.get(species_key, {}).get(status_key, 1000)  # m/hour

        # Apply modifiers
        speed = base_speed * self.size_speed_modifier * self.age_speed_modifier

        # Stamina affects speed
        speed *= max(0.3, self.state.stamina)

        # Time of day affects activity
        time_period = get_time_period(current_hour)
        activity_mod = TIME_OF_DAY_ACTIVITY.get(species_key, {}).get(time_period, 1.0)
        speed *= activity_mod

        # Calculate direction (species-specific)
        direction = self.calculate_movement_direction(environment)
        self.heading = direction

        # Calculate distance
        distance_m = speed * hours_delta

        # Move
        new_position = offset_position(self.state.position, distance_m, direction, self.rng)

        # Check terrain constraints
        if environment and hasattr(environment, 'is_passable'):
            if not environment.is_passable(new_position):
                # Try to deflect around obstacle
                for deflection in [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]:
                    test_dir = normalize_angle(direction + deflection)
                    test_pos = offset_position(self.state.position, distance_m, test_dir, self.rng)
                    if environment.is_passable(test_pos):
                        new_position = test_pos
                        self.heading = test_dir
                        break
                else:
                    # Blocked - don't move
                    return

        # Update position
        moved_distance = distance(self.state.position, new_position)
        self.state.position = new_position
        self.total_distance_m += moved_distance

        # Track max distance from home
        dist_from_home = distance(self.state.position, self.profile.home_location)
        self.max_distance_from_home_m = max(self.max_distance_from_home_m, dist_from_home)

    def check_hazards(self, hours_delta: float, environment: Any, current_hour: int):
        """Check for environmental hazards (traffic, predators, etc.)."""
        # Get terrain at current position
        terrain_type = "SUBURBAN"  # Default
        if environment and hasattr(environment, 'get_terrain_at'):
            terrain_type = environment.get_terrain_at(self.state.position)

        terrain_params = TERRAIN_PARAMS.get(terrain_type, TERRAIN_PARAMS["SUBURBAN"])

        # Traffic risk (higher when fleeing, lower awareness)
        traffic_risk = terrain_params.get("traffic_risk_per_hour", 0.001)
        if self.state.status == AnimalStatus.FLEEING:
            traffic_risk *= 2.0  # Less aware when panicked

        if self.rng.random() < traffic_risk * hours_delta:
            self.state.status = AnimalStatus.DECEASED
            self.state.death_cause = "traffic"
            return

        # Predator risk
        predator_risk = terrain_params.get("predator_risk_per_hour", 0.0005)
        # Size affects vulnerability
        predator_risk *= self.predator_vulnerability

        if self.rng.random() < predator_risk * hours_delta:
            self.state.status = AnimalStatus.DECEASED
            self.state.death_cause = "predator"
            return

        # Dehydration
        if self.state.hours_since_last_water > 72:  # 3 days
            if self.rng.random() < 0.1 * hours_delta:
                self.state.status = AnimalStatus.DECEASED
                self.state.death_cause = "dehydration"
                return

        # Starvation (much slower)
        if self.state.hours_since_last_food > 168:  # 7 days
            if self.rng.random() < 0.05 * hours_delta:
                self.state.status = AnimalStatus.DECEASED
                self.state.death_cause = "starvation"
                return

    def apply_fear_spike(self, severity: float = 0.3):
        """Apply a fear spike (from threat or failed capture)."""
        self.state.fear_level = clamp(self.state.fear_level + severity, 0, 1)

    def apply_failed_capture(self):
        """Record a failed capture attempt - increases wariness."""
        self.state.failed_capture_count += 1
        self.state.human_wariness = clamp(
            self.state.human_wariness + 0.15,
            0, 0.9
        )
        self.state.last_failed_capture_time = self.state.hours_since_escape
        self.apply_fear_spike(0.4)

        # May trigger flight
        if self.state.fear_level > 0.7:
            self.state.status = AnimalStatus.FLEEING

    def check_self_return(self) -> bool:
        """Check if animal has returned home."""
        dist_to_home = distance(self.state.position, self.profile.home_location)

        if dist_to_home < 50:  # Within 50 meters of home
            # Must have traveled away first
            if self.max_distance_from_home_m < 100:
                return False

            # Probability based on fear and needs
            stay_prob = (1 - self.state.fear_level) * 0.5
            stay_prob += (1 - self.state.stamina) * 0.2
            stay_prob += self.state.hunger_level * 0.15
            stay_prob += self.state.thirst_level * 0.15

            if self.rng.random() < stay_prob:
                self.state.status = AnimalStatus.RECOVERED
                self.state.recovery_method = "self_return"
                return True

        return False

    def is_detectable_by(
        self,
        searcher_pos: Tuple[float, float],
        searcher_type: str,
        is_owner: bool,
        detection_range_m: float,
        current_hour: int
    ) -> Tuple[bool, float]:
        """
        Check if this animal is detectable by a searcher.

        Returns: (detected, distance)
        """
        from ..core.constants import DETECTION_PROBABILITY

        dist = distance(self.state.position, searcher_pos)

        if dist > detection_range_m:
            return False, dist

        # Base detection probability based on temperament
        species_key = "dog" if self.profile.species == Species.DOG else "cat"
        time_period = get_time_period(current_hour)

        if time_period == "night":
            detect_probs = DETECTION_PROBABILITY.get("physical_search_night", {})
        else:
            detect_probs = DETECTION_PROBABILITY.get("physical_search_day", {})

        species_probs = detect_probs.get(species_key, {})
        base_prob = species_probs.get(self.profile.temperament, 0.3)

        # Modify by state
        if self.state.status == AnimalStatus.HIDING:
            base_prob *= 0.2
        elif self.state.status == AnimalStatus.FLEEING:
            base_prob *= 1.3  # Moving, more visible

        # Distance modifier
        dist_factor = 1 - (dist / detection_range_m) * 0.5

        # Owner bonus for calling
        if is_owner:
            base_prob *= 1.3

        final_prob = base_prob * dist_factor

        if self.rng.random() < final_prob:
            return True, dist

        return False, dist

    def get_current_distance_from_home(self) -> float:
        """Get current distance from home in meters."""
        return distance(self.state.position, self.profile.home_location)

    def get_state_snapshot(self) -> Dict[str, Any]:
        """Get a snapshot of current state for logging."""
        return {
            "position": self.state.position,
            "status": self.state.status.value,
            "fear_level": self.state.fear_level,
            "hunger_level": self.state.hunger_level,
            "thirst_level": self.state.thirst_level,
            "stamina": self.state.stamina,
            "hours_since_escape": self.state.hours_since_escape,
            "distance_from_home_m": self.get_current_distance_from_home(),
        }

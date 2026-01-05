"""
Cat Agent for Monte Carlo Simulation

Implements cat-specific behavioral patterns from BEHAVIORAL_PROFILES.md:
- Threshold phenomenon (10-12 day hiding before emergence)
- Triangular patrol patterns during emergence
- Temperament codes: CUR/CL/CAU/X/B
- Indoor/outdoor status affects displacement
"""

import math
from typing import Optional, Any, Tuple

from .pet_base import PetAgent
from ..core.types import (
    AnimalProfile, AnimalState, AnimalStatus, Species,
    CatHidingPhase, IndoorOutdoor
)
from ..core.constants import (
    CAT_TEMPERAMENT_PARAMS, CAT_SIZE_PARAMS, CAT_AGE_PARAMS,
    FEAR_PARAMS, PHYSIOLOGY_PARAMS, DISPLACEMENT_PARAMS,
    TIME_OF_DAY_ACTIVITY
)
from ..core.utils import (
    distance, direction_to, normalize_angle, clamp,
    get_time_period, lognormal_sample, triangular_patrol_direction,
    calculate_direction_with_noise, offset_position
)


class CatAgent(PetAgent):
    """
    Cat agent with species-specific behavioral patterns.

    Key behaviors:
    - Threshold phenomenon: cats hide for extended period before emerging
    - Displacement based on indoor/outdoor status (Huang 2018)
    - Triangular patrol patterns during emergence
    - Crepuscular activity (dawn/dusk)
    """

    def _load_parameters(self):
        """Load cat-specific parameters from profile."""
        # Get temperament parameters
        self.temp_params = CAT_TEMPERAMENT_PARAMS.get(
            self.profile.temperament,
            CAT_TEMPERAMENT_PARAMS["CAU"]  # Default to cautious
        )

        # Get size parameters
        self.size_params = CAT_SIZE_PARAMS.get(
            self.profile.size_class,
            CAT_SIZE_PARAMS["MED"]
        )

        # Get age parameters
        self.age_params = CAT_AGE_PARAMS.get(
            self.profile.age_class,
            CAT_AGE_PARAMS["ADT"]
        )

        # Set modifiers
        self.size_speed_modifier = self.size_params["speed_multiplier"]
        self.age_speed_modifier = self.age_params["speed_multiplier"]
        self.predator_vulnerability = self.size_params["predator_vulnerability"]

        # Threshold phenomenon parameters
        threshold_range = self.temp_params["threshold_days"]
        base_threshold = self.rng.uniform(threshold_range["min"], threshold_range["max"])
        self.threshold_days = base_threshold * self.age_params["threshold_multiplier"]
        self.threshold_hours = self.threshold_days * 24

        # Initialize hiding phase
        self.state.hiding_phase = CatHidingPhase.DEEP
        self.state.threshold_reached = False

        # Displacement parameters based on indoor/outdoor status
        io_status = self.profile.indoor_outdoor or "IO"
        if io_status in ["IO", "IOP"]:
            self.displacement_params = DISPLACEMENT_PARAMS["cat"]["indoor_only"]
        else:
            self.displacement_params = DISPLACEMENT_PARAMS["cat"]["indoor_outdoor"]

        # Calculate max displacement for this cat
        self.max_displacement = lognormal_sample(
            self.displacement_params["median_m"],
            self.displacement_params["q75_m"],
            self.rng
        )

        # Patrol pattern state
        self.patrol_angle = self.rng.uniform(0, 2 * math.pi)
        self.patrol_radius = 20  # Starts small, expands
        self.hiding_spot: Optional[Tuple[float, float]] = None

    def update_fear(self, hours_delta: float):
        """
        Update fear level using threshold phenomenon.

        Cats: Fear remains high during initial hiding phase (DEEP).
        After threshold reached (typically 10-12 days), fear begins
        to decay and cat enters EMERGENCE phase.
        """
        fear_params = FEAR_PARAMS["cat"]

        if not self.state.threshold_reached:
            # Check if threshold reached
            if self.state.hours_since_escape >= self.threshold_hours:
                self.state.threshold_reached = True
                self.state.hiding_phase = CatHidingPhase.EMERGENCE
                # Set hiding spot as current position
                self.hiding_spot = self.state.position

            # Pre-threshold: minimal fear decay
            decay_rate = fear_params["pre_threshold_decay_rate"]
        else:
            # Post-threshold: normal fear decay
            decay_rate = fear_params["post_threshold_decay_rate"]

        # Apply decay
        self.state.fear_level *= (1 - decay_rate * hours_delta)

        # Minimum fear floor (cats stay somewhat wary)
        min_fear = 0.1 if self.state.threshold_reached else 0.4
        self.state.fear_level = max(min_fear, self.state.fear_level)

    def calculate_movement_direction(self, environment: Any) -> float:
        """
        Calculate movement direction for cats.

        During DEEP hiding: minimal movement, stay concealed
        During EMERGENCE: triangular patrol pattern from hiding spot
        """
        if self.state.status == AnimalStatus.FLEEING:
            # Flee away from threat/escape point, then hide
            direction_away = direction_to(
                self.profile.escape_location,
                self.state.position
            )

            # Cats flee more erratically than dogs
            noise_std = math.pi / 4 * self.state.fear_level
            direction = calculate_direction_with_noise(direction_away, noise_std, self.rng)

            # Cats don't flee far - limit by displacement
            dist_from_escape = distance(self.state.position, self.profile.escape_location)
            if dist_from_escape > self.max_displacement * 0.3:
                # Start curving toward hiding
                hiding_bias = direction_to(
                    self.state.position,
                    self.profile.escape_location
                ) + math.pi / 2  # Perpendicular
                direction = normalize_angle(direction * 0.7 + hiding_bias * 0.3)

        elif self.state.status == AnimalStatus.FORAGING:
            if self.state.threshold_reached and self.hiding_spot:
                # Triangular patrol from hiding spot
                new_pos, new_angle = triangular_patrol_direction(
                    self.state.position,
                    self.hiding_spot,
                    self.patrol_radius,
                    self.patrol_angle,
                    self.rng
                )
                self.patrol_angle = new_angle

                # Direction toward patrol point
                direction = direction_to(self.state.position, new_pos)

                # Gradually expand patrol radius
                self.patrol_radius = min(200, self.patrol_radius * 1.01)
            else:
                # Pre-threshold: stay close to hiding spot
                if self.hiding_spot:
                    dist_from_spot = distance(self.state.position, self.hiding_spot)
                    if dist_from_spot > 30:
                        # Return toward hiding spot
                        direction = direction_to(self.state.position, self.hiding_spot)
                    else:
                        # Small random movements
                        direction = self.rng.uniform(0, 2 * math.pi)
                else:
                    direction = self.rng.uniform(0, 2 * math.pi)

        elif self.state.status == AnimalStatus.TRAVELING:
            # Cats rarely travel far - stay near hiding spot
            if self.hiding_spot:
                direction = direction_to(self.state.position, self.hiding_spot)
                # Add noise
                direction = calculate_direction_with_noise(direction, math.pi / 6, self.rng)
            else:
                direction = self.heading

        else:
            # Hiding/resting - no movement direction needed
            direction = self.heading

        return direction

    def check_state_transition(self, environment: Any, hour: int) -> Optional[AnimalStatus]:
        """
        Check and execute state transitions for cats.

        Cats are primarily driven by:
        - Threshold phenomenon (deep hiding → emergence)
        - Crepuscular activity patterns
        - Extreme caution (high fear tolerance for hiding)
        """
        current_status = self.state.status
        time_period = get_time_period(hour)
        is_crepuscular = time_period in ["dawn", "dusk"]

        if current_status == AnimalStatus.FLEEING:
            # Cats flee briefly then hide
            # Indoor cats especially - they tire quickly
            is_indoor = self.profile.indoor_outdoor in ["IO", "IOP", None]

            if is_indoor:
                max_flee_hours = 0.5  # Indoor cats stop fleeing very quickly
            else:
                max_flee_hours = 2.0  # Outdoor cats may flee longer

            if self.state.hours_since_escape > max_flee_hours:
                return AnimalStatus.HIDING

            # Also stop if exhausted
            if self.state.stamina < 0.2:
                return AnimalStatus.HIDING

            # Or if found good hiding spot
            if environment and hasattr(environment, 'get_hiding_quality'):
                hiding_quality = environment.get_hiding_quality(self.state.position)
                if hiding_quality > 0.7 and self.rng.random() < 0.3:
                    self.hiding_spot = self.state.position
                    return AnimalStatus.HIDING

        elif current_status == AnimalStatus.HIDING:
            # The heart of cat behavior - threshold phenomenon
            if not self.state.threshold_reached:
                # Deep hiding phase - very reluctant to emerge
                # Only extreme need forces emergence
                if self.state.thirst_level > 0.9 and is_crepuscular:
                    emergence_prob = self.temp_params["emergence_probability"] * 0.3
                    if self.rng.random() < emergence_prob:
                        return AnimalStatus.FORAGING
            else:
                # Post-threshold - gradually more willing to emerge
                if is_crepuscular:
                    # Much more likely during dawn/dusk
                    emergence_prob = self.temp_params["emergence_probability"]

                    # Needs drive emergence
                    needs_factor = (self.state.hunger_level + self.state.thirst_level) / 2

                    if self.rng.random() < emergence_prob * needs_factor:
                        return AnimalStatus.FORAGING

        elif current_status == AnimalStatus.FORAGING:
            # Return to hiding if:
            # - Not crepuscular time
            # - Fear spike
            # - Needs satisfied

            if not is_crepuscular:
                # Strong tendency to hide during day
                if self.rng.random() < 0.3:
                    return AnimalStatus.HIDING

            if self.state.fear_level > 0.7:
                return AnimalStatus.HIDING

            # Needs satisfied
            if self.state.hunger_level < 0.3 and self.state.thirst_level < 0.3:
                return AnimalStatus.HIDING

            # Check distance from hiding spot
            if self.hiding_spot:
                dist = distance(self.state.position, self.hiding_spot)
                if dist > self.patrol_radius * 1.5:
                    # Too far, return
                    return AnimalStatus.HIDING

        elif current_status == AnimalStatus.RESTING:
            # Cats rest is essentially hiding
            return AnimalStatus.HIDING

        elif current_status == AnimalStatus.TRAVELING:
            # Cats rarely travel - usually means returning to hiding spot
            if self.hiding_spot:
                dist = distance(self.state.position, self.hiding_spot)
                if dist < 10:
                    return AnimalStatus.HIDING

        return None

    def responds_to_calling(self, caller_is_owner: bool) -> bool:
        """
        Check if cat responds to calling.

        Cats are much less likely than dogs to respond.
        """
        if self.state.status in [AnimalStatus.RECOVERED, AnimalStatus.DECEASED]:
            return False

        # Cats rarely respond to calling, especially when stressed
        if not self.state.threshold_reached:
            # Pre-threshold: almost never responds
            base_prob = 0.02 if caller_is_owner else 0.001
        else:
            # Post-threshold: slightly more likely
            if caller_is_owner:
                base_prob = self.temp_params.get("approach_owner_prob", 0.3) * 0.3
            else:
                base_prob = self.temp_params.get("approach_stranger_prob", 0.1) * 0.1

        # Fear heavily reduces response
        fear_modifier = (1 - self.state.fear_level) ** 2

        # Crepuscular bonus
        time_period = get_time_period(self.state.time_of_day)
        if time_period in ["dawn", "dusk"]:
            fear_modifier *= 1.5

        final_prob = base_prob * fear_modifier

        return self.rng.random() < final_prob

    def can_be_trapped(self, trap_effectiveness: float) -> bool:
        """
        Check if cat enters and is captured by trap.

        Cats require more patience with traps.
        """
        # Base trap susceptibility from temperament
        base_prob = self.temp_params["trap_susceptibility"]

        # Threshold affects trap response
        if not self.state.threshold_reached:
            # Pre-threshold: very unlikely to approach trap
            base_prob *= 0.2
        else:
            # Post-threshold: more likely as emergence progresses
            days_since_threshold = (
                self.state.hours_since_escape - self.threshold_hours
            ) / 24
            emergence_factor = min(1.5, 1 + days_since_threshold * 0.1)
            base_prob *= emergence_factor

        # Hunger increases trap interest
        hunger_bonus = self.state.hunger_level * 0.4

        # Fear reduces approach
        fear_penalty = self.state.fear_level * 0.6

        # Must be crepuscular time
        time_period = get_time_period(self.state.time_of_day)
        if time_period not in ["dawn", "dusk"]:
            base_prob *= 0.3

        # Trap wariness
        trap_id = "current_trap"
        wariness = self.state.trap_wariness.get(trap_id, 0)

        # Calculate probability
        capture_prob = (base_prob + hunger_bonus - fear_penalty) * (1 - wariness) * trap_effectiveness

        if self.rng.random() < capture_prob:
            return True

        # Record visit (cats learn quickly about traps)
        self.state.trap_wariness[trap_id] = min(0.9, wariness + 0.15)
        return False

    def get_displacement_estimate(self) -> dict:
        """
        Get estimated displacement for this cat based on profile.

        Returns median and q75 in meters based on indoor/outdoor status.
        """
        return {
            "median_m": self.displacement_params["median_m"],
            "q75_m": self.displacement_params["q75_m"],
            "individual_max_m": self.max_displacement,
        }

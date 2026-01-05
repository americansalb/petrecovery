"""
Dog Agent for Monte Carlo Simulation

Implements dog-specific behavioral patterns from BEHAVIORAL_PROFILES.md:
- FDM/DIR gravity spiral movement
- Continuous exponential fear decay
- Temperament codes: G/C/A/X/B
"""

import math
from typing import Optional, Any

from .pet_base import PetAgent
from ..core.types import (
    AnimalProfile, AnimalStatus, Species
)
from ..core.constants import (
    DOG_TEMPERAMENT_PARAMS, DOG_SIZE_PARAMS, DOG_AGE_PARAMS,
    FEAR_PARAMS, PHYSIOLOGY_PARAMS
)
from ..core.utils import (
    distance, direction_to, normalize_angle, clamp,
    exponential_decay, get_time_period, spiral_gravity_direction,
    calculate_direction_with_noise
)


class DogAgent(PetAgent):
    """
    Dog agent with species-specific behavioral patterns.

    Key behaviors:
    - FDM/DIR (Fear-Distance-Movement/Direction) gravity spiral
    - Continuous exponential fear decay
    - Strong homing instinct (varies by temperament)
    - Responsive to owner calling
    """

    def _load_parameters(self):
        """Load dog-specific parameters from profile."""
        # Get temperament parameters
        self.temp_params = DOG_TEMPERAMENT_PARAMS.get(
            self.profile.temperament,
            DOG_TEMPERAMENT_PARAMS["A"]  # Default to aloof
        )

        # Get size parameters
        self.size_params = DOG_SIZE_PARAMS.get(
            self.profile.size_class,
            DOG_SIZE_PARAMS["MED"]
        )

        # Get age parameters
        self.age_params = DOG_AGE_PARAMS.get(
            self.profile.age_class,
            DOG_AGE_PARAMS["ADT"]
        )

        # Set modifiers
        self.size_speed_modifier = self.size_params["speed_multiplier"]
        self.age_speed_modifier = self.age_params["speed_multiplier"]
        self.predator_vulnerability = self.size_params["predator_vulnerability"]

        # Fear dynamics
        self.fear_decay_rate = (
            FEAR_PARAMS["dog"]["base_decay_rate_per_hour"] *
            self.temp_params["fear_decay_rate"] *
            self.age_params["fear_decay_multiplier"]
        )

        # Homing instinct
        self.homing_instinct = self.age_params["homing_instinct"]

        # Flight distance (how far before stopping to assess)
        fd = self.temp_params["flight_distance_m"]
        self.flight_distance = self.rng.uniform(fd["min"], fd["max"])

    def update_fear(self, hours_delta: float):
        """
        Update fear level using continuous exponential decay.

        Dogs: Fear decays continuously from the moment of escape.
        Half-life approximately 35 hours (varies by temperament).
        """
        # Exponential decay: fear(t) = fear(0) * e^(-λt)
        decay = exponential_decay(1.0, self.fear_decay_rate, hours_delta)
        self.state.fear_level *= decay

        # Minimum fear floor
        self.state.fear_level = max(0.05, self.state.fear_level)

    def calculate_movement_direction(self, environment: Any) -> float:
        """
        Calculate movement direction using FDM/DIR gravity spiral.

        The gravity spiral creates the characteristic "curving back"
        pattern observed in lost dogs. Initially flee away from home,
        but gradually curve back as fear decreases.
        """
        if self.state.status == AnimalStatus.FLEEING:
            # During flee: primarily away from escape point
            # with some random wandering
            direction_away = direction_to(
                self.profile.escape_location,
                self.state.position
            )

            # Add noise based on fear (high fear = more erratic)
            noise_std = math.pi / 6 * self.state.fear_level
            direction = calculate_direction_with_noise(direction_away, noise_std, self.rng)

        elif self.state.status == AnimalStatus.TRAVELING:
            # Use gravity spiral - gradually curves toward home
            direction = spiral_gravity_direction(
                current_pos=self.state.position,
                home_pos=self.profile.home_location,
                escape_pos=self.profile.escape_location,
                hours_since_escape=self.state.hours_since_escape,
                fear_level=self.state.fear_level,
                rng=self.rng
            )

        elif self.state.status == AnimalStatus.FORAGING:
            # Local exploration with bias toward home
            home_direction = direction_to(self.state.position, self.profile.home_location)

            # Random exploration with slight home bias
            random_dir = self.rng.uniform(0, 2 * math.pi)
            home_weight = 0.2 * self.homing_instinct * (1 - self.state.fear_level)

            # Blend directions
            direction = normalize_angle(
                random_dir * (1 - home_weight) +
                home_direction * home_weight
            )

        else:
            # Default: continue current heading with some drift
            direction = calculate_direction_with_noise(
                self.heading,
                math.pi / 8,
                self.rng
            )

        return direction

    def check_state_transition(self, environment: Any, hour: int) -> Optional[AnimalStatus]:
        """
        Check and execute state transitions for dogs.

        Dogs transition based on:
        - Fear level (primary driver)
        - Stamina (exhaustion)
        - Time of day
        - Distance traveled
        """
        current_status = self.state.status

        if current_status == AnimalStatus.FLEEING:
            # Transition to traveling when:
            # 1. Exhausted (stamina depleted)
            if self.state.stamina < PHYSIOLOGY_PARAMS["stamina"]["exhaustion_threshold"]:
                return AnimalStatus.HIDING

            # 2. Fear has dropped below threshold
            fear_threshold = 0.5 * self.temp_params["fear_decay_rate"]
            if self.state.fear_level < fear_threshold:
                return AnimalStatus.TRAVELING

            # 3. Traveled beyond flight distance
            dist_from_escape = distance(self.state.position, self.profile.escape_location)
            if dist_from_escape > self.flight_distance:
                # Probability increases with distance
                transition_prob = (dist_from_escape - self.flight_distance) / self.flight_distance * 0.1
                if self.rng.random() < transition_prob:
                    return AnimalStatus.TRAVELING

        elif current_status == AnimalStatus.TRAVELING:
            # Check if should stop and hide/rest
            if self.state.stamina < 0.3:
                return AnimalStatus.RESTING

            # High fear triggers fleeing
            if self.state.fear_level > 0.8:
                return AnimalStatus.FLEEING

            # Low fear + needs = foraging
            if self.state.fear_level < 0.4:
                if self.state.hunger_level > 0.5 or self.state.thirst_level > 0.4:
                    time_period = get_time_period(hour)
                    # Dogs forage more during day
                    if time_period in ["dawn", "morning", "afternoon", "dusk"]:
                        if self.rng.random() < 0.2:
                            return AnimalStatus.FORAGING

        elif current_status == AnimalStatus.HIDING:
            # Dogs don't hide as long as cats
            # Emerge when fear decreases
            if self.state.fear_level < 0.3 and self.state.stamina > 0.5:
                return AnimalStatus.TRAVELING

            # High needs drive emergence
            if self.state.hunger_level > 0.7 or self.state.thirst_level > 0.6:
                if self.state.fear_level < 0.6:
                    return AnimalStatus.FORAGING

        elif current_status == AnimalStatus.RESTING:
            # Rested enough, resume travel
            if self.state.stamina > 0.6:
                if self.state.fear_level < 0.4:
                    return AnimalStatus.TRAVELING
                elif self.state.hunger_level > 0.6:
                    return AnimalStatus.FORAGING

        elif current_status == AnimalStatus.FORAGING:
            # Return to traveling or hiding
            if self.state.fear_level > 0.6:
                return AnimalStatus.HIDING

            # Needs satisfied, resume travel
            if self.state.hunger_level < 0.3 and self.state.thirst_level < 0.3:
                if self.rng.random() < 0.3:
                    return AnimalStatus.TRAVELING

        return None

    def responds_to_calling(self, caller_is_owner: bool) -> bool:
        """
        Check if dog responds to calling.

        Dogs with good recall training may respond to owner calling.
        """
        if self.state.status in [AnimalStatus.RECOVERED, AnimalStatus.DECEASED]:
            return False

        # Base response probability
        if caller_is_owner:
            base_prob = self.temp_params["recall_response"]
            # Recall training bonus
            base_prob *= (0.5 + 0.5 * self.profile.recall_training)
        else:
            # Much less likely to respond to strangers
            base_prob = self.temp_params["approach_stranger_prob"] * 0.3

        # Fear reduces response
        fear_modifier = 1 - (self.state.fear_level * 0.7)

        # Human wariness from failed captures
        wariness_modifier = 1 - (self.state.human_wariness * 0.5)

        final_prob = base_prob * fear_modifier * wariness_modifier

        return self.rng.random() < final_prob

    def can_be_trapped(self, trap_effectiveness: float) -> bool:
        """
        Check if dog enters and is captured by trap.
        """
        # Base trap susceptibility from temperament
        base_prob = self.temp_params["trap_susceptibility"]

        # Hunger increases trap interest
        hunger_bonus = self.state.hunger_level * 0.3

        # Fear reduces approach
        fear_penalty = self.state.fear_level * 0.5

        # Trap wariness (if has visited trap before)
        trap_id = "current_trap"  # Would be actual trap ID
        wariness = self.state.trap_wariness.get(trap_id, 0)

        # Calculate probability
        capture_prob = (base_prob + hunger_bonus - fear_penalty) * (1 - wariness) * trap_effectiveness

        if self.rng.random() < capture_prob:
            return True

        # Record visit (increases wariness for next time)
        self.state.trap_wariness[trap_id] = min(0.8, wariness + 0.1)
        return False

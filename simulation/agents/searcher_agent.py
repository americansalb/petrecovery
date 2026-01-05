"""
Searcher Agent for Monte Carlo Simulation

Implements discrete searcher agents from BEHAVIORAL_PROFILES.md Part 11:
- Multiple searcher types (OWNER, VOLUNTEER, PROFESSIONAL, etc.)
- Search strategies (ProfileAware, SightingChaser, etc.)
- Fatigue and dedication modeling
"""

import math
import random
from typing import Optional, Any, Tuple, List, Dict
from dataclasses import dataclass, field
from enum import Enum

from ..core.types import (
    SearcherType, SearchStrategy, SightingReport
)
from ..core.constants import SEARCHER_TYPE_PARAMS
from ..core.utils import (
    distance, direction_to, offset_position, normalize_angle,
    get_time_period, clamp
)


@dataclass
class SearcherState:
    """Runtime state of a searcher."""
    position: Tuple[float, float]
    is_active: bool = False
    current_fatigue: float = 0.0
    hours_searched_today: float = 0.0
    total_hours_searched: float = 0.0
    cells_searched: List[Tuple[int, int]] = field(default_factory=list)
    current_target: Optional[Tuple[float, float]] = None
    heading: float = 0.0


class SearcherAgent:
    """
    Individual searcher agent that moves through the environment
    searching for the lost pet.

    Searchers have:
    - A type (owner, volunteer, professional, etc.)
    - A search strategy
    - Fatigue that accumulates and reduces effectiveness
    - Limited hours per day
    """

    def __init__(
        self,
        searcher_id: int,
        searcher_type: SearcherType,
        strategy: SearchStrategy,
        home_position: Tuple[float, float],
        search_radius_m: float,
        is_owner: bool = False,
        seed: Optional[int] = None
    ):
        self.id = searcher_id
        self.searcher_type = searcher_type
        self.strategy = strategy
        self.is_owner = is_owner
        self.home_position = home_position
        self.search_radius_m = search_radius_m
        self.rng = random.Random(seed)

        # Load type-specific parameters
        type_key = searcher_type.value.upper()
        self.params = SEARCHER_TYPE_PARAMS.get(type_key, SEARCHER_TYPE_PARAMS["VOLUNTEER"])

        # Initialize state
        self.state = SearcherState(position=home_position)
        self.state.heading = self.rng.uniform(0, 2 * math.pi)

        # Strategy-specific state
        self.spiral_angle = 0
        self.spiral_radius = 50  # Start 50m from center
        self.grid_x = 0
        self.grid_y = 0
        self.grid_spacing = 100  # 100m grid cells

        # Sighting tracking (for SightingChaser strategy)
        self.known_sightings: List[SightingReport] = []
        self.current_sighting_target: Optional[SightingReport] = None

    def activate(self, current_hour: int):
        """Activate the searcher if conditions are met."""
        # Check if within search hours (typically 7am - 9pm)
        if 7 <= current_hour <= 21:
            self.state.is_active = True

    def deactivate(self):
        """Deactivate the searcher."""
        self.state.is_active = False

    def tick(
        self,
        hours_delta: float,
        environment: Any,
        current_hour: int,
        sightings: List[SightingReport] = None
    ):
        """Execute one simulation tick for this searcher."""
        if not self.state.is_active:
            # Check if should activate
            self.activate(current_hour)
            if not self.state.is_active:
                return

        # Check if exceeded daily hours
        max_hours = self.params["hours_per_day"]
        if self.state.hours_searched_today >= max_hours:
            self.deactivate()
            return

        # Check time of day
        if current_hour < 7 or current_hour > 21:
            self.deactivate()
            return

        # Update fatigue
        fatigue_rate = 1 / (self.params["fatigue_resistance"] * 8)  # Hours to full fatigue
        self.state.current_fatigue = clamp(
            self.state.current_fatigue + fatigue_rate * hours_delta,
            0, 1
        )

        # Update sightings knowledge
        if sightings:
            self.known_sightings = sightings

        # Move according to strategy
        self.move(hours_delta, environment)

        # Update tracking
        self.state.hours_searched_today += hours_delta
        self.state.total_hours_searched += hours_delta

    def move(self, hours_delta: float, environment: Any):
        """Move the searcher according to their strategy."""
        # Calculate speed (affected by fatigue)
        base_speed = 4000  # 4 km/h walking speed in m/h
        fatigue_modifier = 1 - (self.state.current_fatigue * 0.4)
        speed = base_speed * fatigue_modifier

        distance_m = speed * hours_delta

        # Get direction based on strategy
        if self.strategy == SearchStrategy.NAIVE_EXPANDING:
            direction = self._naive_expanding_direction()
        elif self.strategy == SearchStrategy.PROFILE_AWARE:
            direction = self._profile_aware_direction(environment)
        elif self.strategy == SearchStrategy.SIGHTING_CHASER:
            direction = self._sighting_chaser_direction()
        elif self.strategy == SearchStrategy.COORDINATED_GRID:
            direction = self._coordinated_grid_direction()
        elif self.strategy == SearchStrategy.TRAP_FOCUSED:
            direction = self._trap_focused_direction(environment)
        else:
            direction = self._naive_expanding_direction()

        # Move
        new_position = offset_position(self.state.position, distance_m, direction, self.rng)

        # Check bounds
        dist_from_home = distance(new_position, self.home_position)
        if dist_from_home > self.search_radius_m:
            # Bounce back toward center
            direction = direction_to(self.state.position, self.home_position)
            new_position = offset_position(self.state.position, distance_m, direction, self.rng)

        self.state.position = new_position
        self.state.heading = direction

    def _naive_expanding_direction(self) -> float:
        """
        Naive expanding circle strategy.

        Start near escape point and spiral outward.
        Simple but not optimal.
        """
        # Expanding spiral from home
        self.spiral_angle += 0.1
        self.spiral_radius += 5  # Expand 5m per step

        # Cap at search radius
        if self.spiral_radius > self.search_radius_m:
            self.spiral_radius = 50
            self.spiral_angle = self.rng.uniform(0, 2 * math.pi)

        # Calculate target on spiral
        target_lat = self.home_position[0] + (self.spiral_radius / 111000) * math.cos(self.spiral_angle)
        target_lon = self.home_position[1] + (self.spiral_radius / (111000 * math.cos(math.radians(self.home_position[0])))) * math.sin(self.spiral_angle)

        return direction_to(self.state.position, (target_lat, target_lon))

    def _profile_aware_direction(self, environment: Any) -> float:
        """
        Profile-aware search strategy.

        Uses knowledge of pet behavior to search likely areas first:
        - Hiding spots for cats
        - Travel corridors for dogs
        - Water sources
        """
        if not self.state.current_target:
            # Pick a new target based on probability
            self.state.current_target = self._pick_profile_target(environment)

        if self.state.current_target:
            dist = distance(self.state.position, self.state.current_target)
            if dist < 20:  # Reached target
                self.state.current_target = None
                return self._naive_expanding_direction()

            return direction_to(self.state.position, self.state.current_target)

        return self._naive_expanding_direction()

    def _pick_profile_target(self, environment: Any) -> Optional[Tuple[float, float]]:
        """Pick a high-probability target location."""
        # Would query environment for hiding spots, water sources, etc.
        # For now, bias toward areas near home
        angle = self.rng.uniform(0, 2 * math.pi)
        # Bias toward closer areas
        radius = self.rng.triangular(50, 100, self.search_radius_m * 0.5)

        lat = self.home_position[0] + (radius / 111000) * math.cos(angle)
        lon = self.home_position[1] + (radius / (111000 * math.cos(math.radians(self.home_position[0])))) * math.sin(angle)

        return (lat, lon)

    def _sighting_chaser_direction(self) -> float:
        """
        Sighting chaser strategy.

        Prioritize investigating recent sightings.
        """
        if self.known_sightings:
            # Find most recent unvisited sighting
            if not self.current_sighting_target:
                # Sort by timestamp, most recent first
                sorted_sightings = sorted(
                    self.known_sightings,
                    key=lambda s: s.timestamp,
                    reverse=True
                )
                if sorted_sightings:
                    self.current_sighting_target = sorted_sightings[0]

            if self.current_sighting_target:
                dist = distance(self.state.position, self.current_sighting_target.location)
                if dist < 30:
                    # Investigated this sighting
                    self.current_sighting_target = None
                    return self._naive_expanding_direction()

                return direction_to(self.state.position, self.current_sighting_target.location)

        return self._naive_expanding_direction()

    def _coordinated_grid_direction(self) -> float:
        """
        Coordinated grid search strategy.

        Systematic coverage of the area in a grid pattern.
        Multiple searchers would coordinate to avoid overlap.
        """
        # Calculate grid target
        grid_x_offset = self.grid_x * self.grid_spacing
        grid_y_offset = self.grid_y * self.grid_spacing

        target_lat = self.home_position[0] + (grid_y_offset / 111000)
        target_lon = self.home_position[1] + (grid_x_offset / (111000 * math.cos(math.radians(self.home_position[0]))))

        dist = distance(self.state.position, (target_lat, target_lon))

        if dist < 20:
            # Move to next grid cell
            self.grid_x += 1
            if self.grid_x * self.grid_spacing > self.search_radius_m:
                self.grid_x = -int(self.search_radius_m / self.grid_spacing)
                self.grid_y += 1
            if self.grid_y * self.grid_spacing > self.search_radius_m:
                self.grid_y = -int(self.search_radius_m / self.grid_spacing)

        return direction_to(self.state.position, (target_lat, target_lon))

    def _trap_focused_direction(self, environment: Any) -> float:
        """
        Trap-focused strategy.

        Check trap locations regularly, otherwise patrol nearby.
        """
        # Would check trap locations from environment
        # For now, similar to profile-aware but with trap checks
        return self._profile_aware_direction(environment)

    def check_detection(
        self,
        pet_position: Tuple[float, float],
        pet_status: str,
        current_hour: int
    ) -> Tuple[bool, float]:
        """
        Check if this searcher detects the pet.

        Returns (detected, distance)
        """
        dist = distance(self.state.position, pet_position)

        # Get detection range (affected by fatigue)
        base_range = self.params["detection_range_m"]
        fatigue_modifier = 1 - (self.state.current_fatigue * 0.3)
        detection_range = base_range * fatigue_modifier

        # Night reduces range
        if current_hour < 7 or current_hour > 20:
            detection_range *= 0.3

        # Pet state affects visibility
        if pet_status == "hiding":
            detection_range *= 0.3
        elif pet_status == "fleeing":
            detection_range *= 1.2

        if dist <= detection_range:
            # Detection probability based on distance
            detection_prob = 1 - (dist / detection_range) * 0.5

            # Owner gets recall bonus
            if self.is_owner:
                detection_prob += self.params["recall_bonus"]

            if self.rng.random() < detection_prob:
                return True, dist

        return False, dist

    def attempt_capture(
        self,
        pet_agent: Any,
        distance_m: float
    ) -> bool:
        """
        Attempt to capture the detected pet.

        Returns True if capture successful.
        """
        from ..core.utils import calculate_capture_probability

        capture_prob = calculate_capture_probability(
            animal_state=pet_agent.state,
            animal_profile=pet_agent.profile,
            searcher_type=self.searcher_type.value.upper(),
            is_owner=self.is_owner,
            distance_m=distance_m,
            time_of_day=get_time_period(self.state.hours_searched_today % 24),
            rng=self.rng
        )

        if self.rng.random() < capture_prob:
            return True

        # Failed capture
        pet_agent.apply_failed_capture()
        return False

    def reset_daily(self):
        """Reset daily state (call at start of each day)."""
        self.state.hours_searched_today = 0
        self.state.current_fatigue = max(0, self.state.current_fatigue - 0.8)

    def get_state_snapshot(self) -> Dict[str, Any]:
        """Get snapshot of current state."""
        return {
            "id": self.id,
            "type": self.searcher_type.value,
            "position": self.state.position,
            "is_active": self.state.is_active,
            "fatigue": self.state.current_fatigue,
            "hours_today": self.state.hours_searched_today,
            "total_hours": self.state.total_hours_searched,
        }


def create_search_team(
    num_searchers: int,
    home_position: Tuple[float, float],
    search_radius_m: float,
    include_owner: bool = True,
    seed: Optional[int] = None
) -> List[SearcherAgent]:
    """
    Create a team of searchers with appropriate types and strategies.
    """
    rng = random.Random(seed)
    searchers = []

    for i in range(num_searchers):
        if i == 0 and include_owner:
            # First searcher is always the owner
            searcher = SearcherAgent(
                searcher_id=i,
                searcher_type=SearcherType.OWNER,
                strategy=SearchStrategy.PROFILE_AWARE,
                home_position=home_position,
                search_radius_m=search_radius_m,
                is_owner=True,
                seed=rng.randint(0, 1000000)
            )
        elif i == 1:
            # Second searcher is typically household member
            searcher = SearcherAgent(
                searcher_id=i,
                searcher_type=SearcherType.HOUSEHOLD,
                strategy=SearchStrategy.SIGHTING_CHASER,
                home_position=home_position,
                search_radius_m=search_radius_m,
                is_owner=False,
                seed=rng.randint(0, 1000000)
            )
        else:
            # Additional searchers are volunteers
            searcher = SearcherAgent(
                searcher_id=i,
                searcher_type=SearcherType.VOLUNTEER,
                strategy=rng.choice([
                    SearchStrategy.NAIVE_EXPANDING,
                    SearchStrategy.COORDINATED_GRID,
                    SearchStrategy.SIGHTING_CHASER
                ]),
                home_position=home_position,
                search_radius_m=search_radius_m,
                is_owner=False,
                seed=rng.randint(0, 1000000)
            )

        searchers.append(searcher)

    return searchers

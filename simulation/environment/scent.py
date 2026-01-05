"""
Scent Article Mechanics for Pet Recovery Simulation

Implements scent article placement, wind effects, and pet detection
based on BEHAVIORAL_PROFILES.md specifications.
"""

import math
import random
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

from ..core.constants import SCENT_ARTICLE_PARAMS, WIND_EFFECTS


class ScentArticleType(Enum):
    WORN_CLOTHING = "worn_clothing"
    BEDDING = "bedding"
    LITTER_BOX = "litter_box"  # Cat only
    TOY = "toy"
    FOOD_BOWL = "food_bowl"


class WindCondition(Enum):
    CALM = "calm"        # 0-5 mph / 0-8 km/h
    LIGHT = "light"      # 5-10 mph / 8-16 km/h
    MODERATE = "moderate"  # 10-20 mph / 16-32 km/h
    STRONG = "strong"    # 20+ mph / 32+ km/h


@dataclass
class ScentArticleState:
    """Runtime state of a scent article."""
    article_id: str
    location: Tuple[float, float]
    article_type: ScentArticleType
    placed_at_hour: float = 0.0
    effectiveness: float = 1.0
    duration_hours: float = 48.0
    is_depleted: bool = False
    owner_scent_strength: float = 1.0  # Fresh = 1.0, degrades over time


@dataclass
class WindState:
    """Current wind conditions."""
    speed_mps: float = 0.0  # meters per second
    direction: float = 0.0  # degrees, 0 = North, 90 = East
    condition: WindCondition = WindCondition.CALM

    @classmethod
    def from_speed_mps(cls, speed_mps: float, direction: float = 0.0) -> "WindState":
        """Create wind state from speed in meters per second."""
        # Convert m/s to mph for condition classification
        speed_mph = speed_mps * 2.237

        if speed_mph < 5:
            condition = WindCondition.CALM
        elif speed_mph < 10:
            condition = WindCondition.LIGHT
        elif speed_mph < 20:
            condition = WindCondition.MODERATE
        else:
            condition = WindCondition.STRONG

        return cls(speed_mps=speed_mps, direction=direction, condition=condition)


class ScentArticleManager:
    """
    Manages scent article placement and detection mechanics.

    Key mechanics:
    - Scent effectiveness degrades over time
    - Wind affects scent dispersal direction and range
    - Different article types have different effectiveness
    - Species-specific detection ranges
    """

    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed)
        self.articles: Dict[str, ScentArticleState] = {}
        self.article_counter = 0
        self.wind: WindState = WindState()

    def set_wind(self, speed_mps: float, direction: float):
        """Update current wind conditions."""
        self.wind = WindState.from_speed_mps(speed_mps, direction)

    def place_article(
        self,
        location: Tuple[float, float],
        article_type: ScentArticleType,
        current_hour: float = 0.0,
        scent_strength: float = 1.0
    ) -> str:
        """Place a scent article and return its ID."""
        self.article_counter += 1
        article_id = f"scent_{self.article_counter}"

        params = SCENT_ARTICLE_PARAMS.get(article_type.value, {})

        self.articles[article_id] = ScentArticleState(
            article_id=article_id,
            location=location,
            article_type=article_type,
            placed_at_hour=current_hour,
            effectiveness=params.get("effectiveness", 1.0),
            duration_hours=params.get("duration_hours", 48.0),
            owner_scent_strength=scent_strength,
        )

        return article_id

    def update_degradation(self, hours_delta: float, current_hour: float):
        """Update scent effectiveness over time."""
        for article in self.articles.values():
            if article.is_depleted:
                continue

            hours_active = current_hour - article.placed_at_hour

            # Linear degradation over duration
            remaining_fraction = max(0, 1 - hours_active / article.duration_hours)
            article.owner_scent_strength = remaining_fraction

            if article.owner_scent_strength <= 0:
                article.is_depleted = True

    def calculate_detection_zone(
        self,
        article: ScentArticleState
    ) -> Tuple[float, float, float]:
        """
        Calculate the scent detection zone for an article.

        Returns: (base_radius_m, effective_radius_m, downwind_direction)

        Wind effects:
        - Calm: 360-degree detection
        - Light/Moderate/Strong: Elongated cone downwind
        """
        # Base detection radius (species can detect from ~50m in ideal conditions)
        base_radius = 50  # meters

        # Modify by article effectiveness and current scent strength
        effective_base = base_radius * article.effectiveness * article.owner_scent_strength

        # Apply wind effects
        wind_params = WIND_EFFECTS.get(self.wind.condition.value, {})
        radius_mult = wind_params.get("radius_multiplier", 1.0)

        effective_radius = effective_base * radius_mult

        # Downwind direction (opposite of where wind is coming from)
        # Wind direction is where it's coming FROM, scent travels TO downwind
        downwind_direction = (self.wind.direction + 180) % 360

        return (effective_base, effective_radius, downwind_direction)

    def is_in_detection_zone(
        self,
        pet_position: Tuple[float, float],
        article: ScentArticleState,
        species: str
    ) -> Tuple[bool, float]:
        """
        Check if a pet is within the scent detection zone.

        Returns: (is_detected: bool, detection_strength: 0-1)
        """
        if article.is_depleted:
            return (False, 0.0)

        # Calculate distance
        lat_diff = (pet_position[0] - article.location[0]) * 111000
        lon_diff = (pet_position[1] - article.location[1]) * 111000 * math.cos(math.radians(article.location[0]))
        distance = math.sqrt(lat_diff**2 + lon_diff**2)

        base_radius, effective_radius, downwind_dir = self.calculate_detection_zone(article)

        # Check if within base radius (always detectable)
        if distance <= base_radius:
            strength = 1.0 - (distance / base_radius) * 0.5
            return (True, strength)

        # Check if within extended downwind zone
        if distance <= effective_radius:
            # Calculate angle from article to pet
            angle_to_pet = math.degrees(math.atan2(lon_diff, lat_diff)) % 360

            # Get the downwind cone angle
            wind_params = WIND_EFFECTS.get(self.wind.condition.value, {})
            cone_angle = wind_params.get("downwind_angle", 360)

            # Check if pet is within downwind cone
            angle_diff = abs(angle_to_pet - downwind_dir)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff

            if cone_angle >= 360 or angle_diff <= cone_angle / 2:
                # Within cone - calculate strength based on distance
                strength = 0.5 * (1 - (distance - base_radius) / (effective_radius - base_radius))
                return (True, max(0.1, strength))

        return (False, 0.0)

    def get_attraction_vector(
        self,
        pet_position: Tuple[float, float],
        species: str
    ) -> Optional[Tuple[float, float, float]]:
        """
        Get the attraction vector toward detected scent.

        Returns: (direction_degrees, attraction_strength, article_id) or None
        """
        best_attraction = None
        best_strength = 0.0

        for article_id, article in self.articles.items():
            is_detected, strength = self.is_in_detection_zone(pet_position, article, species)

            if is_detected and strength > best_strength:
                # Calculate direction to article
                lat_diff = (article.location[0] - pet_position[0]) * 111000
                lon_diff = (article.location[1] - pet_position[1]) * 111000 * math.cos(math.radians(pet_position[0]))

                direction = math.degrees(math.atan2(lon_diff, lat_diff)) % 360

                best_attraction = (direction, strength, article_id)
                best_strength = strength

        return best_attraction

    def pet_response_to_scent(
        self,
        pet_profile: Any,
        pet_state: Any,
        detection_strength: float,
        rng: Optional[random.Random] = None
    ) -> Dict[str, Any]:
        """
        Determine how a pet responds to detected scent.

        Response depends on:
        - Species
        - Temperament
        - Fear level
        - Time since escape
        """
        if rng is None:
            rng = self.rng

        species = pet_profile.species.value
        temperament = pet_profile.temperament
        fear = pet_state.fear_level

        response = {
            "attracted": False,
            "investigate": False,
            "approach_home": False,
            "strength_modifier": 1.0,
        }

        # Base attraction probability (higher detection = more attraction)
        base_attraction = detection_strength * 0.7

        # Modify by temperament
        if species == "dog":
            if temperament == "G":
                base_attraction *= 1.3  # Gregarious dogs love familiar scents
            elif temperament == "B":
                base_attraction *= 1.2  # Bonded dogs respond to owner scent
            elif temperament == "X":
                base_attraction *= 0.8  # Xenophobic still cautious
        else:  # cat
            if temperament == "CUR":
                base_attraction *= 1.2
            elif temperament == "B":
                base_attraction *= 1.1
            elif temperament == "X":
                base_attraction *= 0.5  # Xenophobic cats very cautious

        # Fear reduces attraction response
        fear_penalty = 1 - fear * 0.4
        base_attraction *= fear_penalty

        # Roll for attraction
        if rng.random() < base_attraction:
            response["attracted"] = True

            # Will they investigate?
            investigate_prob = base_attraction * 0.8
            if rng.random() < investigate_prob:
                response["investigate"] = True

                # Will they approach/return home?
                # This is a big decision - only high bond + low fear
                if species == "dog":
                    approach_prob = 0.3 if temperament == "G" else 0.2
                    if temperament == "B" and fear < 0.5:
                        approach_prob = 0.5
                else:  # cat
                    approach_prob = 0.1  # Cats rarely self-return to scent
                    if temperament in ["CUR", "CL"] and fear < 0.3:
                        approach_prob = 0.2

                if rng.random() < approach_prob:
                    response["approach_home"] = True

        response["strength_modifier"] = detection_strength
        return response

    def get_article_status(self, article_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a scent article."""
        if article_id not in self.articles:
            return None

        article = self.articles[article_id]
        base_radius, effective_radius, downwind_dir = self.calculate_detection_zone(article)

        return {
            "article_id": article.article_id,
            "location": article.location,
            "article_type": article.article_type.value,
            "effectiveness": article.effectiveness,
            "scent_strength": article.owner_scent_strength,
            "is_depleted": article.is_depleted,
            "base_radius_m": base_radius,
            "effective_radius_m": effective_radius,
            "downwind_direction": downwind_dir,
        }

    def get_all_article_statuses(self) -> List[Dict[str, Any]]:
        """Get status of all scent articles."""
        return [self.get_article_status(aid) for aid in self.articles]


def optimal_scent_article_placement(
    home_location: Tuple[float, float],
    last_sighting: Optional[Tuple[float, float]],
    wind_direction: float,
    num_articles: int = 3
) -> List[Tuple[float, float, str]]:
    """
    Calculate optimal scent article placement.

    Strategy:
    - Place articles upwind of likely pet locations
    - Cover multiple approach routes
    - Near hiding spots if known

    Returns: List of (lat, lon, recommended_article_type)
    """
    placements = []

    # Primary: Near home in all cardinal directions
    # With wind, prioritize upwind placement (scent carries to pet)
    upwind_dir = wind_direction  # Wind FROM this direction

    for i in range(num_articles):
        if i == 0:
            # Place at home
            placements.append((home_location[0], home_location[1], "bedding"))
        else:
            # Place in expanding pattern, biased upwind
            angle_offset = (i - 1) * 90  # 0, 90, 180, 270 degrees
            angle = (upwind_dir + angle_offset) % 360

            # Distance increases with each article
            distance_m = 50 + i * 25

            lat_offset = distance_m / 111000 * math.cos(math.radians(angle))
            lon_offset = distance_m / (111000 * math.cos(math.radians(home_location[0]))) * math.sin(math.radians(angle))

            article_type = "worn_clothing" if i % 2 == 0 else "toy"
            placements.append((
                home_location[0] + lat_offset,
                home_location[1] + lon_offset,
                article_type
            ))

    return placements[:num_articles]

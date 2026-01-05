"""
Utility functions for Pet Recovery Simulation

Based on BEHAVIORAL_PROFILES.md Part 0 - Utility Functions
"""

import math
import random
from typing import Tuple, Dict, List, Optional, Any


def haversine(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Calculate the great-circle distance between two points on Earth.

    Args:
        coord1: (lat, lon) in degrees
        coord2: (lat, lon) in degrees

    Returns:
        Distance in meters
    """
    R = 6371000  # Earth's radius in meters

    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))

    return R * c


def haversine_meters(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Alias for haversine() - returns distance in meters."""
    return haversine(coord1, coord2)


def distance(pos1: Tuple[float, float], pos2: Tuple[float, float]) -> float:
    """
    Calculate approximate distance between two lat/lon positions in meters.
    Faster than haversine for small distances.
    """
    meters_per_deg = 111000
    dx = (pos2[1] - pos1[1]) * meters_per_deg * math.cos(math.radians(pos1[0]))
    dy = (pos2[0] - pos1[0]) * meters_per_deg
    return math.sqrt(dx*dx + dy*dy)


def direction_to(from_pos: Tuple[float, float], to_pos: Tuple[float, float]) -> float:
    """
    Calculate direction (in radians) from one position to another.

    Returns:
        Angle in radians, 0 = East, π/2 = North
    """
    dx = to_pos[1] - from_pos[1]
    dy = to_pos[0] - from_pos[0]
    return math.atan2(dy, dx)


def normalize_angle(angle: float) -> float:
    """Normalize angle to range [0, 2π)."""
    while angle < 0:
        angle += 2 * math.pi
    while angle >= 2 * math.pi:
        angle -= 2 * math.pi
    return angle


def offset_position(
    position: Tuple[float, float],
    distance_m: float,
    direction: Optional[float] = None,
    rng: Optional[random.Random] = None
) -> Tuple[float, float]:
    """
    Offset a position by a distance in a given direction.

    Args:
        position: (lat, lon) starting position
        distance_m: Distance to offset in meters
        direction: Direction in radians (random if None)
        rng: Random number generator

    Returns:
        New (lat, lon) position
    """
    if direction is None:
        if rng:
            direction = rng.uniform(0, 2 * math.pi)
        else:
            direction = random.uniform(0, 2 * math.pi)

    meters_per_deg_lat = 111000
    meters_per_deg_lon = 111000 * math.cos(math.radians(position[0]))

    dlat = distance_m * math.sin(direction) / meters_per_deg_lat
    dlon = distance_m * math.cos(direction) / meters_per_deg_lon

    return (position[0] + dlat, position[1] + dlon)


def gaussian_1d(x: float, mean: float, std: float) -> float:
    """Calculate 1D Gaussian probability density."""
    if std <= 0:
        return 1.0 if x == mean else 0.0
    coeff = 1.0 / (std * math.sqrt(2 * math.pi))
    exponent = -0.5 * ((x - mean) / std) ** 2
    return coeff * math.exp(exponent)


def lognormal_sample(median: float, q75: float, rng: Optional[random.Random] = None) -> float:
    """
    Sample from a lognormal distribution given median and 75th percentile.

    This matches the displacement distributions from Huang 2018.
    """
    # For lognormal: median = exp(μ), so μ = ln(median)
    # q75 = exp(μ + 0.675σ), so σ = (ln(q75) - μ) / 0.675
    mu = math.log(median)
    sigma = (math.log(q75) - mu) / 0.675

    if rng:
        return rng.lognormvariate(mu, sigma)
    return random.lognormvariate(mu, sigma)


def interpolate_value(value: float, lookup_table: Dict[float, float]) -> float:
    """
    Interpolate a value from a lookup table.
    """
    keys = sorted(lookup_table.keys())

    if value <= keys[0]:
        return lookup_table[keys[0]]
    if value >= keys[-1]:
        return lookup_table[keys[-1]]

    for i in range(len(keys) - 1):
        if keys[i] <= value <= keys[i + 1]:
            t = (value - keys[i]) / (keys[i + 1] - keys[i])
            return lookup_table[keys[i]] * (1 - t) + lookup_table[keys[i + 1]] * t

    return 1.0


def weighted_random_choice(probabilities: Dict[str, float], rng: Optional[random.Random] = None) -> str:
    """
    Make a weighted random choice from a probability distribution.
    """
    choices = list(probabilities.keys())
    weights = list(probabilities.values())

    total = sum(weights)
    if total > 0:
        weights = [w / total for w in weights]
    else:
        weights = [1.0 / len(weights)] * len(weights)

    if rng:
        return rng.choices(choices, weights=weights, k=1)[0]
    return random.choices(choices, weights=weights, k=1)[0]


def get_time_period(hour: int) -> str:
    """Convert hour (0-23) to time period name."""
    if 5 <= hour < 8:
        return "dawn"
    elif 8 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 20:
        return "dusk"
    else:
        return "night"


def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp a value between min and max."""
    return max(min_val, min(max_val, value))


def exponential_decay(initial: float, rate: float, time: float) -> float:
    """Calculate exponential decay: initial * e^(-rate * time)"""
    return initial * math.exp(-rate * time)


def sigmoid(x: float, steepness: float = 1.0) -> float:
    """Standard sigmoid function."""
    return 1.0 / (1.0 + math.exp(-steepness * x))


def calculate_direction_with_noise(
    base_direction: float,
    noise_std: float,
    rng: Optional[random.Random] = None
) -> float:
    """Add Gaussian noise to a direction."""
    if rng:
        noise = rng.gauss(0, noise_std)
    else:
        noise = random.gauss(0, noise_std)
    return normalize_angle(base_direction + noise)


def spiral_gravity_direction(
    current_pos: Tuple[float, float],
    home_pos: Tuple[float, float],
    escape_pos: Tuple[float, float],
    hours_since_escape: float,
    fear_level: float,
    rng: Optional[random.Random] = None
) -> float:
    """
    Calculate FDM/DIR gravity spiral direction for dogs.

    As time passes and fear decreases, the direction gradually curves
    back toward home, creating the characteristic gravity spiral pattern.

    Based on BEHAVIORAL_PROFILES.md dog movement patterns.
    """
    # Direction away from home (initial flight direction)
    away_from_home = direction_to(home_pos, current_pos)

    # Direction toward home
    toward_home = direction_to(current_pos, home_pos)

    # Weight toward home increases as:
    # 1. Time passes (logarithmic)
    # 2. Fear decreases
    # 3. Distance from home increases (eventually must curve back)

    time_factor = math.log(1 + hours_since_escape / 24) / math.log(8)  # Saturates around 7 days
    fear_factor = 1 - fear_level

    home_weight = clamp(time_factor * fear_factor * 0.5, 0, 0.7)
    away_weight = 1 - home_weight

    # Blend directions using vector math
    home_x = math.cos(toward_home) * home_weight
    home_y = math.sin(toward_home) * home_weight
    away_x = math.cos(away_from_home) * away_weight
    away_y = math.sin(away_from_home) * away_weight

    base_direction = math.atan2(home_y + away_y, home_x + away_x)

    # Add perpendicular drift (creates the spiral)
    drift = math.pi / 6 * (0.5 - (rng.random() if rng else random.random()))

    return normalize_angle(base_direction + drift)


def triangular_patrol_direction(
    current_pos: Tuple[float, float],
    hiding_spot: Tuple[float, float],
    patrol_radius_m: float,
    current_angle: float,
    rng: Optional[random.Random] = None
) -> Tuple[float, float]:
    """
    Calculate cat triangular patrol pattern.

    Cats during emergence phase make short forays from hiding spot
    in a triangular pattern, gradually expanding.

    Returns: (new_position, new_angle)
    """
    # Advance angle for triangular pattern (120 degrees apart)
    angle_step = 2 * math.pi / 3
    new_angle = normalize_angle(current_angle + angle_step)

    # Add some randomness to patrol radius
    if rng:
        actual_radius = patrol_radius_m * rng.uniform(0.7, 1.3)
    else:
        actual_radius = patrol_radius_m * random.uniform(0.7, 1.3)

    # Calculate new position
    new_pos = offset_position(hiding_spot, actual_radius, new_angle, rng)

    return new_pos, new_angle


def calculate_capture_probability(
    animal_state: Any,  # AnimalState
    animal_profile: Any,  # AnimalProfile
    searcher_type: str,
    is_owner: bool,
    distance_m: float,
    time_of_day: str,
    rng: Optional[random.Random] = None
) -> float:
    """
    Calculate probability of successful capture given detection.

    Accounts for:
    - Animal temperament
    - Fear level
    - Human wariness (from failed captures)
    - Searcher type
    - Whether searcher is owner
    - Distance
    """
    from .constants import (
        DOG_TEMPERAMENT_PARAMS,
        CAT_TEMPERAMENT_PARAMS,
        SEARCHER_TYPE_PARAMS
    )
    from .types import Species

    # Get temperament params
    if animal_profile.species == Species.DOG:
        temp_params = DOG_TEMPERAMENT_PARAMS.get(animal_profile.temperament, DOG_TEMPERAMENT_PARAMS["A"])
    else:
        temp_params = CAT_TEMPERAMENT_PARAMS.get(animal_profile.temperament, CAT_TEMPERAMENT_PARAMS["CAU"])

    # Base approach probability
    if is_owner:
        base_prob = temp_params.get("approach_owner_prob", 0.5)
        # Add recall training bonus for dogs
        if animal_profile.species == Species.DOG:
            base_prob += animal_profile.recall_training * 0.2
    else:
        base_prob = temp_params.get("approach_stranger_prob", 0.2)

    # Fear reduces approach probability
    fear_factor = 1 - (animal_state.fear_level * 0.8)

    # Human wariness from failed captures
    wariness_factor = 1 - (animal_state.human_wariness * 0.5)

    # Distance factor (closer = higher success)
    distance_factor = max(0.2, 1 - (distance_m / 50))

    # Searcher skill
    searcher_params = SEARCHER_TYPE_PARAMS.get(searcher_type, SEARCHER_TYPE_PARAMS["VOLUNTEER"])
    skill_factor = searcher_params.get("capture_skill", 0.5)

    # Combine factors
    capture_prob = base_prob * fear_factor * wariness_factor * distance_factor * skill_factor

    return clamp(capture_prob, 0.01, 0.95)
